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
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f7e6bd');   // high, warm and bright
  g.addColorStop(0.35, '#e0a95c');
  g.addColorStop(0.62, '#8a5a2c');
  g.addColorStop(0.85, '#2c1d10');
  g.addColorStop(1, '#0a0705');   // the floor falls away into dark
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
  // Every one of these is kept well off the axis and well downrange. A wheel
  // this size sitting near the flight path just fills the screen with one tooth.
  const SPEC = [
    { N: 90, r: 22, x: -44, y: -12, z: -30, sp: 0.012, arms: 7 },
    { N: 120, r: 32, x: 54, y: 18, z: -50, sp: -0.008, arms: 8 },
    { N: 70, r: 16, x: 24, y: -32, z: -38, sp: 0.018, arms: 6 },
    { N: 150, r: 44, x: -30, y: 46, z: -78, sp: -0.005, arms: 9 },
    { N: 60, r: 12, x: -20, y: 17, z: -28, sp: 0.03, arms: 5 },
  ];
  for (const s of SPEC) {
    // Pick a module that makes this many teeth come out at the wanted radius.
    const mod = (s.r * 2) / s.N;
    const mesh = new THREE.Mesh(wheelGeometry(s.N, mod, s.r * 0.06, s.arms), bronze);
    mesh.position.set(s.x, s.y, mouth + s.z);
    group.add(mesh);
    giants.push({ mesh, sp: s.sp });
  }

  // A far arch of light to walk toward.
  const arch = new THREE.Mesh(
    new THREE.CircleGeometry(9, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff0cf, toneMapped: false }),
  );
  arch.position.set(0, 2, mouth - 96);
  group.add(arch);

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

  // The tunnel's fog is dense enough to hide a hand in front of your face; at
  // chamber scale that turns everything black. Thin it out as the space opens.
  const FOG_TUNNEL = scene.fog ? scene.fog.density : 0.055;

  // `open` runs 0→1 as the camera clears the mouth of the tunnel.
  function update(dt, t, open) {
    if (scene.fog) scene.fog.density = FOG_TUNNEL * (1 - open) + 0.0035 * open;
    group.visible = open > 0.001;
    if (!group.visible) return;
    sun.intensity = open * 9000;
    fill.intensity = open * 2.4;
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
