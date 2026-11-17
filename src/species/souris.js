// Espèce : souris (Mus musculus).
// Régions et connexions simplifiées d'après les grandes voies de l'Allen Mouse Brain
// Connectivity Atlas (connexions entre régions, pas neurone par neurone).
// Repère : x = gauche(-)/droite(+), y = bas/haut, z = arrière(-)/avant(+).
import { fbm3, inBall, ellDist, inEllipsoid } from '../util.js';

// Hémisphère : ellipsoïde plus large à l'arrière qu'à l'avant (vue de dessus en goutte d'eau)
const HEMI = { cx: 0.36, cy: 0, rx: 0.46, ryTop: 0.42, ryBot: 0.52, rz: 0.78, medial: 0.03 };
const OB = (side) => ({ c: [side * 0.13, -0.08, 0.92], r: [0.14, 0.17, 0.24] });
const CEREB = { c: [0, 0.02, -0.98], r: [0.46, 0.3, 0.26] };
const SC = (side) => ({ c: [side * 0.1, 0.02, -0.68], r: [0.1, 0.08, 0.08] });

function hemiLocal(x, y, z, side) {
  const lz = z / HEMI.rz;
  const lateral = (side * x - HEMI.cx) / (HEMI.rx * (1 - 0.15 * lz));
  const ly = y / (y > HEMI.cy ? HEMI.ryTop : HEMI.ryBot);
  return { lateral, ly, lz, d: Math.sqrt(lateral * lateral + ly * ly + lz * lz) };
}
function brainstemPoint(t) {
  return [0, -0.3 - 0.06 * t - 0.03 * Math.sin(Math.PI * t), -0.56 - 0.9 * t];
}
function corticalArea({ lateral, ly, lz }) {
  if (ly < -0.58 && lz > -0.4 && lateral > -0.4) return 'piriforme';
  if (lz > 0.62) return 'prefrontal';
  if (lz < -0.5) return 'visuel';
  if (lateral > 0.45 && ly < 0.1 && lz < 0) return 'auditif';
  if (lz > 0.15 && lateral < 0.4) return 'moteur';
  return 'somato';
}

const CORTEX = ['prefrontal', 'moteur', 'somato', 'visuel', 'auditif', 'piriforme'];
const lowCortex = (v) => Object.fromEntries(CORTEX.map((id) => [id, v]));

export default {
  id: 'souris',
  nom: 'Souris',
  arene: true, // la souris a une arène où elle se déplace (src/arena.js)
  camera: { position: [-3.0, 1.7, 2.4], cible: [0, -0.1, -0.15] },

  regions: [
    { id: 'bulbe_olfactif', name: 'Bulbe olfactif', color: '#d4a373', kind: 'Système olfactif',
      fn: "Premier relais de l'odorat, énorme chez la souris : elle vit dans un monde d'odeurs (nourriture, prédateurs, congénères)." },
    { id: 'piriforme', name: 'Cortex olfactif', color: '#f28482', kind: 'Cortex',
      fn: "Cortex piriforme : identifie les odeurs et les associe aux souvenirs et aux émotions." },
    { id: 'prefrontal', name: 'Cortex préfrontal', color: '#4f8bff', kind: 'Cortex',
      fn: "Décisions et flexibilité : choisir entre explorer, manger ou se cacher." },
    { id: 'moteur', name: 'Cortex moteur', color: '#36cfc9', kind: 'Cortex',
      fn: "Commande des mouvements volontaires : course, escalade, mouvements des moustaches." },
    { id: 'somato', name: 'Cortex somatosensoriel', color: '#9d8cff', kind: 'Cortex',
      fn: "Toucher. Contient le « cortex des tonneaux » : une colonne de neurones par moustache, le sens principal de la souris dans le noir." },
    { id: 'visuel', name: 'Cortex visuel', color: '#ffa94d', kind: 'Cortex',
      fn: "Vision : contours et mouvements. La souris voit flou mais détecte très bien ce qui bouge." },
    { id: 'auditif', name: 'Cortex auditif', color: '#2fe0a0', kind: 'Cortex',
      fn: "Audition, y compris les ultrasons que les souris utilisent pour communiquer entre elles." },
    { id: 'hippocampe', name: 'Hippocampe', color: '#ff7eb6', kind: 'Système limbique',
      fn: "Mémoire et carte de l'espace : ses « cellules de lieu », découvertes chez le rongeur, s'activent à un endroit précis (prix Nobel 2014)." },
    { id: 'amygdale', name: 'Amygdale', color: '#ff3355', kind: 'Système limbique',
      fn: "Peur et émotions : odeur de chat, douleur, danger appris." },
    { id: 'striatum', name: 'Striatum', color: '#d16cff', kind: 'Noyaux gris centraux',
      fn: "Choix des actions et apprentissage par récompense : il reçoit la dopamine et renforce les actions qui ont payé." },
    { id: 'thalamus', name: 'Thalamus', color: '#ffe066', kind: 'Diencéphale',
      fn: "Relais vers le cortex : toucher des moustaches, vision, audition." },
    { id: 'hypothalamus', name: 'Hypothalamus', color: '#7ee8fa', kind: 'Diencéphale', median: true,
      fn: "Besoins vitaux (faim, soif, température) et réactions de défense innées : fuite ou immobilisation." },
    { id: 'colliculus', name: 'Colliculus supérieur', color: '#a0c4ff', kind: 'Mésencéphale',
      fn: "Réflexes visuels : détecte une ombre qui grossit au-dessus (un rapace !) et déclenche la fuite en une fraction de seconde, sans passer par le cortex." },
    { id: 'vta', name: 'Aire tegmentale ventrale', color: '#f1f3f5', kind: 'Mésencéphale',
      fn: "Neurones à dopamine : signal de récompense (« c'était mieux que prévu »). La base de l'apprentissage." },
    { id: 'cervelet', name: 'Cervelet', color: '#b8f35a', kind: 'Cervelet', median: true,
      fn: "Coordination fine des mouvements et équilibre : course, escalade, sauts." },
    { id: 'tronc', name: 'Tronc cérébral', color: '#a9b8c8', kind: 'Tronc cérébral', median: true,
      fn: "Respiration, rythme cardiaque, mastication, balayage des moustaches ; relaie le toucher des moustaches vers le thalamus." },
  ],

  // [source, cible, probabilité par neurone source, poids]
  connections: [
    // Odorat
    ['bulbe_olfactif', 'piriforme', 0.35, 0.6], ['piriforme', 'bulbe_olfactif', 0.06, 0.45],
    ['bulbe_olfactif', 'amygdale', 0.015, 0.5],
    ['piriforme', 'amygdale', 0.03, 0.5], ['piriforme', 'hippocampe', 0.1, 0.55], ['piriforme', 'prefrontal', 0.08, 0.5],
    // Thalamus <-> cortex
    ['thalamus', 'somato', 0.3, 0.6], ['thalamus', 'visuel', 0.2, 0.55], ['thalamus', 'auditif', 0.2, 0.55],
    ['thalamus', 'moteur', 0.15, 0.55], ['thalamus', 'prefrontal', 0.15, 0.55],
    ['thalamus', 'striatum', 0.08, 0.5], ['thalamus', 'amygdale', 0.1, 0.55],
    ['somato', 'thalamus', 0.04, 0.5], ['visuel', 'thalamus', 0.04, 0.5], ['auditif', 'thalamus', 0.04, 0.5],
    ['moteur', 'thalamus', 0.04, 0.5], ['prefrontal', 'thalamus', 0.05, 0.5],
    // Cortex <-> cortex
    ['somato', 'moteur', 0.08, 0.55], ['moteur', 'somato', 0.06, 0.5], ['visuel', 'somato', 0.04, 0.5],
    ['auditif', 'visuel', 0.04, 0.5], ['visuel', 'prefrontal', 0.04, 0.5],
    ['moteur', 'prefrontal', 0.04, 0.5], ['prefrontal', 'moteur', 0.08, 0.55],
    // Cortex -> striatum, boucle de sélection des actions
    ['prefrontal', 'striatum', 0.1, 0.55], ['moteur', 'striatum', 0.08, 0.55],
    ['somato', 'striatum', 0.05, 0.5], ['visuel', 'striatum', 0.03, 0.5],
    ['striatum', 'thalamus', 0.08, 0.45], ['striatum', 'vta', 0.06, 0.45],
    // Dopamine
    ['vta', 'striatum', 0.5, 0.5], ['vta', 'prefrontal', 0.3, 0.45], ['vta', 'amygdale', 0.15, 0.45], ['vta', 'hippocampe', 0.1, 0.45],
    // Hippocampe
    ['hippocampe', 'prefrontal', 0.12, 0.5], ['hippocampe', 'hypothalamus', 0.05, 0.5], ['hippocampe', 'striatum', 0.05, 0.5],
    ['prefrontal', 'hippocampe', 0.03, 0.45], ['visuel', 'hippocampe', 0.03, 0.5],
    // Amygdale et défense
    ['amygdale', 'hypothalamus', 0.3, 0.6], ['amygdale', 'tronc', 0.2, 0.6], ['amygdale', 'striatum', 0.15, 0.5],
    ['amygdale', 'prefrontal', 0.15, 0.5], ['amygdale', 'vta', 0.1, 0.5],
    ['prefrontal', 'amygdale', 0.05, 0.5], ['auditif', 'amygdale', 0.04, 0.55],
    ['hypothalamus', 'tronc', 0.25, 0.6], ['hypothalamus', 'vta', 0.15, 0.55], ['hypothalamus', 'thalamus', 0.08, 0.5],
    // Colliculus : réflexe de fuite
    ['visuel', 'colliculus', 0.06, 0.55], ['colliculus', 'thalamus', 0.2, 0.55],
    ['colliculus', 'tronc', 0.25, 0.6], ['colliculus', 'amygdale', 0.08, 0.5],
    // Mouvement
    ['moteur', 'tronc', 0.06, 0.6], ['moteur', 'cervelet', 0.03, 0.5],
    ['tronc', 'cervelet', 0.3, 0.55], ['cervelet', 'thalamus', 0.12, 0.55],
    ['tronc', 'thalamus', 0.25, 0.55], ['tronc', 'colliculus', 0.05, 0.5],
  ],
  callosal: [...CORTEX, 'hippocampe'],

  scenarios: [
    { id: 'rest', name: 'Repos', icon: '◌',
      desc: "Activité spontanée de fond : des neurones s'allument au hasard et de petites vagues se propagent localement.",
      drive: {} },
    { id: 'whisk', name: 'Moustaches', icon: '≋',
      desc: "La souris explore en balayant ses moustaches ~8 fois par seconde : tronc cérébral → thalamus → cortex des tonneaux (somatosensoriel).",
      drive: { somato: 2.5, tronc: 2.5, thalamus: 2, moteur: 1.5, hippocampe: 1.5 },
      rhythm: { regions: { tronc: 8, somato: 4, moteur: 4 }, period: 0.125, sharp: 4 } },
    { id: 'food', name: 'Nourriture', icon: '✿',
      desc: "Odeur de graines : le bulbe olfactif s'active à chaque reniflement, le cortex olfactif identifie l'odeur, l'hypothalamus signale la faim et les neurones à dopamine annoncent une récompense.",
      drive: { bulbe_olfactif: 5, piriforme: 2.5, hypothalamus: 2, vta: 4, striatum: 2 },
      rhythm: { regions: { bulbe_olfactif: 8, piriforme: 4 }, period: 0.14, sharp: 4 } },
    { id: 'shadow', name: 'Ombre', icon: '▲',
      desc: "Une ombre grossit au-dessus (un rapace ?) : le colliculus supérieur la détecte et déclenche la fuite via le tronc cérébral, sans attendre le cortex.",
      drive: { colliculus: 8, amygdale: 4, hypothalamus: 4, tronc: 4, visuel: 2 },
      rhythm: { regions: { colliculus: 8 }, period: 1.2, sharp: 10 } },
    { id: 'cat', name: 'Odeur de chat', icon: '⚠',
      desc: "Peur innée : l'odeur d'un prédateur passe du bulbe olfactif à l'amygdale et à l'hypothalamus, qui figent la souris sur place.",
      drive: { bulbe_olfactif: 4, amygdale: 6, hypothalamus: 5, tronc: 3, piriforme: 2 },
      rhythm: { regions: { bulbe_olfactif: 6 }, period: 0.14, sharp: 4 } },
    { id: 'nav', name: 'Navigation', icon: '✦',
      desc: "La souris retrouve son chemin dans un labyrinthe : l'hippocampe oscille au rythme thêta (~8 Hz) et dialogue avec le cortex préfrontal.",
      drive: { hippocampe: 4, prefrontal: 2, visuel: 1.5, striatum: 1.5 },
      rhythm: { regions: { hippocampe: 10 }, period: 0.125, sharp: 4 } },
    { id: 'sleep', name: 'Sommeil', icon: '☾',
      desc: "Ondes lentes : thalamus et cortex alternent entre silence et bouffées d'activité synchronisées.",
      drive: { ...lowCortex(0.15), thalamus: 0.3, cervelet: 0.4, hippocampe: 0.5, amygdale: 0.3, tronc: 0.8 },
      excit: 1.25,
      rhythm: { regions: { thalamus: 90, ...lowCortex(40) }, period: 1.3, sharp: 6 } },
  ],

  ia: {
    sujet: "d'une souris",
    consigneReponse: 'ce que fait ou ressent la souris, en une phrase courte à la troisième personne (une souris ne parle pas).',
    guillemets: false,
    comportements: ['renifler', 'explorer', 'manger', 'fuir', 'se figer', 'se cacher', 'se toiletter', 'approcher', 'couiner', 'dormir'],
    exemples: [
      {
        message: 'Une ombre passe au-dessus de toi',
        reponse: {
          regions: { colliculus: 0.9, amygdale: 0.7, hypothalamus: 0.6, tronc: 0.7, visuel: 0.5, thalamus: 0.3 },
          comportement: 'fuir', reponse: 'La souris file se cacher sous une feuille, le cœur battant.',
        },
      },
      {
        message: 'Des graines de tournesol sont éparpillées près de toi',
        reponse: {
          regions: { bulbe_olfactif: 0.8, piriforme: 0.6, hypothalamus: 0.5, vta: 0.6, striatum: 0.5, moteur: 0.3, prefrontal: 0.2 },
          comportement: 'manger', reponse: "La souris renifle les graines, s'approche et commence à les grignoter.",
        },
      },
    ],
  },

  generate({ rand, add }) {
    // Cortex : couche externe, lisse (pas de plis chez la souris)
    for (let n = 0; n < 3600;) {
      const x = (rand() * 2 - 1) * 0.95, y = -0.55 + rand() * 1.0, z = -0.8 + rand() * 1.6;
      const side = x < 0 ? -1 : 1;
      if (side * x < HEMI.medial + 0.005) continue;
      const h = hemiLocal(x, y, z, side);
      if (h.d < 0.8 || h.d > 0.97) continue;
      if (ellDist(CEREB, x, y, z) < 1.1 || ellDist(SC(side), x, y, z) < 1.2) continue;
      add(x, y, z, corticalArea(h)); n++;
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 220; k++) add(...inEllipsoid(rand, OB(side), 0.35, 0.95), 'bulbe_olfactif');
      for (let k = 0; k < 160; k++) add(...inEllipsoid(rand, { c: [side * 0.1, -0.08, -0.22], r: [0.1, 0.11, 0.17] }), 'thalamus');
      for (let k = 0; k < 220; k++) add(...inEllipsoid(rand, { c: [side * 0.26, -0.06, 0.22], r: [0.13, 0.15, 0.2] }), 'striatum');
      for (let k = 0; k < 70; k++) add(...inEllipsoid(rand, { c: [side * 0.33, -0.35, -0.12], r: [0.07, 0.07, 0.07] }), 'amygdale');
      for (let k = 0; k < 110; k++) add(...inEllipsoid(rand, SC(side), 0.3, 1), 'colliculus');
      for (let k = 0; k < 50; k++) add(...inEllipsoid(rand, { c: [side * 0.05, -0.3, -0.45], r: [0.05, 0.04, 0.06] }), 'vta');
      // Hippocampe : arc en C au-dessus du thalamus, qui descend sur le côté
      for (let k = 0; k < 250; k++) {
        const t = rand();
        const [ox, oy, oz] = inBall(rand, 0.06);
        add(side * (0.08 + 0.3 * t) + ox, 0.12 - 0.42 * Math.pow(t, 1.5) + oy, -0.12 - 0.3 * t + oz, 'hippocampe');
      }
    }
    for (let k = 0; k < 260; k++) add(...inEllipsoid(rand, { c: [0, -0.38, -0.05], r: [0.11, 0.09, 0.2] }), 'hypothalamus');
    for (let k = 0; k < 1000; k++) add(...inEllipsoid(rand, CEREB, 0.45, 0.95), 'cervelet');
    for (let k = 0; k < 420; k++) {
      const t = rand();
      const [cx, cy, cz] = brainstemPoint(t);
      const r = (0.15 - 0.04 * t) * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      add(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, cz, 'tronc');
    }
  },

  shells({ THREE, shellMaterial }) {
    const group = new THREE.Group();
    const hemisphere = (side) => {
      const g = new THREE.SphereGeometry(1, 200, 140);
      const pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const z = v.z * HEMI.rz, lz = v.z;
        let x = side * HEMI.cx + v.x * HEMI.rx * (1 - 0.15 * lz);
        const y = v.y * (v.y > 0 ? HEMI.ryTop : HEMI.ryBot);
        const m = side * x;
        if (m < HEMI.medial) x = side * (HEMI.medial - (HEMI.medial - m) * 0.06);
        const disp = -0.008 * fbm3(x * 3 + side * 5, y * 3, z * 3); // presque lisse
        pos.setXYZ(i, x + v.x * disp, y + v.y * disp, z + v.z * disp);
      }
      g.computeVertexNormals();
      return g;
    };
    const ellipsoid = (e, folds = 0) => {
      const g = new THREE.SphereGeometry(1, 140, 100);
      const pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        let disp = 0;
        // Lamelles du cervelet : bandes transversales autour de l'axe gauche-droite
        if (folds) disp = -0.014 * Math.pow(0.5 + 0.5 * Math.sin(Math.atan2(v.y, v.z) * folds), 3);
        pos.setXYZ(i, e.c[0] + v.x * (e.r[0] + disp), e.c[1] + v.y * (e.r[1] + disp), e.c[2] + v.z * (e.r[2] + disp));
      }
      g.computeVertexNormals();
      return g;
    };
    const cortexMat = shellMaterial('#5aa8ff', 0.28, 2.6);
    const olfMat = shellMaterial('#e0b080', 0.3, 2.2);
    group.add(new THREE.Mesh(hemisphere(-1), cortexMat));
    group.add(new THREE.Mesh(hemisphere(1), cortexMat));
    group.add(new THREE.Mesh(ellipsoid(OB(-1)), olfMat));
    group.add(new THREE.Mesh(ellipsoid(OB(1)), olfMat));
    group.add(new THREE.Mesh(ellipsoid(CEREB, 34), shellMaterial('#7fd8c8', 0.26, 2.4)));
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(...brainstemPoint(k / 8)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.15, 32, false), shellMaterial('#8fa3c0', 0.22, 2.4)));
    return group;
  },
};
