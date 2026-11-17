// Espèce : être humain (anatomie procédurale simplifiée).
// Repère : x = gauche(-)/droite(+), y = bas/haut, z = arrière(-)/avant(+).
import { fbm3, inBall } from '../util.js';

const HEMI = { cx: 0.5, cy: 0.12, rx: 0.56, ryTop: 0.68, ryBot: 0.5, rz: 0.98, medial: 0.045 };
const CEREB = { cx: 0, cy: -0.5, cz: -0.62, rx: 0.6, ry: 0.27, rz: 0.36 };

function hemiDist(x, y, z, side) {
  const lx = (x - side * HEMI.cx) / HEMI.rx;
  const ly = (y - HEMI.cy) / (y > HEMI.cy ? HEMI.ryTop : HEMI.ryBot);
  const lz = z / HEMI.rz;
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}
function cerebDist(x, y, z) {
  const lx = (x - CEREB.cx) / CEREB.rx, ly = (y - CEREB.cy) / CEREB.ry, lz = (z - CEREB.cz) / CEREB.rz;
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}
function brainstemPoint(t) {
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

const CORTEX_LOW = { frontal: 0.15, parietal: 0.15, temporal: 0.15, occipital: 0.15 };

export default {
  id: 'humain',
  nom: 'Être humain',
  camera: { position: [-2.7, 1.0, 2.5], cible: [0, -0.15, -0.05] },

  regions: [
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
    { id: 'cerebellum', name: 'Cervelet', color: '#b8f35a', kind: 'Cervelet', median: true,
      fn: "Coordination et précision des mouvements, équilibre, apprentissage moteur. Contient plus de la moitié des neurones du cerveau." },
    { id: 'brainstem', name: 'Tronc cérébral', color: '#a9b8c8', kind: 'Tronc cérébral', median: true,
      fn: "Fonctions vitales automatiques : respiration, rythme cardiaque, éveil. Passage de toutes les voies motrices et sensitives." },
  ],

  // [source, cible, probabilité par neurone source, poids]
  connections: [
    ['thalamus', 'frontal', 0.25, 0.55], ['thalamus', 'parietal', 0.25, 0.55],
    ['thalamus', 'temporal', 0.2, 0.55], ['thalamus', 'occipital', 0.3, 0.6],
    ['thalamus', 'amygdala', 0.15, 0.6],
    ['frontal', 'thalamus', 0.04, 0.5], ['parietal', 'thalamus', 0.04, 0.5],
    ['occipital', 'thalamus', 0.04, 0.5], ['temporal', 'thalamus', 0.04, 0.5],
    ['occipital', 'parietal', 0.08, 0.55], ['occipital', 'temporal', 0.08, 0.55],
    ['parietal', 'frontal', 0.07, 0.55], ['temporal', 'frontal', 0.06, 0.55], ['frontal', 'parietal', 0.05, 0.5],
    ['temporal', 'hippocampus', 0.08, 0.6], ['hippocampus', 'temporal', 0.25, 0.55], ['hippocampus', 'frontal', 0.2, 0.5],
    ['amygdala', 'hippocampus', 0.3, 0.55], ['hippocampus', 'amygdala', 0.15, 0.5], ['temporal', 'amygdala', 0.05, 0.6],
    ['amygdala', 'frontal', 0.3, 0.5], ['amygdala', 'brainstem', 0.3, 0.6], ['amygdala', 'thalamus', 0.2, 0.5],
    ['frontal', 'brainstem', 0.03, 0.6], ['frontal', 'cerebellum', 0.02, 0.5],
    ['brainstem', 'cerebellum', 0.35, 0.55], ['cerebellum', 'thalamus', 0.12, 0.55], ['brainstem', 'thalamus', 0.3, 0.55],
  ],
  // Régions reliées à leur jumelle de l'autre hémisphère (corps calleux)
  callosal: ['frontal', 'parietal', 'temporal', 'occipital'],

  scenarios: [
    { id: 'rest', name: 'Repos', icon: '◌',
      desc: "Activité spontanée de fond : des neurones s'allument au hasard et de petites vagues se propagent localement.",
      drive: {} },
    { id: 'vision', name: 'Vision', icon: '◉',
      desc: "Le thalamus relaie les signaux de la rétine vers le cortex visuel (occipital), puis l'information part vers le lobe temporal (« quoi ? ») et pariétal (« où ? »).",
      drive: { occipital: 3, thalamus: 3, parietal: 1.3, temporal: 1.3 },
      rhythm: { regions: { thalamus: 10, occipital: 6 }, period: 0.9, sharp: 8 } },
    { id: 'motor', name: 'Mouvement', icon: '➚',
      desc: "Le cortex moteur (frontal) envoie la commande via le tronc cérébral ; le cervelet affine la coordination en boucle avec le thalamus.",
      drive: { frontal: 3, brainstem: 3, cerebellum: 4, parietal: 1.5 },
      rhythm: { regions: { frontal: 5 }, period: 1.4, sharp: 6 } },
    { id: 'memory', name: 'Mémoire', icon: '✦',
      desc: "L'hippocampe oscille au rythme thêta (~6 Hz) et dialogue avec le cortex temporal et préfrontal pour encoder un souvenir.",
      drive: { hippocampus: 4, temporal: 2, frontal: 1.5 },
      rhythm: { regions: { hippocampus: 10 }, period: 0.17, sharp: 4 } },
    { id: 'fear', name: 'Peur', icon: '⚠',
      desc: "Stimulus menaçant : le thalamus alerte directement l'amygdale (voie rapide), qui déclenche la réponse du tronc cérébral (cœur, respiration) et grave le souvenir via l'hippocampe.",
      drive: { amygdala: 8, thalamus: 2, brainstem: 3, hippocampus: 2 },
      rhythm: { regions: { amygdala: 6, thalamus: 6 }, period: 1.1, sharp: 10 } },
    { id: 'sleep', name: 'Sommeil profond', icon: '☾',
      desc: "Ondes lentes : thalamus et cortex alternent toutes les ~1,3 s entre silence et bouffées d'activité synchronisées.",
      drive: { ...CORTEX_LOW, thalamus: 0.3, cerebellum: 0.4, hippocampus: 0.5, amygdala: 0.3, brainstem: 0.8 },
      excit: 1.25,
      rhythm: { regions: { thalamus: 90, frontal: 40, parietal: 40, temporal: 40, occipital: 40 }, period: 1.3, sharp: 6 } },
    { id: 'seizure', name: 'Crise épileptique', icon: '⚡',
      desc: "Simulation : un foyer temporal hyperexcitable déclenche une activité qui s'emballe et se propage au cortex (l'inhibition est affaiblie).",
      drive: { temporal: 2 }, excit: 1.9, homeo: 0.12,
      rhythm: { regions: { temporal: 20 }, period: 2.5, sharp: 20 } },
  ],

  // Configuration de l'IA locale
  ia: {
    sujet: "d'un être humain",
    consigneReponse: 'ce que la personne dit ou pense, en une phrase courte.',
    guillemets: true,
    comportements: ['sourire', 'sursauter', 'fuir', 'réfléchir', 'se souvenir', 'bouger', 'parler', 'se détendre', 'avoir peur', 'regarder'],
    exemples: [
      {
        message: 'Un chien aboie violemment derrière toi',
        reponse: {
          regions: { temporal: 0.7, thalamus: 0.6, amygdala: 0.9, brainstem: 0.7, frontal: 0.2, cerebellum: 0.3, hippocampus: 0.2, parietal: 0.1 },
          comportement: 'sursauter', reponse: "Oh ! Tu m'as fait peur !",
        },
      },
      {
        message: 'On t’offre ton gâteau préféré',
        reponse: {
          regions: { occipital: 0.5, frontal: 0.4, hippocampus: 0.4, temporal: 0.3, thalamus: 0.3 },
          comportement: 'sourire', reponse: 'Oh merci, ça me rappelle les anniversaires de mon enfance !',
        },
      },
    ],
  },

  // Placement des neurones
  generate({ rand, add }) {
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
      for (let k = 0; k < 170; k++) {
        const [x, y, z] = inBall(rand, 1);
        add(side * 0.13 + x * 0.1, 0.02 + y * 0.085, -0.08 + z * 0.16, 'thalamus');
      }
      for (let k = 0; k < 150; k++) {
        const t = rand();
        const [ox, oy, oz] = inBall(rand, 0.045);
        add(side * (0.31 - 0.06 * t) + ox, -0.2 + 0.2 * t * t + oy, 0.18 - 0.5 * t + oz, 'hippocampus');
      }
      for (let k = 0; k < 70; k++) {
        const [ox, oy, oz] = inBall(rand, 0.065);
        add(side * 0.3 + ox, -0.2 + oy, 0.27 + oz, 'amygdala');
      }
    }
    for (let n = 0; n < 1000;) {
      const x = CEREB.cx + (rand() * 2 - 1) * CEREB.rx;
      const y = CEREB.cy + (rand() * 2 - 1) * CEREB.ry;
      const z = CEREB.cz + (rand() * 2 - 1) * CEREB.rz;
      const d = cerebDist(x, y, z);
      if (d > 0.95 || d < 0.45) continue;
      add(x, y, z, 'cerebellum'); n++;
    }
    for (let k = 0; k < 340; k++) {
      const t = rand();
      const [cx, cy, cz] = brainstemPoint(t);
      const r = (0.1 - 0.03 * t) * Math.sqrt(rand()), a = rand() * Math.PI * 2;
      add(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, 'brainstem');
    }
  },

  // Enveloppes translucides
  shells({ THREE, shellMaterial }) {
    const group = new THREE.Group();
    const hemisphere = (side) => {
      const g = new THREE.SphereGeometry(1, 240, 170);
      const pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        let x = v.x * HEMI.rx + side * HEMI.cx;
        const y = v.y * (v.y > 0 ? HEMI.ryTop : HEMI.ryBot) + HEMI.cy;
        const z = v.z * HEMI.rz;
        const m = side * x;
        if (m < HEMI.medial) x = side * (HEMI.medial - (HEMI.medial - m) * 0.06);
        const n = fbm3(x * 4.6 + side * 7.3, y * 4.6, z * 4.6);
        const disp = -0.05 * Math.pow(1 - Math.abs(2 * n - 1), 12); // sillons
        pos.setXYZ(i, x + v.x * disp, y + v.y * disp, z + v.z * disp);
      }
      g.computeVertexNormals();
      return g;
    };
    const cerebellum = () => {
      const g = new THREE.SphereGeometry(1, 180, 120);
      const pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const x = CEREB.cx + v.x * CEREB.rx, y = CEREB.cy + v.y * CEREB.ry, z = CEREB.cz + v.z * CEREB.rz;
        let disp = -0.016 * Math.pow(0.5 + 0.5 * Math.sin(y * 75 + fbm3(x * 3, y * 3, z * 3) * 7), 3);
        if (Math.abs(x) < 0.05) disp -= 0.03 * (1 - Math.abs(x) / 0.05) * Math.max(0, v.y);
        pos.setXYZ(i, x + v.x * disp, y + v.y * disp, z + v.z * disp);
      }
      g.computeVertexNormals();
      return g;
    };
    const pts = [];
    for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(...brainstemPoint(k / 8)));
    const cortexMat = shellMaterial('#5aa8ff', 0.28, 2.8);
    group.add(new THREE.Mesh(hemisphere(-1), cortexMat));
    group.add(new THREE.Mesh(hemisphere(1), cortexMat));
    group.add(new THREE.Mesh(cerebellum(), shellMaterial('#7fd8c8', 0.26, 2.4)));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.11, 32, false), shellMaterial('#8fa3c0', 0.22, 2.4)));
    return group;
  },
};
