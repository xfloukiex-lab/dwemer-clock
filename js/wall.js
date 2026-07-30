import * as THREE from 'three';

// The wall the clock is set into.
//
// WHY THIS EXISTS: the barrel is a BackSide cylinder, so from outside it draws
// nothing at all — front faces are culled and you look straight through it at
// the movement inside. On a wide screen that never showed, because the clock
// overfills the corners and hides everything. On a phone the clock only fits the
// WIDTH, so the gear trains were plainly visible floating above and below the
// dial — reported from a real phone, 2026-07-30.
//
// A door in a void has nothing to be a door in. This is a plate with a bore the
// clock sits in: it seals every aspect ratio, and when the face sinks you are
// left looking through the bore, which is what should happen.
export function createWall(scene, bore = 6.02) {
  const group = new THREE.Group();
  scene.add(group);

  // Big enough to run off the corners of any screen at the framing distances we
  // use (baseZ tops out around 30 in a tall portrait window).
  const OUTER = 260;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, OUTER, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const plate = new THREE.Mesh(
    new THREE.ShapeGeometry(shape, 128),
    new THREE.MeshStandardMaterial({
      color: 0x231b12, metalness: 0.55, roughness: 0.82, envMapIntensity: 0.25,
    }),
  );
  // In front of the barrel's mouth (the barrel spans z = +1 … -35) so nothing
  // inside can peek past it, and behind the clock's own frame so the frame still
  // stands proud of the wall.
  plate.position.z = 0.98;
  group.add(plate);

  // A machined bronze collar around the bore, so the clock reads as SET INTO
  // something rather than pasted on a black card.
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(bore + 0.5, 0.5, 10, 128),
    new THREE.MeshStandardMaterial({
      color: 0x8a6a30, metalness: 0.95, roughness: 0.42, envMapIntensity: 0.7,
    }),
  );
  collar.position.z = 1.0;
  group.add(collar);

  // Rivets round the collar — the same language as the clock frame, so the wall
  // belongs to the same machine.
  const rivetGeo = new THREE.SphereGeometry(0.16, 12, 8);
  rivetGeo.scale(1, 1, 0.6);
  const rivets = new THREE.InstancedMesh(
    rivetGeo,
    new THREE.MeshStandardMaterial({ color: 0x7d6030, metalness: 0.9, roughness: 0.5 }),
    64,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    dummy.position.set(Math.cos(a) * (bore + 1.35), Math.sin(a) * (bore + 1.35), 1.24);
    dummy.updateMatrix();
    rivets.setMatrixAt(i, dummy.matrix);
  }
  group.add(rivets);

  return { group, bore };
}
