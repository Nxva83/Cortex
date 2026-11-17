// Simulation d'activité : neurones intègre-et-tire à fuite, synapses avec délais de
// propagation, inhibition globale (homéostasie) pour garder un régime stable.
import { REGIONS, REGION_INDEX, ESPECE, mulberry32 } from './anatomy.js';

export const SIM_HZ = 120;          // pas de simulation par seconde
export const RING = 256;            // délai maximal (en pas)
const BASE_NOISE = 0.0015;          // probabilité de décharge spontanée par pas
const TARGET_RATE = 0.006;          // fraction de neurones actifs visée par pas
const W_LOCAL = 0.5;
// Connexions entre régions et liaisons inter-hémisphères : définies par l'espèce
export const CONNECTIONS = ESPECE.connections;
const CALLOSAL = ESPECE.callosal ?? [];

// Point de contrôle des faisceaux longs : courbés vers l'intérieur (substance blanche)
export function tractControl(ax, ay, az, bx, by, bz) {
  const k = 0.7;
  return [((ax + bx) / 2) * k, ((ay + by) / 2) * k, ((az + bz) / 2) * k];
}

export function buildConnectome(neurons, { seed = 99, localK = 6, localRadius = 0.11, speed = 0.011 } = {}) {
  const rand = mulberry32(seed);
  const { positions: P, region, count: N } = neurons;
  const out = Array.from({ length: N }, () => []);
  const dist = (i, j) => Math.hypot(P[3 * i] - P[3 * j], P[3 * i + 1] - P[3 * j + 1], P[3 * i + 2] - P[3 * j + 2]);

  // Connexions locales (grille spatiale)
  const inv = 1 / localRadius, r2 = localRadius * localRadius;
  const key = (a, b, c) => (a + 64) * 16384 + (b + 64) * 128 + (c + 64);
  const grid = new Map();
  const cellOf = (i) => [Math.floor(P[3 * i] * inv), Math.floor(P[3 * i + 1] * inv), Math.floor(P[3 * i + 2] * inv)];
  for (let i = 0; i < N; i++) {
    const k = key(...cellOf(i));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  let nLocal = 0;
  for (let i = 0; i < N; i++) {
    const [cx, cy, cz] = cellOf(i);
    const cand = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cell = grid.get(key(cx + a, cy + b, cz + c));
      if (!cell) continue;
      for (const j of cell) {
        if (j === i) continue;
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        if (dx * dx + dy * dy + dz * dz < r2) cand.push(j);
      }
    }
    const k = Math.min(localK, cand.length);
    for (let s = 0; s < k; s++) {
      const r = s + Math.floor(rand() * (cand.length - s));
      [cand[s], cand[r]] = [cand[r], cand[s]];
      const j = cand[s];
      out[i].push([j, Math.max(1, Math.round(dist(i, j) / speed)), W_LOCAL, 0]);
      nLocal++;
    }
  }

  // Faisceaux longs entre régions
  const pools = REGIONS.map(() => ({ L: [], R: [], A: [] }));
  for (let i = 0; i < N; i++) {
    const p = pools[region[i]];
    p.A.push(i);
    (P[3 * i] < 0 ? p.L : p.R).push(i);
  }
  let nLong = 0;
  const addLong = (i, j, w) => {
    const len = dist(i, j) * 1.12;
    out[i].push([j, Math.min(RING - 1, Math.max(2, Math.round(len / speed))), w, 1]);
    nLong++;
  };
  for (const [a, b, p, w] of CONNECTIONS) {
    const src = pools[REGION_INDEX[a]], dst = pools[REGION_INDEX[b]];
    for (const i of src.A) {
      if (rand() >= p) continue;
      const side = P[3 * i] < 0 ? 'L' : 'R';
      const pool = rand() < 0.85 && dst[side].length ? dst[side] : dst.A;
      addLong(i, pool[Math.floor(rand() * pool.length)], w);
    }
  }
  // Corps calleux : liaisons entre hémisphères
  for (const id of CALLOSAL) {
    const pool = pools[REGION_INDEX[id]];
    for (const i of pool.A) {
      if (rand() >= 0.03) continue;
      const other = P[3 * i] < 0 ? pool.R : pool.L;
      addLong(i, other[Math.floor(rand() * other.length)], 0.5);
    }
  }

  // Format compact (CSR)
  const total = nLocal + nLong;
  const offsets = new Uint32Array(N + 1), target = new Uint32Array(total), delay = new Uint16Array(total);
  const weight = new Float32Array(total), isLong = new Uint8Array(total);
  let s = 0;
  for (let i = 0; i < N; i++) {
    offsets[i] = s;
    for (const [j, d, w, l] of out[i]) { target[s] = j; delay[s] = d; weight[s] = w; isLong[s] = l; s++; }
  }
  offsets[N] = s;
  return { offsets, target, delay, weight, isLong, nLocal, nLong, total };
}

export class NeuralSim {
  constructor(neurons, conn) {
    const N = (this.N = neurons.count);
    const R = (this.R = REGIONS.length);
    this.region = neurons.region;
    this.c = conn;
    this.u = new Float32Array(N);
    this.refr = new Uint8Array(N);
    this.glow = new Float32Array(N);
    this.ring = new Float32Array(RING * N);
    this.fired = new Uint32Array(N);
    this.tick = 0;
    this.drive = new Float32Array(R).fill(1);
    this.boost = new Float32Array(R);
    this.rhythm = null; // { amp: Float32Array(R), period (s), sharp }
    this.params = { excit: 1, noise: 1, homeo: 1, leak: 0.88, threshold: 1, refractory: 14 };
    this.localPulseProb = 0.06;
    this.rate = 0;
    this.regionSize = new Uint32Array(R);
    for (let i = 0; i < N; i++) this.regionSize[this.region[i]]++;
    this.regionRate = new Float32Array(R);
    this._rs = new Uint32Array(R);
    // Côté de chaque neurone (0 = gauche, 1 = droite) et activité par région ET par côté
    this.side = new Uint8Array(N);
    this.sideSize = new Uint32Array(R * 2);
    for (let i = 0; i < N; i++) {
      this.side[i] = neurons.positions[i * 3] < 0 ? 0 : 1;
      this.sideSize[this.region[i] * 2 + this.side[i]]++;
    }
    this.sideRate = new Float32Array(R * 2);
    this._rs2 = new Uint32Array(R * 2);
    // Entrée sensorielle externe par neurone (même unité que drive : 1 = activité de fond)
    this.input = new Float32Array(N);
    this._p = new Float32Array(R);
    this.lastFired = 0;
    this.totalSpikes = 0;
    const cap = 6000;
    this.pulses = {
      cap, n: 0,
      src: new Uint32Array(cap), dst: new Uint32Array(cap),
      t0: new Float32Array(cap), t1: new Float32Array(cap), long: new Uint8Array(cap),
    };
  }

  stimulate(r, amount = 60) { this.boost[r] = Math.max(this.boost[r], amount); }

  reset() {
    this.u.fill(0); this.refr.fill(0); this.glow.fill(0); this.ring.fill(0);
    this.boost.fill(0); this.pulses.n = 0; this.rate = 0; this.regionRate.fill(0); this.sideRate.fill(0); this.input.fill(0);
  }

  step() {
    const { N, R, region, u, refr, glow, ring, params, c } = this;
    const base = (this.tick % RING) * N;
    const tSec = this.tick / SIM_HZ;

    for (let r = 0; r < R; r++) {
      let f = this.drive[r] + this.boost[r];
      const rh = this.rhythm;
      if (rh && rh.amp[r] > 0) {
        f *= 1 + rh.amp[r] * Math.pow(Math.max(0, Math.sin((2 * Math.PI * tSec) / rh.period)), rh.sharp);
      }
      this._p[r] = BASE_NOISE * params.noise * f;
      this.boost[r] *= 0.99;
    }

    const homeo = 1 / (1 + params.homeo * Math.max(0, this.rate / TARGET_RATE - 1));
    const gain = params.excit * homeo;
    const leak = params.leak, thr = params.threshold, refrT = params.refractory;
    const rs = this._rs; rs.fill(0);
    const rs2 = this._rs2; rs2.fill(0);
    const input = this.input, side = this.side, pIn = BASE_NOISE * params.noise;
    let nf = 0;

    for (let i = 0; i < N; i++) {
      glow[i] *= 0.9;
      const inp = ring[base + i]; ring[base + i] = 0;
      if (refr[i] > 0) { refr[i]--; u[i] = 0; continue; }
      let v = u[i] * leak + inp;
      if (v >= thr || Math.random() < this._p[region[i]] + pIn * input[i]) {
        v = 0; refr[i] = refrT; glow[i] = 1;
        this.fired[nf++] = i; rs[region[i]]++; rs2[region[i] * 2 + side[i]]++;
      }
      u[i] = v;
    }

    // Retire les impulsions arrivées
    const pl = this.pulses;
    let m = 0;
    for (let k = 0; k < pl.n; k++) {
      if (pl.t1[k] <= this.tick) continue;
      if (m !== k) {
        pl.src[m] = pl.src[k]; pl.dst[m] = pl.dst[k];
        pl.t0[m] = pl.t0[k]; pl.t1[m] = pl.t1[k]; pl.long[m] = pl.long[k];
      }
      m++;
    }
    pl.n = m;

    // Propagation des potentiels d'action
    const { offsets, target, delay, weight, isLong } = c;
    for (let k = 0; k < nf; k++) {
      const i = this.fired[k];
      for (let s = offsets[i], e = offsets[i + 1]; s < e; s++) {
        const d = delay[s];
        ring[((this.tick + d) % RING) * N + target[s]] += weight[s] * gain;
        if (pl.n < pl.cap && (isLong[s] || Math.random() < this.localPulseProb)) {
          const q = pl.n++;
          pl.src[q] = i; pl.dst[q] = target[s];
          pl.t0[q] = this.tick; pl.t1[q] = this.tick + d; pl.long[q] = isLong[s];
        }
      }
    }

    this.rate = this.rate * 0.97 + (nf / N) * 0.03;
    for (let r = 0; r < R; r++) {
      this.regionRate[r] = this.regionRate[r] * 0.97 + (rs[r] / this.regionSize[r]) * 0.03;
      for (let s = 0; s < 2; s++) {
        const k = r * 2 + s;
        if (this.sideSize[k]) this.sideRate[k] = this.sideRate[k] * 0.97 + (rs2[k] / this.sideSize[k]) * 0.03;
      }
    }
    this.lastFired = nf;
    this.totalSpikes += nf;
    this.tick++;
  }
}
