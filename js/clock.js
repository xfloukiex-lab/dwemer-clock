import * as THREE from 'three';
import { normalFromHeight, fitToWorld } from './textures.js';
import { clockHeight, albedo, FACE_BANDS } from './face.js';

// The face: a Dwemer clock. Three concentric dials — seconds, minutes, hours —
// turning inside a heavy bronze frame. Same construction as the door it grew
// out of: one world-space height field converted to a normal map, so every
// engraved tick actually catches the light.

const HALF = 7;

function annulus(inner, outer, depth, bevel = 0.05) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  if (inner > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 200,
  });
  geo.translate(0, 0, -depth / 2);
  // Bevels add depth at BOTH ends — the real front face is not depth/2.
  geo.userData.faceZ = depth / 2 + bevel;
  return geo;
}

export function createClock(scene) {
  const face = new THREE.Group();
  scene.add(face);

  const height = clockHeight(2048, HALF, FACE_BANDS);
  const normalTex = fitToWorld(new THREE.CanvasTexture(normalFromHeight(height, 3.5)), HALF);
  const roughTex = fitToWorld(new THREE.CanvasTexture(height), HALF);

  const dialTex = fitToWorld(new THREE.CanvasTexture(albedo(height, '#8e7a4e', 0.5)), HALF);
  dialTex.colorSpace = THREE.SRGBColorSpace;
  const frameTex = fitToWorld(new THREE.CanvasTexture(albedo(height, '#9a7838', 0.16)), HALF);
  frameTex.colorSpace = THREE.SRGBColorSpace;

  // Dial plates: aged bronze, still metal but dirtier and less mirror-like than
  // the frame so the markings stay readable.
  const dialMat = new THREE.MeshStandardMaterial({
    map: dialTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(1.7, 1.7),
    roughnessMap: roughTex,
    roughness: 0.78,
    metalness: 0.85,
    color: 0xa8905c,
    envMapIntensity: 0.5,
  });

  // Frame: polished bronze. No roughness map — per-pixel roughness on metal
  // turns it into a field of hot specks.
  const frameMat = new THREE.MeshStandardMaterial({
    map: frameTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.36,
    metalness: 0.97,
    color: 0xa87f3c,
    envMapIntensity: 0.8,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x8d949f, metalness: 1, roughness: 0.28, envMapIntensity: 0.8,
  });
  const amber = new THREE.MeshStandardMaterial({
    color: 0x2a1a06, emissive: 0xff9b2e, emissiveIntensity: 0.35, roughness: 0.4,
  });

  // --- frame ---------------------------------------------------------------
  face.add(new THREE.Mesh(annulus(4.14, 6.12, 0.78, 0.1), frameMat));
  const shoulder = new THREE.Mesh(annulus(4.0, 6.6, 0.5, 0.08), dialMat);
  shoulder.position.z = -0.36;
  face.add(shoulder);

  // Static bronze bands between the dials.
  for (const r of [1.10, 2.11, 3.11, 4.11]) {
    const m = new THREE.Mesh(annulus(r - 0.06, r + 0.06, 0.66, 0.045), frameMat);
    m.position.z = 0.04;
    face.add(m);
  }

  // Rivets around the frame.
  const rivetGeo = new THREE.SphereGeometry(0.1, 14, 10);
  rivetGeo.scale(1, 1, 0.6);
  const rows = [{ r: 4.44, n: 44 }, { r: 5.2, n: 52 }, { r: 5.88, n: 58 }];
  const rivets = new THREE.InstancedMesh(rivetGeo, frameMat, rows.reduce((a, b) => a + b.n, 0));
  const dummy = new THREE.Object3D();
  let ri = 0;
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const a = (i / row.n) * Math.PI * 2 + (row.r % 1);
      dummy.position.set(Math.cos(a) * row.r, Math.sin(a) * row.r, 0.5);
      dummy.rotation.set(0, 0, a);
      dummy.updateMatrix();
      rivets.setMatrixAt(ri++, dummy.matrix);
    }
  }
  face.add(rivets);

  // --- the three dials -----------------------------------------------------
  const rings = FACE_BANDS.map((band, i) => {
    const group = new THREE.Group();
    group.position.z = 0.02;
    face.add(group);
    const geo = annulus(band.inner, band.outer, 0.52, 0.06);
    const mesh = new THREE.Mesh(geo, dialMat);
    mesh.userData.ringIndex = i;
    group.add(mesh);
    return { group, mesh, band, divisions: band.divisions };
  });

  // --- index marker ---------------------------------------------------------
  // A fixed pointer at twelve o'clock. Without it there is nothing to read the
  // dials against and no way to see that they have locked.
  const index = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.62, 4),
    new THREE.MeshStandardMaterial({
      color: 0x241a08, metalness: 0.9, roughness: 0.3,
      emissive: 0xff9b2e, emissiveIntensity: 0,
    }),
  );
  index.rotation.x = Math.PI / 2;
  index.rotation.z = Math.PI;
  index.position.set(0, 4.42, 0.62);
  face.add(index);

  // --- centre boss ----------------------------------------------------------
  const hubGeo = annulus(0, 1.06, 0.5, 0.06);
  const hub = new THREE.Mesh(hubGeo, dialMat);
  hub.position.z = 0.02;
  face.add(hub);

  const collar = new THREE.Mesh(annulus(0.58, 0.98, 0.62, 0.04), frameMat);
  collar.position.z = 0.04;
  face.add(collar);

  // This is a combination lock, not a clock with hands — so the centre is a
  // keyway and a set of bolts, not an arbor. It has to carry its own weight of
  // machining even while it is dark; a bare socket reads as unfinished until it
  // happens to light up.
  const hubZ = hubGeo.userData.faceZ;

  // Stepped collars, each a little smaller and a little prouder.
  const STEPS = [
    { inner: 0.72, outer: 0.94, depth: 0.7, mat: frameMat },
    { inner: 0.52, outer: 0.74, depth: 0.78, mat: steel },
    { inner: 0.34, outer: 0.54, depth: 0.86, mat: frameMat },
  ];
  for (const s of STEPS) {
    const m = new THREE.Mesh(annulus(s.inner, s.outer, s.depth, 0.035), s.mat);
    m.position.z = 0.05;
    face.add(m);
  }

  // Lock teeth around the cylinder — the detents the dials drop into.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), steel);
    tooth.position.set(Math.cos(a) * 0.63, Math.sin(a) * 0.63, hubZ + 0.06);
    tooth.rotation.z = a;
    face.add(tooth);
  }

  // Screws around the outer collar.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.07, 10), steel);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.84, hubZ + 0.12);
    face.add(screw);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), dialMat);
    slot.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.84, hubZ + 0.16);
    slot.rotation.z = a * 1.7;
    face.add(slot);
  }

  // The keyway: a hexagonal throat sunk into the cylinder, with a chamfer.
  const chamfer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.26, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0x3b2c14, metalness: 0.95, roughness: 0.42 }),
  );
  chamfer.rotation.x = Math.PI / 2;
  chamfer.position.z = hubZ - 0.02;
  face.add(chamfer);

  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.2, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x0d0903, metalness: 0.85, roughness: 0.7 }),
  );
  throat.rotation.x = Math.PI / 2;
  throat.position.z = hubZ - 0.2;
  face.add(throat);

  // The core sits deep in the throat and always has a faint ember in it.
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), amber);
  core.position.z = hubZ - 0.34;
  face.add(core);

  // Six bolts, shot across the centre and withdrawn into the collar on unlock.
  const bolts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    face.add(pivot);
    const bolt = new THREE.Group();
    bolt.position.set(0.42, 0, hubZ + 0.02);
    const shank = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.13, 0.13), steel);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 6), frameMat);
    head.rotation.z = Math.PI / 2;
    head.position.x = -0.3;
    bolt.add(shank, head);
    pivot.add(bolt);
    bolts.push(bolt);
  }

  const coreLight = new THREE.PointLight(0xffa64a, 0, 14, 2);
  coreLight.position.set(0, 0, 1.6);
  face.add(coreLight);

  function setRingAngle(i, rot) {
    rings[i].group.rotation.z = rot;
  }

  // How far a dial is from reading exactly twelve, as 0..1.
  function alignmentOf(i) {
    const step = (Math.PI * 2) / rings[i].divisions;
    const off = Math.abs(((rings[i].group.rotation.z % step) + step) % step);
    return Math.min(off, step - off) / (step / 2);
  }

  function setGlow(v) {
    amber.emissiveIntensity = 0.35 + v * 3.2;
    index.material.emissiveIntensity = v * 2.4;
    coreLight.intensity = 1.5 + v * 34;
  }

  // 0 = bolts shot across the centre, 1 = withdrawn into the collar.
  function setBolts(v) {
    for (const b of bolts) b.position.x = 0.42 + v * 0.55;
  }

  return { face, rings, index, core, hub, setRingAngle, alignmentOf, setGlow, setBolts, HALF };
}
