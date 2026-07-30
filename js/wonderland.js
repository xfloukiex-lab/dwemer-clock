import * as THREE from 'three';
import { wheelGeometry } from './parts.js';

// What the tunnel opens into. After twenty units of dark bronze the reward has
// to be scale and light — the wardrobe-door moment. Same machine, except the
// gears are now the size of buildings and there is a sky behind them.

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const ctx = c.getContext('2d');
  // The camera looks HORIZONTALLY out of the tunnel, so it only ever sees a
  // narrow band of this sphere either side of the equator — roughly v 0.40 to
  // 0.60. A gradient spread evenly top-to-bottom puts nothing but mid-brown in
  // that band, which is why the chamber read as a flat wash. Pack the range
  // into the band that is actually on screen.
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#0b0907');     // straight up, dark
  g.addColorStop(0.28, '#241708');
  g.addColorStop(0.42, '#ffeec6');  // the light comes in just above the horizon
  g.addColorStop(0.5, '#dfa155');
  g.addColorStop(0.57, '#6b4119');
  g.addColorStop(0.68, '#1d1209');
  g.addColorStop(1, '#07060a');     // the floor falls away into dark
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createChamber(scene, mouth = -34) {
  const group = new THREE.Group();
  scene.add(group);

  const MODULE = 0.135;
  const bronze = new THREE.MeshStandardMaterial({
    color: 0xa87d42, metalness: 0.9, roughness: 0.4,
  });

  // The chamber shell — a sky you are inside.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, toneMapped: false, fog: false }),
  );
  shell.position.z = mouth - 60;
  group.add(shell);

  const sun = new THREE.PointLight(0xffdda0, 0, 400, 1.2);
  sun.position.set(-14, 26, mouth - 60);
  group.add(sun);
  const fill = new THREE.HemisphereLight(0xffd9a0, 0x22160a, 0);
  group.add(fill);

  // Cathedral-scale wheels, turning slowly enough to feel heavy.
  const giants = [];
  // Kept off the flight path (the camera stops at -44) but INSIDE the frame.
  // These were spread wide enough to compose on a laptop; on a phone the
  // horizontal field is less than half as wide, so every one of them sat off
  // screen and the reveal was an empty brown wash. Placed by the narrow field,
  // they read on both — a phone sees the wheels, a desktop sees more of them.
  const SPEC = [
    { N: 90, r: 22, x: -26, y: -14, z: -36, sp: 0.012, arms: 7 },
    { N: 120, r: 32, x: 34, y: 22, z: -52, sp: -0.008, arms: 8 },
    { N: 70, r: 16, x: 16, y: -22, z: -42, sp: 0.018, arms: 6 },
    { N: 150, r: 44, x: -22, y: 50, z: -84, sp: -0.005, arms: 9 },
    { N: 60, r: 12, x: -13, y: 12, z: -34, sp: 0.03, arms: 5 },
  ];
  for (const s of SPEC) {
    // Pick a module that makes this many teeth come out at the wanted radius.
    const mod = (s.r * 2) / s.N;
    const mesh = new THREE.Mesh(wheelGeometry(s.N, mod, s.r * 0.06, s.arms), bronze);
    mesh.position.set(s.x, s.y, mouth + s.z);
    group.add(mesh);
    giants.push({ mesh, sp: s.sp });
  }

  // A far arch of light to walk toward. It is `toneMapped: false`, so at low
  // tier — no bloom to spread it — a big pure-white disc just reads as a hole
  // punched in the picture. Smaller and warmer holds its shape.
  const arch = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 48),
    new THREE.MeshBasicMaterial({ color: 0xf6dcaa, toneMapped: false, transparent: true }),
  );
  arch.position.set(0, 2, mouth - 96);
  group.add(arch);

  // Framed, so it reads as a way OUT rather than a pale disc floating in haze.
  const archRing = new THREE.Mesh(new THREE.TorusGeometry(6.9, 0.55, 10, 64), bronze);
  archRing.position.copy(arch.position);
  group.add(archRing);

  // Dust hanging in the light.
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 90;
    pos[i * 3 + 2] = mouth - Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.5, color: 0xffe6bb, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  group.add(motes);

  group.visible = false;

  // `open` runs 0→1 as the camera clears the mouth of the tunnel. Fog is owned
  // by the timeline in site.js, not here.
  function update(dt, t, open) {
    group.visible = open > 0.001;
    if (!group.visible) return;
    // 9000 cd blew every wheel out to flat cream — no tooth shadow left, so the
    // gears stopped reading as gears. Lower key, more hemisphere fill.
    sun.intensity = open * 3400;
    fill.intensity = open * 1.5;
    motes.material.opacity = open * 0.6;
    arch.material.opacity = open;
    for (const g of giants) g.mesh.rotation.z = t * g.sp;
    const p = geo.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + dt * 0.5;
      if (y > 45) y -= 90;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }

  return { group, update };
}
