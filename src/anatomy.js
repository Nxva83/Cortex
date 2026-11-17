// Anatomie procédurale : régions du cerveau et placement des neurones.
// Repère : x = gauche(-)/droite(+), y = bas/haut, z = arrière(-)/avant(+).

export const REGIONS = [
  { id: 'frontal', name: 'Lobe frontal', color: '#4fc3ff', kind: 'Cortex',
    fn: "Planification, prise de décision, mouvements volontaires (cortex moteur), langage parlé (aire de Broca), contrôle des émotions." },
  { id: 'parietal', name: 'Lobe pariétal', color: '#9d8cff', kind: 'Cortex',
    fn: "Intégration du toucher, de la douleur et de la position du corps ; perception de l'espace et attention." },
  { id: 'temporal', name: 'Lobe temporal', color: '#2fe0a0', kind: 'Cortex',
    fn: "Audition, compréhension du langage (aire de Wernicke), reconnaissance des objets et des visages." },
  { id: 'occipital', name: 'Lobe occipital', color: '#ffa94d', kind: 'Cortex',
    fn: "Cortex visuel : analyse des contours, des couleurs, de la profondeur et du mouvement." },
  { id: 'thalamus', name: 'Thalamus', color: '#ffe066', kind: 'Noyau profond',
    fn: "Station relais : filtre et transmet les informations sensorielles vers le cortex. Rythme la veille et le sommeil." },
  { id: 'hippocampus', name: 'Hippocampe', color: '#ff7eb6', kind: 'Système limbique',
    fn: "Encodage des nouveaux souvenirs et carte mentale de l'espace." },
  { id: 'amygdala', name: 'Amygdale', color: '#ff4d6d', kind: 'Système limbique',
    fn: "Détection des menaces, peur, mémoire émotionnelle." },
  { id: 'cerebellum', name: 'Cervelet', color: '#b8f35a', kind: 'Cervelet',
    fn: "Coordination et précision des mouvements, équilibre, apprentissage moteur. Contient plus de la moitié des neurones du cerveau." },
  { id: 'brainstem', name: 'Tronc cérébral', color: '#a9b8c8', kind: 'Tronc cérébral',
    fn: "Fonctions vitales automatiques : respiration, rythme cardiaque, éveil. Passage de toutes les voies motrices et sensitives." },
];

export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));

// Formes de référence
export const HEMI = { cx: 0.5, cy: 0.12, rx: 0.56, ryTop: 0.68, ryBot: 0.5, rz: 0.98, medial: 0.045 };
export const CEREB = { cx: 0, cy: -0.5, cz: -0.62, rx: 0.6, ry: 0.27, rz: 0.36 };

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Bruit (pour les plis du cortex) ---
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), xf), lerp(c(0, 1, 0), c(1, 1, 0), xf), yf),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), xf), lerp(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
export function fbm3(x, y, z) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let o = 0; o < 4; o++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// --- Fonctions de forme ---
export function hemiDist(x, y, z, side) {
  const lx = (x - side * HEMI.cx) / HEMI.rx;
  const ly = (y - HEMI.cy) / (y > HEMI.cy ? HEMI.ryTop : HEMI.ryBot);
  const lz = z / HEMI.rz;
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}
export function cerebDist(x, y, z) {
  const lx = (x - CEREB.cx) / CEREB.rx, ly = (y - CEREB.cy) / CEREB.ry, lz = (z - CEREB.cz) / CEREB.rz;
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}
export function brainstemPoint(t) {
  return [0, -0.1 - 1.0 * t, -0.1 - 0.14 * t - 0.06 * Math.sin(Math.PI * t)];
}

function corticalLobe(x, y, z, side) {
  const lateral = (side * x - HEMI.cx) / HEMI.rx;
  const ly = (y - HEMI.cy) / (y > HEMI.cy ? HEMI.ryTop : HEMI.ryBot);
  const lz = z / HEMI.rz;
  if (ly < -0.12 && lz > -0.55 && lz < 0.55 && lateral > -0.35) return 'temporal';
  if (lz > 0.28) return 'frontal';
  if (lz < -0.55) return 'occipital';
  return 'parietal';
}

export function generateNeurons(seed = 1337) {
  const rand = mulberry32(seed);
  const P = [], R = [];
  const add = (x, y, z, id) => { P.push(x, y, z); R.push(REGION_INDEX[id]); };
  const inBall = (r) => {
    for (;;) {
      const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
      if (x * x + y * y + z * z <= 1) return [x * r, y * r, z * r];
    }
  };

  // Cortex : couche externe des deux hémisphères
  for (let n = 0; n < 4600;) {
    const x = (rand() * 2 - 1) * 1.1, y = -0.42 + rand() * 1.25, z = (rand() * 2 - 1) * 1.0;
    const side = x < 0 ? -1 : 1;
    if (side * x < HEMI.medial + 0.005) continue;
    const d = hemiDist(x, y, z, side);
    if (d < 0.8 || d > 0.97) continue;
    if (cerebDist(x, y, z) < 1.15) continue;
    add(x, y, z, corticalLobe(x, y, z, side)); n++;
  }

  for (const side of [-1, 1]) {
    // Thalamus
    for (let k = 0; k < 170;) {
      const [x, y, z] = inBall(1);
      add(side * 0.13 + x * 0.1, 0.02 + y * 0.085, -0.08 + z * 0.16, 'thalamus'); k++;
    }
    // Hippocampe : tube recourbé
    for (let k = 0; k < 150; k++) {
      const t = rand();
      const [ox, oy, oz] = inBall(0.045);
      add(side * (0.31 - 0.06 * t) + ox, -0.2 + 0.2 * t * t + oy, 0.18 - 0.5 * t + oz, 'hippocampus');
    }
    // Amygdale
    for (let k = 0; k < 70; k++) {
      const [ox, oy, oz] = inBall(0.065);
      add(side * 0.3 + ox, -0.2 + oy, 0.27 + oz, 'amygdala');
    }
  }

  // Cervelet
  for (let n = 0; n < 1000;) {
    const x = CEREB.cx + (rand() * 2 - 1) * CEREB.rx;
    const y = CEREB.cy + (rand() * 2 - 1) * CEREB.ry;
    const z = CEREB.cz + (rand() * 2 - 1) * CEREB.rz;
    const d = cerebDist(x, y, z);
    if (d > 0.95 || d < 0.45) continue;
    add(x, y, z, 'cerebellum'); n++;
  }

  // Tronc cérébral
  for (let k = 0; k < 340; k++) {
    const t = rand();
    const [cx, cy, cz] = brainstemPoint(t);
    const r = (0.1 - 0.03 * t) * Math.sqrt(rand()), a = rand() * Math.PI * 2;
    add(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, 'brainstem');
  }

  return { positions: new Float32Array(P), region: Uint8Array.from(R), count: R.length };
}
