// Choix de l'espèce et placement des neurones.
// L'espèce vient de l'adresse (#espece=souris), sinon de globalThis.CORTEX_ESPECE (tests), sinon humain.
import { mulberry32 } from './util.js';
import humain from './species/humain.js';
import souris from './species/souris.js';

export { mulberry32 };
export const ESPECES = [humain, souris];

function especeDemandee() {
  const hash = globalThis.location?.hash?.slice(1) ?? '';
  return new URLSearchParams(hash).get('espece') ?? globalThis.CORTEX_ESPECE ?? 'humain';
}
export const ESPECE = ESPECES.find((e) => e.id === especeDemandee()) ?? humain;

export const REGIONS = ESPECE.regions;
export const REGION_INDEX = Object.fromEntries(REGIONS.map((r, i) => [r.id, i]));

export function generateNeurons(seed = 1337) {
  const rand = mulberry32(seed);
  const P = [], R = [];
  const add = (x, y, z, id) => {
    if (!(id in REGION_INDEX)) throw new Error(`Région inconnue : ${id}`);
    P.push(x, y, z); R.push(REGION_INDEX[id]);
  };
  ESPECE.generate({ rand, add });
  return { positions: new Float32Array(P), region: Uint8Array.from(R), count: R.length };
}
