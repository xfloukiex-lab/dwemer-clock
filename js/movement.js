import * as THREE from 'three';
import {
  wheelGeometry, escapeWheelGeometry, anchorGeometry, wormGeometry, mainspringGeometry,
} from './parts.js';

// The inside of the clock: a tunnel of real movement, station by station, in the
// order power actually flows through a mechanical clock —
//   mainspring barrel → fusee → going train → escape wheel → anchor → pendulum
// (see the horological references in the project router).
//
// Wheels run on three different axes: facing you, edge-on against the barrel
// wall, and at right angles through bevel pairs and a worm drive. A tunnel of
// nothing but forward-facing gears reads as wallpaper.

const MODULE = 0.135;

export function createMovement(scene, tunnelR = 6.15, tier = 'high') {
  // A phone cannot carry the full movement. Fewer stations, fewer wheels per
  // station, no edge-on extras — the tunnel still reads, at a third of the mesh.
  const LIGHT = tier === 'low';
  const group = new THREE.Group();
  scene.add(group);

  const M = {
    bronze: new THREE.MeshStandardMaterial({ color: 0xb08344, metalness: 0.98, roughness: 0.32, envMapIntensity: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x6a5026, metalness: 0.95, roughness: 0.52, envMapIntensity: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949f, metalness: 1, roughness: 0.24, envMapIntensity: 0.95 }),
    blued: new THREE.MeshStandardMaterial({ color: 0x2a3f6b, metalness: 1, roughness: 0.18, envMapIntensity: 1.3 }),
    amber: new THREE.MeshStandardMaterial({ color: 0x2a1a06, emissive: 0xff9b2e, emissiveIntensity: 2.4, roughness: 0.4 }),
  };

  const spinners = [];   // { obj, speed } — free-running
  const driven = [];     // { node, parent, phi, ratio } — phase-locked to a parent
  const tickers = [];    // { fn } — escapements, pendulums, anything oscillating
  const lamps = [];

  // --- the case ------------------------------------------------------------
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(tunnelR, tunnelR, 36, 96, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x5b4622, metalness: 0.9, roughness: 0.55,
      side: THREE.BackSide, envMapIntensity: 0.4,
    }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -17;   // spans z = +1 … -35, ending at the mouth
  scene.add(barrel);

  // Ribs, lamps and pipes down the whole length.
  const RIB_COUNT = LIGHT ? 9 : 16;
  for (let i = 0; i < RIB_COUNT; i++) {
    const z = -2.2 - i * (LIGHT ? 4.4 : 2.6);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(tunnelR - 0.05, 0.15, 8, 64), M.dark);
    rib.position.z = z;
    group.add(rib);

    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + i * 0.35;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M.amber);
      lamp.position.set(Math.cos(a) * (tunnelR - 0.3), Math.sin(a) * (tunnelR - 0.3), z - 1.3);
      group.add(lamp);
    }
    const light = new THREE.PointLight(0xffa64a, 0, 14, 2);
    light.position.set(0, 0, z - 1.3);
    group.add(light);
    lamps.push(light);
  }

  // Conduits running the length of the barrel.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 34, 8), M.dark);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(Math.cos(a) * (tunnelR - 0.42), Math.sin(a) * (tunnelR - 0.42), -17);
    group.add(pipe);
  }

  // --- helpers -------------------------------------------------------------
  // A ring plate with a clear bore. A solid disc across the barrel is a wall.
  function plate(z, inner = 2.3) {
    const s = new THREE.Shape();
    s.absarc(0, 0, tunnelR - 0.12, 0, Math.PI * 2, false);
    const bore = new THREE.Path();
    bore.absarc(0, 0, inner, 0, Math.PI * 2, true);
    s.holes.push(bore);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 72), M.dark);
    m.position.z = z;
    group.add(m);
    // Pillars: the posts that hold real movement plates apart.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 10), M.bronze);
      post.rotation.x = Math.PI / 2;
      post.position.set(Math.cos(a) * (tunnelR - 1.5), Math.sin(a) * (tunnelR - 1.5), z + 1.1);
      group.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10), M.steel);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(Math.cos(a) * (tunnelR - 1.5), Math.sin(a) * (tunnelR - 1.5), z + 0.06);
      group.add(cap);
    }
    return m;
  }

  // A wheel facing the camera, spinning on its own axis.
  function wheel({ N, x, y, z, arms = 5, thickness = 0.2, mat = M.bronze }) {
    const geo = wheelGeometry(N, MODULE, thickness, arms);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return { mesh, N, rP: geo.userData.rP, x, y, z, thickness };
  }

  // Place `b` in mesh with `a` and record the phase link.
  function meshTo(a, N, phi, opts = {}) {
    const b = wheel({
      N,
      arms: opts.arms ?? (N > 26 ? 5 : 0),
      thickness: opts.thickness ?? 0.2,
      x: a.x + Math.cos(phi) * (a.rP + (MODULE * N) / 2),
      y: a.y + Math.sin(phi) * (a.rP + (MODULE * N) / 2),
      z: opts.z ?? a.z,
      mat: opts.mat ?? M.bronze,
    });
    driven.push({ node: b, parent: a, phi, ratio: a.N / N });
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(MODULE * 1.2, MODULE * 1.4, 0.16, 12), M.steel);
    boss.rotation.x = Math.PI / 2;
    boss.position.set(b.x, b.y, b.z + b.thickness / 2 + 0.08);
    group.add(boss);
    return b;
  }

  // A wheel lying EDGE-ON against the barrel wall — its axis points at the
  // centre of the tunnel, so you see it side-on as you pass.
  function wallWheel({ N, angle, z, radius, speed, mat = M.bronze, arms = 5 }) {
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
    pivot.rotation.z = angle;
    pivot.rotateY(Math.PI / 2);            // lay the wheel on its edge
    group.add(pivot);
    const w = new THREE.Mesh(wheelGeometry(N, MODULE, 0.18, arms), mat);
    pivot.add(w);
    spinners.push({ obj: w, speed });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 8), M.steel);
    axle.rotation.z = Math.PI / 2;
    pivot.add(axle);
    return w;
  }

  // Two wheels at right angles, rims touching — a bevel pair.
  function bevelPair({ x, y, z, N = 24, speed }) {
    const a = new THREE.Mesh(wheelGeometry(N, MODULE, 0.16, 4), M.bronze);
    a.position.set(x, y, z);
    group.add(a);
    spinners.push({ obj: a, speed });

    const rP = (MODULE * N) / 2;
    const pivot = new THREE.Group();
    pivot.position.set(x, y - rP, z - rP);
    pivot.rotateX(Math.PI / 2);
    group.add(pivot);
    const b = new THREE.Mesh(wheelGeometry(N, MODULE, 0.16, 4), M.steel);
    pivot.add(b);
    spinners.push({ obj: b, speed: -speed });
  }

  // A worm screw driving a wheel at right angles — a big slow reduction.
  function wormDrive({ x, y, z, N = 30, speed }) {
    const w = new THREE.Mesh(wormGeometry(2.0, 0.22, 7), M.steel);
    w.position.set(x, y, z);
    w.rotation.y = Math.PI / 2;
    group.add(w);
    spinners.push({ obj: w, speed: speed * 6 });

    const rP = (MODULE * N) / 2;
    const gearPivot = new THREE.Group();
    gearPivot.position.set(x, y - rP - 0.22, z);
    gearPivot.rotateY(Math.PI / 2);
    group.add(gearPivot);
    const g = new THREE.Mesh(wheelGeometry(N, MODULE, 0.18, 5), M.bronze);
    gearPivot.add(g);
    spinners.push({ obj: g, speed });
  }

  // Mainspring in its barrel, open side toward you.
  function springBarrel({ x, y, z, speed }) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 40, 1, true), M.dark);
    cup.rotation.x = Math.PI / 2;
    cup.position.set(x, y, z);
    group.add(cup);
    const back = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), M.dark);
    back.position.set(x, y, z - 0.25);
    group.add(back);
    const spring = new THREE.Mesh(mainspringGeometry(1.0, 0.22, 7, 0.16), M.blued);
    spring.position.set(x, y, z);
    group.add(spring);
    spinners.push({ obj: spring, speed: speed * 0.35 });
    const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), M.steel);
    arbor.rotation.x = Math.PI / 2;
    arbor.position.set(x, y, z + 0.2);
    group.add(arbor);
  }

  // The fusee: a grooved cone that evens out the mainspring's pull, with its
  // chain running off to the barrel.
  function fusee({ x, y, z, speed }) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 1.0, 1.5, 28, 6, true), M.bronze);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(x, y, z);
    group.add(cone);
    spinners.push({ obj: cone, speed });
    // The spiral groove.
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const r = 1.0 + (0.38 - 1.0) * t;
      const a = t * Math.PI * 2 * 7;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, (t - 0.5) * 1.5));
    }
    const groove = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.035, 5, false), M.steel,
    );
    groove.position.set(x, y, z);
    group.add(groove);
    spinners.push({ obj: groove, speed });
  }

  // Escape wheel, anchor and pendulum — the part that actually ticks.
  function escapement({ x, y, z }) {
    const esc = new THREE.Mesh(escapeWheelGeometry(30, 1.0, 0.12), M.steel);
    esc.position.set(x, y, z);
    group.add(esc);

    const anchor = new THREE.Mesh(anchorGeometry(0.85, 0.14), M.blued);
    anchor.position.set(x, y + 1.35, z + 0.16);
    group.add(anchor);

    // Pendulum hung behind, swinging in step with the anchor.
    const pend = new THREE.Group();
    pend.position.set(x, y + 1.35, z - 0.5);
    group.add(pend);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 8), M.steel);
    rod.position.y = -2.1;
    pend.add(rod);
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 28), M.bronze);
    bob.rotation.x = Math.PI / 2;
    bob.position.y = -4.1;
    pend.add(bob);
    const bobRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), M.steel);
    bobRing.position.y = -4.1;
    pend.add(bobRing);

    tickers.push((t) => {
      const swing = Math.sin(t * 2.2);
      pend.rotation.z = swing * 0.26;
      anchor.rotation.z = swing * 0.14;
      // The escape wheel steps rather than glides — that is the tick.
      esc.rotation.z = -Math.floor(t * 2.2 / Math.PI) * ((Math.PI * 2) / 30) * 2;
    });
  }

  // --- stations down the tunnel --------------------------------------------
  // Laid out in the order power flows through a real clock.
  const STATIONS = LIGHT ? [-5, -13, -21, -30] : [-4.5, -10, -15.5, -21, -26.5, -32];

  STATIONS.forEach((z, i) => {
    plate(z - 0.7);

    const baseA = (i / STATIONS.length) * Math.PI * 2 + 0.5;
    const root = wheel({
      N: [58, 50, 46, 54, 44, 52][i],
      x: Math.cos(baseA) * 3.5,
      y: Math.sin(baseA) * 3.5,
      z,
      arms: 6,
      thickness: 0.26,
    });
    spinners.push({ obj: root.mesh, speed: [0.22, -0.3, 0.34, -0.4, 0.28, -0.36][i] });

    // A phase-locked chain curving around the wall.
    let cur = root;
    const tangent = baseA + Math.PI / 2;
    const chain = [
      { N: 34, phi: tangent + 0.15, mat: M.steel },
      { N: 22, phi: tangent + 0.55, mat: M.bronze },
      { N: 46, phi: tangent + 1.0, mat: M.dark, arms: 5 },
      { N: 16, phi: tangent + 1.5, mat: M.steel },
    ];
    for (const c of (LIGHT ? chain.slice(0, 2) : chain)) cur = meshTo(cur, c.N, c.phi, c);
    meshTo(root, 28, baseA + Math.PI * 0.5 - 1.2, { mat: M.steel });

    // Edge-on wheels against the wall, so you pass them side-on.
    for (let k = 0; k < (LIGHT ? 1 : 3); k++) {
      wallWheel({
        N: 30 + k * 8,
        angle: baseA + Math.PI + k * 0.8,
        z: z - 1.2 - k * 0.9,
        radius: tunnelR - 1.35,
        speed: (k % 2 ? -1 : 1) * (0.5 + k * 0.2),
        mat: k % 2 ? M.steel : M.bronze,
      });
    }

    // Something different at every station, so the tunnel keeps revealing.
    const a2 = baseA + Math.PI * 0.7;
    const p2 = [Math.cos(a2) * 3.2, Math.sin(a2) * 3.2];
    if (i === 0) springBarrel({ x: p2[0], y: p2[1], z: z - 0.4, speed: 0.3 });
    else if (i === 1) fusee({ x: p2[0], y: p2[1], z: z - 0.4, speed: -0.35 });
    else if (i === 2) bevelPair({ x: p2[0], y: p2[1], z: z - 0.3, N: 26, speed: 0.5 });
    else if (i === 3) escapement({ x: p2[0], y: p2[1] + 0.8, z: z - 0.3 });
    else if (i === 4) wormDrive({ x: p2[0], y: p2[1], z: z - 0.3, N: 32, speed: 0.4 });
    else springBarrel({ x: p2[0], y: p2[1], z: z - 0.4, speed: -0.26 });
  });

  function update(dt, t, camZ) {
    for (const s of spinners) s.obj.rotation.z = s.speed * t;
    for (const d of driven) {
      const thetaA = d.parent.mesh.rotation.z;
      d.node.mesh.rotation.z =
        (d.phi + Math.PI) - (thetaA - d.phi) * d.ratio + Math.PI / d.node.N;
    }
    for (const fn of tickers) fn(t);
    for (const l of lamps) {
      const dz = Math.abs(l.position.z - camZ);
      l.intensity = Math.max(0, 24 - dz * 3.2) * (0.85 + Math.sin(t * 3 + l.position.z) * 0.15);
    }
  }

  return { group, update, barrel, lamps, materials: M };
}
