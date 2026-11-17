import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { REGIONS, REGION_INDEX, generateNeurons } from './anatomy.js';
import { buildConnectome, NeuralSim, SIM_HZ, CONNECTIONS, tractControl } from './sim.js';
import { buildShells } from './brain.js';
import { SCENARIOS } from './scenarios.js';

const $ = (id) => document.getElementById(id);
const PANEL_W = 320;

// ---------------------------------------------------------------- Données
const neurons = generateNeurons();
const conn = buildConnectome(neurons);
const sim = new NeuralSim(neurons, conn);
const N = neurons.count;
const P = neurons.positions;
const region = neurons.region;
const regionColors = REGIONS.map((r) => new THREE.Color(r.color));

// ---------------------------------------------------------------- Scène
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#04060c');
const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
camera.position.set(-2.7, 1.0, 2.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 9;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
const HOME_TARGET = new THREE.Vector3(0, -0.15, -0.05);
controls.target.copy(HOME_TARGET);
const targetGoal = HOME_TARGET.clone();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Poussière de fond
{
  const n = 1400, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 8 + Math.random() * 20, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    a.set([r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#3a5585', size: 0.035, transparent: true, opacity: 0.5, depthWrite: false })));
}

const shells = buildShells();
scene.add(shells);

// ---------------------------------------------------------------- Neurones
const pointVS = /* glsl */ `
  attribute vec3 aColor; attribute float aGlow; attribute float aDim;
  uniform float uSize; uniform float uViewport;
  varying vec3 vColor; varying float vGlow; varying float vDim;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (1.0 + 1.6 * aGlow) * projectionMatrix[1][1] * uViewport / -mv.z;
    vColor = aColor; vGlow = aGlow; vDim = aDim;
  }`;
const pointFS = /* glsl */ `
  uniform float uBase; uniform float uFlash;
  varying vec3 vColor; varying float vGlow; varying float vDim;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 1.0, d);
    core *= core;
    vec3 col = mix(vColor, vec3(1.0), vGlow * 0.5);
    float k = (uBase + uFlash * vGlow) * vDim;
    gl_FragColor = vec4(col * k * core, 1.0);
  }`;

function pointMaterial(size, base, flash) {
  return new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uViewport: { value: 800 }, uBase: { value: base }, uFlash: { value: flash } },
    vertexShader: pointVS, fragmentShader: pointFS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

const nColors = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
  const c = regionColors[region[i]];
  nColors[i * 3] = c.r; nColors[i * 3 + 1] = c.g; nColors[i * 3 + 2] = c.b;
}
const dim = new Float32Array(N).fill(1);
const neuronGeo = new THREE.BufferGeometry();
neuronGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
neuronGeo.setAttribute('aColor', new THREE.BufferAttribute(nColors, 3));
const glowAttr = new THREE.BufferAttribute(sim.glow, 1).setUsage(THREE.DynamicDrawUsage);
neuronGeo.setAttribute('aGlow', glowAttr);
const dimAttr = new THREE.BufferAttribute(dim, 1);
neuronGeo.setAttribute('aDim', dimAttr);
const neuronMat = pointMaterial(0.014, 0.1, 1.6);
const neuronPoints = new THREE.Points(neuronGeo, neuronMat);
scene.add(neuronPoints);

// ---------------------------------------------------------------- Connexions
const pos = (i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
const BEZ_SEG = 10;
function bezier(a, c, b, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]];
}
function tractGeometry(filter, maxCount) {
  const list = [];
  for (let i = 0; i < N; i++) {
    for (let s = conn.offsets[i]; s < conn.offsets[i + 1]; s++) {
      if (conn.isLong[s] && filter(i, conn.target[s])) list.push([i, conn.target[s]]);
    }
  }
  const step = Math.max(1, list.length / maxCount);
  const v = [], col = [];
  for (let k = 0; k < list.length; k += step) {
    const [i, j] = list[Math.floor(k)];
    const a = pos(i), b = pos(j), c = tractControl(...a, ...b);
    const ca = regionColors[region[i]], cb = regionColors[region[j]];
    let prev = a;
    for (let q = 1; q <= BEZ_SEG; q++) {
      const t = q / BEZ_SEG, cur = bezier(a, c, b, t);
      v.push(...prev, ...cur);
      const t0 = (q - 1) / BEZ_SEG;
      col.push(ca.r + (cb.r - ca.r) * t0, ca.g + (cb.g - ca.g) * t0, ca.b + (cb.b - ca.b) * t0);
      col.push(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
      prev = cur;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const lineMat = (opacity) => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

const tracts = new THREE.LineSegments(tractGeometry(() => true, 1600), lineMat(0.035));
scene.add(tracts);

let highlight = null;
function setHighlight(r) {
  if (highlight) { scene.remove(highlight); highlight.geometry.dispose(); highlight = null; }
  if (r < 0) return;
  highlight = new THREE.LineSegments(tractGeometry((i, j) => region[i] === r || region[j] === r, 900), lineMat(0.16));
  scene.add(highlight);
}

const localLines = (() => {
  const v = [], col = [];
  for (let i = 0; i < N; i++) {
    for (let s = conn.offsets[i]; s < conn.offsets[i + 1]; s++) {
      if (conn.isLong[s] || Math.random() > 0.5) continue;
      const j = conn.target[s], c = regionColors[region[i]];
      v.push(...pos(i), ...pos(j));
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(g, lineMat(0.04));
})();
localLines.visible = false;
scene.add(localLines);

// ---------------------------------------------------------------- Impulsions
const PCAP = sim.pulses.cap;
const pulsePos = new Float32Array(PCAP * 3), pulseCol = new Float32Array(PCAP * 3);
const pulseGeo = new THREE.BufferGeometry();
const pulsePosAttr = new THREE.BufferAttribute(pulsePos, 3).setUsage(THREE.DynamicDrawUsage);
const pulseColAttr = new THREE.BufferAttribute(pulseCol, 3).setUsage(THREE.DynamicDrawUsage);
pulseGeo.setAttribute('position', pulsePosAttr);
pulseGeo.setAttribute('aColor', pulseColAttr);
pulseGeo.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(PCAP).fill(0), 1));
pulseGeo.setAttribute('aDim', new THREE.BufferAttribute(new Float32Array(PCAP).fill(1), 1));
const pulseMat = pointMaterial(0.018, 0.9, 0);
const pulsePoints = new THREE.Points(pulseGeo, pulseMat);
pulsePoints.frustumCulled = false;
scene.add(pulsePoints);

function updatePulses(now) {
  const pl = sim.pulses;
  let m = 0;
  for (let k = 0; k < pl.n; k++) {
    const t = (now - pl.t0[k]) / (pl.t1[k] - pl.t0[k]);
    if (t < 0 || t > 1) continue;
    const i = pl.src[k], j = pl.dst[k];
    const ri = region[i], rj = region[j];
    if (selected >= 0 && ri !== selected && rj !== selected) continue;
    const a = pos(i), b = pos(j);
    let p;
    if (pl.long[k]) p = bezier(a, tractControl(...a, ...b), b, t);
    else p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    pulsePos[m * 3] = p[0]; pulsePos[m * 3 + 1] = p[1]; pulsePos[m * 3 + 2] = p[2];
    const ca = regionColors[ri], cb = regionColors[rj], w = pl.long[k] ? 1 : 0.45;
    pulseCol[m * 3] = (ca.r + (cb.r - ca.r) * t) * w;
    pulseCol[m * 3 + 1] = (ca.g + (cb.g - ca.g) * t) * w;
    pulseCol[m * 3 + 2] = (ca.b + (cb.b - ca.b) * t) * w;
    m++;
  }
  pulseGeo.setDrawRange(0, m);
  pulseMat.uniforms.uBase.value = 0.9 * Math.min(1, Math.sqrt(900 / Math.max(1, m)));
  pulsePosAttr.needsUpdate = true;
  pulseColAttr.needsUpdate = true;
}

// ---------------------------------------------------------------- Centres des régions (étiquettes, focus)
const centroids = REGIONS.map(() => ({ L: new THREE.Vector3(), R: new THREE.Vector3(), all: new THREE.Vector3(), nL: 0, nR: 0 }));
for (let i = 0; i < N; i++) {
  const c = centroids[region[i]], v = new THREE.Vector3(...pos(i));
  c.all.add(v);
  if (v.x < 0) { c.L.add(v); c.nL++; } else { c.R.add(v); c.nR++; }
}
centroids.forEach((c, r) => {
  c.all.divideScalar(sim.regionSize[r]);
  if (c.nL) c.L.divideScalar(c.nL); else c.L.copy(c.all);
  if (c.nR) c.R.divideScalar(c.nR); else c.R.copy(c.all);
  // Les structures médianes (tronc, cervelet) gardent un seul centre
  if (Math.abs(c.L.x - c.R.x) < 0.5 && ['cerebellum', 'brainstem'].includes(REGIONS[r].id)) { c.L.copy(c.all); c.R.copy(c.all); }
});

const labelEls = REGIONS.map((r) => {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = r.name;
  el.style.color = r.color;
  $('labels').appendChild(el);
  return el;
});
const tmpV = new THREE.Vector3();
function updateLabels() {
  const show = $('t-labels').checked;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  REGIONS.forEach((r, k) => {
    const el = labelEls[k];
    if (!show) { el.style.display = 'none'; return; }
    const c = centroids[k];
    const p = camera.position.distanceToSquared(c.L) < camera.position.distanceToSquared(c.R) ? c.L : c.R;
    tmpV.copy(p).project(camera);
    if (tmpV.z > 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.left = `${((tmpV.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - tmpV.y) / 2) * h}px`;
    el.classList.toggle('dim', selected >= 0 && selected !== k);
  });
}

// ---------------------------------------------------------------- Scénarios & paramètres
let scenario = SCENARIOS[0];
const sliders = { excit: 1, noise: 1, speed: 1 };

function applyParams() {
  sim.params.excit = sliders.excit * (scenario.excit ?? 1);
  sim.params.homeo = scenario.homeo ?? 1;
  sim.params.noise = sliders.noise;
}
function applyScenario(sc) {
  scenario = sc;
  sim.drive.fill(1);
  for (const [k, v] of Object.entries(sc.drive)) sim.drive[REGION_INDEX[k]] = v;
  if (sc.rhythm) {
    const amp = new Float32Array(REGIONS.length);
    for (const [k, v] of Object.entries(sc.rhythm.regions)) amp[REGION_INDEX[k]] = v;
    sim.rhythm = { amp, period: sc.rhythm.period, sharp: sc.rhythm.sharp };
  } else sim.rhythm = null;
  applyParams();
  $('scenario-desc').textContent = sc.desc;
  document.querySelectorAll('#scenarios button').forEach((b) => b.classList.toggle('active', b.dataset.id === sc.id));
}

SCENARIOS.forEach((sc, k) => {
  const b = document.createElement('button');
  b.dataset.id = sc.id;
  b.title = `${sc.name} (${k + 1})`;
  b.innerHTML = `<span class="ic">${sc.icon}</span>${sc.name}`;
  b.onclick = () => applyScenario(sc);
  $('scenarios').appendChild(b);
});

function bindSlider(id, fmt, onChange) {
  const el = $(id), out = $('o-' + id);
  const update = () => { const v = parseFloat(el.value); out.textContent = fmt(v); onChange(v); };
  el.addEventListener('input', update);
  update();
}
bindSlider('excit', (v) => v.toFixed(2), (v) => { sliders.excit = v; applyParams(); });
bindSlider('noise', (v) => v.toFixed(2), (v) => { sliders.noise = v; applyParams(); });
bindSlider('speed', (v) => v.toFixed(2) + '×', (v) => { sliders.speed = v; });
bindSlider('bloom', (v) => v.toFixed(2), (v) => { bloom.strength = v; });

$('t-shell').onchange = (e) => { shells.visible = e.target.checked; };
$('t-tracts').onchange = (e) => { tracts.visible = e.target.checked; };
$('t-local').onchange = (e) => { localLines.visible = e.target.checked; };
$('t-pulses').onchange = (e) => { pulsePoints.visible = e.target.checked; };
$('t-rotate').onchange = (e) => { controls.autoRotate = e.target.checked; };

// ---------------------------------------------------------------- Régions : liste et sélection
const regionItems = REGIONS.map((r, k) => {
  const li = document.createElement('li');
  li.style.color = r.color;
  li.innerHTML = `<span class="dot"></span><span style="color:var(--text)">${r.name}</span><span class="bar"><i></i></span>`;
  li.onclick = () => select(selected === k ? -1 : k);
  $('regions').appendChild(li);
  return { li, bar: li.querySelector('.bar i') };
});

const names = (ids) => [...new Set(ids)].map((id) => REGIONS[REGION_INDEX[id]].name).join(', ') || '—';
let selected = -1;
function select(r) {
  selected = r;
  for (let i = 0; i < N; i++) dim[i] = r < 0 || region[i] === r ? 1 : 0.1;
  dimAttr.needsUpdate = true;
  tracts.material.opacity = r < 0 ? 0.035 : 0.012;
  setHighlight(r);
  regionItems.forEach((it, k) => {
    it.li.classList.toggle('active', k === r);
    it.li.classList.toggle('faded', r >= 0 && k !== r);
  });
  const info = $('info');
  if (r < 0) {
    info.hidden = true;
    targetGoal.copy(HOME_TARGET);
    return;
  }
  const reg = REGIONS[r];
  info.hidden = false;
  info.style.setProperty('--c', reg.color);
  $('i-dot').style.color = reg.color;
  $('i-bar').style.color = reg.color;
  $('i-name').textContent = reg.name;
  $('i-kind').textContent = reg.kind;
  $('i-fn').textContent = reg.fn;
  $('i-count').textContent = sim.regionSize[r].toLocaleString('fr-FR') + ' (simulés)';
  $('i-out').textContent = names(CONNECTIONS.filter((c) => c[0] === reg.id).map((c) => c[1]));
  $('i-in').textContent = names(CONNECTIONS.filter((c) => c[1] === reg.id).map((c) => c[0]));
  targetGoal.copy(centroids[r].all).lerp(HOME_TARGET, 0.4);
}
$('i-close').onclick = () => select(-1);
$('i-stim').onclick = () => stimulate();
function stimulate() {
  if (selected >= 0) sim.stimulate(selected, 60);
}

// ---------------------------------------------------------------- Interaction 3D
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.025;
const mouse = new THREE.Vector2();
const tooltip = $('tooltip');
function pick(ev) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(neuronPoints);
  return hits.length ? hits[0].index : -1;
}
let downAt = null, lastHover = 0;
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const i = pick(e);
  select(i < 0 ? -1 : region[i] === selected ? -1 : region[i]);
});
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (e.buttons || now - lastHover < 40) return;
  lastHover = now;
  const i = pick(e);
  if (i < 0) { tooltip.style.opacity = 0; canvas.style.cursor = ''; return; }
  const r = REGIONS[region[i]];
  tooltip.innerHTML = `<span style="color:${r.color}">●</span> ${r.name} <span style="color:var(--muted)">· neurone #${i}</span>`;
  tooltip.style.left = e.clientX + 14 + 'px';
  tooltip.style.top = e.clientY + 12 + 'px';
  tooltip.style.opacity = 1;
  canvas.style.cursor = 'pointer';
});
canvas.addEventListener('pointerleave', () => { tooltip.style.opacity = 0; });

let paused = false;
function togglePause() {
  paused = !paused;
  $('paused').hidden = !paused;
  $('pause').textContent = paused ? '▶' : '❚❚';
}
$('pause').onclick = togglePause;
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'range' && e.key.startsWith('Arrow')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
  else if (e.key === 's' || e.key === 'S') stimulate();
  else if (e.key === 'Escape') select(-1);
  else if (/^[1-9]$/.test(e.key) && SCENARIOS[+e.key - 1]) applyScenario(SCENARIOS[+e.key - 1]);
});

// ---------------------------------------------------------------- Graphique
const HIST = 240; // 12 s à 20 échantillons/s
const history = REGIONS.map(() => new Float32Array(HIST));
let histHead = 0, lastSample = 0;
const chart = $('chart'), ctx = chart.getContext('2d');
let chartMax = 2;
function drawChart() {
  const dpr = window.devicePixelRatio || 1;
  const w = chart.clientWidth, h = chart.clientHeight;
  if (chart.width !== Math.round(w * dpr) || chart.height !== Math.round(h * dpr)) {
    chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let mx = 1;
  for (const hst of history) for (const v of hst) if (v > mx) mx = v;
  chartMax += (mx * 1.15 - chartMax) * 0.05;
  const padL = 30, ch = h - 12;
  ctx.font = '10px system-ui'; ctx.fillStyle = '#5d6a85'; ctx.strokeStyle = 'rgba(140,170,255,0.08)'; ctx.lineWidth = 1;
  for (const f of [0, 0.5, 1]) {
    const y = 6 + ch - f * ch;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.fillText((chartMax * f).toFixed(1), 2, Math.min(h - 6, Math.max(6, y)));
  }
  const order = REGIONS.map((_, k) => k).sort((a, b) => (a === selected) - (b === selected));
  for (const k of order) {
    const hst = history[k];
    ctx.beginPath();
    for (let q = 0; q < HIST; q++) {
      const v = hst[(histHead + q) % HIST];
      const x = padL + (q / (HIST - 1)) * (w - padL), y = 6 + ch - Math.min(1, v / chartMax) * ch;
      q ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = REGIONS[k].color;
    ctx.globalAlpha = selected < 0 ? 0.85 : k === selected ? 1 : 0.18;
    ctx.lineWidth = k === selected ? 2.2 : 1.3;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- Redimensionnement
let viewShift = 0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  viewShift = w > 900 ? PANEL_W / 2 : 0;
  camera.setViewOffset(w, h, -viewShift, 0, w, h);
  camera.updateProjectionMatrix();
  const vp = h * renderer.getPixelRatio() * 0.5;
  neuronMat.uniforms.uViewport.value = vp;
  pulseMat.uniforms.uViewport.value = vp;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- Boucle
$('s-neurons').textContent = N.toLocaleString('fr-FR');
$('s-syn').textContent = conn.total.toLocaleString('fr-FR');
applyScenario(SCENARIOS[0]);

let last = performance.now(), acc = 0, fpsFrames = 0, fpsT = last, spikesT = 0, uiT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (!paused) {
    acc += dt * SIM_HZ * sliders.speed;
    let steps = 0;
    while (acc >= 1 && steps < 24) { sim.step(); acc -= 1; steps++; }
    if (acc > 2) acc = 0;
    glowAttr.needsUpdate = true;
    if (now - lastSample > 50) {
      lastSample = now;
      for (let r = 0; r < REGIONS.length; r++) history[r][histHead] = sim.regionRate[r] * SIM_HZ;
      histHead = (histHead + 1) % HIST;
    }
  }
  if (pulsePoints.visible) updatePulses(sim.tick + acc);

  controls.target.lerp(targetGoal, 0.06);
  controls.update();
  composer.render();
  updateLabels();

  fpsFrames++;
  if (now - fpsT > 1000) {
    $('s-fps').textContent = Math.round((fpsFrames * 1000) / (now - fpsT));
    $('s-spikes').textContent = Math.round(((sim.totalSpikes - spikesT) * 1000) / (now - fpsT)).toLocaleString('fr-FR');
    spikesT = sim.totalSpikes; fpsFrames = 0; fpsT = now;
  }
  if (now - uiT > 80) {
    uiT = now;
    drawChart();
    let mx = 0.5;
    for (let r = 0; r < REGIONS.length; r++) mx = Math.max(mx, sim.regionRate[r] * SIM_HZ);
    regionItems.forEach((it, r) => { it.bar.style.width = `${((sim.regionRate[r] * SIM_HZ) / mx) * 100}%`; });
    if (selected >= 0) {
      const hz = sim.regionRate[selected] * SIM_HZ;
      $('i-rate').textContent = hz.toFixed(2) + ' Hz';
      $('i-bar').style.width = `${Math.min(100, (hz / 6) * 100)}%`;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Paramètres d'URL (ex. index.html#scenario=vision&select=thalamus)
const hp = new URLSearchParams(location.hash.slice(1));
const hs = SCENARIOS.find((s) => s.id === hp.get('scenario'));
if (hs) applyScenario(hs);
if (hp.has('select') && hp.get('select') in REGION_INDEX) select(REGION_INDEX[hp.get('select')]);
