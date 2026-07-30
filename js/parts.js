import * as THREE from 'three';

// Gear geometry, shared by everything in the movement.
//
// Two things make a train look genuinely connected:
//   1. INVOLUTE TOOTH PROFILE — the true involute of the base circle at a 20°
//      pressure angle. A trapezoid tooth reads as fake immediately.
//   2. PHASE LOCK — meshing wheels must be placed exactly pitch-to-pitch AND
//      rotated so one presents a tooth where the other presents a gap. The right
//      ratio alone is not enough; without the phase term teeth pass through
//      each other.

const PA = (20 * Math.PI) / 180;
const inv = (a) => Math.tan(a) - a;

export function gearShape(N, module_) {
  const rP = (module_ * N) / 2;
  const rA = rP + module_;
  const rD = rP - 1.25 * module_;
  const rB = rP * Math.cos(PA);
  const rStart = Math.max(rB, rD) + 1e-4;
  const halfTooth = Math.PI / (2 * N);
  const flank = (R) => halfTooth + inv(PA) - inv(Math.acos(Math.min(1, rB / R)));

  const STEPS = 6;
  const shape = new THREE.Shape();
  const per = (Math.PI * 2) / N;
  let first = true;

  for (let k = 0; k < N; k++) {
    const c = k * per;
    const pts = [[rD, c - per / 2 + per * 0.06]];
    for (let i = 0; i <= STEPS; i++) {
      const R = rStart + ((rA - rStart) * i) / STEPS;
      pts.push([R, c - flank(R)]);
    }
    pts.push([rA, c + flank(rA)]);
    for (let i = STEPS; i >= 0; i--) {
      const R = rStart + ((rA - rStart) * i) / STEPS;
      pts.push([R, c + flank(R)]);
    }
    pts.push([rD, c + per / 2 - per * 0.06]);
    for (const [R, a] of pts) {
      const x = Math.cos(a) * R;
      const y = Math.sin(a) * R;
      if (first) { shape.moveTo(x, y); first = false; } else { shape.lineTo(x, y); }
    }
  }
  shape.closePath();
  return { shape, rP, rD };
}

export function wheelGeometry(N, module_, thickness, arms = 5) {
  const { shape, rP, rD } = gearShape(N, module_);
  const rHub = Math.max(module_ * 1.6, rP * 0.16);

  const hole = new THREE.Path();
  hole.absarc(0, 0, rHub * 0.4, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const rRim = rD - module_ * 0.9;
  if (arms > 0 && rRim > rHub + module_ * 0.6) {
    const half = (Math.PI / arms) * 0.6;
    for (let i = 0; i < arms; i++) {
      const mid = (i / arms) * Math.PI * 2 + Math.PI / arms;
      const p = new THREE.Path();
      p.absarc(0, 0, rHub, mid - half, mid + half, false);
      p.absarc(0, 0, rRim, mid + half, mid - half, true);
      p.closePath();
      shape.holes.push(p);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.12,
    bevelSize: module_ * 0.1,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.userData.rP = rP;
  return geo;
}

// An escape wheel: few teeth, hooked and undercut so the anchor pallets can
// catch them. Nothing else in a clock looks like this.
export function escapeWheelGeometry(N, r, thickness) {
  const shape = new THREE.Shape();
  const per = (Math.PI * 2) / N;
  const rIn = r * 0.74;
  for (let i = 0; i < N; i++) {
    const a = i * per;
    const pts = [
      [rIn, a],
      [r, a + per * 0.30],          // long sloping face
      [r * 0.94, a + per * 0.40],   // hooked tip
      [rIn, a + per * 0.46],        // undercut back to the rim
    ];
    for (const [R, ang] of pts) {
      const x = Math.cos(ang) * R;
      const y = Math.sin(ang) * R;
      if (i === 0 && R === rIn && ang === a) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.1, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  for (let i = 0; i < 4; i++) {
    const mid = (i / 4) * Math.PI * 2 + 0.4;
    const half = (Math.PI / 4) * 0.6;
    const p = new THREE.Path();
    p.absarc(0, 0, r * 0.22, mid - half, mid + half, false);
    p.absarc(0, 0, rIn - 0.04, mid + half, mid - half, true);
    p.closePath();
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: false, curveSegments: 4,
  });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

// The anchor: two pallets on a rocking arm, the thing that makes a clock tick.
export function anchorGeometry(span, thickness) {
  const s = new THREE.Shape();
  s.moveTo(-span, 0.1);
  s.quadraticCurveTo(0, -span * 0.75, span, 0.1);
  s.lineTo(span, -0.16);
  s.quadraticCurveTo(0, -span * 1.05, -span, -0.16);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness, bevelEnabled: true,
    bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 12,
  });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

// A helical worm — a screw that drives a wheel at right angles.
export function wormGeometry(len, r, turns) {
  const pts = [];
  const steps = turns * 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector3(
      Math.cos(t * turns * Math.PI * 2) * r,
      Math.sin(t * turns * Math.PI * 2) * r,
      (t - 0.5) * len,
    ));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, r * 0.34, 6, false);
}

// A coiled mainspring, seen through the open side of its barrel.
export function mainspringGeometry(rOuter, rInner, coils, height) {
  const pts = [];
  const steps = coils * 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * coils * Math.PI * 2;
    const r = rOuter + (rInner - rOuter) * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  // A flat ribbon, not a tube — a real mainspring is a strip on edge.
  return new THREE.TubeGeometry(curve, steps, height * 0.5, 4, false);
}
