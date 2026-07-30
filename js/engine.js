import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function detectTier() {
  const forced = new URLSearchParams(location.search).get('tier');
  if (['low', 'medium', 'high'].includes(forced)) return forced;
  const cores = navigator.hardwareConcurrency || 4;
  if (matchMedia('(pointer: coarse)').matches || cores <= 4) return 'low';
  return cores >= 8 ? 'high' : 'medium';
}

export function createEngine({ canvas, tier = 'high' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = false;

  const MAX_DPR = tier === 'low' ? 1 : tier === 'medium' ? 1.4 : 1.8;
  let dpr = Math.min(devicePixelRatio, MAX_DPR);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.FogExp2(0x07060a, 0.055);

  // Bronze needs something to reflect or it renders as flat dark metal. This
  // environment is generated in code — no HDRI file to ship or license.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3; // a barrow, not a showroom

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 600);
  camera.position.set(0, 0, 21);

  // Barrow lighting: almost nothing ambient, two warm torches off to the sides,
  // and a cold fill so the stone does not go muddy in the shadows.
  // three.js uses physical light units by default: a PointLight's intensity is
  // in candela and falls off as 1/d². At ~12 units away these numbers need to
  // be in the hundreds, not the tens — setting them like legacy lights is what
  // left the door in the dark.
  scene.add(new THREE.AmbientLight(0x4b4a60, 1.15));

  // Directionals do the actual work of showing the carving; the two point
  // lights are there to flicker and to warm one side of the stone.
  const key = new THREE.DirectionalLight(0xffe8cf, 1.15);
  key.position.set(-7, 6, 7); // rakes across the face so the carving casts shade
  const fill = new THREE.DirectionalLight(0xb6cbff, 0.6);
  fill.position.set(4, 7, 9);
  scene.add(key, fill);

  const torchL = new THREE.PointLight(0xff9d42, 170, 60, 2);
  torchL.position.set(-9, 3, 8);
  const torchR = new THREE.PointLight(0xff8a2e, 120, 60, 2);
  torchR.position.set(9.5, -2, 7.5);
  scene.add(torchL, torchR);

  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    }),
  );
  composer.addPass(new RenderPass(scene, camera));
  if (tier !== 'low') {
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.85));
  }
  composer.addPass(new OutputPass());

  let baseZ = 21;
  function resize() {
    if (innerWidth < 1 || innerHeight < 1) return;
    renderer.setPixelRatio(dpr);
    composer.setPixelRatio(dpr);
    renderer.setSize(innerWidth, innerHeight, false);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    // Keep the whole door on screen on narrow windows by backing the camera off.
    // Frame the door so it OVERFILLS the viewport — its outer edge has to sit
    // beyond the screen corners, so solve for the distance where the visible
    // half-diagonal equals the door's radius, then come in a little closer.
    const DOOR_R = 6.1;
    const halfH = Math.tan((camera.fov * Math.PI) / 180 / 2);
    baseZ = camera.aspect >= 1
      // Landscape: solve for the visible half-DIAGONAL so the face overfills the
      // corners and the bezel runs off the top and bottom.
      ? (DOOR_R * 0.93) / (halfH * Math.hypot(1, camera.aspect))
      // Portrait: a circle cannot overfill a tall narrow screen without zooming
      // in absurdly, so fit the WIDTH and let the case show above and below.
      : (DOOR_R * 1.04) / (halfH * camera.aspect);
    camera.position.z = baseZ;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  const clock = new THREE.Clock();
  const hooks = [];
  let paused = false;

  return {
    renderer,
    scene,
    camera,
    torches: [torchL, torchR],
    // The scroll timeline drives camera.z, so it needs the framing distance.
    baseZ: () => baseZ,
    tier,
    onFrame: (fn) => hooks.push(fn),
    setPaused(v) {
      paused = v;
      if (!v) clock.getDelta();
    },
    start() {
      (function loop() {
        requestAnimationFrame(loop);
        if (paused) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        for (const h of hooks) h(dt, clock.elapsedTime);
        composer.render();
      })();
    },
    renderOnce() {
      for (const h of hooks) h(0, 0);
      composer.render();
    },
  };
}
