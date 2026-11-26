// The Merpati Nusa: a small orange-and-cream mail plane, built from
// triangles in code — fuselage, wings, tail, propeller, fixed gear.
// One mesh, vertex colours, no textures: it has to read as a built
// aircraft at a glance in a 1280-wide screenshot.
export function buildPlaneMesh() {
  const pos = [];
  const col = [];
  const ORANGE = [0.95, 0.42, 0.10];
  const CREAM = [0.96, 0.90, 0.78];
  const DARK = [0.16, 0.18, 0.22];
  const GLASS = [0.45, 0.75, 0.85];
  const RED = [0.85, 0.15, 0.12];

  function tri(a, b, c, color) {
    pos.push(...a, ...b, ...c);
    col.push(...color, ...color, ...color);
  }
  function quad(a, b, c, d, color) {
    tri(a, b, c, color);
    tri(a, c, d, color);
  }
  // Fuselage: a tapered box, nose at -Z (forward), tail at +Z.
  // Cross-section corners (x, y) at stations along z.
  const stations = [
    { z: -4.6, w: 0.05, t: 0.05 }, // nose tip
    { z: -4.2, w: 0.55, t: 0.55 },
    { z: -2.2, w: 0.85, t: 0.95 }, // cockpit
    { z: 0.5, w: 0.8, t: 0.85 },
    { z: 3.2, w: 0.5, t: 0.55 },
    { z: 4.6, w: 0.08, t: 0.12 }, // tail tip
  ];
  function corner(s, sx, sy) {
    return [s.w * sx, s.t * sy, s.z];
  }
  for (let i = 0; i < stations.length - 1; i += 1) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const c = i < 2 ? ORANGE : CREAM;
    // Top, bottom, left, right faces of the tapered tube.
    quad(corner(s0, -1, 1), corner(s1, -1, 1), corner(s1, 1, 1), corner(s0, 1, 1), c);
    quad(corner(s0, -1, -1), corner(s0, 1, -1), corner(s1, 1, -1), corner(s1, -1, -1), c);
    quad(corner(s0, -1, -1), corner(s1, -1, -1), corner(s1, -1, 1), corner(s0, -1, 1), c);
    quad(corner(s0, 1, -1), corner(s0, 1, 1), corner(s1, 1, 1), corner(s1, 1, -1), c);
  }
  // Nose cap + spinner.
  tri([-0.05, 0.05, -4.6], [0.05, 0.05, -4.6], [0, -0.05, -4.6], DARK);
  quad([-0.28, -0.28, -4.75], [0.28, -0.28, -4.75], [0.28, 0.28, -4.75], [-0.28, 0.28, -4.75], RED);
  // Canopy glass: a low wedge over the cockpit.
  quad([-0.55, 0.75, -2.6], [0.55, 0.75, -2.6], [0.45, 1.05, -1.2], [-0.45, 1.05, -1.2], GLASS);
  quad([-0.55, 0.75, -2.6], [-0.45, 1.05, -1.2], [-0.45, 1.05, -1.2], [-0.55, 0.75, -2.6], GLASS);
  // Main wing: low wing, slight dihedral, orange with cream tips.
  function wingPanel(x0, x1, z0, z1, color) {
    quad([x0, -0.15, z0], [x1, 0.05, z0], [x1, 0.05, z1], [x0, -0.15, z1], color);
    quad([x0, -0.15, z0], [x0, -0.15, z1], [x1, 0.05, z1], [x1, 0.05, z0], color);
  }
  wingPanel(-7.2, -0.7, -0.9, 0.7, ORANGE);
  wingPanel(0.7, 7.2, -0.9, 0.7, ORANGE);
  wingPanel(-7.2, -6.4, -0.9, 0.7, CREAM);
  wingPanel(6.4, 7.2, -0.9, 0.7, CREAM);
  // Tailplane + fin.
  wingPanel(-2.6, -0.3, 3.4, 4.4, ORANGE);
  wingPanel(0.3, 2.6, 3.4, 4.4, ORANGE);
  quad([-0.08, 0.3, 3.2], [0.08, 0.3, 3.2], [0.08, 2.0, 4.5], [-0.08, 2.0, 4.5], ORANGE);
  quad([-0.08, 0.3, 3.2], [-0.08, 2.0, 4.5], [0.08, 2.0, 4.5], [0.08, 0.3, 3.2], ORANGE);
  // Fixed landing gear: two wheels + struts.
  for (const s of [-1, 1]) {
    quad([s * 0.9 - 0.06, -0.9, -0.6], [s * 0.9 + 0.06, -0.9, -0.6], [s * 0.9 + 0.06, -1.7, -0.6], [s * 0.9 - 0.06, -1.7, -0.6], DARK);
    quad([s * 0.9 - 0.3, -1.7, -0.9], [s * 0.9 + 0.3, -1.7, -0.9], [s * 0.9 + 0.3, -1.7, -0.3], [s * 0.9 - 0.3, -1.7, -0.3], DARK);
  }
  // Registration stripe on the tail.
  quad([-0.5, 0.15, 4.45], [0.5, 0.15, 4.45], [0.5, 0.35, 4.45], [-0.5, 0.35, 4.45], RED);
  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    count: pos.length / 3,
  };
}

// Propeller: two thin blades + a translucent-look disc, spun by the
// renderer. The disc and the blades are separate meshes: the disc is a
// motion-blur effect that reads well from the chase camera but would
// fill the cockpit view, so the renderer hides it there.
export function buildPropMesh() {
  const pos = [];
  const col = [];
  const BLADE = [0.12, 0.12, 0.14];
  function tri(a, b, c, color) {
    pos.push(...a, ...b, ...c);
    col.push(...color, ...color, ...color);
  }
  // Blades along X, thin in Z, at the nose (z = -4.85).
  tri([-2.1, -0.14, -4.85], [2.1, -0.14, -4.85], [2.1, 0.14, -4.85], BLADE);
  tri([-2.1, -0.14, -4.85], [2.1, 0.14, -4.85], [-2.1, 0.14, -4.85], BLADE);
  tri([-0.14, -2.1, -4.85], [0.14, -2.1, -4.85], [0.14, 2.1, -4.85], BLADE);
  tri([-0.14, -2.1, -4.85], [0.14, 2.1, -4.85], [-0.14, 2.1, -4.85], BLADE);
  return { positions: new Float32Array(pos), colors: new Float32Array(col), count: pos.length / 3 };
}

export function buildPropDiscMesh() {
  const pos = [];
  const col = [];
  const DISC = [0.96, 0.97, 1.0];
  function tri(a, b, c, color) {
    pos.push(...a, ...b, ...c);
    col.push(...color, ...color, ...color);
  }
  // An annulus (a blur ring), not a solid disc: a solid disc reads as
  // a grey balloon from the chase camera.
  const N = 24;
  const R_OUT = 2.2;
  const R_IN = 1.25;
  for (let i = 0; i < N; i += 1) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    const o0 = [Math.cos(a0) * R_OUT, Math.sin(a0) * R_OUT, -4.86];
    const o1 = [Math.cos(a1) * R_OUT, Math.sin(a1) * R_OUT, -4.86];
    const i0 = [Math.cos(a0) * R_IN, Math.sin(a0) * R_IN, -4.86];
    const i1 = [Math.cos(a1) * R_IN, Math.sin(a1) * R_IN, -4.86];
    tri(o0, i0, i1, DISC);
    tri(o0, i1, o1, DISC);
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), count: pos.length / 3 };
}

// A gold ring: a torus built from tube segments, emissive-looking bright
// gold with a darker inner edge. Faces the pilot (normal along -Z of the
// course direction is applied by the renderer via rotation).
export function buildRingMesh(radius, tube = 1.1, radial = 10, tubular = 28) {
  const pos = [];
  const col = [];
  const GOLD = [1.0, 0.78, 0.15];
  const DARKGOLD = [0.85, 0.55, 0.08];
  function vert(u, v) {
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cv = Math.cos(v);
    const sv = Math.sin(v);
    return [(radius + tube * cv) * cu, (radius + tube * cv) * su, tube * sv];
  }
  for (let i = 0; i < tubular; i += 1) {
    const u0 = (i / tubular) * Math.PI * 2;
    const u1 = ((i + 1) / tubular) * Math.PI * 2;
    for (let j = 0; j < radial; j += 1) {
      const v0 = (j / radial) * Math.PI * 2;
      const v1 = ((j + 1) / radial) * Math.PI * 2;
      const a = vert(u0, v0);
      const b = vert(u1, v0);
      const c = vert(u1, v1);
      const d = vert(u0, v1);
      const shade = (Math.sin(v0) > 0 ? GOLD : DARKGOLD);
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let k = 0; k < 6; k += 1) col.push(...shade);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), count: pos.length / 3 };
}
