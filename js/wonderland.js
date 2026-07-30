import * as THREE from 'three';
import { wheelGeometry } from './parts.js';

// What the tunnel opens into: a Dwemer city.
//
// First attempt at this was stacked boxes with dome hats, and Flouk called it
// exactly right — "all basic shapes". Box + sphere is not Dwarven architecture.
// What actually reads as Dwemer, in silhouette, from a long way off:
//
//   · TIERED towers — plinth, corbelled setbacks, a cornice — never a plain box
//   · FACETED bodies, not smooth cylinders (low-segment lathes; the facets are
//     the fluting)
//   · pointed LANCET arches, tall and narrow, in rows
//   · angular BUTTRESS spurs kicking out of the base
//   · a faceted CAP with a finial spike on top
//   · rivet bands on every seam, and gear rosettes set flat into the facades
//   · colonnades lining the avenue
//
// All of it is generated from three lathe profiles and instanced, so the whole
// skyline is a handful of draw calls and a phone can carry it.

const GROUND = -30;

// Deterministic — a designed shot, not a different city per visit.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Profiles in (radius, height), both normalised 0..1, so one geometry can be
// scaled into any tower. The steps ARE the architecture: every ledge is a
// corbel, every pinch is a setback.
const PROFILES = [
  // Broad, heavily tiered — the civic block.
  [[0, 0], [1.3, 0], [1.3, 0.04], [1.14, 0.06], [1.14, 0.1], [1.0, 0.12],
    [1.0, 0.4], [1.16, 0.42], [1.16, 0.47], [0.94, 0.49],
    [0.94, 0.68], [1.08, 0.7], [1.08, 0.74], [0.82, 0.76],
    [0.82, 0.84], [0.96, 0.86], [0.52, 0.95], [0.16, 0.985], [0.05, 1]],
  // Slender shaft — the spires between them.
  [[0, 0], [1.15, 0], [1.15, 0.035], [0.92, 0.055], [0.92, 0.5],
    [1.04, 0.52], [1.04, 0.56], [0.78, 0.58], [0.78, 0.8],
    [0.9, 0.82], [0.38, 0.94], [0.1, 0.99], [0.04, 1]],
  // Squat, huge corbel, stepped crown — the machine halls.
  [[0, 0], [1.35, 0], [1.35, 0.07], [1.2, 0.09], [1.2, 0.42],
    [1.42, 0.45], [1.42, 0.52], [1.16, 0.54], [1.16, 0.66],
    [1.26, 0.68], [1.26, 0.72], [0.86, 0.75], [0.86, 0.86],
    [0.62, 0.9], [0.3, 0.97], [0.08, 1]],
];

// A lancet arch — the Dwemer window. Unit width, unit-ish height.
function archShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0);
  s.lineTo(-0.5, 0.62);
  s.quadraticCurveTo(-0.5, 1.12, 0, 1.4);
  s.quadraticCurveTo(0.5, 1.12, 0.5, 0.62);
  s.lineTo(0.5, 0);
  s.closePath();
  return s;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext('2d');
  // The camera looks HORIZONTALLY out of the tunnel and only ever sees a narrow
  // band of this sphere either side of the equator. A gradient spread evenly
  // top-to-bottom puts nothing but mid-brown on screen — pack the range into
  // the band that is actually visible.
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#08070a');      // cavern roof, lost in the dark
  g.addColorStop(0.3, '#1b1409');
  g.addColorStop(0.44, '#ffeec4');   // the great vents, glowing above the city
  g.addColorStop(0.52, '#cf8b45');
  g.addColorStop(0.6, '#54321a');
  g.addColorStop(0.72, '#130c07');
  g.addColorStop(1, '#07060a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, mouth = -34, tier = 'high') {
  const LIGHT = tier === 'low';
  const SEG = LIGHT ? 8 : 10;   // low segment count IS the faceting
  const group = new THREE.Group();
  scene.add(group);

  const rand = rng(0x0d3e3e);
  const M = {
    brass: new THREE.MeshStandardMaterial({ color: 0xa8802f, metalness: 0.92, roughness: 0.44, envMapIntensity: 0.75 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xc09144, metalness: 0.95, roughness: 0.36, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2015, metalness: 0.7, roughness: 0.75, envMapIntensity: 0.3 }),
    // Terraces and floor are CUT STONE, not metal — left metallic they caught the
    // key light and blew out to flat cream slabs.
    stone: new THREE.MeshStandardMaterial({ color: 0x37291a, metalness: 0.05, roughness: 0.96, envMapIntensity: 0.2 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffb457, toneMapped: false, fog: true, transparent: true, side: THREE.DoubleSide }),
  };

  // --- the cavern -----------------------------------------------------------
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(420, 48, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, toneMapped: false, fog: false }),
  );
  shell.position.z = mouth - 200;
  group.add(shell);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.stone);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, GROUND, mouth - 200);
  group.add(floor);

  // A directional light travels FROM its position TOWARDS its target, so the key
  // has to sit BEHIND the camera or it lights the far side of everything and
  // leaves every visible face black. The far light is a rim, and only a rim.
  const hemi = new THREE.HemisphereLight(0xffce8e, 0x120a04, 0);
  group.add(hemi);
  const key = new THREE.DirectionalLight(0xffd2a0, 0);
  key.position.set(-52, 78, mouth + 90);
  group.add(key);
  const rim = new THREE.DirectionalLight(0xffbf78, 0);
  rim.position.set(46, 40, mouth - 300);
  group.add(rim);

  // --- lay out the skyline --------------------------------------------------
  const towers = [[], [], []];   // one bucket per profile
  const finials = [];
  const spurs = [];              // buttress kicks at the base
  const rivets = [];
  const windows = [];
  const rosettes = [];

  function tower(cx, cz, R, H, kind) {
    towers[kind].push({ x: cx, z: cz, R, H });
    finials.push({ x: cx, z: cz, y: GROUND + H, r: R * 0.09, h: R * 0.9 });

    // Buttress spurs — four kicks out of the plinth. This is the single biggest
    // "not a box" tell in the silhouette.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
      spurs.push({
        x: cx + Math.cos(a) * R * 1.08, z: cz + Math.sin(a) * R * 1.08, a,
        w: R * 0.36, h: H * 0.34, d: R * 0.7,
      });
    }

    // Rivet bands on the seams.
    const bands = [0.06, 0.42, 0.7];
    for (const b of bands) {
      const n = Math.max(8, Math.round(R * 2.6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        rivets.push({
          x: cx + Math.cos(a) * R * 1.11, y: GROUND + H * b + H * 0.02,
          z: cz + Math.sin(a) * R * 1.11, s: R * 0.05,
        });
      }
    }

    // Lancet windows, in rows, on the face that looks back at the camera.
    // Putting them on the corridor-facing sides rendered nothing: you fly
    // straight down the corridor, so those planes are edge-on the whole way.
    const rowsN = Math.max(2, Math.round(H / 13));
    for (let r = 0; r < rowsN; r++) {
      const y = GROUND + H * (0.16 + r * (0.62 / rowsN));
      const perRow = R > 8 ? 3 : 2;
      for (let i = 0; i < perRow; i++) {
        const off = (i - (perRow - 1) / 2) * (R * 0.62);
        windows.push({
          x: cx + off, y, z: cz + Math.sqrt(Math.max(0.2, R * R - off * off)) * 0.99,
          w: R * 0.26, h: H * 0.055,
        });
      }
    }

    // A gear set flat into the facade, on some of them.
    if (R > 7 && rand() < 0.55) {
      rosettes.push({ x: cx, y: GROUND + H * 0.78, z: cz + R * 0.98, r: R * 0.5, sp: (rand() - 0.5) * 0.09 });
    }
  }

  // Two banks flanking the corridor, receding into the haze. The corridor
  // itself (|x| < 22) is kept clear — that is what the camera flies down.
  const ROWS = LIGHT ? 8 : 13;
  for (let i = 0; i < ROWS; i++) {
    const z = mouth - 46 - i * (LIGHT ? 38 : 24) - rand() * 8;
    for (const side of [-1, 1]) {
      tower(side * (26 + rand() * 12), z, 5 + rand() * 4, 26 + rand() * 30, rand() < 0.45 ? 1 : 0);
      if (!LIGHT || i % 2 === 0) {
        tower(side * (56 + rand() * 38), z - rand() * 20, 7 + rand() * 6, 34 + rand() * 46,
          rand() < 0.35 ? 2 : (rand() < 0.5 ? 1 : 0));
      }
    }
  }

  // --- the avenue -----------------------------------------------------------
  // Terraces the towers stand on, and a colonnade down both sides. Bare floor
  // under a skyline reads as models on a table.
  const terraceMat = M.stone;
  for (const side of [-1, 1]) {
    for (let step = 0; step < 3; step++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(14 + step * 10, 3 + step * 2.5, 420), terraceMat);
      t.position.set(side * (22 + step * 11), GROUND + (3 + step * 2.5) / 2 - step * 0.4, mouth - 220);
      group.add(t);
    }
  }

  const columns = [];
  const lintels = [];
  for (let i = 0; i < (LIGHT ? 16 : 30); i++) {
    const z = mouth - 40 - i * 11;
    for (const side of [-1, 1]) {
      columns.push({ x: side * 19, z });
      windows.push({ x: side * 19, y: GROUND + 11.6, z: z + 0.9, w: 1.5, h: 1.6 });
    }
  }
  for (let i = 0; i < (LIGHT ? 8 : 15); i++) {
    const z = mouth - 45 - i * 22;
    for (const side of [-1, 1]) lintels.push({ x: side * 19, z, len: 22 });
  }

  // Aqueducts and walkways crossing the corridor — you fly UNDER these, which is
  // most of the reason the city reads as big.
  // Only in the NEAR half. A walkway far down the avenue sits at almost the same
  // screen height as the great tower's dial and draws a bar straight across it;
  // close in, perspective throws it well clear above your head.
  const spans = [];
  for (let i = 0; i < (LIGHT ? 4 : 6); i++) {
    const z = mouth - 50 - i * 22;
    spans.push({ y: 26 + rand() * 16, z, r: 0.55 + rand() * 0.3 });
  }

  // --- build the instanced meshes -------------------------------------------
  const dummy = new THREE.Object3D();
  function instance(geo, mat, n) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.frustumCulled = false;
    group.add(m);
    return m;
  }

  PROFILES.forEach((pts, k) => {
    if (!towers[k].length) return;
    const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), SEG);
    const im = instance(geo, k === 2 ? M.brass : M.bronze, towers[k].length);
    towers[k].forEach((t, i) => {
      dummy.position.set(t.x, GROUND, t.z);
      dummy.scale.set(t.R, t.H, t.R);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
  });

  const finialIM = instance(new THREE.ConeGeometry(1, 1, 6), M.bronze, finials.length);
  finials.forEach((f, i) => {
    dummy.position.set(f.x, f.y + f.h / 2, f.z);
    dummy.scale.set(f.r, f.h, f.r);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    finialIM.setMatrixAt(i, dummy.matrix);
  });

  const spurIM = instance(new THREE.BoxGeometry(1, 1, 1), M.brass, spurs.length);
  spurs.forEach((s, i) => {
    dummy.position.set(s.x, GROUND + s.h / 2, s.z);
    dummy.scale.set(s.w, s.h, s.d);
    dummy.rotation.set(0, -s.a, 0);
    dummy.updateMatrix();
    spurIM.setMatrixAt(i, dummy.matrix);
  });

  const rivetIM = instance(new THREE.SphereGeometry(1, 6, 5), M.brass, rivets.length);
  rivets.forEach((r, i) => {
    dummy.position.set(r.x, r.y, r.z);
    dummy.scale.set(r.s, r.s, r.s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    rivetIM.setMatrixAt(i, dummy.matrix);
  });

  const winIM = instance(new THREE.ShapeGeometry(archShape(), 8), M.lamp, windows.length);
  windows.forEach((w, i) => {
    dummy.position.set(w.x, w.y, w.z);
    dummy.scale.set(w.w, w.h, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    winIM.setMatrixAt(i, dummy.matrix);
  });

  const colIM = instance(new THREE.CylinderGeometry(0.62, 0.78, 11, 8), M.bronze, columns.length);
  columns.forEach((c, i) => {
    dummy.position.set(c.x, GROUND + 5.5, c.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    colIM.setMatrixAt(i, dummy.matrix);
  });

  const linIM = instance(new THREE.BoxGeometry(1, 1, 1), M.brass, lintels.length);
  lintels.forEach((l, i) => {
    dummy.position.set(l.x, GROUND + 11.9, l.z);
    dummy.scale.set(2.6, 1.5, l.len);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    linIM.setMatrixAt(i, dummy.matrix);
  });

  // A bridge is a DECK with rails, not a pipe. Bare tubes crossing the avenue
  // read as scaffolding.
  const deckIM = instance(new THREE.BoxGeometry(150, 1.1, 6), M.brass, spans.length);
  const railIM = instance(new THREE.CylinderGeometry(1, 1, 150, LIGHT ? 6 : 8), M.bronze, spans.length * 2);
  spans.forEach((s, i) => {
    dummy.position.set(0, s.y, s.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    deckIM.setMatrixAt(i, dummy.matrix);
    for (const side of [0, 1]) {
      dummy.position.set(0, s.y + 2.2, s.z + (side ? 2.6 : -2.6));
      dummy.scale.set(s.r, 1, s.r);
      dummy.rotation.set(0, 0, Math.PI / 2);
      dummy.updateMatrix();
      railIM.setMatrixAt(i * 2 + side, dummy.matrix);
    }
  });

  // --- gears in the architecture --------------------------------------------
  // Real wheels from parts.js — the city runs on the machine you flew through.
  const cityGears = [];
  for (const r of rosettes.slice(0, LIGHT ? 4 : 10)) {
    const N = Math.max(24, Math.round(r.r * 4));
    const mesh = new THREE.Mesh(wheelGeometry(N, (r.r * 2) / N, r.r * 0.12, 6), M.brass);
    mesh.position.set(r.x, r.y, r.z);
    group.add(mesh);
    cityGears.push({ mesh, sp: r.sp });
  }
  for (const s of (LIGHT
    ? [{ r: 17, x: -40, y: 4, z: -70, sp: 0.045 }]
    : [{ r: 17, x: -40, y: 4, z: -70, sp: 0.045 },
      { r: 26, x: 48, y: 18, z: -118, sp: -0.03 },
      { r: 12, x: 30, y: -14, z: -58, sp: 0.07 }])) {
    const N = Math.round(s.r * 4);
    const mesh = new THREE.Mesh(wheelGeometry(N, (s.r * 2) / N, s.r * 0.08, 7), M.bronze);
    mesh.position.set(s.x, s.y, mouth + s.z);
    group.add(mesh);
    cityGears.push({ mesh, sp: s.sp });
  }

  // --- the great clock tower, dead ahead ------------------------------------
  // The payoff: the thing you wound, city-sized, at the end of the avenue.
  const tower0 = new THREE.Group();
  tower0.position.set(0, GROUND, mouth - 300);
  group.add(tower0);

  const H0 = 108;
  const R0 = 21;
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(PROFILES[0].map(([r, y]) => new THREE.Vector2(r * R0, y * H0)), LIGHT ? 10 : 14),
    M.bronze,
  );
  tower0.add(body);
  // Vertical fluting — worth the extra meshes on the one building you stare at.
  for (let i = 0; i < (LIGHT ? 10 : 16); i++) {
    const a = (i / (LIGHT ? 10 : 16)) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.5, H0 * 0.36, 1.5), M.brass);
    rib.position.set(Math.cos(a) * R0 * 1.02, H0 * 0.22, Math.sin(a) * R0 * 1.02);
    rib.rotation.y = -a;
    tower0.add(rib);
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    // Kept small and low: at 0.4R × 0.3H they read as flat slabs pasted on the
    // shaft, not buttresses.
    const spur = new THREE.Mesh(new THREE.BoxGeometry(R0 * 0.2, H0 * 0.14, R0 * 0.5), M.brass);
    spur.position.set(Math.cos(a) * R0 * 1.15, H0 * 0.07, Math.sin(a) * R0 * 1.15);
    spur.rotation.y = -a;
    tower0.add(spur);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 22, 6), M.bronze);
  spire.position.y = H0 + 11;
  tower0.add(spire);

  const faceY = H0 * 0.6;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(12.5, 48), M.dark);
  dial.position.set(0, faceY, R0 * 1.02);
  tower0.add(dial);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(12.9, 1.25, 8, 48), M.bronze);
  bezel.position.copy(dial.position);
  tower0.add(bezel);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(11.8, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb457, toneMapped: false, transparent: true, opacity: 0.45 }),
  );
  glow.position.set(0, faceY, R0 * 1.0);
  tower0.add(glow);
  // Twelve marks, so it reads as a dial and not a porthole.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, i % 3 === 0 ? 2.4 : 1.4, 0.4), M.bronze);
    m.position.set(Math.cos(a) * 10.6, faceY + Math.sin(a) * 10.6, R0 * 1.06);
    m.rotation.z = a - Math.PI / 2;
    tower0.add(m);
  }
  const hands = [];
  for (const [len, w] of [[10, 0.75], [6.8, 1.1]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.6), M.brass);
    h.geometry.translate(0, len / 2, 0);
    h.position.set(0, faceY, R0 * 1.09);
    tower0.add(h);
    hands.push(h);
  }

  // --- steam and motes ------------------------------------------------------
  const N = LIGHT ? 500 : 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 260;
    pos[i * 3 + 1] = GROUND + Math.random() * 110;
    pos[i * 3 + 2] = mouth - Math.random() * 260;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.7, color: 0xffe0b0, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  motes.frustumCulled = false;
  group.add(motes);

  group.visible = false;

  // `open` runs 0→1 as the camera clears the mouth. Fog belongs to the timeline
  // in site.js, not here.
  function update(dt, t, open) {
    group.visible = open > 0.001;
    if (!group.visible) return;
    hemi.intensity = open * 3.1;
    key.intensity = open * 2.9;
    rim.intensity = open * 1.8;
    M.lamp.opacity = open;
    motes.material.opacity = open * 0.5;
    glow.material.opacity = open * 0.45;
    for (const g of cityGears) g.mesh.rotation.z = t * g.sp;
    hands[0].rotation.z = -t * 0.09;
    hands[1].rotation.z = -t * 0.011;
    const p = geo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + dt * 1.4;
      if (y > GROUND + 110) y -= 110;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }

  return { group, update };
}
