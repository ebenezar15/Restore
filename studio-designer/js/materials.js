// Procedural textures + material factory. Everything is generated on a canvas,
// so nothing is downloaded and the app works fully offline.
import * as THREE from 'three';

const texCache = new Map();
const matCache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(key, size, draw, { repeat = 1, srgb = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function noise(g, n, alpha, seed, minL = 200, maxL = 255) {
  const r = rng(seed);
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = minL + (maxL - minL) * r();
    img.data[i] = img.data[i] * (1 - alpha) + v * alpha;
    img.data[i + 1] = img.data[i + 1] * (1 - alpha) + v * alpha;
    img.data[i + 2] = img.data[i + 2] * (1 - alpha) + v * alpha;
  }
  g.putImageData(img, 0, 0);
}

const DRAW = {
  fabric(g, n) {
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < n; i += 2) {
      g.fillStyle = i % 4 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect(i, 0, 1, n); g.fillRect(0, i, n, 1);
    }
    noise(g, n, 0.25, 7, 205, 255);
  },
  felt(g, n) { g.fillStyle = '#eee'; g.fillRect(0, 0, n, n); noise(g, n, 0.5, 11, 190, 255); },
  wood(g, n) {
    const r = rng(3);
    g.fillStyle = '#e9e1d6'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) {
      const v = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 6) * 0.5 + 0.5;
      g.fillStyle = `rgba(90,60,30,${0.05 + v * 0.13})`;
      g.fillRect(0, y, n, 1);
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(70,45,20,${0.06 + r() * 0.08})`;
      g.beginPath(); const y = r() * n; g.moveTo(0, y);
      for (let x = 0; x <= n; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      g.stroke();
    }
  },
  concrete(g, n) {
    g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, n, n); noise(g, n, 0.35, 21, 170, 255);
    const r = rng(5);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.beginPath(); g.arc(r() * n, r() * n, r() * 2.2, 0, 7); g.fill(); }
  },
  carpet(g, n) { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n); noise(g, n, 0.7, 31, 150, 255); },
  foam(g, n) {
    g.fillStyle = '#ddd'; g.fillRect(0, 0, n, n);
    const r = rng(9);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.18})`; g.beginPath(); g.arc(r() * n, r() * n, 0.5 + r() * 1.6, 0, 7); g.fill(); }
  },
  brick(g, n) {
    g.fillStyle = '#d8d0c8'; g.fillRect(0, 0, n, n);
    const bh = n / 8, bw = n / 4, r = rng(13);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const off = row % 2 ? bw / 2 : 0, l = 205 + r() * 50;
      g.fillStyle = `rgb(${l},${l * 0.97},${l * 0.94})`;
      g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  },
  tile(g, n) {
    g.fillStyle = '#c9c9c9'; g.fillRect(0, 0, n, n);
    g.fillStyle = '#f4f4f4';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillRect(x * n / 4 + 2, y * n / 4 + 2, n / 4 - 4, n / 4 - 4);
  },
  marble(g, n) {
    g.fillStyle = '#f5f5f5'; g.fillRect(0, 0, n, n);
    const r = rng(17);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(80,80,90,${0.05 + r() * 0.12})`; g.lineWidth = 0.5 + r() * 1.5;
      g.beginPath(); let x = r() * n, y = 0; g.moveTo(x, y);
      while (y < n) { x += (r() - 0.5) * 22; y += 8 + r() * 10; g.lineTo(x, y); }
      g.stroke();
    }
  },
  metal(g, n) {
    g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(0, y, n, 1); }
  },
  leather(g, n) { g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, n, n); noise(g, n, 0.25, 41, 200, 255); },

  plaster(g, n) {
    g.fillStyle = '#eee'; g.fillRect(0, 0, n, n);
    const r = rng(51);
    for (let i = 0; i < 260; i++) { const x = r() * n, y = r() * n, rad = 8 + r() * 40, l = 215 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${l},${l},${l},0.35)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    noise(g, n, 0.08, 52, 200, 255);
  },
  limewash(g, n) {
    g.fillStyle = '#ececec'; g.fillRect(0, 0, n, n);
    const r = rng(53);
    for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(${r() > 0.5 ? 255 : 170},${r() > 0.5 ? 255 : 170},${r() > 0.5 ? 255 : 170},0.08)`; g.lineWidth = 6 + r() * 18; g.beginPath(); const x = r() * n, y = r() * n; g.moveTo(x, y); g.quadraticCurveTo(x + 40 * (r() - 0.5), y + 40 * (r() - 0.5), x + 80 * (r() - 0.5), y + 80 * (r() - 0.5)); g.stroke(); }
  },
  linen(g, n) {
    g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, n, n);
    const r = rng(61);
    for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`; g.fillRect(i, 0, 1, n); g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.05})`; g.fillRect(0, i, n, 1); }
    noise(g, n, 0.15, 62, 210, 255);
  },
  velvet(g, n) {
    const gr = g.createLinearGradient(0, 0, n, n); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#d8d8d8'); gr.addColorStop(1, '#f4f4f4');
    g.fillStyle = gr; g.fillRect(0, 0, n, n); noise(g, n, 0.12, 63, 220, 255);
  },
  boucle(g, n) {
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n);
    const r = rng(64);
    for (let i = 0; i < 1400; i++) { g.strokeStyle = `rgba(${r() > 0.5 ? 255 : 150},${r() > 0.5 ? 255 : 150},${r() > 0.5 ? 255 : 150},0.35)`; g.lineWidth = 1.2; g.beginPath(); g.arc(r() * n, r() * n, 1.5 + r() * 2.5, 0, 7); g.stroke(); }
  },
  herringboneFab(g, n) {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, n, n);
    const w = 16;
    for (let x = 0; x < n; x += w) for (let y = -n; y < n * 2; y += 4) { g.strokeStyle = `rgba(0,0,0,${(x / w) % 2 ? 0.12 : 0.06})`; g.beginPath(); const dir = (x / w) % 2 ? 1 : -1; g.moveTo(x, y); g.lineTo(x + w, y + dir * w * 0.6); g.stroke(); }
    noise(g, n, 0.12, 65, 200, 255);
  },
  tweed(g, n) { g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, n, n); const r = rng(66); for (let i = 0; i < 2600; i++) { const l = r() > 0.5 ? 255 : 120; g.fillStyle = `rgba(${l},${l},${l},0.25)`; g.fillRect(r() * n, r() * n, 3 + r() * 4, 1); g.fillRect(r() * n, r() * n, 1, 3 + r() * 4); } },
  suede(g, n) { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n); noise(g, n, 0.35, 67, 205, 255); const r = rng(68); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.08})`; g.beginPath(); g.ellipse(r() * n, r() * n, 20 + r() * 40, 8 + r() * 20, r() * 3, 0, 7); g.fill(); } },
  mesh(g, n) { g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < n; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < n; x += 4) g.fillRect(x, y, 2, 2); },
  plank(g, n) {
    DRAW.wood(g, n);
    const r = rng(71); g.strokeStyle = 'rgba(40,25,10,0.45)'; g.lineWidth = 2;
    for (let y = 0; y < n; y += n / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke(); const x = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + n / 4); g.stroke(); }
    for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 200 : 0},0,${r() * 0.07})`; g.fillRect(0, (k * n) / 4, n, n / 4); }
  },
  parquet(g, n) {
    g.fillStyle = '#e2d6c6'; g.fillRect(0, 0, n, n);
    const L = n / 4, W = n / 16, r = rng(72);
    g.save(); g.translate(n / 2, n / 2); g.rotate(Math.PI / 4); g.translate(-n, -n);
    for (let y = 0; y < n * 2; y += W) for (let x = 0; x < n * 2; x += L) { const vert = ((x / L + y / W) | 0) % 2; g.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.15})`; if (vert) g.fillRect(x, y, W, L); else g.fillRect(x, y, L, W); g.strokeStyle = 'rgba(60,40,20,0.35)'; g.strokeRect(x, y, vert ? W : L, vert ? L : W); }
    g.restore();
  },
  chevron(g, n) {
    g.fillStyle = '#e2d6c6'; g.fillRect(0, 0, n, n);
    const r = rng(73), h = n / 8;
    for (let y = -h; y < n + h; y += h) for (const side of [-1, 1]) { g.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.16})`; g.beginPath(); g.moveTo(n / 2, y); g.lineTo(n / 2 + side * n / 2, y + n / 4); g.lineTo(n / 2 + side * n / 2, y + n / 4 + h); g.lineTo(n / 2, y + h); g.closePath(); g.fill(); g.strokeStyle = 'rgba(60,40,20,0.35)'; g.stroke(); }
  },
  slatlines(g, n) { DRAW.wood(g, n); for (let x = 0; x < n; x += n / 8) { g.fillStyle = 'rgba(20,12,5,0.55)'; g.fillRect(x, 0, n / 40, n); } },
  plywood(g, n) { DRAW.wood(g, n); g.globalAlpha = 0.5; DRAW.wood(g, n); g.globalAlpha = 1; },
  stone(g, n) {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, n, n);
    const r = rng(81); let y = 0;
    while (y < n) { const hh = 24 + r() * 30; let x = -r() * 30; while (x < n) { const ww = 40 + r() * 60, l = 170 + r() * 70; g.fillStyle = `rgb(${l},${l},${l - 6})`; g.fillRect(x + 2, y + 2, ww - 4, hh - 4); x += ww; } y += hh; }
    noise(g, n, 0.25, 82, 150, 255);
  },
  terrazzo(g, n) { g.fillStyle = '#efefef'; g.fillRect(0, 0, n, n); const r = rng(83); const cols = ['#bbb', '#888', '#d9a07a', '#8fa3a8', '#555', '#c9b18a']; for (let i = 0; i < 420; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); const x = r() * n, y = r() * n, s = 1 + r() * 5; g.moveTo(x, y); g.lineTo(x + s, y + r() * s); g.lineTo(x + r() * s, y + s); g.fill(); } },
  slate(g, n) { g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, n, n); const r = rng(84); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(0, r() * n, n, 1 + r() * 4); } noise(g, n, 0.2, 85, 170, 255); },
  subway(g, n) { g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, n, n); const bh = n / 8, bw = n / 4; for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) { const off = row % 2 ? bw / 2 : 0; g.fillStyle = '#f7f7f7'; g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4); } },
  hexTile(g, n) { g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, n, n); const R = n / 8, hgt = Math.sqrt(3) * R; for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) { const x = col * R * 1.5, y = row * hgt + (col % 2 ? hgt / 2 : 0); g.fillStyle = '#f6f6f6'; g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * (R - 2), y + Math.sin(a) * (R - 2)); } g.fill(); } },
  mosaic(g, n) { const r = rng(86), s = n / 16; for (let y = 0; y < n; y += s) for (let x = 0; x < n; x += s) { const l = 200 + r() * 55; g.fillStyle = '#bbb'; g.fillRect(x, y, s, s); g.fillStyle = `rgb(${l},${l},${l})`; g.fillRect(x + 1, y + 1, s - 2, s - 2); } },
  perforated(g, n) { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, n, n); g.fillStyle = '#222'; for (let y = 6; y < n; y += 12) for (let x = (y / 12) % 2 ? 12 : 6; x < n; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } },
  fluted(g, n) { for (let x = 0; x < n; x++) { const v = 200 + Math.sin((x / n) * Math.PI * 24) * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, n); } },
  frosted(g, n) { g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); noise(g, n, 0.25, 87, 215, 255); },
  stripes(g, n) { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n); for (let x = 0; x < n; x += n / 8) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, n / 16, n); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x + n / 16 + 3, 0, 2, n); } },
  geo(g, n) { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; const s = n / 4; for (let y = 0; y <= n; y += s) for (let x = 0; x <= n; x += s) { g.beginPath(); g.moveTo(x, y - s / 2); g.lineTo(x + s / 2, y); g.lineTo(x, y + s / 2); g.lineTo(x - s / 2, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, s / 8, 0, 7); g.stroke(); } },
  damask(g, n) { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(0,0,0,0.12)'; const s = n / 2; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const cx = x * s + s / 2 + (y % 2 ? s / 2 : 0) - (y % 2 && x ? s : 0), cy = y * s + s / 2; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.ellipse(cx + Math.cos(a) * s * 0.18, cy + Math.sin(a) * s * 0.18, s * 0.14, s * 0.05, a, 0, 7); g.fill(); } g.beginPath(); g.arc(cx, cy, s * 0.06, 0, 7); g.fill(); } },
  cork(g, n) { g.fillStyle = '#d8c0a0'; g.fillRect(0, 0, n, n); const r = rng(88); for (let i = 0; i < 3000; i++) { const l = 120 + r() * 120; g.fillStyle = `rgba(${l},${l * 0.8},${l * 0.6},0.6)`; g.fillRect(r() * n, r() * n, 1 + r() * 3, 1 + r() * 3); } },
  loop(g, n) { g.fillStyle = '#ddd'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < n; x += 4) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } noise(g, n, 0.25, 89, 170, 255); },
  rubber(g, n) { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, n, n); const r = rng(90); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.5})`; g.fillRect(r() * n, r() * n, 1.5, 1.5); } },
};

// Material library. `cat` groups the picker; `color` is the natural colour applied
// when the material is picked (the user can recolour afterwards); `ac` is the
// acoustic material suggested when it's used on a room surface.
export const FINISH_CATS = ['Paint & plaster', 'Fabric & upholstery', 'Wood', 'Stone & masonry', 'Tile', 'Metal', 'Glass & mirror', 'Wallcovering', 'Flooring', 'Other'];
const F = (cat, label, o = {}) => ({ cat, label, rough: 0.9, metal: 0, tex: null, rep: 1, ...o });
export const FINISHES = {
  paint: F('Paint & plaster', 'Matte paint', { ac: 'drywall' }),
  eggshell: F('Paint & plaster', 'Eggshell paint', { rough: 0.7, ac: 'drywall' }),
  satin: F('Paint & plaster', 'Satin paint', { rough: 0.5, ac: 'drywall' }),
  gloss: F('Paint & plaster', 'Gloss lacquer', { rough: 0.22, ac: 'drywall' }),
  plaster: F('Paint & plaster', 'Venetian plaster', { rough: 0.45, tex: 'plaster', color: '#e9e3d8', ac: 'plaster' }),
  limewash: F('Paint & plaster', 'Limewash', { rough: 0.95, tex: 'limewash', color: '#d9cfc0', ac: 'plaster' }),
  fabric: F('Fabric & upholstery', 'Acoustic fabric', { rough: 1, tex: 'fabric', rep: 3, ac: 'fabric_50' }),
  linen: F('Fabric & upholstery', 'Linen', { rough: 1, tex: 'linen', rep: 3, color: '#cdbfa8', ac: 'fabric_50' }),
  velvet: F('Fabric & upholstery', 'Velvet', { rough: 0.8, tex: 'velvet', rep: 1, color: '#2e4d7a', ac: 'curtain' }),
  boucle: F('Fabric & upholstery', 'Bouclé', { rough: 1, tex: 'boucle', rep: 2, color: '#ece6da', ac: 'fabric_50' }),
  herringboneFab: F('Fabric & upholstery', 'Herringbone weave', { rough: 1, tex: 'herringboneFab', rep: 2, color: '#7d7a72', ac: 'fabric_50' }),
  tweed: F('Fabric & upholstery', 'Tweed', { rough: 1, tex: 'tweed', rep: 2, color: '#6b5f52', ac: 'fabric_50' }),
  felt: F('Fabric & upholstery', 'PET felt', { rough: 1, tex: 'felt', rep: 2, ac: 'pet_felt' }),
  suede: F('Fabric & upholstery', 'Suede', { rough: 0.9, tex: 'suede', rep: 1, color: '#a07850' }),
  leather: F('Fabric & upholstery', 'Leather', { rough: 0.55, tex: 'leather', rep: 2, color: '#4a3b30' }),
  grille: F('Fabric & upholstery', 'Speaker grille cloth', { rough: 1, tex: 'mesh', rep: 6, color: '#1d1d1f', ac: 'fabric_50' }),
  foam: F('Fabric & upholstery', 'Open-cell foam', { rough: 1, tex: 'foam', rep: 2, ac: 'foam_50' }),
  wood: F('Wood', 'Wood veneer', { rough: 0.6, tex: 'wood', ac: 'plywood' }),
  oak: F('Wood', 'Oak', { rough: 0.6, tex: 'wood', color: '#c49a6c', ac: 'plywood' }),
  walnut: F('Wood', 'Walnut', { rough: 0.55, tex: 'wood', color: '#5d4030', ac: 'plywood' }),
  ash: F('Wood', 'Ash', { rough: 0.6, tex: 'wood', color: '#d8c3a0', ac: 'plywood' }),
  maple: F('Wood', 'Maple', { rough: 0.55, tex: 'wood', color: '#e0c08f', ac: 'plywood' }),
  cherry: F('Wood', 'Cherry', { rough: 0.5, tex: 'wood', color: '#8a4a32', ac: 'plywood' }),
  ebony: F('Wood', 'Ebonised wood', { rough: 0.45, tex: 'wood', color: '#2a211c', ac: 'plywood' }),
  bamboo: F('Wood', 'Bamboo', { rough: 0.55, tex: 'slatlines', color: '#d6b77c', ac: 'plywood' }),
  plywood: F('Wood', 'Birch plywood', { rough: 0.7, tex: 'plywood', color: '#e6d3b0', ac: 'plywood' }),
  woodSlat: F('Wood', 'Slatted wood', { rough: 0.6, tex: 'slatlines', color: '#c49a6c', ac: 'slat' }),
  stone: F('Stone & masonry', 'Natural stone', { rough: 0.95, tex: 'stone', color: '#b8b2a7', ac: 'concrete' }),
  concrete: F('Stone & masonry', 'Concrete', { rough: 0.95, tex: 'concrete', ac: 'concrete' }),
  polishedConcrete: F('Stone & masonry', 'Polished concrete', { rough: 0.35, tex: 'concrete', color: '#a4a39e', ac: 'tile_floor' }),
  brick: F('Stone & masonry', 'Red brick', { rough: 0.95, tex: 'brick', color: '#b5654a', ac: 'brick' }),
  whiteBrick: F('Stone & masonry', 'Painted brick', { rough: 0.9, tex: 'brick', color: '#ece8df', ac: 'brick' }),
  marble: F('Stone & masonry', 'Marble', { rough: 0.25, tex: 'marble', color: '#efefef', ac: 'tile_floor' }),
  terrazzo: F('Stone & masonry', 'Terrazzo', { rough: 0.35, tex: 'terrazzo', color: '#f2efe9', ac: 'tile_floor' }),
  slate: F('Stone & masonry', 'Slate', { rough: 0.7, tex: 'slate', color: '#4a4e54', ac: 'tile_floor' }),
  tile: F('Tile', 'Square tile', { rough: 0.35, tex: 'tile', ac: 'tile_floor' }),
  subway: F('Tile', 'Subway tile', { rough: 0.25, tex: 'subway', color: '#f4f4f2', ac: 'tile_floor' }),
  hexTile: F('Tile', 'Hexagon tile', { rough: 0.3, tex: 'hexTile', color: '#f4f4f2', ac: 'tile_floor' }),
  mosaic: F('Tile', 'Mosaic', { rough: 0.3, tex: 'mosaic', color: '#9cc6c9', ac: 'tile_floor' }),
  metal: F('Metal', 'Brushed steel', { rough: 0.35, metal: 0.85, tex: 'metal', color: '#bfc3c7' }),
  blackSteel: F('Metal', 'Black steel', { rough: 0.5, metal: 0.7, color: '#2a2b2e' }),
  chrome: F('Metal', 'Chrome', { rough: 0.08, metal: 1, color: '#e6e8ea' }),
  brass: F('Metal', 'Brushed brass', { rough: 0.3, metal: 1, tex: 'metal', color: '#c8a14a' }),
  copper: F('Metal', 'Copper', { rough: 0.3, metal: 1, tex: 'metal', color: '#b87333' }),
  perforated: F('Metal', 'Perforated metal', { rough: 0.4, metal: 0.8, tex: 'perforated', rep: 3, color: '#9a9ea3', ac: 'helmholtz' }),
  glass: F('Glass & mirror', 'Clear glass', { rough: 0.05, glass: true, opacity: 0.2, color: '#dfeff7', ac: 'glass' }),
  frosted: F('Glass & mirror', 'Frosted glass', { rough: 0.6, glass: true, opacity: 0.72, tex: 'frosted', color: '#eef4f6', ac: 'glass' }),
  tinted: F('Glass & mirror', 'Grey tinted glass', { rough: 0.05, glass: true, opacity: 0.55, color: '#4e5862', ac: 'glass' }),
  bronzeGlass: F('Glass & mirror', 'Bronze glass', { rough: 0.05, glass: true, opacity: 0.5, color: '#8a6a4a', ac: 'glass' }),
  reflective: F('Glass & mirror', 'Reflective glass', { rough: 0.02, metal: 0.9, glass: true, opacity: 0.6, color: '#9fb4c4', ac: 'glass' }),
  fluted: F('Glass & mirror', 'Fluted / reeded glass', { rough: 0.25, glass: true, opacity: 0.55, tex: 'fluted', rep: 2, color: '#e6f0f2', ac: 'glass' }),
  acousticGlass: F('Glass & mirror', 'Laminated acoustic glass', { rough: 0.05, glass: true, opacity: 0.28, color: '#cfe8dc', ac: 'glass' }),
  mirror: F('Glass & mirror', 'Mirror', { rough: 0.02, metal: 1, color: '#e8eef2', ac: 'glass' }),
  wallpaperStripe: F('Wallcovering', 'Striped wallpaper', { rough: 0.8, tex: 'stripes', color: '#d8cdb8', ac: 'drywall' }),
  wallpaperGeo: F('Wallcovering', 'Geometric wallpaper', { rough: 0.8, tex: 'geo', color: '#c9d3cf', ac: 'drywall' }),
  damask: F('Wallcovering', 'Damask wallpaper', { rough: 0.8, tex: 'damask', color: '#bfae8e', ac: 'drywall' }),
  cork: F('Wallcovering', 'Cork', { rough: 0.95, tex: 'cork', ac: 'pet_felt' }),
  fabricWall: F('Wallcovering', 'Stretched fabric wall', { rough: 1, tex: 'linen', rep: 2, color: '#6b6f73', ac: 'fabric_50' }),
  carpet: F('Flooring', 'Cut-pile carpet', { rough: 1, tex: 'carpet', rep: 4, ac: 'carpet_pad' }),
  loopCarpet: F('Flooring', 'Loop carpet', { rough: 1, tex: 'loop', rep: 4, color: '#6e6a64', ac: 'carpet' }),
  plank: F('Flooring', 'Wide plank floor', { rough: 0.55, tex: 'plank', color: '#b88a5c', ac: 'wood_floor' }),
  parquet: F('Flooring', 'Herringbone parquet', { rough: 0.5, tex: 'parquet', rep: 2, color: '#b88a5c', ac: 'wood_floor' }),
  chevron: F('Flooring', 'Chevron parquet', { rough: 0.5, tex: 'chevron', rep: 2, color: '#a87a4c', ac: 'wood_floor' }),
  rubber: F('Flooring', 'Rubber / sports floor', { rough: 0.85, tex: 'rubber', rep: 3, color: '#3a3d42', ac: 'carpet' }),
  vinyl: F('Flooring', 'Vinyl / LVT', { rough: 0.4, tex: 'plank', color: '#9c8b78', ac: 'tile_floor' }),
  plastic: F('Other', 'Plastic', { rough: 0.5 }),
  acrylic: F('Other', 'Acrylic', { rough: 0.15 }),
};
for (const f of Object.values(FINISHES)) if (f.rep == null) f.rep = 1;

export const FABRIC_COLORS = [
  ['Charcoal', '#2f3236'], ['Graphite', '#3a3a3c'], ['Slate', '#5a6470'], ['Pebble', '#a49e94'], ['Oatmeal', '#cdbfa8'], ['Cream', '#ece6da'],
  ['Sand', '#d6c39e'], ['Camel', '#b8895a'], ['Rust', '#a4502b'], ['Terracotta', '#c0654a'], ['Burgundy', '#6d1f2c'], ['Plum', '#5b2a4f'],
  ['Mustard', '#c9a227'], ['Olive', '#6b6f3a'], ['Sage', '#9caf88'], ['Forest', '#2e4d36'], ['Teal', '#1f7f80'], ['Petrol', '#1f4f5c'],
  ['Ocean', '#2f6db5'], ['Navy', '#1d2a44'], ['Blush', '#e8c4c0'], ['Lavender', '#b7a6d9'], ['Black', '#141414'], ['White', '#f4f4f2'],
];

export function finishTexture(name, repeat) {
  const f = FINISHES[name];
  if (!f || !f.tex) return null;
  const base = canvasTexture('tex:' + f.tex, 256, DRAW[f.tex]);
  const rep = repeat ? [repeat[0] * (f.rep || 1), repeat[1] * (f.rep || 1)] : f.rep && f.rep !== 1 ? [f.rep, f.rep] : null;
  if (!rep) return base;
  const key = `tex:${f.tex}:${rep[0].toFixed(2)}:${rep[1].toFixed(2)}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = base.clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]);
  texCache.set(key, t);
  return t;
}

/** Shared material for colour + finish. Pass `repeat` for surfaces that need tiling. */
export function mat(color, finish = 'paint', opts = {}) {
  const key = [color, finish, opts.repeat ? opts.repeat.join('x') : '', opts.emissive || '', opts.emissiveIntensity || '', opts.side || '', opts.opacity || '', opts.map ? opts.map.uuid : ''].join('|');
  if (matCache.has(key)) return matCache.get(key);
  const f = FINISHES[finish] || FINISHES.paint;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: f.rough,
    metalness: f.metal,
    map: opts.map || finishTexture(finish, opts.repeat) || null,
    side: opts.side ?? (f.glass ? THREE.DoubleSide : THREE.FrontSide),
  });
  if (f.glass) { m.transparent = true; m.opacity = opts.opacity ?? f.opacity ?? 0.22; m.depthWrite = false; m.envMapIntensity = 1.6; }
  else if (opts.opacity != null) { m.transparent = true; m.opacity = opts.opacity; }
  if (finish === 'mirror' || finish === 'chrome') m.envMapIntensity = 2.2;
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  matCache.set(key, m);
  return m;
}

export const isGlass = (finish) => !!FINISHES[finish]?.glass;

/** Small swatch image (data URL) for the material picker. */
const swatchCache = new Map();
export function finishSwatch(finish, color, size = 64) {
  const k = finish + color + size;
  if (swatchCache.has(k)) return swatchCache.get(k);
  const f = FINISHES[finish] || FINISHES.paint, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  if (f.glass) { for (let y = 0; y < size; y += 8) for (let x = 0; x < size; x += 8) { g.fillStyle = (x + y) / 8 % 2 ? '#555' : '#888'; g.fillRect(x, y, 8, 8); } g.globalAlpha = Math.min(0.9, (f.opacity ?? 0.3) + 0.15); }
  g.fillStyle = color || f.color || '#cccccc'; g.fillRect(0, 0, size, size);
  g.globalAlpha = 1;
  if (f.tex) { const t = canvasTexture('tex:' + f.tex, 256, DRAW[f.tex]); g.globalCompositeOperation = 'multiply'; const reps = Math.max(1, Math.round((f.rep || 1) / 1.5)); for (let i = 0; i < reps; i++) for (let j = 0; j < reps; j++) g.drawImage(t.image, (i * size) / reps, (j * size) / reps, size / reps, size / reps); g.globalCompositeOperation = 'source-over'; }
  if (f.metal > 0.5 || f.rough < 0.3) { const gr = g.createLinearGradient(0, 0, size, size); gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, size, size); }
  const url = c.toDataURL();
  swatchCache.set(k, url);
  return url;
}

/** Dynamic canvas textures that depend on parameters (signs, fader panels...). */
export function drawnTexture(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

const imgTexCache = new Map();
/** Texture from a data URL (camera photo etc). */
export function imageTexture(dataUrl, onLoad) {
  if (imgTexCache.has(dataUrl)) return imgTexCache.get(dataUrl);
  const t = new THREE.TextureLoader().load(dataUrl, onLoad);
  t.colorSpace = THREE.SRGBColorSpace;
  imgTexCache.set(dataUrl, t);
  return t;
}

export const COLOR_NAMES = {
  black: '#1a1a1a', white: '#f4f4f2', offwhite: '#ece8df', 'off white': '#ece8df', cream: '#efe6cf', ivory: '#f3eedd',
  grey: '#8a8d91', gray: '#8a8d91', 'light grey': '#c8cacc', 'light gray': '#c8cacc', 'dark grey': '#3b3e42', 'dark gray': '#3b3e42',
  charcoal: '#2e3033', graphite: '#3a3a3c', anthracite: '#2f3236', silver: '#bfc3c7',
  red: '#c0392b', burgundy: '#6d1f2c', maroon: '#5a1a1f', wine: '#5e1d2a', crimson: '#a61b2b', rust: '#a4502b', terracotta: '#c0654a',
  orange: '#e07b2a', amber: '#e6a020', yellow: '#e8c547', mustard: '#c9a227', gold: '#c8a14a', ochre: '#c78a2c',
  green: '#3f8f4f', olive: '#6b6f3a', sage: '#9caf88', forest: '#2e4d36', 'forest green': '#2e4d36', emerald: '#1f7a57', mint: '#a8dcc4', teal: '#1f7f80',
  blue: '#2f6db5', navy: '#1d2a44', 'navy blue': '#1d2a44', 'royal blue': '#2a4fb0', 'sky blue': '#8cc4e8', 'light blue': '#a9cbe6', cobalt: '#1f4fa0', petrol: '#1f4f5c', denim: '#3d5a80',
  purple: '#6b3fa0', violet: '#7a4fc0', lavender: '#b7a6d9', plum: '#5b2a4f', magenta: '#b0307a', pink: '#e59ab3', blush: '#e8c4c0',
  brown: '#6b4a32', chocolate: '#4a2f22', tan: '#c4a07a', beige: '#d9c7a7', sand: '#d6c39e', taupe: '#8b7d6b', camel: '#b8895a',
  oak: '#c49a6c', walnut: '#5d4030', ash: '#d8c3a0', maple: '#e0c08f', cherry: '#8a4a32', ebony: '#2a211c', pine: '#d9b47e', teak: '#9a6a3f', bamboo: '#d6b77c',
  wood: '#a77b52', concrete: '#9a9a96', cyan: '#2fb5c9', turquoise: '#2bb3a8', coral: '#e8735f', salmon: '#e89a85', lime: '#9ccf3a', indigo: '#3b3f8f',
  warm: '#ffcf96', 'warm white': '#ffd9a8', 'cool white': '#e8f0ff', daylight: '#f3f6ff', neon: '#ff2e88',
};

export function parseColor(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(s)) return s;
  return COLOR_NAMES[s] || null;
}
