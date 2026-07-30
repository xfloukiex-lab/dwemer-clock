import * as THREE from 'three';
import { createEngine, detectTier } from './engine.js';
import { createClock } from './clock.js';
import { createMovement } from './movement.js';
import { createCity } from './wonderland.js';
import { createWall } from './wall.js';

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
const CH = createCity(eng.scene, -34, tier);
// The clock is set into a wall. Without it the barrel (BackSide, so invisible
// from outside) leaves the movement showing around the dial on any screen the
// clock does not overfill — which is every phone in portrait.
createWall(eng.scene, 6.02);

const touchOnly = matchMedia('(pointer: coarse)').matches;
if (touchOnly) {
  const hint = $('#hint');
  if (hint) hint.textContent = 'swipe up to wind · tap to step';
  const cap = $('#caption');
  if (cap) cap.textContent = 'Swipe up to wind it.';
}

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
const TUNNEL_END = -35;   // the mouth — the far end of the movement
// You go THROUGH the clock and out over the city. Stopping just clear of the
// mouth left the whole journey inside the machine.
// Stop where the city is still AHEAD of you. Flying deep into it puts most of
// it behind the camera and you end up staring at the floor.
const CITY_END = -96;
const CITY_RISE = 17;     // and you come out above it, not level with the floor

const marks = [0, 1, 2].map(() => $('#marks').appendChild(document.createElement('i')));

// --- driving the timeline ---------------------------------------------------
// The wheel drives progress DIRECTLY. There is no tall page and nothing to
// scroll — which is the point: no scrollbar to hide, no dependence on the
// document being scrollable, and the same input works on a trackpad.
let raw = 0;
let p = 0;

const WHEEL = 1 / 4200;   // one full pass ≈ 4200px of wheel travel
const bar = $('#progress');

// A drag is measured against the SCREEN, not against a pixel constant. On a
// phone a fixed px-per-progress rate means the whole sequence takes several
// deliberate full-height swipes, which reads as "nothing is happening".
// One full pass ≈ 1.5 screen-heights of dragging, wherever you are.
const dragGain = () => 1 / (innerHeight * 1.5);

function advance(delta) {
  raw = clamp01(raw + delta);
  if (raw > 0.005) document.body.classList.add('moved');
  if (bar) bar.style.setProperty('--p', raw.toFixed(4));
}

addEventListener('wheel', (e) => {
  advance(e.deltaY * WHEEL * (e.deltaMode === 1 ? 16 : 1));
  e.preventDefault();
}, { passive: false });

// --- dragging ---------------------------------------------------------------
// Pointer events cover touch, pen AND mouse-drag in one path; the touch
// listeners below are the fallback for anything that ships touch without
// pointer events. `claimed` is what stops the two paths double-counting.
//
// A flick carries on after the finger leaves the glass. Without that, a quick
// swipe moves the timeline a couple of hundred pixels and stops dead — the
// gesture everyone actually makes on a phone did the least.
let vel = 0;          // progress per second, decayed each frame
let claimed = false;  // a pointer drag is in progress; touch handlers stand down

function makeDrag() {
  let y = null;
  let moved = 0;
  let t0 = 0;
  return {
    start(clientY) { y = clientY; moved = 0; t0 = performance.now(); vel = 0; },
    move(clientY) {
      if (y === null) return;
      const dy = y - clientY;
      moved += Math.abs(dy);
      const d = dy * dragGain();
      advance(d);
      const dt = Math.max(16, performance.now() - t0) / 1000;
      vel = d / dt;
      t0 = performance.now();
      y = clientY;
    },
    end() {
      const wasTap = y !== null && moved < 12;
      y = null;
      // A tap always does something. If a device ever eats drag events, the page
      // is still usable — the one failure mode worth engineering out.
      if (wasTap) { vel = 0; advance(0.075); }
    },
    get active() { return y !== null; },
  };
}

const pointerDrag = makeDrag();
const touchDrag = makeDrag();

addEventListener('pointerdown', (e) => { claimed = true; pointerDrag.start(e.clientY); });
addEventListener('pointermove', (e) => pointerDrag.move(e.clientY));
for (const end of ['pointerup', 'pointercancel', 'pointerleave']) {
  addEventListener(end, () => { pointerDrag.end(); claimed = false; });
}

// Non-passive so pull-to-refresh and overscroll can be cancelled.
addEventListener('touchstart', (e) => {
  if (!claimed) touchDrag.start(e.touches[0].clientY);
}, { passive: false });
addEventListener('touchmove', (e) => {
  if (!claimed) touchDrag.move(e.touches[0].clientY);
  e.preventDefault();
}, { passive: false });
for (const end of ['touchend', 'touchcancel']) {
  addEventListener(end, () => { if (!claimed) touchDrag.end(); }, { passive: true });
}

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
  // Carry a flick after the finger lifts, then let it die out.
  if (vel !== 0 && !pointerDrag.active && !touchDrag.active) {
    advance(vel * dt);
    vel *= Math.pow(0.0022, dt);
    if (Math.abs(vel) < 0.004) vel = 0;
  }

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

  // Down the tunnel, out of the mouth, and on over the city.
  const through = seg(p, THROUGH_FROM, 0.9);
  const te = through * through;
  const out = seg(p, 0.9, 1);
  const oe = out * out * (3 - 2 * out);
  const camZ = eng.baseZ() * (1 - te) + TUNNEL_END * te + (CITY_END - TUNNEL_END) * oe;
  const camY = oe * CITY_RISE;

  const shake = reduced ? 0 : Math.sin(e * Math.PI) * 0.1;
  eng.camera.position.set((Math.random() - 0.5) * shake, camY + (Math.random() - 0.5) * shake, camZ);
  // Level in the barrel, then a SLIGHT tip down over the city — enough to put
  // the avenue in frame, not so much that the great tower's clock face is
  // cropped off the top (16° of pitch did exactly that).
  eng.camera.lookAt(0, camY - oe * 3.5, camZ - 34);

  // Thin at the face (which on a phone is viewed from a long way back), thick
  // down the barrel where it gives depth, gone in the open chamber.
  if (eng.scene.fog) {
    const inTunnel = 0.012 * (1 - through) + 0.055 * through;
    // Out in the cavern the haze is what gives the far towers their distance —
    // thin enough to see the great tower, thick enough that it stays far away.
    eng.scene.fog.density = inTunnel * (1 - oe) + 0.0052 * oe;
  }

  M.update(dt, t, camZ);
  CH.update(dt, t, seg(p, 0.895, 0.985));
  C.setBolts(seg(p, LOCK_AT, OPEN_FROM + 0.03));

  document.body.classList.toggle('inside', through > 0.25);
  document.body.classList.toggle('solved', out > 0.8);
  setCaption(
    out > 0.62 ? 'The city.'
      : out > 0.12 ? 'Out the other side&hellip;'
      : through > 0.55 ? 'The movement.'
      : o > 0 ? 'The mechanism gives&hellip;'
      : locked ? 'All three read twelve.'
      // The page told a phone to SCROLL, on a page where scrolling is switched
      // off by design. Say what the device in your hand can actually do.
      : STAGES.filter((s) => p >= s.from).pop()?.caption
        || (touchOnly ? 'Swipe up to wind it.' : 'Scroll to wind it.'),
  );
});

$('#boot')?.remove();
eng.start();
document.addEventListener('visibilitychange', () => eng.setPaused(document.hidden));
