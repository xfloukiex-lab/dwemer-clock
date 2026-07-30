import * as THREE from 'three';
import { createEngine, detectTier } from './engine.js';
import { createClock } from './clock.js';
import { createMovement } from './movement.js';
import { createChamber } from './wonderland.js';

const $ = (s) => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const tier = detectTier();
const eng = createEngine({ canvas: $('#scene'), tier });
document.body.dataset.tier = tier;   // visible in devtools when diagnosing a slow device
const C = createClock(eng.scene);
const M = createMovement(eng.scene, 6.15, tier);
const CH = createChamber(eng.scene, -34);

// --- winding the lock -------------------------------------------------------
// The dials start showing the real time, then each one winds round to twelve in
// turn. Scroll back and they wind out again — every value below is a pure
// function of scroll position.
const now = new Date();
const START = [
  -(now.getSeconds() / 60) * Math.PI * 2,
  -(now.getMinutes() / 60) * Math.PI * 2,
  -((now.getHours() % 12) / 12) * Math.PI * 2,
];
const TURNS = [6, 4, 3];                       // full revolutions on the way home
const STAGES = [
  { from: 0.06, to: 0.32, caption: 'Seconds&hellip;' },
  { from: 0.32, to: 0.56, caption: 'Minutes&hellip;' },
  { from: 0.56, to: 0.78, caption: 'Hours&hellip;' },
];
const LOCK_AT = 0.79;
const OPEN_FROM = 0.81;
const OPEN_TO = 0.92;
const THROUGH_FROM = 0.86;
const TUNNEL_END = -33;   // the mouth of the chamber
const CHAMBER_END = -44;  // just clear of the mouth, looking out into it

const marks = [0, 1, 2].map(() => $('#marks').appendChild(document.createElement('i')));

// --- driving the timeline ---------------------------------------------------
// The wheel drives progress DIRECTLY. There is no tall page and nothing to
// scroll — which is the point: no scrollbar to hide, no dependence on the
// document being scrollable, and the same input works on a trackpad.
let raw = 0;
let p = 0;

const WHEEL = 1 / 4200;   // one full pass ≈ 4200px of wheel travel
const bar = $('#progress');

function advance(delta) {
  raw = clamp01(raw + delta);
  if (raw > 0.005) document.body.classList.add('moved');
  if (bar) bar.style.setProperty('--p', raw.toFixed(4));
}

addEventListener('wheel', (e) => {
  advance(e.deltaY * WHEEL * (e.deltaMode === 1 ? 16 : 1));
  e.preventDefault();
}, { passive: false });

// Drag up to go deeper. Pointer events cover touch, pen AND a mouse drag in one
// path — listening only for `touch` events left pen and mouse-drag doing nothing.
let dragY = null;
addEventListener('pointerdown', (e) => { dragY = e.clientY; });
addEventListener('pointermove', (e) => {
  if (dragY === null) return;
  advance((dragY - e.clientY) * WHEEL * 2.4);
  dragY = e.clientY;
});
for (const end of ['pointerup', 'pointercancel', 'pointerleave']) {
  addEventListener(end, () => { dragY = null; });
}

// Touch as well, so a phone that delivers touch events without pointer events
// still works, and so pull-to-refresh can be cancelled (needs non-passive).
let touchY = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY === null) return;
  const y = e.touches[0].clientY;
  // Only advance if pointer events are NOT already handling this drag.
  if (dragY === null) advance((touchY - y) * WHEEL * 2.4);
  touchY = y;
  e.preventDefault();
}, { passive: false });
addEventListener('touchend', () => { touchY = null; });

// Keyboard, for anyone not using a wheel. Arrows are reserved for the dials.
addEventListener('keydown', (e) => {
  const step = { PageDown: 0.08, PageUp: -0.08, ' ': 0.08, Home: -1, End: 1 }[e.key];
  if (step === undefined) return;
  advance(step);
  e.preventDefault();
}, { passive: false });

let last = '';
function setCaption(html) {
  if (html === last) return;
  last = html;
  $('#caption').innerHTML = html;
}

// --- spinning the dials by hand ---------------------------------------------
// Arrow keys add an offset ON TOP of whatever the scroll timeline is doing, so
// playing with a dial can never break the winding sequence. Once a dial has
// finished winding, its offset eases back to zero — otherwise you could leave it
// parked off twelve and the lock would look wrong when it opened.
//
//   ↑ / ↓          outer dial (seconds)
//   ← / →          inner dial (hours)
//   Shift + ↑ / ↓  middle dial (minutes)
const spin = [0, 0, 0];
const held = Object.create(null);
const SPEED = 2.4;   // radians per second at full tilt

addEventListener('keydown', (e) => {
  if (!e.key.startsWith('Arrow')) return;
  held[e.key] = true;
  held.shift = e.shiftKey;
  e.preventDefault();   // arrows drive the dials here, they do not scroll
}, { passive: false });

addEventListener('keyup', (e) => {
  if (!e.key.startsWith('Arrow')) return;
  held[e.key] = false;
  held.shift = e.shiftKey;
});
// A dropped keyup (alt-tab) would otherwise leave a dial spinning forever.
addEventListener('blur', () => { for (const k in held) held[k] = false; });

function dialInput() {
  const vertical = (held.ArrowUp ? 1 : 0) - (held.ArrowDown ? 1 : 0);
  const horizontal = (held.ArrowRight ? 1 : 0) - (held.ArrowLeft ? 1 : 0);
  return [
    held.shift ? 0 : vertical,   // outer
    held.shift ? vertical : 0,   // middle
    horizontal,                  // inner
  ];
}

// --- frame ------------------------------------------------------------------
eng.onFrame((dt, t) => {
  p += (raw - p) * Math.min(1, dt * (reduced ? 60 : 3.2));

  const input = dialInput();
  STAGES.forEach((s, i) => {
    const k = easeOut(seg(p, s.from, s.to));
    // Wind from the current time round to a whole number of turns — landing on
    // exactly zero is what puts that dial on twelve.
    const wound = START[i] * (1 - k) + TURNS[i] * Math.PI * 2 * k;

    spin[i] += input[i] * SPEED * dt;
    // Once this dial has finished winding it settles back to true, so a dial you
    // played with earlier still reads twelve when the lock gives.
    if (k >= 1 && input[i] === 0) spin[i] += (0 - spin[i]) * Math.min(1, dt * 2.2);

    C.setRingAngle(i, wound + spin[i]);
    marks[i].classList.toggle('on', k >= 1 && Math.abs(spin[i]) < 0.02);
  });

  const locked = p >= LOCK_AT;
  C.setGlow(locked ? 1 : seg(p, LOCK_AT - 0.06, LOCK_AT) * 0.35);

  // The face sinks, then the camera travels down the barrel.
  const o = seg(p, OPEN_FROM, OPEN_TO);
  const e = o * o * (3 - 2 * o);
  C.face.position.y = -e * 15;

  // Down the tunnel first, then out into the chamber.
  const through = seg(p, THROUGH_FROM, 0.96);
  const te = through * through;
  const out = seg(p, 0.955, 1);
  const camZ = eng.baseZ() * (1 - te) + TUNNEL_END * te + (CHAMBER_END - TUNNEL_END) * out * out;

  const shake = reduced ? 0 : Math.sin(e * Math.PI) * 0.1;
  eng.camera.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, camZ);
  eng.camera.lookAt(0, 0, camZ - 6);

  // Thin at the face (which on a phone is viewed from a long way back), thick
  // down the barrel where it gives depth, gone in the open chamber.
  if (eng.scene.fog) {
    const inTunnel = 0.012 * (1 - through) + 0.055 * through;
    eng.scene.fog.density = inTunnel * (1 - out) + 0.0035 * out;
  }

  M.update(dt, t, camZ);
  CH.update(dt, t, seg(p, 0.93, 1));
  C.setBolts(seg(p, LOCK_AT, OPEN_FROM + 0.03));

  document.body.classList.toggle('inside', through > 0.25);
  setCaption(
    out > 0.25 ? 'It opens.'
      : through > 0.55 ? 'The movement.'
      : o > 0 ? 'The mechanism gives&hellip;'
      : locked ? 'All three read twelve.'
      : STAGES.filter((s) => p >= s.from).pop()?.caption || 'Scroll to wind it.',
  );
});

$('#boot')?.remove();
eng.start();
document.addEventListener('visibilitychange', () => eng.setPaused(document.hidden));
