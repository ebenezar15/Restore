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
};

export const FINISHES = {
  paint:   { label: 'Matte paint',   rough: 0.9,  metal: 0,   tex: null },
  gloss:   { label: 'Gloss lacquer', rough: 0.25, metal: 0,   tex: null },
  fabric:  { label: 'Acoustic fabric', rough: 1,  metal: 0,   tex: 'fabric', rep: 3 },
  felt:    { label: 'PET felt',      rough: 1,    metal: 0,   tex: 'felt', rep: 2 },
  foam:    { label: 'Open-cell foam', rough: 1,   metal: 0,   tex: 'foam', rep: 2 },
  wood:    { label: 'Wood veneer',   rough: 0.6,  metal: 0,   tex: 'wood', rep: 1 },
  concrete:{ label: 'Concrete',      rough: 0.95, metal: 0,   tex: 'concrete', rep: 1 },
  brick:   { label: 'Brick',         rough: 0.95, metal: 0,   tex: 'brick', rep: 1 },
  carpet:  { label: 'Carpet',        rough: 1,    metal: 0,   tex: 'carpet', rep: 4 },
  tile:    { label: 'Ceramic tile',  rough: 0.35, metal: 0,   tex: 'tile', rep: 1 },
  marble:  { label: 'Stone / marble', rough: 0.3, metal: 0,   tex: 'marble', rep: 1 },
  metal:   { label: 'Brushed metal', rough: 0.35, metal: 0.85, tex: 'metal', rep: 1 },
  leather: { label: 'Leather',       rough: 0.55, metal: 0,   tex: 'leather', rep: 2 },
  plastic: { label: 'Plastic',       rough: 0.5,  metal: 0,   tex: null },
  glass:   { label: 'Glass',         rough: 0.05, metal: 0,   tex: null, glass: true },
};

export function finishTexture(name, repeat) {
  const f = FINISHES[name];
  if (!f || !f.tex) return null;
  const base = canvasTexture('tex:' + f.tex, 256, DRAW[f.tex]);
  if (!repeat) return base;
  const key = `tex:${f.tex}:${repeat[0].toFixed(2)}:${repeat[1].toFixed(2)}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = base.clone(); t.needsUpdate = true; t.repeat.set(repeat[0], repeat[1]);
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
    side: opts.side ?? THREE.FrontSide,
  });
  if (f.glass) { m.transparent = true; m.opacity = opts.opacity ?? 0.22; m.depthWrite = false; m.envMapIntensity = 1.5; }
  else if (opts.opacity != null) { m.transparent = true; m.opacity = opts.opacity; }
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  matCache.set(key, m);
  return m;
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
