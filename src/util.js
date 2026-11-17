// Outils communs : hasard reproductible, bruit, échantillonnage de formes.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// Point uniforme dans une boule de rayon r
export function inBall(rand, r = 1) {
  for (;;) {
    const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1;
    if (x * x + y * y + z * z <= 1) return [x * r, y * r, z * r];
  }
}

// Distance normalisée à un ellipsoïde { c: [x,y,z], r: [rx,ry,rz] } (1 = sur la surface)
export function ellDist(e, x, y, z) {
  const lx = (x - e.c[0]) / e.r[0], ly = (y - e.c[1]) / e.r[1], lz = (z - e.c[2]) / e.r[2];
  return Math.sqrt(lx * lx + ly * ly + lz * lz);
}

// Point dans un ellipsoïde, éventuellement seulement dans une coque [dMin, dMax]
export function inEllipsoid(rand, e, dMin = 0, dMax = 1) {
  for (;;) {
    const [x, y, z] = inBall(rand, 1);
    const d = Math.hypot(x, y, z);
    if (d < dMin || d > dMax) continue;
    return [e.c[0] + x * e.r[0], e.c[1] + y * e.r[1], e.c[2] + z * e.r[2]];
  }
}
