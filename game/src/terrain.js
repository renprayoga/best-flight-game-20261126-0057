// Nusa island: one height function, one colour rule, shared by physics
// (ground height queries), the renderer (terrain mesh) and the minimap.
// The island is a volcano in the north-west, a ridge down the east, a
// river valley cutting between them, rice terraces on the south slopes,
// a coastal town and beach at the south-east, sea all around.
import { CFG } from './config.js';
import { makeNoise } from './random.js';

const noise = makeNoise(1337);
const HALF = CFG.WORLD_SIZE / 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Distance from (x, z) to the river's centreline: a curve from the
// volcano's foot down to the south coast.
export function riverDistance(x, z) {
  // River runs roughly north -> south, bending east as it goes south.
  const centre = -350 + 0.00012 * (z + 900) * (z + 900) * 0.35 - 0.0004 * z;
  return Math.abs(x - centre);
}

export function groundHeight(x, z) {
  const nx = x / HALF;
  const nz = z / HALF;
  const r = Math.sqrt(nx * nx + nz * nz); // 0 centre, ~1.41 corners
  // Island falloff: land above sea inside r < 1, seabed outside.
  const coast = smooth(clamp((1.02 - r) / 0.18, 0, 1));
  // Rolling hills.
  let h = 26 * (noise(x * 0.0016 + 7.3, z * 0.0016 + 2.1) * 0.5 + 0.5);
  h += 12 * (noise(x * 0.006 + 1.7, z * 0.006 + 8.4) * 0.5 + 0.5);
  // Volcano cone, north-west.
  const dv = Math.hypot(x + 620, z + 820) / 620;
  h += 265 * Math.max(0, 1 - dv * dv) * (dv < 1 ? 1 : 0);
  h += 40 * Math.max(0, 1 - dv) * (noise(x * 0.01, z * 0.01) * 0.5 + 0.5);
  // Eastern ridge.
  const dr = Math.hypot((x - 950) / 420, (z + 100) / 1100);
  h += 120 * Math.max(0, 1 - dr * dr);
  // River valley: carve a channel along the river line.
  const rd = riverDistance(x, z);
  const carve = smooth(clamp(1 - rd / 190, 0, 1));
  h = h * (1 - 0.82 * carve) + 4 * carve;
  // Flatten the home runway strip and the two hop strips: a full
  // plateau across the whole strip, ramping down just past its ends.
  for (const s of STRIPS) {
    const dx = x - s.x;
    const dz = z - s.z;
    const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
    const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
    const m = smooth(clamp(1 - Math.max(0, along - s.length / 2) / 60, 0, 1))
      * smooth(clamp(1 - Math.max(0, across - s.width / 2) / 25, 0, 1));
    h = h * (1 - m) + s.elev * m;
  }
  // Beach ring: sand where land meets sea.
  const beach = smooth(clamp((h - 1) / 6, 0, 1));
  void beach;
  return h * coast - 26 * (1 - coast);
}

// Airstrips: home + two island-hop strips, each with a flat elevation.
export const STRIPS = [
  { id: 'home', name: 'Nusa Field', x: 0, z: 120, length: 420, width: 34, heading: 0, elev: 6 },
  { id: 'east', name: 'Ridge Strip', x: 1080, z: -420, length: 340, width: 28, heading: 0.5, elev: 38 },
  { id: 'west', name: 'Palm Strip', x: -1150, z: 620, length: 340, width: 28, heading: -0.4, elev: 9 },
];

function terrainColor(x, z, h) {
  // Sand at the waterline, green lowland, terrace gold on the south
  // slopes, rock grey high up, snow-white ash on the volcano cone.
  if (h < 2.5) return [0.86, 0.78, 0.55]; // beach sand
  if (h > 235) return [0.92, 0.90, 0.86]; // volcano ash cap
  if (h > 150) return [0.52, 0.48, 0.44]; // rock
  const n = noise(x * 0.004 + 3.1, z * 0.004 + 9.7) * 0.5 + 0.5;
  // Rice terraces: banded gold-green on the south-facing slopes.
  const terrace = (Math.sin((z * 0.9 + h * 2.2) * 0.12) > 0.1 && z > -200 && h > 18 && h < 90);
  if (terrace) return [0.72, 0.66, 0.28];
  const g = 0.42 + 0.2 * n;
  return [0.16 + 0.1 * n, g, 0.14 + 0.06 * n]; // jungle green
}

// Build the terrain mesh: a 129x129 grid, vertex colours, indexed.
export function buildTerrainMesh() {
  const N = 129;
  const step = CFG.WORLD_SIZE / (N - 1);
  const positions = new Float32Array(N * N * 3);
  const colors = new Float32Array(N * N * 3);
  const indices = [];
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const x = -HALF + i * step;
      const z = -HALF + j * step;
      const h = groundHeight(x, z);
      const k = (j * N + i) * 3;
      positions[k] = x;
      positions[k + 1] = h;
      positions[k + 2] = z;
      // River water: paint the channel blue where it is carved low.
      let c = terrainColor(x, z, h);
      if (riverDistance(x, z) < 42 && h < 12 && h > -2) c = [0.16, 0.45, 0.62];
      colors[k] = c[0];
      colors[k + 1] = c[1];
      colors[k + 2] = c[2];
    }
  }
  for (let j = 0; j < N - 1; j += 1) {
    for (let i = 0; i < N - 1; i += 1) {
      const a = j * N + i;
      const b = a + 1;
      const c2 = a + N;
      const d = c2 + 1;
      indices.push(a, c2, b, b, c2, d);
    }
  }
  return { positions, colors, indices: new Uint32Array(indices) };
}

// Town: a cluster of small coloured boxes near the south-east beach.
// Trees: cones on trunks, scattered on low green ground (not on strips).
export function buildTownAndTrees() {
  const rand = (function mulberry(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })(20261126);
  const boxes = [];
  for (let i = 0; i < 46; i += 1) {
    const x = 620 + rand() * 560;
    const z = 480 + rand() * 420;
    const h = groundHeight(x, z);
    if (h < 3 || h > 60) continue;
    const w = 14 + rand() * 16;
    const d = 14 + rand() * 16;
    const ht = 10 + rand() * 22;
    const warm = rand();
    const col = warm > 0.66 ? [0.85, 0.55, 0.35] : warm > 0.33 ? [0.9, 0.85, 0.7] : [0.55, 0.65, 0.8];
    boxes.push({ x, z, y: h, w, d, ht, col, roof: [0.75, 0.25, 0.2] });
  }
  const trees = [];
  for (let i = 0; i < 700; i += 1) {
    const x = (rand() * 2 - 1) * (HALF - 80);
    const z = (rand() * 2 - 1) * (HALF - 80);
    const h = groundHeight(x, z);
    if (h < 4 || h > 120) continue;
    if (riverDistance(x, z) < 55) continue;
    let onStrip = false;
    for (const s of STRIPS) {
      if (Math.abs(x - s.x) < s.length / 2 + 40 && Math.abs(z - s.z) < s.width / 2 + 40) onStrip = true;
    }
    if (onStrip) continue;
    trees.push({ x, z, y: h, s: 5 + rand() * 7 });
  }
  return { boxes, trees };
}

// Ring courses: 8 rings each, one per mission, laid out as a tour of the
// island — valley, volcano shoulder, ridge, river, coast, home. Every
// ring floats at least 55 m above the ground beneath it: a ring buried
// in a hillside is a ring no pilot can thread.
export function ringCourse(missionId) {
  const R = CFG.RING_RADIUS;
  let course;
  if (missionId === 'island-hop') {
    // Rings guide the pilot to each strip, then home.
    course = [
      { x: 0, y: 90, z: -350, r: R },
      { x: 480, y: 130, z: -620, r: R },
      { x: 1080, y: 110, z: -420, r: R },
      { x: 700, y: 150, z: 150, r: R },
      { x: -300, y: 120, z: 500, r: R },
      { x: -1150, y: 90, z: 620, r: R },
      { x: -700, y: 130, z: 250, r: R },
      { x: 0, y: 90, z: -150, r: R },
    ];
  } else if (missionId === 'time-trial') {
    // Tight low course down the river valley.
    course = [
      { x: -150, y: 70, z: -300, r: R },
      { x: -320, y: 80, z: -650, r: R },
      { x: -480, y: 150, z: -950, r: R },
      { x: -620, y: 220, z: -700, r: R },
      { x: -420, y: 120, z: -350, r: R },
      { x: -200, y: 70, z: 0, r: R },
      { x: 100, y: 80, z: 350, r: R },
      { x: 0, y: 90, z: -120, r: R },
    ];
  } else {
    // ring-run: the grand tour.
    course = [
      { x: 0, y: 100, z: -400, r: R },
      { x: -350, y: 140, z: -750, r: R },
      { x: -620, y: 240, z: -650, r: R },
      { x: -150, y: 170, z: -250, r: R },
      { x: 550, y: 180, z: -500, r: R },
      { x: 950, y: 150, z: 100, r: R },
      { x: 500, y: 110, z: 650, r: R },
      { x: 0, y: 100, z: -150, r: R },
    ];
  }
  for (const ring of course) {
    ring.y = Math.max(ring.y, groundHeight(ring.x, ring.z) + 55);
  }
  return course;
}
