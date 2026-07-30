import * as THREE from 'three';

// Detail on a surface comes from its NORMALS, not its colour. Everything here
// draws a greyscale height field first, then converts it to a normal map, so
// the light actually catches chisel marks, pitting and ring grooves instead of
// sliding over a flat disc.

// Sobel height → tangent-space normal map.
export function normalFromHeight(src, strength = 3.2) {
  const w = src.width;
  const h = src.height;
  const px = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const at = (x, y) => px[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4] / 255;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// Fractal blobs — cheap stand-in for fBm, and it tiles well enough at this scale.
function grain(ctx, size, passes, alpha) {
  for (let p = 0; p < passes; p++) {
    const r = size * (0.004 + Math.random() * 0.06);
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The whole door face in one square height field, drawn in world space so that
 * it lines up across the frame, the rings and the hub.
 * `half` = half the width of the world square this covers.
 */
export function doorHeight(size, half, bands) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const S = size / (half * 2); // world units → pixels
  const mid = size / 2;

  ctx.fillStyle = '#808080'; // mid grey = flat
  ctx.fillRect(0, 0, size, size);

  grain(ctx, size, 2600, 0.05);          // coarse stone mottle
  grain(ctx, size, 9000, 0.025);         // fine grit

  ctx.translate(mid, mid);

  // Radial chisel marks — the single biggest "hand-cut stone" cue.
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r0 = (0.6 + Math.random() * (half - 1)) * S;
    const len = (0.15 + Math.random() * 0.7) * S;
    const dark = Math.random() > 0.5;
    ctx.strokeStyle = `rgba(${dark ? 0 : 255},${dark ? 0 : 255},${dark ? 0 : 255},${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a + 0.02) * (r0 + len), Math.sin(a + 0.02) * (r0 + len));
    ctx.stroke();
  }

  // Concentric grooves at every band edge: a dark trench with a bright lip, so
  // the rings read as separate slabs rather than a painted-on circle.
  const groove = (radius) => {
    ctx.lineWidth = 0.09 * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, radius * S, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.035 * S;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(0, 0, (radius - 0.07) * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, (radius + 0.07) * S, 0, Math.PI * 2); ctx.stroke();
  };
  for (const b of bands) { groove(b.inner); groove(b.outer); }

  // Fine engraved circles inside each band — the tooled-track look.
  ctx.lineWidth = 0.018 * S;
  for (const b of bands) {
    for (let k = 1; k <= 3; k++) {
      const rr = b.inner + ((b.outer - b.inner) * k) / 4;
      ctx.strokeStyle = `rgba(0,0,0,${0.18 + Math.random() * 0.1})`;
      ctx.beginPath(); ctx.arc(0, 0, rr * S, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Pitting and chips — age.
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * half * S;
    const rad = (0.5 + Math.random() * 4.5);
    ctx.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, rad, 0, Math.PI * 2); ctx.fill();
  }

  // A few cracks that wander outward.
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    let a = Math.random() * Math.PI * 2;
    let r = (0.8 + Math.random() * 2) * S;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.2 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    for (let k = 0; k < 16; k++) {
      a += (Math.random() - 0.5) * 0.22;
      r += (0.08 + Math.random() * 0.16) * S;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

// ExtrudeGeometry's default UVs are raw world x/y, so a texture must be scaled
// and offset to land the world square [-half, half] onto 0..1.
export function fitToWorld(tex, half) {
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1 / (half * 2), 1 / (half * 2));
  tex.offset.set(0.5, 0.5);
  return tex;
}

// Bevelled edges for the totem inlays: blur the glyph, then take its slope, so
// each one reads as a raised casting rather than a decal.
export function glyphNormal(glyphCanvas) {
  const size = glyphCanvas.width;
  const h = document.createElement('canvas');
  h.width = h.height = size;
  const ctx = h.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.filter = `blur(${Math.round(size * 0.035)}px)`;
  ctx.drawImage(glyphCanvas, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 0.75;
  ctx.drawImage(glyphCanvas, 0, 0);
  return normalFromHeight(h, 2.2);
}
