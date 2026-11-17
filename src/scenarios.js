// Scénarios : chaque scénario règle l'activité spontanée par région (drive),
// un éventuel rythme oscillant, et l'excitabilité globale.
const CORTEX_LOW = { frontal: 0.15, parietal: 0.15, temporal: 0.15, occipital: 0.15 };

export const SCENARIOS = [
  {
    id: 'rest', name: 'Repos', icon: '◌',
    desc: "Activité spontanée de fond : des neurones s'allument au hasard et de petites vagues se propagent localement.",
    drive: {},
  },
  {
    id: 'vision', name: 'Vision', icon: '◉',
    desc: "Le thalamus relaie les signaux de la rétine vers le cortex visuel (occipital), puis l'information part vers le lobe temporal (« quoi ? ») et pariétal (« où ? »).",
    drive: { occipital: 3, thalamus: 3, parietal: 1.3, temporal: 1.3 },
    rhythm: { regions: { thalamus: 10, occipital: 6 }, period: 0.9, sharp: 8 },
  },
  {
    id: 'motor', name: 'Mouvement', icon: '➚',
    desc: "Le cortex moteur (frontal) envoie la commande via le tronc cérébral ; le cervelet affine la coordination en boucle avec le thalamus.",
    drive: { frontal: 3, brainstem: 3, cerebellum: 4, parietal: 1.5 },
    rhythm: { regions: { frontal: 5 }, period: 1.4, sharp: 6 },
  },
  {
    id: 'memory', name: 'Mémoire', icon: '✦',
    desc: "L'hippocampe oscille au rythme thêta (~6 Hz) et dialogue avec le cortex temporal et préfrontal pour encoder un souvenir.",
    drive: { hippocampus: 4, temporal: 2, frontal: 1.5 },
    rhythm: { regions: { hippocampus: 10 }, period: 0.17, sharp: 4 },
  },
  {
    id: 'fear', name: 'Peur', icon: '⚠',
    desc: "Stimulus menaçant : le thalamus alerte directement l'amygdale (voie rapide), qui déclenche la réponse du tronc cérébral (cœur, respiration) et grave le souvenir via l'hippocampe.",
    drive: { amygdala: 8, thalamus: 2, brainstem: 3, hippocampus: 2 },
    rhythm: { regions: { amygdala: 6, thalamus: 6 }, period: 1.1, sharp: 10 },
  },
  {
    id: 'sleep', name: 'Sommeil profond', icon: '☾',
    desc: "Ondes lentes : thalamus et cortex alternent toutes les ~1,3 s entre silence et bouffées d'activité synchronisées.",
    drive: { ...CORTEX_LOW, thalamus: 0.3, cerebellum: 0.4, hippocampus: 0.5, amygdala: 0.3, brainstem: 0.8 },
    excit: 1.25,
    rhythm: { regions: { thalamus: 90, frontal: 40, parietal: 40, temporal: 40, occipital: 40 }, period: 1.3, sharp: 6 },
  },
  {
    id: 'seizure', name: 'Crise épileptique', icon: '⚡',
    desc: "Simulation : un foyer temporal hyperexcitable déclenche une activité qui s'emballe et se propage au cortex (l'inhibition est affaiblie).",
    drive: { temporal: 2 }, excit: 1.9, homeo: 0.12,
    rhythm: { regions: { temporal: 20 }, period: 2.5, sharp: 20 },
  },
];
