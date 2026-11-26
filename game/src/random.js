// Deterministic randomness: one mulberry32 stream per seed, plus a tiny
// value-noise field so the island looks the same on every run and every
// screenshot. No Math.random() anywhere in world generation.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise with smooth interpolation; fbm stacks 4 octaves.
export function makeNoise(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function grad(h, x, y) {
    // 4 gradient directions from the hash, dot with (x, y).
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }
  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const u = fade(xf);
    const v = fade(yf);
    const aa = grad(perm[X + perm[Y]], xf, yf);
    const ba = grad(perm[X + 1 + perm[Y]], xf - 1, yf);
    const ab = grad(perm[X + perm[Y + 1]], xf, yf - 1);
    const bb = grad(perm[X + 1 + perm[Y + 1]], xf - 1, yf - 1);
    const x1 = aa + (ba - aa) * u;
    const x2 = ab + (bb - ab) * u;
    return x1 + (x2 - x1) * v; // roughly in [-1, 1]
  }
  return function fbm(x, y) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let o = 0; o < 4; o += 1) {
      sum += amp * noise2(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum; // roughly in [-1, 1]
  };
}
