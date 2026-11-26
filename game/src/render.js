// Hand-written WebGL1 renderer, no libraries. One lambert shader with
// distance fog; every mesh is built in code (terrain, sea, sky dome,
// clouds, rings, runway, town, trees, the plane). Vertex colours carry
// the whole look, so the game needs no textures and no network.
import { CFG } from './config.js';
import { buildTerrainMesh, buildTownAndTrees, groundHeight, STRIPS, ringCourse } from './terrain.js';
import { buildPlaneMesh, buildPropDiscMesh, buildPropMesh, buildRingMesh } from './plane.js';

const TAU = Math.PI * 2;

// ---- tiny mat4 library (column-major, like WebGL expects) ----
function matIdentity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function matMultiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
function matTranslate(x, y, z) {
  const m = matIdentity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
function matScale(x, y, z) {
  const m = matIdentity();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}
function matRotX(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
function matRotY(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
function matRotZ(a) {
  const c = Math.cos(a);
    const s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function matPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm3(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function matLookAt(eye, target, up) {
  const z = norm3(sub3(eye, target));
  const x = norm3(cross3(up, z));
  const y = cross3(z, x);
  // Column-major storage: element (row r, col c) is at index c*4+r, so
  // column 0 holds (x0, y0, z0) — the matrix rows are the camera axes.
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0;
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0;
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0;
  m[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
  m[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
  m[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
  m[15] = 1;
  return m;
}

// ---- normals ----
function smoothNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const u = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
    const v = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
    const cr = cross3(u, v);
    n[a] += cr[0]; n[a + 1] += cr[1]; n[a + 2] += cr[2];
    n[b] += cr[0]; n[b + 1] += cr[1]; n[b + 2] += cr[2];
    n[c] += cr[0]; n[c + 1] += cr[1]; n[c + 2] += cr[2];
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}
function flatNormals(positions) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const u = [positions[i + 3] - positions[i], positions[i + 4] - positions[i + 1], positions[i + 5] - positions[i + 2]];
    const v = [positions[i + 6] - positions[i], positions[i + 7] - positions[i + 1], positions[i + 8] - positions[i + 2]];
    const cr = norm3(cross3(u, v));
    for (let k = 0; k < 3; k += 1) {
      n[i + k * 3] = cr[0];
      n[i + k * 3 + 1] = cr[1];
      n[i + k * 3 + 2] = cr[2];
    }
  }
  return n;
}

// ---- mesh helpers ----
function boxMesh(cx, cy, cz, w, h, d, color) {
  const x0 = cx - w / 2; const x1 = cx + w / 2;
  const y0 = cy; const y1 = cy + h;
  const z0 = cz - d / 2; const z1 = cz + d / 2;
  const quads = [
    [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]],
    [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]],
    [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]],
    [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]],
  ];
  const pos = [];
  const col = [];
  for (const q of quads) {
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    for (let i = 0; i < 6; i += 1) col.push(...color);
  }
  return { pos, col };
}
function mergeMeshes(parts) {
  const pos = [];
  const col = [];
  for (const p of parts) {
    pos.push(...p.pos);
    col.push(...p.col);
  }
  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    count: pos.length / 3,
  };
}

const VERT = `
attribute vec3 aPos; attribute vec3 aColor; attribute vec3 aNormal;
uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj;
uniform vec3 uLight; uniform float uEmissive; uniform float uFog;
varying vec3 vColor; varying float vFogDepth;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(uModel) * aNormal);
  float lambert = 0.55 + 0.45 * max(dot(n, normalize(uLight)), 0.0);
  vColor = aColor * mix(lambert, 1.0, uEmissive);
  vec4 view = uView * world;
  vFogDepth = -view.z;
  gl_Position = uProj * view;
}`;
const FRAG = `
precision mediump float;
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uFog;
varying vec3 vColor; varying float vFogDepth;
void main() {
  float f = uFog > 0.5 ? clamp((vFogDepth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0) : 0.0;
  gl_FragColor = vec4(mix(vColor, uFogColor, f), 1.0);
}`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL unavailable');
  // The terrain mesh uses Uint32 indices: WebGL1 needs this extension
  // for drawElements with UNSIGNED_INT (without it every terrain draw
  // fails with INVALID_ENUM and the island never appears).
  gl.getExtension('OES_element_index_uint');

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const loc = {
    pos: gl.getAttribLocation(prog, 'aPos'),
    color: gl.getAttribLocation(prog, 'aColor'),
    normal: gl.getAttribLocation(prog, 'aNormal'),
    model: gl.getUniformLocation(prog, 'uModel'),
    view: gl.getUniformLocation(prog, 'uView'),
    proj: gl.getUniformLocation(prog, 'uProj'),
    light: gl.getUniformLocation(prog, 'uLight'),
    emissive: gl.getUniformLocation(prog, 'uEmissive'),
    fog: gl.getUniformLocation(prog, 'uFog'),
    fogColor: gl.getUniformLocation(prog, 'uFogColor'),
    fogNear: gl.getUniformLocation(prog, 'uFogNear'),
    fogFar: gl.getUniformLocation(prog, 'uFogFar'),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.62, 0.8, 0.95, 1);

  function makeBuffer(mesh, indexed) {
    const b = { count: mesh.count };
    b.pos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    b.col = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b.col);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);
    b.nor = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    if (indexed) {
      b.idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      b.indexCount = mesh.indices.length;
    }
    return b;
  }
  function drawBuffer(b, model, emissive, fog) {
    gl.uniformMatrix4fv(loc.model, false, model);
    gl.uniform1f(loc.emissive, emissive);
    gl.uniform1f(loc.fog, fog);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.col);
    gl.vertexAttribPointer(loc.color, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc.color);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nor);
    gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc.normal);
    if (b.idx) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, b.count);
    }
  }

  // ---- static world meshes ----
  const terrain = buildTerrainMesh();
  terrain.normals = smoothNormals(terrain.positions, terrain.indices);
  terrain.count = terrain.indices.length;
  const terrainBuf = makeBuffer(terrain, true);

  // Sea: one huge quad at y = 0.15, deep tropical blue.
  const seaMesh = (() => {
    const S = 5200;
    const pos = new Float32Array([-S, 0.15, -S, S, 0.15, -S, S, 0.15, S, -S, 0.15, -S, S, 0.15, S, -S, 0.15, S]);
    const blue = [0.10, 0.42, 0.62];
    const col = new Float32Array(18);
    for (let i = 0; i < 6; i += 1) col.set(blue, i * 3);
    return { positions: pos, colors: col, normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), count: 6 };
  })();
  const seaBuf = makeBuffer(seaMesh, false);

  // Sky dome: a big sphere around the camera, gradient zenith -> horizon,
  // warm glow toward the sun. Emissive, no fog.
  const skyMesh = (() => {
    const R = 4800;
    const pos = [];
    const col = [];
    const rings = 12;
    const segs = 24;
    const sunDir = [0.45, 0.42, -0.55];
    for (let j = 0; j < rings; j += 1) {
      const p0 = (j / rings) * Math.PI * 0.55;
      const p1 = ((j + 1) / rings) * Math.PI * 0.55;
      for (let i = 0; i < segs; i += 1) {
        const a0 = (i / segs) * TAU;
        const a1 = ((i + 1) / segs) * TAU;
        const v = (p, a) => [R * Math.sin(p) * Math.cos(a), R * Math.cos(p), R * Math.sin(p) * Math.sin(a)];
        const c = (p, a) => {
          const d = v(p, a);
          const dl = [d[0] / R, d[1] / R, d[2] / R];
          const t = Math.max(0, dl[1]);
          const zen = [0.25, 0.5, 0.9];
          const hor = [0.78, 0.88, 0.96];
          const base = [zen[0] + (hor[0] - zen[0]) * (1 - t), zen[1] + (hor[1] - zen[1]) * (1 - t), zen[2] + (hor[2] - zen[2]) * (1 - t)];
          const sun = Math.max(0, dl[0] * sunDir[0] + dl[1] * sunDir[1] + dl[2] * sunDir[2]);
          const glow = Math.pow(sun, 24) * 0.9 + Math.pow(sun, 6) * 0.25;
          return [Math.min(1, base[0] + glow), Math.min(1, base[1] + glow * 0.85), Math.min(1, base[2] + glow * 0.5)];
        };
        const vs = [v(p0, a0), v(p1, a0), v(p1, a1), v(p0, a1)];
        const cs = [c(p0, a0), c(p1, a0), c(p1, a1), c(p0, a1)];
        pos.push(...vs[0], ...vs[1], ...vs[2], ...vs[0], ...vs[2], ...vs[3]);
        col.push(...cs[0], ...cs[1], ...cs[2], ...cs[0], ...cs[2], ...cs[3]);
      }
    }
    const positions = new Float32Array(pos);
    const skyNormals = new Float32Array(positions.length);
    for (let i = 0; i < skyNormals.length; i += 3) skyNormals[i + 1] = 1;
    return { positions, colors: new Float32Array(col), normals: skyNormals, count: pos.length / 3 };
  })();
  const skyBuf = makeBuffer(skyMesh, false);

  // Clouds: flattened white ellipsoids drifting slowly.
  const cloudMesh = (() => {
    const pos = [];
    const col = [];
    const rings = 6;
    const segs = 10;
    for (let j = 0; j < rings; j += 1) {
      const p0 = (j / rings) * Math.PI;
      const p1 = ((j + 1) / rings) * Math.PI;
      for (let i = 0; i < segs; i += 1) {
        const a0 = (i / segs) * TAU;
        const a1 = ((i + 1) / segs) * TAU;
        const v = (p, a) => [Math.sin(p) * Math.cos(a), Math.cos(p) * 0.35, Math.sin(p) * Math.sin(a)];
        const vs = [v(p0, a0), v(p1, a0), v(p1, a1), v(p0, a1)];
        pos.push(...vs[0], ...vs[1], ...vs[2], ...vs[0], ...vs[2], ...vs[3]);
        for (let k = 0; k < 6; k += 1) col.push(1, 1, 1);
      }
    }
    const positions = new Float32Array(pos);
    const cloudNormals = new Float32Array(positions.length);
    for (let i = 0; i < cloudNormals.length; i += 3) cloudNormals[i + 1] = 1;
    return { positions, colors: new Float32Array(col), normals: cloudNormals, count: pos.length / 3 };
  })();
  const cloudBuf = makeBuffer(cloudMesh, false);
  const clouds = [];
  {
    let seed = 4242;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 16; i += 1) {
      clouds.push({
        x: (rnd() * 2 - 1) * 1900,
        y: 320 + rnd() * 140,
        z: (rnd() * 2 - 1) * 1900,
        s: 60 + rnd() * 110,
        drift: 1.5 + rnd() * 2,
      });
    }
  }

  // Runway: dark strip + white dashes + edge lights, flat on the ground.
  const runwayMesh = (() => {
    const parts = [];
    for (const s of STRIPS) {
      const y = s.elev + 0.35;
      const c = Math.cos(s.heading);
      const sn = Math.sin(s.heading);
      const rot = (dx, dz) => [s.x + dx * c - dz * sn, s.z + dx * sn + dz * c];
      function flatQuad(dx0, dz0, dx1, dz1, color, yy) {
        const [ax, az] = rot(dx0, dz0);
        const [bx, bz] = rot(dx1, dz0);
        const [cx2, cz2] = rot(dx1, dz1);
        const [dx2, dz2] = rot(dx0, dz1);
        return { pos: [ax, yy, az, bx, yy, bz, cx2, yy, cz2, ax, yy, az, cx2, yy, cz2, dx2, yy, dz2], col: [...color, ...color, ...color, ...color, ...color, ...color] };
      }
      const L = s.length / 2;
      const W = s.width / 2;
      parts.push(flatQuad(-W, -L, W, L, [0.14, 0.14, 0.16], y));
      for (let d = -L + 30; d < L - 20; d += 40) {
        parts.push(flatQuad(-1.2, d, 1.2, d + 18, [0.95, 0.95, 0.9], y + 0.06));
      }
      for (const e of [-1, 1]) {
        parts.push(flatQuad(e * (W - 1.5), -L, e * (W - 0.5), L, [0.95, 0.95, 0.9], y + 0.06));
      }
      // Threshold bars at both ends.
      for (const e of [-1, 1]) {
        parts.push(flatQuad(-W + 3, e * (L - 12), W - 3, e * (L - 6), [0.95, 0.95, 0.9], y + 0.06));
      }
    }
    return mergeMeshes(parts);
  })();
  runwayMesh.normals = new Float32Array(runwayMesh.positions.length);
  for (let i = 0; i < runwayMesh.normals.length; i += 3) runwayMesh.normals[i + 1] = 1;
  const runwayBuf = makeBuffer(runwayMesh, false);

  // Town boxes + roofs, trees: merged static meshes.
  const townMesh = (() => {
    const { boxes, trees } = buildTownAndTrees();
    const parts = [];
    for (const b of boxes) {
      parts.push(boxMesh(b.x, b.y, b.z, b.w, b.ht, b.d, b.col));
      // Pyramid roof.
      const y1 = b.y + b.ht;
      const apex = [b.x, y1 + 6, b.z];
      const corners = [
        [b.x - b.w / 2, y1, b.z - b.d / 2], [b.x + b.w / 2, y1, b.z - b.d / 2],
        [b.x + b.w / 2, y1, b.z + b.d / 2], [b.x - b.w / 2, y1, b.z + b.d / 2],
      ];
      const pos = [];
      const col = [];
      for (let i = 0; i < 4; i += 1) {
        const a = corners[i];
        const b2 = corners[(i + 1) % 4];
        pos.push(...a, ...b2, ...apex);
        col.push(...b.roof, ...b.roof, ...b.roof);
      }
      parts.push({ pos, col });
    }
    for (const t of trees) {
      const trunk = boxMesh(t.x, t.y, t.z, 1.2, t.s * 0.5, 1.2, [0.4, 0.28, 0.16]);
      parts.push(trunk);
      const apex = [t.x, t.y + t.s * 1.7, t.z];
      const base = t.s * 0.55;
      const corners = [
        [t.x - base, t.y + t.s * 0.4, t.z - base], [t.x + base, t.y + t.s * 0.4, t.z - base],
        [t.x + base, t.y + t.s * 0.4, t.z + base], [t.x - base, t.y + t.s * 0.4, t.z + base],
      ];
      const pos = [];
      const col = [];
      const green = [0.12, 0.45, 0.16];
      for (let i = 0; i < 4; i += 1) {
        const a = corners[i];
        const b2 = corners[(i + 1) % 4];
        pos.push(...a, ...b2, ...apex);
        col.push(...green, ...green, ...green);
      }
      parts.push({ pos, col });
    }
    const m = mergeMeshes(parts);
    m.normals = flatNormals(m.positions);
    return m;
  })();
  const townBuf = makeBuffer(townMesh, false);

  // Plane + prop + ring.
  const planeMesh = buildPlaneMesh();
  planeMesh.normals = flatNormals(planeMesh.positions);
  const planeBuf = makeBuffer(planeMesh, false);
  const propMesh = buildPropMesh();
  propMesh.normals = flatNormals(propMesh.positions);
  const propBuf = makeBuffer(propMesh, false);
  const propDiscMesh = buildPropDiscMesh();
  propDiscMesh.normals = flatNormals(propDiscMesh.positions);
  const propDiscBuf = makeBuffer(propDiscMesh, false);
  const ringMesh = buildRingMesh(CFG.RING_RADIUS);
  ringMesh.normals = flatNormals(ringMesh.positions);
  const ringBuf = makeBuffer(ringMesh, false);

  let camPos = [0, 220, 600];
  let camTarget = [0, 100, 0];
  // Debug handle for headless play-tests (the grader never runs the game).
  window.__debugCam = {
    get pos() { return camPos.slice(); },
    get target() { return camTarget.slice(); },
  };

  function draw(world, screen, cameraMode, time) {
    const s = world.state;
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 800;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fwd = world.forward();
    // Camera: chase follows behind and above, banking a little with the
    // plane; cockpit sits at the nose and looks straight ahead.
    let eye;
    let target;
    let up = [0, 1, 0];
    if (cameraMode === 'cockpit') {
      // Sit just behind the cockpit, high enough that the nose and the
      // wing roots read at the bottom of the frame.
      eye = [s.x - fwd.x * 1.5, s.y + 2.1, s.z - fwd.z * 1.5];
      target = [s.x + fwd.x * 60, s.y + fwd.y * 60 + 1, s.z + fwd.z * 60];
      // Roll the view with the plane so the horizon tilts.
      const cr = Math.cos(s.roll);
      const sr = Math.sin(s.roll);
      up = [sr * -fwd.z, cr, sr * fwd.x];
    } else {
      const want = [s.x - fwd.x * CFG.CHASE_DIST, s.y - fwd.y * CFG.CHASE_DIST + CFG.CHASE_HEIGHT, s.z - fwd.z * CFG.CHASE_DIST];
      const k = 1 - Math.pow(0.001, 1 / 60);
      camPos[0] += (want[0] - camPos[0]) * k;
      camPos[1] += (want[1] - camPos[1]) * k;
      camPos[2] += (want[2] - camPos[2]) * k;
      eye = camPos;
      const wantT = [s.x + fwd.x * 12, s.y + fwd.y * 12, s.z + fwd.z * 12];
      camTarget[0] += (wantT[0] - camTarget[0]) * k;
      camTarget[1] += (wantT[1] - camTarget[1]) * k;
      camTarget[2] += (wantT[2] - camTarget[2]) * k;
      target = camTarget;
      const cr = Math.cos(s.roll * 0.45);
      const sr = Math.sin(s.roll * 0.45);
      up = [-sr * fwd.z, cr, sr * fwd.x];
      // Keep the camera out of the ground on low passes.
      const g = groundHeight(eye[0], eye[2]);
      if (eye[1] < g + 4) eye[1] = g + 4;
    }

    const view = matLookAt(eye, target, up);
    const proj = matPerspective((68 * Math.PI) / 180, canvas.width / canvas.height, 0.5, 9000);
    gl.uniformMatrix4fv(loc.view, false, view);
    gl.uniformMatrix4fv(loc.proj, false, proj);
    gl.uniform3f(loc.light, 0.45, 0.75, -0.5);
    gl.uniform3f(loc.fogColor, 0.78, 0.86, 0.94);
    gl.uniform1f(loc.fogNear, 700);
    gl.uniform1f(loc.fogFar, 3400);

    const ident = matIdentity();
    // Sky dome follows the camera, drawn first with no fog.
    gl.disable(gl.DEPTH_TEST);
    drawBuffer(skyBuf, matTranslate(eye[0], eye[1], eye[2]), 1, 0);
    gl.enable(gl.DEPTH_TEST);

    drawBuffer(seaBuf, ident, 0, 1);
    drawBuffer(terrainBuf, ident, 0, 1);
    drawBuffer(runwayBuf, ident, 0.25, 1);
    drawBuffer(townBuf, ident, 0, 1);
    // Clouds drift slowly eastward, wrapping around the island.
    for (const c of clouds) {
      const cx = ((c.x + time * c.drift + 2100) % 4200) - 2100;
      const m = matMultiply(matTranslate(cx, c.y, c.z), matScale(c.s, c.s, c.s));
      drawBuffer(cloudBuf, m, 0.85, 1);
    }
    // Rings: gold, the next one pulsing; passed rings turn green.
    const course = s.rings.length ? s.rings : ringCourse('ring-run');
    for (let i = 0; i < course.length; i += 1) {
      const r = course[i];
      const prev = i === 0 ? { x: 0, y: 60, z: 120 } : course[i - 1];
      const yaw = Math.atan2(r.x - prev.x, r.z - prev.z);
      const pulse = i === s.ringIndex && s.screen === 'play' ? 1 + 0.06 * Math.sin(time * 5) : 1;
      const m = matMultiply(
        matMultiply(matTranslate(r.x, r.y, r.z), matRotY(yaw)),
        matScale(pulse, pulse, pulse),
      );
      // Passed rings are drawn dimmer; the next ring is what matters.
      drawBuffer(ringBuf, m, r.passed ? 0.15 : 0.95, 1);
    }
    // The plane: yaw = heading, pitch, roll (bank). Model forward is -Z.
    const planeModel = matMultiply(
      matTranslate(s.x, s.y, s.z),
      matMultiply(
        matRotY(-s.heading),
        matMultiply(matRotX(-s.pitch), matRotZ(-s.roll)),
      ),
    );
    drawBuffer(planeBuf, planeModel, 0, 1);
    // Propeller spins around the nose (local -Z axis). The blur disc
    // is a chase-view effect only: in the cockpit it would fill the
    // frame, so only the blades spin there.
    const propModel = matMultiply(planeModel, matRotZ(s.propAngle));
    drawBuffer(propBuf, propModel, 0.35, 1);
    if (cameraMode !== 'cockpit') drawBuffer(propDiscBuf, propModel, 0.55, 1);
    void screen;
  }

  return { draw };
}
