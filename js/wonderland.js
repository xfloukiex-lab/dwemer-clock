import * as THREE from 'three';
import { wheelGeometry } from './parts.js';

// What the tunnel opens into: a Dwemer city.
//
// The barrel is twenty units of dark bronze, so the reward has to be SCALE.
// Before, it opened into a few big wheels and a sky — which stopped the journey
// inside the machine instead of taking you out the other side of it (Flouk,
// 2026-07-30: "it stops inside the clock, its supposed to go through the clock
// and then show a detailed dwarven city").
//
// So: you come out of the movement high over a cavern, banked towers on both
// sides, aqueduct pipes and walkways crossing overhead, gears built into the
// architecture, and a great clock tower on the axis at the far end — the same
// machine you just flew through, city-sized.
//
// Everything here is instanced and generated from a fixed seed: identical every
// load, one draw call per KIND of thing, and it holds up on a phone.

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
  g.addColorStop(0, '#0a0806');      // cavern roof, lost in the dark
  g.addColorStop(0.3, '#1d1409');
  g.addColorStop(0.44, '#ffe9bd');   // the great vents, glowing above the city
  g.addColorStop(0.52, '#d2914a');
  g.addColorStop(0.6, '#5c3717');
  g.addColorStop(0.72, '#150d07');
  g.addColorStop(1, '#07060a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, mouth = -34, tier = 'high') {
  const LIGHT = tier === 'low';
  const group = new THREE.Group();
  scene.add(group);

  const rand = rng(0x0d3e3e);
  const M = {
    stone: new THREE.MeshStandardMaterial({ color: 0x7a6038, metalness: 0.4, roughness: 0.8, envMapIntensity: 0.45 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xb58a42, metalness: 0.95, roughness: 0.4, envMapIntensity: 0.8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2116, metalness: 0.6, roughness: 0.8, envMapIntensity: 0.25 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffb457, toneMapped: false, fog: true, transparent: true }),
  };

  // --- the cavern -----------------------------------------------------------
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(420, 48, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, toneMapped: false, fog: false }),
  );
  shell.position.z = mouth - 200;
  group.add(shell);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.dark);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, GROUND, mouth - 200);
  group.add(floor);

  // Light: a hemisphere for the cavern glow plus one hard key from up ahead, so
  // every tower reads as a silhouette against the vents. Point lights at this
  // scale cost far more than they buy.
  const hemi = new THREE.HemisphereLight(0xffce8e, 0x120a04, 0);
  group.add(hemi);
  // A directional light travels from its position TOWARDS its target, so one
  // placed at the far end of the cavern lights the far side of everything and
  // leaves every face you can actually see in the dark — which is exactly what
  // it did on the first render. The key belongs BEHIND the camera; the rim from
  // the far vents is the second light, and only the second.
  const key = new THREE.DirectionalLight(0xffd2a0, 0);
  key.position.set(-52, 78, mouth + 90);
  group.add(key);
  const rim = new THREE.DirectionalLight(0xffbf78, 0);
  rim.position.set(46, 40, mouth - 300);
  group.add(rim);

  // --- generate the skyline -------------------------------------------------
  const blocks = [];   // stacked stone/bronze masses
  const domes = [];
  const lamps = [];    // amber windows — emissive quads, not lights
  const pipes = [];    // aqueducts, walkways, spans

  function tower(cx, cz, baseW, height) {
    let y = GROUND;
    let w = baseW;
    let bronzeTop = false;
    while (y < GROUND + height) {
      const h = 5 + rand() * 9;
      blocks.push({ x: cx, y: y + h / 2, z: cz, w, h, d: w, bronze: bronzeTop });
      // Amber windows on the face that looks BACK at the camera. Putting them on
      // the corridor-facing side sounded right and rendered nothing: you fly
      // straight down the corridor, so those planes are edge-on the whole way
      // and the city had no lit glass in it at all.
      const rowN = Math.max(1, Math.round(h / 3));
      for (let i = 0; i < rowN; i++) {
        if (rand() < 0.4) continue;
        lamps.push({
          x: cx + (rand() - 0.5) * w * 0.7,
          y: y + 1.5 + i * (h / rowN),
          z: cz + w / 2 + 0.05,
          s: 0.6 + rand() * 0.9,
          face: 0,
        });
      }
      y += h;
      w *= 0.78 + rand() * 0.14;
      bronzeTop = bronzeTop || rand() < 0.3;
    }
    domes.push({ x: cx, y, z: cz, r: w * 0.66 });
    // A collar of pipe running off the top into the dark.
    if (rand() < 0.5) {
      pipes.push({
        x: cx, y: y + 1, z: cz, len: 14 + rand() * 26, r: 0.5 + rand() * 0.5,
        axis: 'x', dir: cx < 0 ? -1 : 1,
      });
    }
  }

  // Two banks flanking the corridor, receding into the haze. The corridor
  // itself (|x| < 22) is kept clear — that is what the camera flies down.
  const ROWS = LIGHT ? 8 : 13;
  for (let i = 0; i < ROWS; i++) {
    const z = mouth - 45 - i * (LIGHT ? 38 : 24) - rand() * 8;
    for (const side of [-1, 1]) {
      const near = side * (24 + rand() * 16);
      tower(near, z, 9 + rand() * 7, 26 + rand() * 34);
      if (!LIGHT || i % 2 === 0) {
        tower(side * (58 + rand() * 40), z - rand() * 20, 12 + rand() * 10, 34 + rand() * 46);
      }
    }
  }

  // Spans crossing the corridor — you fly UNDER these, which is most of the
  // reason the city reads as big.
  for (let i = 0; i < (LIGHT ? 4 : 8); i++) {
    const z = mouth - 40 - i * (LIGHT ? 60 : 32);
    pipes.push({ x: 0, y: 26 + rand() * 34, z, len: 150, r: 1.1 + rand() * 1.3, axis: 'x', dir: 1, span: true });
    if (rand() < 0.6) {
      pipes.push({ x: 0, y: GROUND + 6 + rand() * 6, z: z - 8, len: 130, r: 0.8, axis: 'x', dir: 1, span: true });
    }
  }

  // The avenue: lamp standards down both sides of the corridor, running to the
  // great tower. Without them the whole lower half of the shot is bare floor,
  // and nothing leads the eye anywhere.
  const posts = [];
  for (let i = 0; i < (LIGHT ? 12 : 22); i++) {
    const z = mouth - 34 - i * 22;
    for (const side of [-1, 1]) {
      posts.push({ x: side * 15, z });
      lamps.push({ x: side * 15, y: GROUND + 11.4, z: z + 0.3, s: 1.6, face: 0 });
    }
  }

  // --- push it all into instanced meshes ------------------------------------
  const dummy = new THREE.Object3D();

  function instance(geo, mat, n) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;   // one object, spread over the whole cavern
    group.add(m);
    return m;
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const stoneBlocks = blocks.filter((b) => !b.bronze);
  const bronzeBlocks = blocks.filter((b) => b.bronze);
  for (const [set, mat] of [[stoneBlocks, M.stone], [bronzeBlocks, M.bronze]]) {
    if (!set.length) continue;
    const im = instance(boxGeo, mat, set.length);
    set.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
  }

  const domeIM = instance(
    new THREE.SphereGeometry(1, LIGHT ? 10 : 16, LIGHT ? 6 : 10, 0, Math.PI * 2, 0, Math.PI / 2),
    M.bronze, domes.length,
  );
  domes.forEach((d, i) => {
    dummy.position.set(d.x, d.y, d.z);
    dummy.scale.set(d.r, d.r * 0.8, d.r);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    domeIM.setMatrixAt(i, dummy.matrix);
  });

  const lampIM = instance(new THREE.PlaneGeometry(1, 1), M.lamp, Math.max(1, lamps.length));
  lamps.forEach((l, i) => {
    dummy.position.set(l.x, l.y, l.z);
    dummy.scale.set(l.s, l.s * 1.5, 1);
    dummy.rotation.set(0, l.face * (Math.PI / 2), 0);
    dummy.updateMatrix();
    lampIM.setMatrixAt(i, dummy.matrix);
  });

  const postIM = instance(new THREE.CylinderGeometry(0.4, 0.55, 11, 8), M.bronze, posts.length);
  posts.forEach((s, i) => {
    dummy.position.set(s.x, GROUND + 5.5, s.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    postIM.setMatrixAt(i, dummy.matrix);
  });

  const pipeIM = instance(new THREE.CylinderGeometry(1, 1, 1, LIGHT ? 6 : 10), M.bronze, pipes.length);
  pipes.forEach((p, i) => {
    dummy.position.set(p.span ? 0 : p.x + p.dir * p.len / 2, p.y, p.z);
    dummy.scale.set(p.r, p.len, p.r);
    dummy.rotation.set(0, 0, Math.PI / 2);   // lie it along X
    dummy.updateMatrix();
    pipeIM.setMatrixAt(i, dummy.matrix);
  });

  // --- gears built into the architecture ------------------------------------
  // The city runs on the same machine you flew through. These are real wheels
  // from parts.js, not decoration — same involute teeth.
  const cityGears = [];
  const GSPEC = LIGHT
    ? [{ r: 16, N: 64, x: -34, y: 6, z: -58, sp: 0.05 }, { r: 22, N: 84, x: 40, y: 14, z: -96, sp: -0.035 }]
    : [
      { r: 16, N: 64, x: -34, y: 6, z: -58, sp: 0.05 },
      { r: 22, N: 84, x: 40, y: 14, z: -96, sp: -0.035 },
      { r: 11, N: 48, x: 27, y: -12, z: -46, sp: 0.08 },
      { r: 30, N: 108, x: -58, y: 26, z: -150, sp: -0.022 },
      { r: 13, N: 52, x: -24, y: 34, z: -120, sp: 0.045 },
    ];
  for (const s of GSPEC) {
    const mesh = new THREE.Mesh(wheelGeometry(s.N, (s.r * 2) / s.N, s.r * 0.07, 6), M.bronze);
    mesh.position.set(s.x, s.y, mouth + s.z);
    group.add(mesh);
    cityGears.push({ mesh, sp: s.sp });
  }

  // --- the great clock tower, dead ahead ------------------------------------
  // The payoff: the thing you wound, city-sized, at the end of the avenue.
  const tower0 = new THREE.Group();
  tower0.position.set(0, 0, mouth - 300);
  group.add(tower0);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(17, 23, 96, LIGHT ? 12 : 24), M.stone);
  shaft.position.y = GROUND + 48;
  tower0.add(shaft);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(18.5 - i * 1.1, 1.1, 6, LIGHT ? 16 : 32), M.bronze);
    band.rotation.x = Math.PI / 2;
    band.position.y = GROUND + 16 + i * 24;
    tower0.add(band);
  }
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(18, LIGHT ? 12 : 22, LIGHT ? 8 : 14, 0, Math.PI * 2, 0, Math.PI / 2),
    M.bronze,
  );
  cap.position.y = GROUND + 96;
  tower0.add(cap);

  const faceY = GROUND + 62;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(13, 48), M.dark);
  dial.position.set(0, faceY, 23.4);
  tower0.add(dial);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(13.4, 1.3, 8, 48), M.bronze);
  bezel.position.set(0, faceY, 23.4);
  tower0.add(bezel);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(12.2, 48),
    new THREE.MeshBasicMaterial({ color: 0xffb457, toneMapped: false, transparent: true, opacity: 0.5 }),
  );
  glow.position.set(0, faceY, 23.2);
  tower0.add(glow);
  // Two hands, turning — the city keeps time.
  const hands = [];
  for (const [len, w] of [[10.5, 0.7], [7.2, 1.0]]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.6), M.bronze);
    h.geometry.translate(0, len / 2, 0);
    h.position.set(0, faceY, 24.0);
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
    lampIM.material.opacity = open;
    motes.material.opacity = open * 0.5;
    glow.material.opacity = open * 0.5;
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
