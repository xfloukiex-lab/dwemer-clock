import * as THREE from 'three';

// The face, drawn once as a world-space height field. Three concentric bands of
// clock markings — SECONDS outside, MINUTES in the middle, HOURS inside — plus
// Dwemer plate engraving: hard geometry, deep grooves, rivet dimples.
//
// All three bands live in ONE texture. Each ring mesh only covers its own radial
// band, so it only ever shows its own markings, and rotating the ring carries
// those markings round with it. That is what makes the rings readable as dials.

// IIII rather than IV on the hours: the horological convention, not a mistake.
const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

// Every dial reads in Roman — the seconds and minutes rings run V, X, XV … LX.
const NUMERALS = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function toRoman(n) {
  let out = '';
  let left = n;
  for (const [value, sym] of NUMERALS) {
    while (left >= value) { out += sym; left -= value; }
  }
  return out;
}

export function clockHeight(size, half, bands) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const S = size / (half * 2); // world units → pixels

  ctx.fillStyle = '#808080'; // mid grey = flat
  ctx.fillRect(0, 0, size, size);

  // Fine machined grain.
  for (let i = 0; i < 7000; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},0.022)`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(size / 2, size / 2);
  ctx.lineCap = 'butt';

  const groove = (r, w = 0.05) => {
    ctx.lineWidth = w * 2 * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.82)';
    ctx.beginPath(); ctx.arc(0, 0, r * S, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.028 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, (r - w - 0.02) * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, (r + w + 0.02) * S, 0, Math.PI * 2); ctx.stroke();
  };

  // Turned concentric lines across the whole plate — machined, not carved.
  ctx.lineWidth = 0.012 * S;
  for (let r = 0.4; r < half; r += 0.075) {
    ctx.strokeStyle = `rgba(0,0,0,${0.10 + Math.random() * 0.06})`;
    ctx.beginPath(); ctx.arc(0, 0, r * S, 0, Math.PI * 2); ctx.stroke();
  }

  for (const b of bands) { groove(b.inner); groove(b.outer); }

  // --- the three dials ------------------------------------------------------
  const tickRing = (band, divisions, majorEvery, labeller, fontScale) => {
    const outer = band.outer - 0.07;
    const inner = band.inner + 0.07;
    const mid = (band.inner + band.outer) / 2;

    for (let i = 0; i < divisions; i++) {
      const a = (i / divisions) * Math.PI * 2 - Math.PI / 2;
      const major = i % majorEvery === 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.88)';
      ctx.lineWidth = (major ? 0.075 : 0.028) * S;
      const r0 = major ? outer - 0.30 : outer - 0.16;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0 * S, Math.sin(a) * r0 * S);
      ctx.lineTo(Math.cos(a) * outer * S, Math.sin(a) * outer * S);
      ctx.stroke();
      // A bright lip on the leading side so each tick reads as cut, not printed.
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = (major ? 0.022 : 0.012) * S;
      const off = (major ? 0.05 : 0.022) * S;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0 * S + off, Math.sin(a) * r0 * S);
      ctx.lineTo(Math.cos(a) * outer * S + off, Math.sin(a) * outer * S);
      ctx.stroke();
    }

    if (!labeller) return;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${fontScale * S}px Cinzel, Georgia, serif`;
    const count = divisions / majorEvery;
    for (let k = 0; k < count; k++) {
      const label = labeller(k);
      if (!label) continue;
      ctx.save();
      ctx.rotate((k / count) * Math.PI * 2);
      ctx.translate(0, -(inner + (mid - inner) * 0.55) * S);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  };

  // bands[0] = outer = SECONDS, [1] = MINUTES, [2] = HOURS
  // Smaller face on the 60-division rings: XXXV and XLV are wide, and they have
  // to sit inside the same band width as a two-character label.
  tickRing(bands[0], 60, 5, (k) => toRoman(k === 0 ? 60 : k * 5), 0.22);
  tickRing(bands[1], 60, 5, (k) => toRoman(k === 0 ? 60 : k * 5), 0.22);
  tickRing(bands[2], 12, 1, (k) => ROMAN[k], 0.34);

  // --- Dwemer plate engraving ----------------------------------------------
  // Hard radial spokes and hexagonal bosses on the frame — the machined,
  // geometric look, as opposed to the hand-chiselled Nordic one.
  const frameIn = bands[0].outer + 0.16;
  ctx.lineWidth = 0.05 * S;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * frameIn * S, Math.sin(a) * frameIn * S);
    ctx.lineTo(Math.cos(a) * (half - 0.5) * S, Math.sin(a) * (half - 0.5) * S);
    ctx.stroke();
  }
  for (const r of [frameIn + 0.35, frameIn + 1.0, frameIn + 1.7]) groove(r, 0.035);

  // Hexagonal bosses set into the frame.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.1;
    const rr = (frameIn + 0.68) * S;
    const cx = Math.cos(a) * rr;
    const cy = Math.sin(a) * rr;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const ha = (k / 6) * Math.PI * 2 + a;
      const px = cx + Math.cos(ha) * 0.22 * S;
      const py = cy + Math.sin(ha) * 0.22 * S;
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 0.03 * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }

  // Pitting and a few hairline cracks — four thousand years underground.
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * half * S;
    ctx.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.5 + Math.random() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

// Albedo built on the height field so grime settles into the engraving.
export function albedo(height, tint, strength = 0.5) {
  const size = height.width;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(height, 0, 0);
  return c;
}

export const FACE_BANDS = [
  { inner: 3.16, outer: 4.06, unit: 'seconds', divisions: 60 },
  { inner: 2.16, outer: 3.06, unit: 'minutes', divisions: 60 },
  { inner: 1.16, outer: 2.06, unit: 'hours', divisions: 12 },
];

export { THREE };
