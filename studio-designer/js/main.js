// RoomTone Studio Designer — application core.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { CATALOG, CATEGORIES, BY_TYPE, buildItem, areaOf, defaultParams } from './catalog.js';
import { mat, FINISHES, imageTexture, COLOR_NAMES } from './materials.js';
import * as AC from './acoustics.js';
import * as G from './geometry.js';
import { runPrompt, PROMPT_EXAMPLES } from './prompt.js';
import { openScanner } from './scan.js';
import { openPdfDialog } from './export.js';

const DEG = Math.PI / 180;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_LIGHTS = 14;

// ===================================================================== DOM helper
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

// ===================================================================== project model
const SURF_DEFAULTS = {
  front: { color: '#ece8df', finish: 'paint', acoustic: 'drywall' },
  back: { color: '#ece8df', finish: 'paint', acoustic: 'drywall' },
  left: { color: '#ece8df', finish: 'paint', acoustic: 'drywall' },
  right: { color: '#ece8df', finish: 'paint', acoustic: 'drywall' },
  floor: { color: '#a77b52', finish: 'wood', acoustic: 'wood_floor' },
  ceiling: { color: '#f4f4f2', finish: 'paint', acoustic: 'drywall' },
};
const SURF_LABEL = { front: 'Front wall', back: 'Back wall', left: 'Left wall', right: 'Right wall', floor: 'Floor', ceiling: 'Ceiling' };

function newProject(dims = { w: 4.2, d: 5.4, h: 2.7 }) {
  return {
    version: 1, name: 'Untitled Studio', designer: '', client: '', notes: '',
    room: G.ensureRoom({ ...dims, surfaces: JSON.parse(JSON.stringify(SURF_DEFAULTS)), ambient: 0.8, daylight: true }),
    items: [], scenes: [], assets: {}, underlay: null,
  };
}

const TEMPLATES = {
  'Home studio': { dims: { w: 3.4, d: 4.2, h: 2.5 }, setup: 'desk' },
  'Mix room': { dims: { w: 4.6, d: 6.1, h: 2.9 }, setup: 'desk' },
  'Mastering suite': { dims: { w: 5.5, d: 7.0, h: 3.2 }, setup: 'mastering' },
  'Control room + console': { dims: { w: 5.2, d: 6.4, h: 3.0 }, setup: 'console' },
  'Vocal booth': { dims: { w: 1.6, d: 1.9, h: 2.3 }, setup: 'booth' },
  'Live room': { dims: { w: 7.0, d: 9.0, h: 3.6 }, setup: 'live' },
  'Podcast studio': { dims: { w: 3.6, d: 4.0, h: 2.6 }, setup: 'podcast' },
  'Home theater': { dims: { w: 5.0, d: 7.0, h: 2.8 }, setup: 'theater' },
  'Splayed control room': { dims: { w: 5.4, d: 6.6, h: 2.8 }, setup: 'desk', shape: 'splayed', ceiling: { type: 'shed', h2: 3.4, dir: 'f2b' } },
  'L-shaped live room': { dims: { w: 7.0, d: 8.0, h: 3.2 }, setup: 'live', shape: 'lshape' },
  'Attic studio': { dims: { w: 4.5, d: 6.0, h: 1.6 }, setup: 'desk', ceiling: { type: 'gable', h2: 3.2, axis: 'z' } },
  'Octagonal booth': { dims: { w: 2.0, d: 2.0, h: 2.4 }, setup: 'booth', shape: 'octagon' },
  'Vaulted hall': { dims: { w: 8.0, d: 12.0, h: 3.2 }, setup: 'live', ceiling: { type: 'vault', h2: 5.5, axis: 'z' } },
  'Round dome room': { dims: { w: 6.0, d: 6.0, h: 2.8 }, setup: 'desk', shape: 'round', ceiling: { type: 'dome', h2: 4.0 } },
  'Empty room': { dims: { w: 4.0, d: 5.0, h: 2.7 }, setup: null },
};

const S = {
  project: newProject(), sel: [], surfaceSel: null, hist: [], future: [], cur: null,
  view: 'persp', tool: 'select', snap: true, units: localStorage.getItem('rt.units') || 'm',
  showReflections: true, showDims: true, showGrid: true, shadows: true, xray: false,
  section: { top: 1, front: 0.5, back: 0.5, left: 0.5, right: 0.5 },
  measurements: [], measureA: null, imported: {}, thumbs: {}, dirty: false, leftTab: 'library', rightTab: 'props',
};
const P = () => S.project;
const R = () => S.project.room;
const defOf = (type) => BY_TYPE[type] || BY_TYPE.shapeBox;
const itemById = (id) => P().items.find((i) => i.id === id);
const selectedItems = () => S.sel.map(itemById).filter(Boolean);

// ---- walls & surfaces of an arbitrarily shaped room
const wallEdges = () => G.edges(R());
function surfLabel(id) {
  if (SURF_LABEL[id]) return SURF_LABEL[id];
  const i = wallEdges().findIndex((e) => e.id === id);
  return i >= 0 ? `Wall ${i + 1}` : id;
}
const surfaceIds = () => [...wallEdges().map((e) => e.id), 'floor', 'ceiling'];
const surfaceLabels = () => Object.fromEntries(surfaceIds().map((id) => [id, surfLabel(id)]));
function surf(id) {
  const all = R().surfaces;
  if (!all[id]) all[id] = { ...JSON.parse(JSON.stringify(all.front || SURF_DEFAULTS.front)), photo: null };
  return all[id];
}
const IDEAL_N = { front: [0, 1], back: [0, -1], left: [1, 0], right: [-1, 0] };
/** Resolve "front"/"left"… (or a wall id) to the best matching wall of any room shape. */
function edgeFor(name) {
  const E = wallEdges();
  const exact = E.find((e) => e.id === name);
  if (exact) return exact;
  const n = IDEAL_N[name];
  if (!n) return E[0];
  const ext = Math.max(R().w, R().d) / 2 || 1;
  let best = null, bs = -Infinity;
  for (const e of E) {
    const al = e.n[0] * n[0] + e.n[1] * n[1];
    if (al < 0.35) continue;
    const pos = -(e.mid[0] * n[0] + e.mid[1] * n[1]) / ext; // how far toward that side
    const sc = al * 2 + pos * 1.5 + Math.min(e.len, 4) * 0.25;
    if (sc > bs) { bs = sc; best = e; }
  }
  return best || E.slice().sort((a, b) => (b.n[0] * n[0] + b.n[1] * n[1]) - (a.n[0] * n[0] + a.n[1] * n[1]))[0];
}
function openingsOn(e) {
  const out = [];
  for (const it of P().items) {
    const def = defOf(it.type);
    if (!def.opening || it.hidden || it.params?.cutWall === false) continue;
    const r = G.distToSegment(it.pos[0], it.pos[2], e.a, e.b);
    if (r.d > it.size[2] / 2 + 0.25) continue;
    const a = it.rot[1] * DEG, fx = Math.sin(a), fz = Math.cos(a);
    if (fx * e.n[0] + fz * e.n[1] < 0.9) continue;
    const u = r.t * e.len, hw = it.size[0] / 2;
    const u0 = clamp(u - hw, 0.02, e.len - 0.02), u1 = clamp(u + hw, 0.02, e.len - 0.02);
    const top = Math.min(G.heightAt(R(), e.a[0] + e.dir[0] * u0, e.a[1] + e.dir[1] * u0), G.heightAt(R(), e.a[0] + e.dir[0] * u1, e.a[1] + e.dir[1] * u1));
    const y0 = clamp(it.pos[1], 0, top - 0.05), y1 = clamp(it.pos[1] + it.size[1], y0 + 0.02, top - 0.02);
    if (u1 - u0 > 0.05 && y1 - y0 > 0.05) out.push({ u0, u1, y0, y1, id: it.id });
  }
  return out;
}
function surfaceArea(id) {
  if (id === 'floor') return G.floorArea(R());
  if (id === 'ceiling') return G.ceilingArea(R());
  const e = wallEdges().find((x) => x.id === id);
  if (!e) return 0;
  return Math.max(0, G.wallArea(R(), e) - openingsOn(e).reduce((a, o) => a + (o.u1 - o.u0) * (o.y1 - o.y0), 0));
}

// ===================================================================== units
const fmt = (m, digits = 2) => (S.units === 'ft' ? `${(m / 0.3048).toFixed(digits)} ft` : `${m.toFixed(digits)} m`);
const toUnit = (m) => (S.units === 'ft' ? m / 0.3048 : m);
const fromUnit = (v) => (S.units === 'ft' ? v * 0.3048 : v);

// ===================================================================== three.js setup
const viewportEl = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewportEl.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1b1d21');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight('#ffffff', '#5a5048', 0.6);
const sun = new THREE.DirectionalLight('#fff4e6', 1.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(hemi, sun, sun.target);

const roomGroup = new THREE.Group(); roomGroup.name = 'Room';
const itemsGroup = new THREE.Group(); itemsGroup.name = 'Items';
const helpers = new THREE.Group(); helpers.name = 'Helpers';
const measureGroup = new THREE.Group();
const underlayGroup = new THREE.Group();
scene.add(roomGroup, itemsGroup, helpers, measureGroup, underlayGroup);
const objMap = new Map(); // item id -> Object3D
const wallObjs = {};

const persp = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
const orthoCams = {};
for (const v of ['top', 'front', 'back', 'left', 'right']) orthoCams[v] = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.05, 300);
let activeCam = persp;

const orbit = new OrbitControls(persp, renderer.domElement);
orbit.enableDamping = true; orbit.dampingFactor = 0.12; orbit.screenSpacePanning = true;
orbit.maxPolarAngle = Math.PI * 0.495;

const tc = new TransformControls(persp, renderer.domElement);
tc.setSize(0.9);
scene.add(tc.getHelper());

// ===================================================================== room build
function labelSprite(text, { size = 0.16, color = '#ffffff', bg = 'rgba(17,19,23,0.85)', border = null } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 48;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 36;
  c.width = w; c.height = fs + 26;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  g.fillStyle = bg; roundRect(g, 0, 0, c.width, c.height, 14); g.fill();
  if (border) { g.strokeStyle = border; g.lineWidth = 4; roundRect(g, 2, 2, c.width - 4, c.height - 4, 12); g.stroke(); }
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(size * (c.width / c.height), size, 1);
  s.renderOrder = 999;
  return s;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function line(points, color = '#ffffff', opacity = 1, dashed = false) {
  const geo = new THREE.BufferGeometry().setFromPoints(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity, depthTest: false }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false });
  const l = new THREE.Line(geo, m); if (dashed) l.computeLineDistances(); l.renderOrder = 998;
  return l;
}
function dimLine(a, b, text, offsetDir, color = '#9fd3ff') {
  const g = new THREE.Group();
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), o = new THREE.Vector3(...offsetDir);
  g.add(line([A.clone().add(o), Bv.clone().add(o)], color, 0.9));
  const tick = o.clone().normalize().multiplyScalar(0.12);
  g.add(line([A, A.clone().add(o).add(tick)], color, 0.5), line([Bv, Bv.clone().add(o).add(tick)], color, 0.5));
  const lab = labelSprite(text, { size: 0.17, color: '#dff1ff' });
  lab.position.copy(A.clone().add(Bv).multiplyScalar(0.5).add(o).add(tick.clone().multiplyScalar(1.4)));
  g.add(lab);
  return g;
}

function surfaceMaterial(name, opts = {}) {
  const sf = surf(name);
  if (sf.photo && sf.showPhoto !== false && P().assets[sf.photo]) {
    return new THREE.MeshStandardMaterial({ map: imageTexture(P().assets[sf.photo], () => {}), roughness: 0.9, side: opts.side ?? THREE.FrontSide });
  }
  let m = mat(sf.color, sf.finish, opts);
  if (S.xray && opts.xray) { m = m.clone(); m.transparent = true; m.opacity = 0.28; m.depthWrite = false; }
  return m;
}
/** Wall face as a flat shape in (u along wall, y up) with holes for doors / windows, mapped into 3D. */
function wallFaceGeometry(e, top, holes, map, photo) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(e.len, 0);
  for (let k = top.length - 1; k >= 0; k--) sh.lineTo(top[k][0], top[k][1]);
  sh.closePath();
  for (const o of holes) { const hp = new THREE.Path(); hp.moveTo(o.u0, o.y0); hp.lineTo(o.u0, o.y1); hp.lineTo(o.u1, o.y1); hp.lineTo(o.u1, o.y0); hp.closePath(); sh.holes.push(hp); }
  const g = new THREE.ShapeGeometry(sh);
  const pos = g.attributes.position, uv = g.attributes.uv, hmax = Math.max(...top.map((t) => t[1]));
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i), y = pos.getY(i), [x, z] = map(u);
    pos.setXYZ(i, x, y, z);
    if (photo) uv.setXY(i, u / e.len, y / hmax); else uv.setXY(i, u / 2.4, y / 2.4);
  }
  g.computeVertexNormals();
  return g;
}
function quadsGeometry(quads) {
  const v = [];
  for (const [a, b, c, d] of quads) v.push(...a, ...b, ...c, ...a, ...c, ...d);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}

function buildRoom() {
  roomGroup.clear();
  for (const k of Object.keys(wallObjs)) delete wallObjs[k];
  const room = G.ensureRoom(R());
  const { w, d, h } = room, t = clamp(room.wallT ?? 0.15, 0.02, 1);
  S.hmax = G.maxHeight(room);
  const shellMat = S.xray ? new THREE.MeshStandardMaterial({ color: '#c9c5bd', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }) : mat('#c9c5bd', 'paint', { side: THREE.DoubleSide });
  const mk = (geo, m, name) => { const me = new THREE.Mesh(geo, m); me.userData.surface = name; me.receiveShadow = true; return me; };
  const E = wallEdges(), ring = G.offsetRing(room, t);
  // floor + slab
  const fg = new THREE.Group(); fg.userData.surface = 'floor';
  const floorShape = new THREE.Shape(room.poly.map((p) => new THREE.Vector2(p.x, -p.z)));
  const floor = mk(new THREE.ShapeGeometry(floorShape), surfaceMaterial('floor', { repeat: [1 / 1.2, 1 / 1.2] }), 'floor');
  floor.rotation.x = -Math.PI / 2; fg.add(floor);
  const slabShape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: 0.15, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2); slabGeo.translate(0, -0.152, 0);
  fg.add(mk(slabGeo, shellMat, 'floor'));
  roomGroup.add(fg); wallObjs.floor = fg;
  // walls (each edge: inner face with openings, outer shell, top cap, reveals)
  E.forEach((e, i) => {
    const g = new THREE.Group(); g.userData.surface = e.id; g.userData.edge = e;
    const top = G.wallTop(room, e), holes = openingsOn(e), sf = surf(e.id);
    const photo = sf.photo && sf.showPhoto !== false && P().assets[sf.photo];
    const inner = (u) => [e.a[0] + e.dir[0] * u, e.a[1] + e.dir[1] * u];
    const oA = ring[i], oB = ring[(i + 1) % ring.length];
    const outer = (u) => [oA[0] + (oB[0] - oA[0]) * (u / e.len), oA[1] + (oB[1] - oA[1]) * (u / e.len)];
    g.add(mk(wallFaceGeometry(e, top, holes, inner, !!photo), surfaceMaterial(e.id, { xray: true }), e.id));
    const og = wallFaceGeometry(e, top, holes, outer, false);
    const idx = og.index.array; for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
    og.computeVertexNormals();
    const shell = mk(og, shellMat, e.id); shell.castShadow = true; g.add(shell);
    const quads = [];
    for (let k = 0; k < top.length - 1; k++) {
      const [u0, y0] = top[k], [u1, y1] = top[k + 1], i0 = inner(u0), i1 = inner(u1), o0 = outer(u0), o1 = outer(u1);
      quads.push([[i0[0], y0, i0[1]], [i1[0], y1, i1[1]], [o1[0], y1, o1[1]], [o0[0], y0, o0[1]]]);
    }
    for (const o of holes) {
      const P3 = (u, y, f) => { const q = f(u); return [q[0], y, q[1]]; };
      quads.push([P3(o.u0, o.y0, inner), P3(o.u1, o.y0, inner), P3(o.u1, o.y0, outer), P3(o.u0, o.y0, outer)]);
      quads.push([P3(o.u0, o.y1, inner), P3(o.u1, o.y1, inner), P3(o.u1, o.y1, outer), P3(o.u0, o.y1, outer)]);
      quads.push([P3(o.u0, o.y0, inner), P3(o.u0, o.y1, inner), P3(o.u0, o.y1, outer), P3(o.u0, o.y0, outer)]);
      quads.push([P3(o.u1, o.y0, inner), P3(o.u1, o.y1, inner), P3(o.u1, o.y1, outer), P3(o.u1, o.y0, outer)]);
    }
    if (quads.length) g.add(mk(quadsGeometry(quads), shellMat, e.id));
    roomGroup.add(g); wallObjs[e.id] = g;
  });
  // ceiling (flat, sloped, pitched, vaulted or domed)
  const cg = new THREE.Group(); cg.userData.surface = 'ceiling';
  const tris = G.ceilingTriangles(room), cv = [], cuv = [];
  for (const tri of tris) for (const [x, y, z] of tri) { cv.push(x, y, z); cuv.push(x / 1.2, z / 1.2); }
  const cgeo = new THREE.BufferGeometry();
  cgeo.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3)); cgeo.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2)); cgeo.computeVertexNormals();
  cg.add(mk(cgeo, surfaceMaterial('ceiling', { side: THREE.DoubleSide }), 'ceiling'));
  roomGroup.add(cg); wallObjs.ceiling = cg;
  // grid clipped to the floor outline
  if (S.showGrid) {
    const pts = [], step = S.units === 'ft' ? 0.3048 : 0.5, seg = step / 4;
    const add = (x0, z0, x1, z1) => { if (insideRoom((x0 + x1) / 2, (z0 + z1) / 2)) pts.push(new THREE.Vector3(x0, 0.003, z0), new THREE.Vector3(x1, 0.003, z1)); };
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += step) for (let z = -d / 2; z < d / 2 - 1e-6; z += seg) add(x, z, x, Math.min(z + seg, d / 2));
    for (let z = -d / 2; z <= d / 2 + 1e-6; z += step) for (let x = -w / 2; x < w / 2 - 1e-6; x += seg) add(x, z, Math.min(x + seg, w / 2), z);
    const grid = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 0.12 }));
    grid.userData.helper = true; roomGroup.add(grid);
  }
  if (S.showDims) {
    const dims = new THREE.Group(); dims.userData.helper = true; dims.name = 'dims';
    const rect = G.isRect(room);
    for (const e of E) {
      if (e.len < 0.6 && !rect) continue;
      dims.add(dimLine([e.a[0], 0.01, e.a[1]], [e.b[0], 0.01, e.b[1]], fmt(e.len), [-e.n[0] * (t + 0.35), 0, -e.n[1] * (t + 0.35)]));
    }
    const e0 = E.find((e) => e.id === 'front') || E[0];
    dims.add(dimLine([e0.b[0], 0, e0.b[1]], [e0.b[0], G.heightAt(room, e0.b[0], e0.b[1]), e0.b[1]], fmt(G.heightAt(room, e0.b[0], e0.b[1])), [-e0.n[0] * (t + 0.3) + e0.dir[0] * 0.2, 0, -e0.n[1] * (t + 0.3) + e0.dir[1] * 0.2]));
    if (S.hmax > h + 0.05) { const lab = labelSprite(`peak ${fmt(S.hmax)}`, { size: 0.15, color: '#dff1ff' }); lab.position.set(0, S.hmax + 0.2, 0); dims.add(lab); }
    roomGroup.add(dims);
  }
  // wall name tags (visible in plan)
  E.forEach((e, i) => {
    if (e.len < 0.5 && !G.isRect(room)) return;
    const s2 = labelSprite(SURF_LABEL[e.id] ? e.id.toUpperCase() : `W${i + 1}`, { size: 0.12, color: '#ffffff', bg: 'rgba(0,0,0,0.35)' });
    s2.position.set(e.mid[0] + e.n[0] * 0.28, 0.02, e.mid[1] + e.n[1] * 0.28); s2.userData.helper = true; s2.userData.tag = e.id; s2.visible = false; roomGroup.add(s2);
  });
  // lighting rig follows room size
  sun.position.set(w * 0.6, S.hmax * 3, d * 0.9);
  sun.target.position.set(0, 0, 0);
  const span = Math.max(w, d) * 0.9;
  Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: S.hmax * 6 + span * 2 });
  sun.shadow.camera.updateProjectionMatrix();
  applyAmbient();
  buildUnderlay();
  drawShapeHandles();
}
function applyAmbient() {
  const a = R().ambient ?? 0.8;
  hemi.intensity = 0.25 + a * 0.55;
  sun.intensity = R().daylight === false ? 0 : 0.4 + a * 1.4;
  scene.environmentIntensity = 0.15 + a * 0.55;
  sun.castShadow = S.shadows;
}

function buildUnderlay() {
  underlayGroup.clear();
  const u = P().underlay;
  if (!u || !P().assets[u.asset] || u.visible === false) return;
  const tex = imageTexture(P().assets[u.asset], (t) => { const a = t.image.height / t.image.width; plane.scale.set(u.width, u.width * a, 1); });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: u.opacity ?? 0.6, depthWrite: false }));
  const a = tex.image ? tex.image.height / tex.image.width : 0.7;
  plane.scale.set(u.width, u.width * a, 1);
  plane.rotation.set(-Math.PI / 2, 0, (u.rot || 0) * DEG);
  plane.position.set(u.x || 0, 0.006, u.z || 0);
  plane.renderOrder = 1;
  underlayGroup.add(plane);
}

// ===================================================================== items
const buildCtx = () => ({ room: R(), heightAt: (x, z) => G.heightAt(R(), x, z), assets: P().assets, imported: S.imported, onTexture: () => {} });

function syncTransform(it, obj = objMap.get(it.id)) {
  if (!obj) return;
  obj.position.set(...it.pos);
  obj.rotation.set(it.rot[0] * DEG, it.rot[1] * DEG, it.rot[2] * DEG, 'YXZ');
  obj.visible = !it.hidden;
}
function rebuildItem(it) {
  const old = objMap.get(it.id);
  if (old) { itemsGroup.remove(old); disposeTree(old); }
  const obj = buildItem(it, buildCtx());
  obj.userData.itemId = it.id;
  obj.traverse((o) => { o.userData.itemId = it.id; });
  syncTransform(it, obj);
  itemsGroup.add(obj);
  objMap.set(it.id, obj);
  if (S.sel.includes(it.id) && S.sel[0] === it.id && S.tool !== 'select' && S.tool !== 'measure' && !it.locked) tc.attach(obj);
  return obj;
}
function disposeTree(o) {
  o.traverse((c) => {
    if (c.geometry && c.geometry !== undefined && c.geometry.type !== 'BoxGeometry') c.geometry.dispose?.();
    if (c.isLight && c.dispose) c.dispose();
  });
}
function rebuildAllItems() {
  tc.detach();
  for (const o of objMap.values()) { itemsGroup.remove(o); disposeTree(o); }
  objMap.clear();
  for (const it of P().items) rebuildItem(it);
  limitLights();
  attachGizmo();
}
function limitLights() {
  let n = 0;
  itemsGroup.traverse((o) => { if (o.isLight) { o.visible = n < MAX_LIGHTS; n++; } });
}

function makeItem(type, over = {}) {
  const def = defOf(type);
  return {
    id: uid(), type, name: def.name,
    pos: [0, 0, 0], rot: [0, 0, 0], size: def.size.slice(),
    color: def.color, color2: def.color2, finish: def.finish, acoustic: def.acoustic,
    params: defaultParams(def), locked: false, hidden: false, ...over,
  };
}

// ---------------------------------------------------------------- placement
function wallY(def, size) {
  if (def.wallY != null) return Math.max(0, def.wallY - size[1] / 2);
  if (size[1] >= 1.8) return 0;
  return Math.max(0, 1.2 - size[1] / 2);
}
const inwardRot = (e) => Math.atan2(e.n[0], e.n[1]) / DEG;
/** Put an item flat against a wall. `u` = offset from the wall's centre along the wall. */
function placeOnWall(it, wall, u = 0, y) {
  const e = typeof wall === 'object' ? wall : edgeFor(wall);
  if (!e) return;
  const dep = it.size[2], def = defOf(it.type), half = Math.min(it.size[0] / 2, e.len / 2);
  const uu = clamp(u, -e.len / 2 + half, e.len / 2 - half);
  const x = e.mid[0] + e.dir[0] * uu + e.n[0] * dep / 2, z = e.mid[1] + e.dir[1] * uu + e.n[1] * dep / 2;
  it.rot = [0, inwardRot(e), 0];
  const top = Math.min(G.heightAt(R(), x - e.dir[0] * half, z - e.dir[1] * half), G.heightAt(R(), x + e.dir[0] * half, z + e.dir[1] * half));
  let yy = y ?? wallY(def, it.size);
  if (def.wallTop) yy = top - it.size[1];
  if (it.size[1] > top) it.size[1] = +top.toFixed(3);
  it.pos = [x, clamp(yy, 0, Math.max(0, top - it.size[1])), z];
  it.wall = e.id;
}
/** Put an item on a wall at the point nearest to world (px, pz). */
function placeOnWallAt(it, wall, px, pz, y) {
  const e = typeof wall === 'object' ? wall : edgeFor(wall);
  if (!e) return;
  const t = (px - e.a[0]) * e.dir[0] + (pz - e.a[1]) * e.dir[1];
  placeOnWall(it, e, t - e.len / 2, y);
}
function nearestEdge(x, z) {
  let best = null;
  for (const e of wallEdges()) { const r = G.distToSegment(x, z, e.a, e.b); if (!best || r.d < best.d) best = { e, d: r.d }; }
  return best?.e;
}
function convexCorners() {
  const v = G.vertexInfo(R()).filter((c) => c.convex);
  return v.sort((a, b) => a.z - b.z || a.x - b.x);
}
function cornerFor(key) {
  const { w, d } = R(), vs = convexCorners();
  if (typeof key === 'number') return vs[key % vs.length];
  const t = { FL: [-w / 2, -d / 2], FR: [w / 2, -d / 2], BR: [w / 2, d / 2], BL: [-w / 2, d / 2] }[key] || [0, 0];
  return vs.slice().sort((a, b) => Math.hypot(a.x - t[0], a.z - t[1]) - Math.hypot(b.x - t[0], b.z - t[1]))[0];
}
function placeInCorner(it, key) {
  const v = typeof key === 'object' ? key : cornerFor(key), def = defOf(it.type);
  if (!v) return placeItem(it, 'floor');
  const top = G.heightAt(R(), v.x, v.z);
  if (def.origin === 'corner') {
    let u = v.toNext, o = v.toPrev;
    const zdir = [-u[1], u[0]];
    if (zdir[0] * o[0] + zdir[1] * o[1] < 0) [u, o] = [o, u];
    it.pos = [v.x, 0, v.z];
    it.rot = [0, Math.atan2(-u[1], u[0]) / DEG, 0];
    it.params = { ...it.params, angle: Math.round(v.angle * 10) / 10 };
    if (it.size[1] > top || it.size[1] >= R().h - 0.05) it.size[1] = +top.toFixed(3);
  } else {
    const bx = v.toPrev[0] + v.toNext[0], bz = v.toPrev[1] + v.toNext[1], bl = Math.hypot(bx, bz) || 1;
    const off = (Math.max(it.size[0], it.size[2]) / 2 + 0.03) / Math.max(0.3, Math.sin((v.angle * DEG) / 2));
    it.pos = [v.x + (bx / bl) * off, def.mount === 'wall' ? wallY(def, it.size) : 0, v.z + (bz / bl) * off];
    it.rot = [0, Math.atan2(bx, bz) / DEG, 0];
  }
}
function spread(n, i, len, itemLen, gap = 0.15) {
  const total = n * itemLen + (n - 1) * gap;
  if (total > len - 0.1) { const step = (len - itemLen - 0.1) / Math.max(1, n - 1); return n === 1 ? 0 : -len / 2 + 0.05 + itemLen / 2 + step * i; }
  return -total / 2 + itemLen / 2 + i * (itemLen + gap);
}
function wallLen(wall) { return edgeFor(wall)?.len || R().w; }
const insideRoom = (x, z) => G.pointInPoly(x, z, R().poly);
function roomCentroid() { const p = R().poly; return [p.reduce((a, v) => a + v.x, 0) / p.length, p.reduce((a, v) => a + v.z, 0) / p.length]; }
function defaultListenerSpot() {
  const { d } = R(); const z = -d / 2 + d * 0.38;
  if (insideRoom(0, z)) return [0, z];
  const c = roomCentroid(); return insideRoom(c[0], c[1]) ? c : [R().poly[0].x * 0.5, R().poly[0].z * 0.5];
}
/** Lowest ceiling point over an item's footprint (for hanging clouds, lights…). */
function ceilingYFor(it, x = it.pos[0], z = it.pos[2]) {
  const a = (it.rot?.[1] || 0) * DEG, c = Math.cos(a), s = Math.sin(a), hw = it.size[0] / 2, hd = it.size[2] / 2;
  let m = Infinity;
  for (const [u, v] of [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) m = Math.min(m, G.heightAt(R(), x + u * c + v * s, z - u * s + v * c));
  return m;
}

function getListener() { return P().items.find((i) => defOf(i.type).listener); }
function getSpeakers() { return P().items.filter((i) => defOf(i.type).speaker && !i.hidden); }
function ear(L) { if (L) return [L.pos[0], L.pos[1] + L.size[1] * 0.92, L.pos[2]]; const [x, z] = defaultListenerSpot(); return [x, 1.2, z]; }
function speakerAcoustic(s) {
  // acoustic centre ≈ between woofer and tweeter on the front face
  const o = new THREE.Vector3(0, s.size[1] * 0.6, s.size[2] / 2).applyEuler(new THREE.Euler(s.rot[0] * DEG, s.rot[1] * DEG, s.rot[2] * DEG, 'YXZ'));
  return [s.pos[0] + o.x, s.pos[1] + o.y, s.pos[2] + o.z];
}
/** Which way a wall faces, for wording and placement ("left", "front"…). */
function sideOf(e) {
  const n = e.n;
  if (Math.abs(n[1]) >= Math.abs(n[0])) return n[1] > 0 ? 'front' : 'back';
  return n[0] > 0 ? 'left' : 'right';
}
function reflectionPoints() {
  const L = getListener(), sp = getSpeakers();
  if (!sp.length) return [];
  const E = ear(L), out = [], room = R();
  for (const s of sp) {
    const S0 = speakerAcoustic(s);
    for (const e of wallEdges()) {
      const r = AC.reflectOffPlane(S0, E, [e.a[0], 0, e.a[1]], [e.n[0], 0, e.n[1]], (pt) => G.distToSegment(pt[0], pt[2], e.a, e.b).d < 0.02 && pt[1] >= 0 && pt[1] <= G.heightAt(room, pt[0], pt[2]) + 0.01);
      if (r) out.push({ ...r, surface: e.id, side: sideOf(e), speaker: s.id });
    }
    const f = AC.reflectOffPlane(S0, E, [0, 0, 0], [0, 1, 0], (pt) => insideRoom(pt[0], pt[2]));
    if (f) out.push({ ...f, surface: 'floor', side: 'floor', speaker: s.id });
    // ceiling: tangent plane under the midpoint (handles sloped / curved ceilings)
    const mx = (S0[0] + E[0]) / 2, mz = (S0[2] + E[2]) / 2, dd = 0.05;
    const Hm = G.heightAt(room, mx, mz), hx = (G.heightAt(room, mx + dd, mz) - G.heightAt(room, mx - dd, mz)) / (2 * dd), hz = (G.heightAt(room, mx, mz + dd) - G.heightAt(room, mx, mz - dd)) / (2 * dd);
    const nl = Math.hypot(hx, 1, hz);
    const c = AC.reflectOffPlane(S0, E, [mx, Hm, mz], [hx / nl, -1 / nl, hz / nl], (pt) => insideRoom(pt[0], pt[2]) && Math.abs(pt[1] - G.heightAt(room, pt[0], pt[2])) < 0.2);
    if (c) out.push({ ...c, surface: 'ceiling', side: 'ceiling', speaker: s.id });
  }
  return out;
}

function defaultFloorSpot(i, n, size) {
  const L = getListener(), { w, d } = R();
  const z = L ? L.pos[2] + 0.9 : d * 0.15;
  const x = n > 1 ? spread(n, i, w * 0.8, size[0], 0.3) : 0;
  let p = [clamp(x, -w / 2 + size[0] / 2, w / 2 - size[0] / 2), 0, clamp(z, -d / 2 + size[2] / 2, d / 2 - size[2] / 2)];
  if (!insideRoom(p[0], p[2])) { const c = roomCentroid(); p = [c[0] + x * 0.3, 0, c[1]]; }
  return p;
}

function placeItem(it, loc, i = 0, n = 1, extra = {}) {
  const def = defOf(it.type), { w, d } = R();
  if (!loc) loc = def.mount === 'wall' ? 'front' : def.mount === 'ceiling' ? 'ceiling' : def.mount === 'corner' ? 'corners' : 'floor';
  if (def.speaker && ['floor', 'center'].includes(loc)) return placeSpeaker(it, i);
  if (def.listener) { const [x, z] = defaultListenerSpot(); it.pos = [x, 0, z]; it.rot = [0, 180, 0]; return; }
  const ceilY = (x, z) => Math.max(0, ceilingYFor(it, x, z) - it.size[1] - (def.drop || 0));
  switch (loc) {
    case 'front': case 'back': case 'left': case 'right':
      if (def.mount === 'ceiling') { const e = edgeFor(loc); const x = e.mid[0] + e.n[0] * 0.8, z = e.mid[1] + e.n[1] * 0.8; it.pos = [x, ceilY(x, z), z]; return; }
      placeOnWall(it, loc, spread(n, i, wallLen(loc), it.size[0]));
      if (def.mount === 'floor') it.pos[1] = 0;
      return;
    case 'sides': {
      const wall = i % 2 ? 'right' : 'left', k = Math.floor(i / 2), m = Math.ceil(n / 2);
      return placeOnWall(it, wall, spread(m, k, Math.min(wallLen(wall), d) * 0.7, it.size[0]));
    }
    case 'allWalls': {
      const walls = wallEdges().filter((e) => e.len > it.size[0] + 0.1);
      const list = walls.length ? walls : wallEdges();
      const e = list[i % list.length], k = Math.floor(i / list.length), m = Math.ceil((n - (i % list.length)) / list.length);
      return placeOnWall(it, e, spread(Math.max(m, 1), k, e.len, it.size[0]));
    }
    case 'corners': return placeInCorner(it, i);
    case 'frontCorners': return placeInCorner(it, ['FL', 'FR'][i % 2]);
    case 'backCorners': return placeInCorner(it, ['BL', 'BR'][i % 2]);
    case 'ceiling': case 'aboveListener': {
      const L = getListener(), sp = getSpeakers();
      let [cx, cz] = roomCentroid();
      if (loc === 'aboveListener' || n === 1) {
        const E = ear(L);
        const sz = sp.length ? sp.reduce((a, s) => a + s.pos[2], 0) / sp.length : E[2] - 1.2;
        cx = E[0]; cz = (E[2] + sz) / 2;
      }
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), c = i % cols, r = Math.floor(i / cols);
      const gx = (c - (cols - 1) / 2) * (it.size[0] + 0.3), gz = (r - (rows - 1) / 2) * (it.size[2] + 0.3);
      const x = clamp(cx + gx, -w / 2 + it.size[0] / 2, w / 2 - it.size[0] / 2), z = clamp(cz + gz, -d / 2 + it.size[2] / 2, d / 2 - it.size[2] / 2);
      it.pos = [x, def.mount === 'ceiling' ? ceilY(x, z) : 0, z];
      return;
    }
    case 'reflections': {
      const p = (extra.points || [])[i];
      if (!p) return placeItem(it, null, i, n);
      if (p.side === 'ceiling') it.pos = [p.point[0], ceilY(p.point[0], p.point[2]), p.point[2]];
      else if (p.side === 'floor') it.pos = [p.point[0], 0, p.point[2]];
      else placeOnWallAt(it, p.surface, p.point[0], p.point[2], Math.max(0, p.point[1] - it.size[1] / 2));
      return;
    }
    default: {
      if (def.mount === 'wall') return placeOnWall(it, 'front', spread(n, i, wallLen('front'), it.size[0]));
      if (def.mount === 'ceiling') return placeItem(it, 'ceiling', i, n);
      if (def.mount === 'corner') return placeInCorner(it, i);
      if (BACK_WALL_TYPES.has(it.type)) { placeOnWall(it, 'back', spread(n, i, wallLen('back'), it.size[0], 0.3)); it.pos[1] = 0; return; }
      if (SIDE_WALL_TYPES.has(it.type)) { placeOnWall(it, i % 2 ? 'right' : 'left', spread(Math.ceil(n / 2), Math.floor(i / 2), wallLen('left') * 0.6, it.size[0], 0.3) + wallLen('left') * 0.15 * (i % 2 ? -1 : 1)); it.pos[1] = 0; return; }
      it.pos = defaultFloorSpot(i, n, it.size);
      it.rot = [0, 180, 0];
    }
  }
}

const BACK_WALL_TYPES = new Set(['sofa', 'bookshelf', 'piano', 'partition']);
const SIDE_WALL_TYPES = new Set(['rack', 'keyboard', 'amp', 'plant', 'pc', 'floorLamp', 'tubeTrap', 'lightBar', 'guitar']);
function speakerLayout() {
  const L = getListener(), E = ear(L), { w } = R();
  const spreadW = clamp(w * 0.38, 0.9, 1.8);
  const desk = P().items.find((i) => i.type === 'desk' || i.type === 'console');
  const pos = [-1, 1].map((sx) => [E[0] + sx * spreadW / 2, 0, E[2] - spreadW * 0.866]);
  return { E, pos, desk };
}
function placeSpeaker(it, i) {
  const { E, pos, desk } = speakerLayout();
  const p = pos[i % 2];
  let y;
  if (desk && desk.type === 'desk') y = desk.pos[1] + desk.size[1] + (desk.params?.bridge !== false ? 0.165 : 0);
  else if (desk && desk.type === 'console') y = desk.pos[1] + desk.size[1] + 0.05;
  else y = Math.max(0, E[1] - it.size[1] * 0.75);
  if (it.type === 'mains') { p[2] = -R().d / 2 + it.size[2] / 2 + 0.05; y = Math.max(0, 1.25 - it.size[1] / 2); }
  it.pos = [p[0], y, p[2]];
  it.rot = [0, Math.atan2(E[0] - p[0], E[2] - p[2]) / DEG, 0];
  it.name = `${defOf(it.type).name} ${i % 2 ? 'R' : 'L'}`;
}

function addMany(type, { qty = 1, loc = null, color = null, size = null, auto = false, extra = {} } = {}) {
  const def = defOf(type);
  if (!def) return [];
  let points = null;
  if (loc === 'reflections') {
    let pts = reflectionPoints();
    if (!pts.length) { ensureListening('desk'); pts = reflectionPoints(); }
    const want = def.mount === 'ceiling' ? ['ceiling'] : def.mount === 'floor' && def.cat === 'Absorption' ? ['floor'] : ['left', 'right'];
    points = mergePoints(pts.filter((p) => want.includes(p.side)), 0.5);
    if (!qty) qty = points.length;
  }
  if (!qty) qty = 1;
  if (def.speaker && !loc && qty === 1 && getSpeakers().length % 2 === 1) qty = 1;
  const created = [];
  const startIdx = def.speaker && !loc ? getSpeakers().length : 0;
  for (let i = 0; i < qty; i++) {
    const it = makeItem(type);
    if (color) it.color = color;
    if (size) it.size = [size.w ?? it.size[0], size.h ?? it.size[1], size.d ?? it.size[2]];
    if (auto) it.auto = true;
    placeItem(it, loc, def.speaker && !loc ? startIdx + i : i, qty, { points, ...extra });
    P().items.push(it);
    rebuildItem(it);
    created.push(it);
  }
  if (def.speaker && !loc && !getListener()) { const L = makeItem('listener'); placeItem(L); P().items.push(L); rebuildItem(L); }
  limitLights();
  select(created.map((i) => i.id));
  commit();
  return created;
}
function mergePoints(pts, dist) {
  const out = [];
  for (const p of pts) {
    const q = out.find((o) => o.surface === p.surface && Math.hypot(o.point[0] - p.point[0], o.point[1] - p.point[1], o.point[2] - p.point[2]) < dist);
    if (q) { q.point = q.point.map((v, k) => (v + p.point[k]) / 2); } else out.push({ ...p, point: p.point.slice() });
  }
  return out;
}

function ensureListening(kind = 'desk') {
  const made = [];
  const add = (type, f) => { const it = makeItem(type); f(it); P().items.push(it); rebuildItem(it); made.push(it); return it; };
  let L = getListener();
  if (!L) L = add('listener', (it) => placeItem(it));
  const E = ear(L);
  if (kind === 'desk' && !P().items.some((i) => i.type === 'desk' || i.type === 'console')) {
    add('desk', (it) => { it.pos = [E[0], 0, E[2] - 0.7]; it.rot = [0, 0, 0]; });
    add('chair', (it) => { it.pos = [E[0], 0, E[2] + 0.05]; it.rot = [0, 180, 0]; });
    add('screen', (it) => { it.pos = [E[0], 0.74, E[2] - 0.85]; });
  }
  if (kind === 'console' && !P().items.some((i) => i.type === 'console')) {
    add('console', (it) => { it.pos = [E[0], 0, E[2] - 0.75]; });
    add('chair', (it) => { it.pos = [E[0], 0, E[2] + 0.1]; it.rot = [0, 180, 0]; });
  }
  if (getSpeakers().length < 2) {
    const type = kind === 'mastering' ? 'midfield' : 'monitor';
    for (let i = getSpeakers().length; i < 2; i++) add(type, (it) => { placeSpeaker(it, i); if (kind === 'mastering') { it.pos[1] = 0.62; } });
    if (kind === 'mastering') for (const s of getSpeakers()) add('stand', (it) => { it.pos = [s.pos[0], 0, s.pos[2]]; it.size = [0.35, 0.62, 0.35]; it.params.isoPad = false; });
  }
  return made;
}

// ---------------------------------------------------------------- auto treatment
function autoTreat(mode = 'mixing') {
  P().items = P().items.filter((i) => !i.auto);
  rebuildAllItems();
  const n0 = P().items.length;
  const A = (type, opts) => addMany(type, { auto: true, ...opts });
  const { w, d, h } = R();
  if (mode === 'mixing' || mode === 'mastering' || mode === 'theater') ensureListening(mode === 'mastering' ? 'mastering' : 'desk');
  if (mode === 'podcast') {
    if (!P().items.some((i) => i.type === 'table')) { const t = makeItem('table', { pos: [0, 0, 0], size: [1.4, 0.74, 0.8] }); P().items.push(t); rebuildItem(t); const mk = (z, r) => { const c = makeItem('chair', { pos: [0, 0, z], rot: [0, r, 0] }); P().items.push(c); rebuildItem(c); const m = makeItem('mic', { pos: [0, 0.74, z * 0.55], size: [0.3, 0.45, 0.4], rot: [0, r, 0] }); P().items.push(m); rebuildItem(m); }; mk(-0.75, 0); mk(0.75, 180); }
  }
  const L = getListener(), E = ear(L), sp = getSpeakers();
  // Bass control in every vertical corner (front first)
  if (mode !== 'booth') A('cornerTrap', { qty: 4, loc: 'corners', extra: {} });
  if (mode === 'mixing' || mode === 'mastering') A('cornerTrapCeil', { qty: 1, loc: 'front', size: { w: w - 1.3 } });
  // First reflection points on side walls + ceiling
  if (['mixing', 'mastering', 'theater'].includes(mode) && sp.length) {
    A(mode === 'theater' ? 'framedPanel' : 'absorber', { qty: 0, loc: 'reflections', size: mode === 'theater' ? { w: 1.2, h: 0.9 } : { w: 0.6, h: 1.2 } });
    A('cloud', { qty: 0, loc: 'reflections' });
  }
  if (mode === 'mixing' || mode === 'mastering') {
    // Behind the speakers: thick panels to tame SBIR
    for (const s of sp) { const it = makeItem('bassPanel', { auto: true }); placeOnWallAt(it, 'front', s.pos[0], s.pos[2], 0.55); it.size = [0.6, 1.2, 0.2]; P().items.push(it); rebuildItem(it); }
    // Rear wall: diffusion at ear height + bass panels low
    const nd = mode === 'mastering' ? 4 : 3;
    const type = mode === 'mastering' ? 'skyline' : 'qrd';
    for (let i = 0; i < nd; i++) { const it = makeItem(type, { auto: true }); placeOnWall(it, 'back', spread(nd, i, Math.min(w, wallLen('back')) * 0.8, it.size[0], 0.02), 1.2 - it.size[1] / 2 + (type === 'skyline' ? 0.3 : 0)); P().items.push(it); rebuildItem(it); }
    if (mode === 'mastering') for (let i = 0; i < 4; i++) { const it = makeItem('skyline', { auto: true }); placeOnWall(it, 'back', spread(4, i, Math.min(w, wallLen('back')) * 0.8, 0.6, 0.02), 0.6); P().items.push(it); rebuildItem(it); }
    for (const side of ['left', 'right']) { const it = makeItem('bad', { auto: true }); placeOnWallAt(it, side, 0, d / 2 - 1.0); P().items.push(it); rebuildItem(it); }
    if (!P().items.some((i) => i.type === 'rug')) A('rug', { qty: 1, loc: 'floor' }).forEach((r) => { r.pos = [E[0], 0, E[2] - 0.6]; syncTransform(r); });
  }
  if (mode === 'tracking') {
    A('skyline', { qty: 4, loc: 'back' }); A('poly', { qty: 4, loc: 'sides' }); A('bad', { qty: 2, loc: 'front' });
    A('baffle', { qty: 4, loc: 'ceiling' }); A('gobo', { qty: 2, loc: 'floor' }); A('membrane', { qty: 2, loc: 'front' });
  }
  if (mode === 'podcast') {
    A('absorber50', { qty: 8, loc: 'allWalls' }); A('cloud', { qty: 1, loc: 'ceiling' }); A('rug', { qty: 1, loc: 'floor' }).forEach((r) => { r.pos = [0, 0, 0]; syncTransform(r); });
    A('neon', { qty: 1, loc: 'back' });
  }
  if (mode === 'theater') {
    A('qrd', { qty: 3, loc: 'back' }); A('curtain', { qty: 1, loc: 'front', size: { w: w - 0.4, h: h - 0.1 } });
  }
  if (mode === 'booth') A('absorber50', { qty: 4, loc: 'allWalls' });
  // anything still overlapping the door gets nudged by the user; we keep it simple
  rebuildAllItems();
  commit();
  renderPanels();
  return P().items.length - n0;
}

function applyTemplate(name) {
  const t = TEMPLATES[name];
  if (!t) return;
  const keep = { name: P().name, designer: P().designer, client: P().client };
  S.project = newProject(t.dims);
  Object.assign(S.project, keep);
  if (t.shape) G.applyShape(R(), t.shape);
  if (t.ceiling) Object.assign(R().ceiling, t.ceiling);
  if (P().name === 'Untitled Studio') P().name = name;
  S.sel = [];
  buildRoom(); rebuildAllItems();
  if (t.setup === 'desk' || t.setup === 'mastering' || t.setup === 'console') ensureListening(t.setup);
  if (t.setup === 'booth') { const m = makeItem('mic'); m.pos = [0, 0, 0.1]; m.rot = [0, 180, 0]; P().items.push(m); rebuildItem(m); }
  if (t.setup === 'live') { const dk = makeItem('drums'); dk.pos = [0, 0, -1.5]; dk.rot = [0, 180, 0]; const pi = makeItem('piano'); placeOnWall(pi, 'left', 2, 0); const a = makeItem('amp'); a.pos = [2.2, 0, 1.5]; a.rot = [0, -120, 0]; P().items.push(dk, pi, a); [dk, pi, a].forEach(rebuildItem); }
  if (t.setup === 'theater') { const tv = makeItem('tv', { size: [2.0, 1.15, 0.06] }); placeOnWall(tv, 'front', 0); const so = makeItem('sofa'); so.pos = [0, 0, 1.0]; so.rot = [0, 180, 0]; const L = makeItem('listener'); L.pos = [0, 0, 1.0]; L.rot = [0, 180, 0]; for (const sx of [-1, 1]) { const s = makeItem('midfield'); s.pos = [sx * 1.6, 0, -R().d / 2 + 0.45]; s.rot = [0, Math.atan2(-s.pos[0], 1.0 - s.pos[2]) / DEG, 0]; s.pos[1] = 0.62; P().items.push(s); rebuildItem(s); const st = makeItem('stand'); st.pos = [s.pos[0], 0, s.pos[2]]; st.size = [0.35, 0.62, 0.35]; P().items.push(st); rebuildItem(st); } P().items.push(tv, so, L); [tv, so, L].forEach(rebuildItem); }
  if (t.setup === 'podcast') autoTreat('podcast');
  // keep template furniture inside non-rectangular outlines
  for (const it of P().items) if (defOf(it.type).mount === 'floor' && !insideRoom(it.pos[0], it.pos[2])) {
    const [cx, cz] = roomCentroid(); it.pos[0] = cx + (it.pos[0] - cx) * 0.3; it.pos[2] = cz + (it.pos[2] - cz) * 0.3; syncTransform(it);
  }
  setView('persp', true);
  commit(true);
  renderPanels();
  toast(`New project from template: ${name}`);
}

// ===================================================================== selection & transform
function select(ids, additive = false) {
  S.surfaceSel = null;
  if (additive) { for (const id of ids) S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id]; }
  else S.sel = ids.slice();
  attachGizmo();
  updateHelpers();
  renderProps(); renderLayers();
}
function selectSurface(name) {
  S.sel = []; S.surfaceSel = name; tc.detach(); updateHelpers(); S.rightTab = 'props'; renderRightTabs(); renderProps(); renderLayers();
}
function attachGizmo() {
  const it = selectedItems()[0];
  const mode = { move: 'translate', rotate: 'rotate', scale: 'scale' }[S.tool];
  if (it && mode && !it.locked && !it.hidden && S.view !== 'quad') {
    tc.setMode(mode);
    tc.showX = true; tc.showY = true; tc.showZ = true;
    if (mode === 'rotate') { tc.showX = false; tc.showZ = false; }
    tc.setSpace(mode === 'translate' ? 'world' : 'local');
    tc.attach(objMap.get(it.id));
  } else tc.detach();
  applySnap();
}
function applySnap() {
  const grid = S.units === 'ft' ? 0.3048 / 4 : 0.05;
  tc.setTranslationSnap(S.snap ? grid : null);
  tc.setRotationSnap(S.snap ? 15 * DEG : null);
  tc.setScaleSnap(S.snap ? 0.05 : null);
}
let dragStart = null;
tc.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value && S.view !== 'walk';
  const it = selectedItems()[0];
  if (e.value) dragStart = selectedItems().map((i) => ({ id: i.id, pos: i.pos.slice() }));
  else if (it) onTransformEnd(it);
});
tc.addEventListener('objectChange', () => {
  const it = selectedItems()[0], obj = objMap.get(it?.id);
  if (!it || !obj) return;
  if (tc.mode === 'translate') {
    obj.position.y = Math.max(0, obj.position.y);
    const before = dragStart?.find((x) => x.id === it.id)?.pos || it.pos;
    const delta = [obj.position.x - before[0], obj.position.y - before[1], obj.position.z - before[2]];
    it.pos = [obj.position.x, obj.position.y, obj.position.z];
    for (const other of selectedItems().slice(1)) {
      const b = dragStart?.find((x) => x.id === other.id)?.pos; if (!b || other.locked) continue;
      other.pos = [b[0] + delta[0], Math.max(0, b[1] + delta[1]), b[2] + delta[2]]; syncTransform(other);
    }
  } else if (tc.mode === 'rotate') {
    const e = new THREE.Euler().setFromQuaternion(obj.quaternion, 'YXZ');
    it.rot = [e.x / DEG, ((e.y / DEG) + 360) % 360, e.z / DEG].map((v) => Math.round(v * 100) / 100);
  }
  updateHelpers(true);
  renderStatus();
});
function onTransformEnd(it) {
  const obj = objMap.get(it.id);
  if (tc.mode === 'scale' && obj) {
    it.size = [it.size[0] * Math.abs(obj.scale.x), it.size[1] * Math.abs(obj.scale.y), it.size[2] * Math.abs(obj.scale.z)].map((v) => Math.max(0.005, Math.round(v * 1000) / 1000));
    obj.scale.set(1, 1, 1);
  }
  for (const i of selectedItems()) rebuildItem(i);
  limitLights();
  commit();
  renderProps();
  updateHelpers();
}

function updateItem(it, patch, rebuild = true) {
  Object.assign(it, patch);
  if (patch.params) it.params = { ...it.params, ...patch.params };
  const transformOnly = Object.keys(patch).every((k) => ['pos', 'rot', 'hidden'].includes(k));
  if (transformOnly && !defOf(it.type).mount?.includes('ceiling')) syncTransform(it);
  else if (rebuild) { rebuildItem(it); limitLights(); }
  updateHelpers();
}

function removeItems(list) {
  const ids = new Set(list.map((i) => i.id));
  if (!ids.size) return 0;
  P().items = P().items.filter((i) => !ids.has(i.id));
  for (const id of ids) { const o = objMap.get(id); if (o) { if (tc.object === o) tc.detach(); itemsGroup.remove(o); disposeTree(o); objMap.delete(id); } }
  S.sel = S.sel.filter((id) => !ids.has(id));
  limitLights();
  commit(); updateHelpers(); renderProps(); renderLayers();
  return ids.size;
}
function duplicate(list = selectedItems(), times = 1) {
  const made = [];
  for (const src of list) for (let k = 1; k <= times; k++) {
    const it = JSON.parse(JSON.stringify(src)); it.id = uid(); delete it.auto;
    // offset along the item's own width axis so copies sit side by side
    const a = src.rot[1] * DEG, step = src.size[0] + 0.05;
    it.pos = [src.pos[0] + Math.cos(a) * step * k, src.pos[1], src.pos[2] - Math.sin(a) * step * k];
    P().items.push(it); rebuildItem(it); made.push(it);
  }
  limitLights();
  if (made.length) { select(made.map((i) => i.id)); commit(); }
  return made.length;
}
function mirror(list = selectedItems()) {
  const made = [];
  for (const src of list) {
    const it = JSON.parse(JSON.stringify(src)); it.id = uid(); delete it.auto;
    it.pos = [-src.pos[0], src.pos[1], src.pos[2]];
    it.rot = [src.rot[0], (360 - src.rot[1]) % 360, -src.rot[2]];
    const def = defOf(src.type);
    if (def.origin === 'corner') it.rot[1] = ({ 0: -90, 270: 0, 180: 90, 90: 180 })[((src.rot[1] % 360) + 360) % 360] ?? it.rot[1];
    if (/ L$/.test(src.name)) it.name = src.name.replace(/ L$/, ' R'); else if (/ R$/.test(src.name)) it.name = src.name.replace(/ R$/, ' L');
    P().items.push(it); rebuildItem(it); made.push(it);
  }
  if (made.length) { select(made.map((i) => i.id)); commit(); }
  return made.length;
}
function snapToWall(it, wall) {
  const e = wall ? edgeFor(wall) : nearestEdge(it.pos[0], it.pos[2]);
  placeOnWallAt(it, e, it.pos[0], it.pos[2], defOf(it.type).mount === 'floor' ? 0 : it.pos[1]);
  rebuildItem(it); commit(); renderProps(); updateHelpers();
}
function alignItems(axis, how) {
  const list = selectedItems(); if (list.length < 2) return;
  const k = { x: 0, y: 1, z: 2 }[axis];
  const vals = list.map((i) => i.pos[k]);
  const target = how === 'min' ? Math.min(...vals) : how === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b) / vals.length;
  if (how === 'distribute') {
    const sorted = list.slice().sort((a, b) => a.pos[k] - b.pos[k]);
    const a = sorted[0].pos[k], b = sorted[sorted.length - 1].pos[k];
    sorted.forEach((it, i) => { it.pos[k] = a + ((b - a) * i) / (sorted.length - 1); syncTransform(it); });
  } else list.forEach((it) => { it.pos[k] = target; syncTransform(it); });
  commit(); updateHelpers();
}

// ===================================================================== helpers (selection boxes, reflections, distances)
function updateHelpers(light = false) {
  helpers.clear();
  for (const it of selectedItems()) {
    const o = objMap.get(it.id); if (!o) continue;
    const bh = new THREE.BoxHelper(o, it.locked ? '#ff9f43' : '#ffd166'); bh.material.depthTest = false; bh.renderOrder = 997; helpers.add(bh);
  }
  const sel = selectedItems();
  if (sel.length === 1 && S.showDims) {
    const it = sel[0], o = objMap.get(it.id), bb = new THREE.Box3().setFromObject(o);
    const { w, d } = R(), y = Math.max(0.02, Math.min(bb.max.y, 0.05));
    const c = bb.getCenter(new THREE.Vector3());
    const toL = bb.min.x + w / 2, toR = w / 2 - bb.max.x, toF = bb.min.z + d / 2, toB = d / 2 - bb.max.z;
    const g = new THREE.Group();
    if (toL <= toR && toL > 0.02) g.add(dimLine([-w / 2, y, c.z], [bb.min.x, y, c.z], fmt(toL), [0, 0, 0], '#ffd166'));
    if (toR < toL && toR > 0.02) g.add(dimLine([bb.max.x, y, c.z], [w / 2, y, c.z], fmt(toR), [0, 0, 0], '#ffd166'));
    if (toF <= toB && toF > 0.02) g.add(dimLine([c.x, y, -d / 2], [c.x, y, bb.min.z], fmt(toF), [0, 0, 0], '#ffd166'));
    if (toB < toF && toB > 0.02) g.add(dimLine([c.x, y, bb.max.z], [c.x, y, d / 2], fmt(toB), [0, 0, 0], '#ffd166'));
    if (bb.min.y > 0.05) g.add(dimLine([c.x, 0, c.z], [c.x, bb.min.y, c.z], fmt(bb.min.y), [0, 0, 0], '#ffd166'));
    helpers.add(g);
  }
  if (S.showReflections) {
    const pts = reflectionPoints(), sp = getSpeakers(), E = ear(getListener());
    const treated = treatedCheck(pts);
    pts.forEach((p, i) => {
      if (p.side === 'front') return;
      const col = treated[i] ? '#3ddc97' : '#ff5d73';
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: col, depthTest: false }));
      m.position.set(...p.point); m.renderOrder = 999; helpers.add(m);
      const s = sp.find((x) => x.id === p.speaker);
      if (!light && s) helpers.add(line([speakerAcoustic(s), p.point, E], col, 0.35, true));
    });
  }
}
function treatedCheck(pts) {
  // a reflection point counts as treated if an absorber / diffuser covers it (within its face)
  const treat = P().items.filter((i) => { const a = AC.ACOUSTIC_MATERIALS[i.acoustic]; return a && (a.a[3] >= 0.5 || AC.DIFFUSIVE.has(i.acoustic)); });
  return pts.map((p) => treat.some((i) => {
    const o = objMap.get(i.id); if (!o) return false;
    const bb = new THREE.Box3().setFromObject(o).expandByScalar(0.06);
    return bb.containsPoint(new THREE.Vector3(...p.point));
  }));
}

// ===================================================================== views & cameras
function frameOrtho(cam, view, aspect, spanOverride) {
  const { w, d } = R(), h = S.hmax || R().h, m = 1.7;
  let sw, sh, cy = h / 2;
  if (view === 'top') { sw = w + m; sh = d + m; cy = 0; }
  else if (view === 'front' || view === 'back') { sw = w + m; sh = h + m * 0.8; }
  else { sw = d + m; sh = h + m * 0.8; }
  let halfW, halfH;
  if (spanOverride) { halfW = spanOverride / 2; halfH = halfW / aspect; }
  else if (sw / sh > aspect) { halfW = sw / 2; halfH = halfW / aspect; } else { halfH = sh / 2; halfW = halfH * aspect; }
  Object.assign(cam, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
  const far = 60;
  if (view === 'top') { cam.position.set(0, far, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); }
  if (view === 'front') { cam.position.set(0, cy, far); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
  if (view === 'back') { cam.position.set(0, cy, -far); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
  if (view === 'left') { cam.position.set(far, cy, 0); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
  if (view === 'right') { cam.position.set(-far, cy, 0); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
  cam.near = 0.1; cam.far = 200;
  cam.updateProjectionMatrix();
  return new THREE.Vector3(0, view === 'top' ? 0 : cy, 0);
}
function framePersp(cam) {
  const { w, d } = R(), h = S.hmax || R().h, r = Math.max(w, d, h);
  cam.position.set(w * 0.55 + r * 0.55, h + r * 0.75, d * 0.5 + r * 1.0);
  cam.up.set(0, 1, 0);
  orbit.target.set(0, h * 0.35, 0);
  cam.lookAt(orbit.target);
}
const VIEW_NAMES = { persp: '3D Perspective', top: 'Top / Plan', front: 'Front Elevation', back: 'Back Elevation', left: 'Left Wall Elevation', right: 'Right Wall Elevation', quad: 'Quad View', walk: 'Walkthrough' };

const walk = { yaw: 0, pitch: 0, keys: new Set(), speed: 1.4 };
function setView(v, reframe = false) {
  if (v === 'listener') {
    const E = ear(getListener());
    v = 'walk'; persp.position.set(...E); walk.yaw = 0; walk.pitch = -0.05;
    const sp = getSpeakers(); if (sp.length) { const mx = sp.reduce((a, s) => a + s.pos[0], 0) / sp.length, mz = sp.reduce((a, s) => a + s.pos[2], 0) / sp.length; walk.yaw = Math.atan2(-(mx - E[0]), -(mz - E[2])); }
    S.view = 'walk'; S._walkPlaced = true;
  }
  const prev = S.view;
  S.view = v;
  $$('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  $('#view-label').textContent = VIEW_NAMES[v] || v;
  $('#walk-pad').hidden = v !== 'walk';
  $('#quad-labels').hidden = v !== 'quad';
  const aspect = viewportEl.clientWidth / Math.max(1, viewportEl.clientHeight);
  if (v === 'persp') {
    activeCam = persp; orbit.object = persp; orbit.enableRotate = true; orbit.enabled = true;
    if (reframe || prev === 'walk' || !S._perspInit) { framePersp(persp); S._perspInit = true; }
  } else if (orthoCams[v]) {
    activeCam = orthoCams[v];
    const target = frameOrtho(activeCam, v, aspect);
    activeCam.zoom = 1; activeCam.updateProjectionMatrix();
    orbit.object = activeCam; orbit.target.copy(target); orbit.enableRotate = false; orbit.enabled = true;
  } else if (v === 'walk') {
    activeCam = persp; orbit.enabled = false;
    if (!S._walkPlaced) { const E = ear(getListener()); let z = Math.min(R().d / 2 - 0.4, E[2] + 1.2); if (!insideRoom(E[0], z)) z = E[2]; persp.position.set(E[0], 1.25, z); walk.yaw = 0; walk.pitch = -0.1; }
    S._walkPlaced = false;
  } else if (v === 'quad') { activeCam = persp; orbit.object = persp; orbit.enableRotate = true; orbit.enabled = false; }
  tc.camera = activeCam;
  orbit.update();
  attachGizmo();
  renderSectionCtl();
  drawShapeHandles();
}

function cutaway(cam, view) {
  const room = R(), p = cam.position, hidden = {};
  for (const e of wallEdges()) hidden[e.id] = view !== 'walk' && ((p.x - e.a[0]) * e.n[0] + (p.z - e.a[1]) * e.n[1]) < -0.01;
  hidden.ceiling = view === 'top' || (view !== 'walk' && (p.y > S.hmax - 0.01 || (!insideRoom(p.x, p.z) && p.y > room.h)));
  hidden.floor = view !== 'walk' && p.y < 0;
  for (const [k, o] of Object.entries(wallObjs)) o.visible = !hidden[k];
  for (const s2 of roomGroup.children) if (s2.userData.tag) s2.visible = view === 'top';
  const hiddenEdges = view === 'persp' ? wallEdges().filter((e) => hidden[e.id]) : [];
  for (const it of P().items) {
    const o = objMap.get(it.id); if (!o) continue;
    let vis = !it.hidden;
    if (vis && hiddenEdges.length) {
      const m = defOf(it.type).mount;
      if ((m === 'wall' || m === 'corner') && hiddenEdges.some((e) => G.distToSegment(it.pos[0], it.pos[2], e.a, e.b).d < 0.45)) vis = false;
    }
    o.visible = vis;
  }
}
function clipFor(view) {
  const { w, d } = R(), f = S.section[view] ?? 0.5;
  if (view === 'top') return [new THREE.Plane(new THREE.Vector3(0, -1, 0), (S.hmax || R().h) * f + 0.001)];
  if (view === 'front') return [new THREE.Plane(new THREE.Vector3(0, 0, -1), -d / 2 + d * f)];
  if (view === 'back') return [new THREE.Plane(new THREE.Vector3(0, 0, 1), d / 2 - d * f)];
  if (view === 'left') return [new THREE.Plane(new THREE.Vector3(-1, 0, 0), -w / 2 + w * f)];
  if (view === 'right') return [new THREE.Plane(new THREE.Vector3(1, 0, 0), w / 2 - w * f)];
  return [];
}
function renderSectionCtl() {
  const el = $('#section-ctl');
  if (!orthoCams[S.view]) { el.hidden = true; return; }
  el.hidden = false;
  const lab = S.view === 'top' ? 'Cut height' : 'Section depth';
  const { w, d, h: rh } = R();
  const len = S.view === 'top' ? (S.hmax || rh) : S.view === 'front' || S.view === 'back' ? d : w;
  el.innerHTML = '';
  const out = h('span', {}, fmt(len * S.section[S.view]));
  el.append(h('label', {}, lab), h('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: S.section[S.view], oninput: (e) => { S.section[S.view] = +e.target.value; out.textContent = fmt(len * S.section[S.view]); } }), out);
}

function renderOnce(cam, view, vp) {
  cutaway(cam, view);
  renderer.clippingPlanes = clipFor(view);
  const showTags = view === 'top';
  for (const s of roomGroup.children) if (s.userData.tag) s.visible = showTags;
  tc.getHelper().visible = view === S.view && !!tc.object && view !== 'walk';
  helpers.visible = view !== 'walk';
  const dimsObj = roomGroup.getObjectByName('dims'); if (dimsObj) dimsObj.visible = view !== 'walk';
  if (vp) { renderer.setViewport(...vp); renderer.setScissor(...vp); }
  renderer.render(scene, cam);
}

let lastT = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (document.hidden) return;
  const W = viewportEl.clientWidth, H = viewportEl.clientHeight;
  if (S.view === 'walk') stepWalk(dt);
  else orbit.update();
  if (S.view === 'quad') {
    renderer.setScissorTest(true);
    const hw = Math.floor(W / 2), hh = Math.floor(H / 2);
    const quads = [['persp', persp, [0, hh, hw, H - hh]], ['top', orthoCams.top, [hw, hh, W - hw, H - hh]], ['front', orthoCams.front, [0, 0, hw, hh]], ['left', orthoCams.left, [hw, 0, W - hw, hh]]];
    for (const [v, cam, vp] of quads) {
      if (cam.isOrthographicCamera) frameOrtho(cam, v, vp[2] / vp[3]); else { cam.aspect = vp[2] / vp[3]; cam.updateProjectionMatrix(); }
      renderOnce(cam, v, vp);
    }
    renderer.setScissorTest(false);
  } else {
    renderer.setViewport(0, 0, W, H);
    renderOnce(activeCam, S.view);
  }
}
function stepWalk(dt) {
  const f = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)), r = new THREE.Vector3(-f.z, 0, f.x);
  const v = new THREE.Vector3();
  const k = walk.keys;
  if (k.has('w') || k.has('arrowup') || k.has('fwd')) v.add(f);
  if (k.has('s') || k.has('arrowdown') || k.has('back')) v.sub(f);
  if (k.has('d') || k.has('arrowright') || k.has('right')) v.add(r);
  if (k.has('a') || k.has('arrowleft') || k.has('left')) v.sub(r);
  if (k.has('e') || k.has('up')) v.y += 1;
  if (k.has('q') || k.has('down')) v.y -= 1;
  const prev = persp.position.clone();
  if (v.lengthSq()) persp.position.addScaledVector(v.normalize(), walk.speed * dt * (k.has('shift') ? 2.5 : 1));
  const pp = persp.position;
  if (!insideRoom(pp.x, pp.z) || wallEdges().some((e) => G.distToSegment(pp.x, pp.z, e.a, e.b).d < 0.12)) { pp.x = prev.x; pp.z = prev.z; }
  pp.y = clamp(pp.y, 0.3, G.heightAt(R(), pp.x, pp.z) - 0.1);
  persp.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
}

function onResize() {
  const W = viewportEl.clientWidth, H = viewportEl.clientHeight;
  renderer.setSize(W, H, false);
  renderer.domElement.style.width = W + 'px'; renderer.domElement.style.height = H + 'px';
  persp.aspect = W / Math.max(1, H); persp.updateProjectionMatrix();
  if (orthoCams[S.view]) { const z = activeCam.zoom; const t = orbit.target.clone(); frameOrtho(activeCam, S.view, W / Math.max(1, H)); activeCam.zoom = z; activeCam.position.x += t.x; activeCam.updateProjectionMatrix(); }
}
new ResizeObserver(onResize).observe(viewportEl);

// ===================================================================== pointer: pick / measure / walk look / drop
const ray = new THREE.Raycaster();
function ndc(e, rect = renderer.domElement.getBoundingClientRect()) { return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1); }
function pickAt(e, includeRoom = true) {
  ray.setFromCamera(ndc(e), activeCam);
  const targets = [itemsGroup, ...(includeRoom ? Object.values(wallObjs).filter((o) => o.visible) : [])];
  const hits = ray.intersectObjects(targets, true).filter((hh) => {
    let o = hh.object, vis = true; while (o) { if (!o.visible) vis = false; o = o.parent; }
    if (!vis || hh.object.isLine || hh.object.isSprite || hh.object.isLight) return false;
    const planes = renderer.clippingPlanes || [];
    return planes.every((pl) => pl.distanceToPoint(hh.point) >= -1e-4);
  });
  return hits[0] || null;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), yaw: walk.yaw, pitch: walk.pitch };
  if (S.tool === 'shape' && e.button === 0 && shapePointerDown(e)) { down.shape = true; return; }
  if (S.view === 'walk') renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (S.dragV != null) { shapePointerMove(e); return; }
  if (S.tool === 'draw' && S.drawPts) { const last = S.drawPts[S.drawPts.length - 1]; S.drawHover = floorPoint(e, last ? [last] : []); drawShapeHandles(); }
  if (S.view === 'walk' && down && e.buttons) {
    walk.yaw = down.yaw - (e.clientX - down.x) * 0.005;
    walk.pitch = clamp(down.pitch - (e.clientY - down.y) * 0.005, -1.4, 1.4);
  }
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down) return;
  if (down.shape) { down = null; if (S.dragV != null) shapePointerUp(); return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 5 || tc.dragging || tc.axis) return;
  if (S.view === 'quad') {
    const r = renderer.domElement.getBoundingClientRect(), left = e.clientX - r.left < r.width / 2, topH = e.clientY - r.top < r.height / 2;
    setView(topH ? (left ? 'persp' : 'top') : (left ? 'front' : 'left'));
    return;
  }
  if (S.tool === 'draw') { drawClick(e); return; }
  if (S.tool === 'shape') return;
  const hit = pickAt(e);
  if (S.tool === 'measure') { if (hit) measureClick(hit.point); return; }
  if (!hit) { select([]); return; }
  const id = hit.object.userData.itemId;
  if (id) select([id], e.shiftKey || e.metaKey || e.ctrlKey);
  else if (hit.object.userData.surface) selectSurface(hit.object.userData.surface);
});
renderer.domElement.addEventListener('dblclick', (e) => {
  if (S.tool === 'draw') return finishDraw();
  if (S.tool === 'shape') {
    ray.setFromCamera(ndc(e), activeCam);
    const hit = ray.intersectObjects(shapeGroup.children, false).find((x) => x.object.userData.vertex != null);
    if (hit && R().poly.length > 3) changeShape(() => R().poly.splice(hit.object.userData.vertex, 1));
    return;
  }
  focusSelection();
});

function focusSelection() {
  const it = selectedItems()[0]; if (!it || S.view === 'walk') return;
  const o = objMap.get(it.id), bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length();
  if (activeCam.isPerspectiveCamera) {
    const dir = persp.position.clone().sub(orbit.target).normalize();
    orbit.target.copy(c); persp.position.copy(c.clone().add(dir.multiplyScalar(Math.max(1.2, r * 2.2))));
  } else {
    const sh = orbit.target.clone().sub(c); orbit.target.sub(sh); activeCam.position.sub(sh); activeCam.zoom = 2.5; activeCam.updateProjectionMatrix();
  }
}

function measureClick(p) {
  if (!S.measureA) { S.measureA = p.clone(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd166', depthTest: false })); m.position.copy(p); m.renderOrder = 999; m.userData.pending = true; measureGroup.add(m); toast('Click the second point'); return; }
  const a = S.measureA, b = p.clone(); S.measureA = null;
  measureGroup.children.filter((c) => c.userData.pending).forEach((c) => measureGroup.remove(c));
  S.measurements.push([a.toArray(), b.toArray()]);
  drawMeasurements();
  toast(`Distance: ${fmt(a.distanceTo(b), 3)}`);
}
function drawMeasurements() {
  measureGroup.clear();
  for (const [a, b] of S.measurements) {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    measureGroup.add(line([A, Bv], '#ffd166', 1));
    for (const p of [A, Bv]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd166', depthTest: false })); m.position.copy(p); m.renderOrder = 999; measureGroup.add(m); }
    const s = labelSprite(fmt(A.distanceTo(Bv), 3), { color: '#1b1d21', bg: '#ffd166', size: 0.16 }); s.position.copy(A.clone().add(Bv).multiplyScalar(0.5)); s.position.y += 0.08; measureGroup.add(s);
  }
}

// drag & drop from library onto surfaces
viewportEl.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-roomtone')) e.preventDefault(); });
viewportEl.addEventListener('drop', (e) => {
  const type = e.dataTransfer.getData('text/x-roomtone'); if (!type) return;
  e.preventDefault();
  dropItem(type, e);
});
function dropItem(type, e) {
  const def = defOf(type), it = makeItem(type);
  const hit = pickAt(e);
  const surf = hit?.object.userData.surface;
  if (hit && surf && surf !== 'floor' && surf !== 'ceiling' && def.mount !== 'floor') {
    placeOnWallAt(it, surf, hit.point.x, hit.point.z, Math.max(0, hit.point.y - it.size[1] / 2));
  } else if (hit && def.mount === 'ceiling') {
    it.pos = [hit.point.x, 0, hit.point.z]; it.pos[1] = Math.max(0, ceilingYFor(it) - it.size[1] - (def.drop || 0));
  } else if (hit && def.origin === 'corner') {
    const vs = convexCorners().sort((a, b) => Math.hypot(a.x - hit.point.x, a.z - hit.point.z) - Math.hypot(b.x - hit.point.x, b.z - hit.point.z)); placeInCorner(it, vs[0]);
  } else if (hit) {
    const p = hit.object.userData.itemId ? hit.point : hit.point;
    it.pos = [p.x, hit.object.userData.itemId ? Math.max(0, p.y) : 0, p.z];
    if (def.speaker) { const E = ear(getListener()); it.rot = [0, Math.atan2(E[0] - p.x, E[2] - p.z) / DEG, 0]; }
    else it.rot = [0, 180, 0];
    if (def.mount === 'wall' && surf === 'floor') { it.pos[1] = 0; }
  } else placeItem(it, null);
  P().items.push(it); rebuildItem(it); limitLights();
  select([it.id]); commit();
  if (S.tool === 'select') setTool('move');
}

// ===================================================================== history & persistence
function serialize() { const { assets, ...rest } = P(); return JSON.stringify(rest); }
function openingSig() { return JSON.stringify(P().items.filter((i) => defOf(i.type).opening).map((i) => [i.pos, i.rot, i.size, i.hidden, i.params?.cutWall])); }
function commit(reset = false) {
  const sig = openingSig();
  if (sig !== S._openSig) { S._openSig = sig; buildRoom(); }
  const snap = serialize();
  if (reset) { S.hist = []; S.future = []; S.cur = snap; scheduleSave(); return; }
  if (snap === S.cur) { renderPanels(true); return; }
  if (S.cur) S.hist.push(S.cur);
  if (S.hist.length > 150) S.hist.shift();
  S.cur = snap; S.future = [];
  scheduleSave();
  renderPanels(true);
}
function restore(snap) {
  const assets = P().assets;
  S.project = { ...JSON.parse(snap), assets };
  G.ensureRoom(R());
  S.sel = S.sel.filter((id) => itemById(id));
  buildRoom(); rebuildAllItems(); updateHelpers(); renderPanels();
}
function undo() { if (!S.hist.length) return toast('Nothing to undo'); S.future.push(S.cur); S.cur = S.hist.pop(); restore(S.cur); scheduleSave(); }
function redo() { if (!S.future.length) return toast('Nothing to redo'); S.hist.push(S.cur); S.cur = S.future.pop(); restore(S.cur); scheduleSave(); }

const DB = {
  db: null,
  open() { return this.db ? Promise.resolve(this.db) : new Promise((res, rej) => { const r = indexedDB.open('roomtone', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res((this.db = r.result)); r.onerror = () => rej(r.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); },
};
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  $('#save-state').textContent = 'Saving…';
  saveTimer = setTimeout(async () => {
    try { await DB.set('autosave', JSON.stringify(P())); $('#save-state').textContent = 'Saved offline ✓'; }
    catch { $('#save-state').textContent = 'Autosave unavailable'; }
  }, 500);
}
function loadProjectData(data) {
  const p = typeof data === 'string' ? JSON.parse(data) : data;
  const base = newProject();
  S.project = { ...base, ...p, room: { ...base.room, ...p.room, poly: p.room?.poly, surfaces: { ...base.room.surfaces, ...(p.room?.surfaces || {}) } }, assets: p.assets || {} };
  G.ensureRoom(R()); G.normalizeRoom(R());
  S.sel = []; S.surfaceSel = null;
  hydrateImported().then(() => { rebuildAllItems(); });
  buildRoom(); rebuildAllItems(); setView('persp', true); commit(true); renderPanels();
}
function download(name, data, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = () => (P().name || 'studio').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'studio';

// ===================================================================== import / export
function pickFile(accept, cb, asText = false) {
  const inp = h('input', { type: 'file', accept });
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f); if (asText === 'buffer') r.readAsArrayBuffer(f); else if (asText) r.readAsText(f); else r.readAsDataURL(f); };
  inp.click();
}
async function compressImage(dataUrl, max = 1600) {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = dataUrl; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = h('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
function addAsset(dataUrl) { const id = 'a_' + uid(); P().assets[id] = dataUrl; return id; }

function dataUrlToBuffer(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
async function parseModel(id) {
  const data = P().assets[id]; if (!data) return null;
  if (data.startsWith('obj:')) return new OBJLoader().parse(data.slice(4));
  return new Promise((res) => new GLTFLoader().parse(dataUrlToBuffer(data), '', (g) => res(g.scene), (err) => { console.error(err); res(null); }));
}
async function hydrateImported() {
  for (const it of P().items) if (it.type === 'imported' && it.params.model && !S.imported[it.params.model]) {
    const o = await parseModel(it.params.model); if (o) S.imported[it.params.model] = o;
  }
}
function importModel() {
  pickFile('.glb,.gltf,.obj', async (result, file) => {
    let id;
    if (/\.obj$/i.test(file.name)) { id = addAsset('obj:' + new TextDecoder().decode(result)); }
    else {
      let bin = '', bytes = new Uint8Array(result);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      id = addAsset('data:model/gltf-binary;base64,' + btoa(bin));
    }
    const obj = await parseModel(id);
    if (!obj) { delete P().assets[id]; return toast('Could not read that model', 'error'); }
    S.imported[id] = obj;
    const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3());
    let scale = 1;
    if (Math.max(sz.x, sz.y, sz.z) > 50) scale = 0.01; // probably centimetres
    const dims = [sz.x * scale, sz.y * scale, sz.z * scale];
    const isRoomScan = dims[0] > 1.8 && dims[2] > 1.8 && dims[1] > 1.8;
    if (isRoomScan && await confirmDialog('This looks like a room scan', `The model is ${dims.map((v) => v.toFixed(2)).join(' × ')} m. Set the room to these dimensions and use the scan as a reference overlay?`)) {
      Object.assign(R(), { w: +dims[0].toFixed(2), h: +dims[1].toFixed(2), d: +dims[2].toFixed(2) });
      buildRoom();
      const it = makeItem('imported', { name: 'Room scan: ' + file.name, size: dims, params: { model: id }, pos: [0, 0, 0], locked: true });
      P().items.push(it); rebuildItem(it); select([it.id]);
    } else {
      const it = makeItem('imported', { name: file.name.replace(/\.\w+$/, ''), size: dims, params: { model: id } });
      placeItem(it, 'floor'); P().items.push(it); rebuildItem(it); select([it.id]);
    }
    commit(); renderPanels(); toast('Model imported');
  }, /\.obj$/i.test('') ? true : 'buffer');
}
function importUnderlay() {
  pickFile('image/*', async (url) => {
    const id = addAsset(await compressImage(url, 2000));
    P().underlay = { asset: id, width: R().w, opacity: 0.6, rot: 0, x: 0, z: 0, visible: true };
    buildUnderlay(); commit(); S.leftTab = 'room'; renderLeftTabs(); renderRoom(); setView('top');
    toast('Floor plan placed — set its real width in Room ▸ Floor-plan underlay, then trace with partition walls');
  });
}

function exportGLB() {
  const g = new THREE.Group();
  g.add(roomGroup.clone(true), itemsGroup.clone(true));
  g.traverse((o) => { if (o.isLine || o.isSprite || o.userData.helper) o.visible = false; });
  new GLTFExporter().parse(g, (res) => download(`${safeName()}.glb`, res, 'model/gltf-binary'), (err) => toast('Export failed: ' + err, 'error'), { binary: true, onlyVisible: true });
}
function exportOBJ() {
  const g = new THREE.Group(); g.add(roomGroup.clone(true), itemsGroup.clone(true));
  g.traverse((o) => { if (o.isLine || o.isSprite) o.visible = false; });
  g.updateMatrixWorld(true);
  download(`${safeName()}.obj`, new OBJExporter().parse(g), 'text/plain');
}
function scheduleRows() {
  const rows = new Map();
  for (const it of P().items) {
    if (it.hidden) continue;
    const def = defOf(it.type);
    const key = [it.type, it.size.map((v) => v.toFixed(3)).join('x'), it.color, it.finish, it.acoustic].join('|');
    const r = rows.get(key) || { name: def.name, cat: def.cat, size: it.size, color: it.color, color2: it.color2, finish: FINISHES[it.finish]?.label || it.finish, acoustic: AC.ACOUSTIC_MATERIALS[it.acoustic]?.name || '—', qty: 0, area: 0 };
    r.qty++; r.area += areaOf(def, it.size);
    rows.set(key, r);
  }
  return [...rows.values()].sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}
function exportCSV() {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Category', 'Item', 'Qty', 'Width (m)', 'Height (m)', 'Depth (m)', 'Colour', 'Finish', 'Acoustic material', 'Absorptive area (m²)'].map(esc).join(',')];
  for (const r of scheduleRows()) lines.push([r.cat, r.name, r.qty, ...r.size.map((v) => v.toFixed(3)), r.color, r.finish, r.acoustic, r.area.toFixed(2)].map(esc).join(','));
  download(`${safeName()}-schedule.csv`, lines.join('\n'), 'text/csv');
}

/** Render any view to an image (used by PNG + PDF export). */
function renderToDataURL({ view = 'persp', scene: sc = null, width = 1600, height = 1000, orthoSpan = null, type = 'image/jpeg', quality = 0.92, hideHelpers = true, pixelRatio = 1, bg = null } = {}) {
  const prevBg = scene.background;
  if (bg) scene.background = new THREE.Color(bg);
  const prevSize = renderer.getSize(new THREE.Vector2()), prevPR = renderer.getPixelRatio();
  const helperVis = [helpers.visible, tc.getHelper().visible, measureGroup.visible];
  if (hideHelpers) { helpers.visible = !!sc?.keepHelpers || S.showReflections && view !== 'persp' && false; tc.getHelper().visible = false; }
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  let cam, v = view;
  if (sc) {
    v = sc.view;
    if (orthoCams[v]) { cam = orthoCams[v].clone(); frameOrtho(cam, v, width / height); cam.zoom = sc.zoom || 1; cam.position.fromArray(sc.cam); cam.updateProjectionMatrix(); }
    else { cam = persp.clone(); cam.aspect = width / height; cam.position.fromArray(sc.cam); cam.lookAt(new THREE.Vector3().fromArray(sc.target)); if (sc.view === 'walk') cam.rotation.set(sc.pitch, sc.yaw, 0, 'YXZ'); cam.updateProjectionMatrix(); v = sc.view === 'walk' ? 'walk' : 'persp'; }
  } else if (orthoCams[v]) { cam = orthoCams[v].clone(); frameOrtho(cam, v, width / height, orthoSpan); cam.zoom = 1; cam.updateProjectionMatrix(); }
  else { cam = persp.clone(); cam.aspect = width / height; framePerspClone(cam); }
  const saveSection = S.section[v];
  if (sc && sc.section != null) S.section[v] = sc.section;
  renderer.setViewport(0, 0, width, height);
  const tcVis = tc.getHelper().visible; tc.getHelper().visible = false;
  cutaway(cam, v); renderer.clippingPlanes = clipFor(v); renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL(type, quality);
  tc.getHelper().visible = tcVis;
  if (sc && sc.section != null) S.section[v] = saveSection;
  [helpers.visible, , measureGroup.visible] = helperVis;
  renderer.setPixelRatio(prevPR);
  renderer.setSize(prevSize.x, prevSize.y, false);
  scene.background = prevBg;
  onResize();
  return url;
}
function framePerspClone(cam) {
  const { w, d } = R(), h = S.hmax || R().h, r = Math.max(w, d, h);
  cam.position.set(w * 0.55 + r * 0.55, h + r * 0.7, d * 0.5 + r * 1.0);
  cam.lookAt(0, h * 0.3, 0); cam.updateProjectionMatrix();
}
function hqRender() {
  const W = viewportEl.clientWidth, H = viewportEl.clientHeight;
  const sc = currentSceneState();
  const url = renderToDataURL({ scene: S.view === 'quad' ? null : sc, width: W * 2, height: H * 2, type: 'image/png', pixelRatio: 1, hideHelpers: true });
  download(`${safeName()}-${S.view}.png`, dataUrlToBlob(url));
  toast('High-resolution render saved');
}
function exportAllViewsPNG() {
  const views = ['persp', 'top', 'front', 'back', 'left', 'right'];
  views.forEach((v, i) => setTimeout(() => download(`${safeName()}-${v}.png`, dataUrlToBlob(renderToDataURL({ view: v, width: 2400, height: 1600, type: 'image/png' }))), i * 350));
  P().scenes.forEach((sc, i) => setTimeout(() => download(`${safeName()}-scene-${i + 1}.png`, dataUrlToBlob(renderToDataURL({ scene: sc, width: 2400, height: 1600, type: 'image/png' }))), (views.length + i) * 350));
  toast('Downloading every view as PNG…');
}
function dataUrlToBlob(u) { const [head, b] = u.split(','); const mime = head.match(/:(.*?);/)[1]; const bin = atob(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }

function currentSceneState() {
  if (S.view === 'walk') return { view: 'walk', cam: persp.position.toArray(), target: persp.position.clone().add(new THREE.Vector3(0, 0, -1).applyEuler(persp.rotation)).toArray(), yaw: walk.yaw, pitch: walk.pitch };
  return { view: S.view === 'quad' ? 'persp' : S.view, cam: activeCam.position.toArray(), target: orbit.target.toArray(), zoom: activeCam.zoom, section: S.section[S.view] };
}
function gotoScene(sc) {
  setView(sc.view === 'walk' ? 'walk' : sc.view);
  if (sc.view === 'walk') { persp.position.fromArray(sc.cam); walk.yaw = sc.yaw; walk.pitch = sc.pitch; return; }
  activeCam.position.fromArray(sc.cam); orbit.target.fromArray(sc.target);
  if (sc.zoom) { activeCam.zoom = sc.zoom; activeCam.updateProjectionMatrix(); }
  if (sc.section != null && S.section[sc.view] != null) { S.section[sc.view] = sc.section; renderSectionCtl(); }
  orbit.update();
}

// ===================================================================== acoustic analysis
function analysis() {
  const items = P().items.filter((i) => !i.hidden).map((i) => ({ acoustic: i.acoustic, area: areaOf(defOf(i.type), i.size) }));
  const room = R(), V = G.volume(room), floorA = G.floorArea(room), rect = G.isRect(room);
  const rt = AC.reverbTime({ V, surfaces: surfaceIds().map((id) => ({ area: surfaceArea(id), mat: surf(id).acoustic })) }, items);
  const eq = { w: room.w, d: room.d, h: V / floorA }; // equivalent box for non-rectangular rooms
  const modes = AC.roomModes(rect && room.ceiling?.type === 'flat' ? room : eq, 300);
  const issues = AC.modeIssues(modes);
  const ratio = AC.ratioCheck(eq);
  const shaped = !rect || room.ceiling?.type !== 'flat';
  const L = getListener(), sp = getSpeakers(), E = ear(L);
  const refl = reflectionPoints();
  const treated = treatedCheck(refl);
  let tri = null;
  if (sp.length >= 2) tri = AC.listeningTriangle(E, speakerAcoustic(sp[0]), speakerAcoustic(sp[1]));
  const sbir = sp.map((s) => {
    const p = speakerAcoustic(s), dTo = (e) => (e ? G.distToSegment(p[0], p[2], e.a, e.b).d : 9);
    return { name: s.name, ...AC.sbir({ front: dTo(edgeFor('front')), side: Math.min(dTo(edgeFor('left')), dTo(edgeFor('right'))), floor: p[1] }) };
  });
  const coverage = P().items.filter((i) => (AC.ACOUSTIC_MATERIALS[i.acoustic]?.a[3] || 0) >= 0.5).reduce((a, i) => a + areaOf(defOf(i.type), i.size), 0) / rt.S;
  const advice = [];
  const tol = 0.05;
  rt.bands.forEach((b, i) => {
    const target = rt.target * (i === 0 ? 1.25 : i === 1 ? 1.1 : 1);
    if (b.sabine > target * 1.6) advice.push({ lvl: 'bad', text: `${b.f >= 1000 ? b.f / 1000 + 'k' : b.f} Hz decays in ${b.sabine.toFixed(2)} s (target ≈ ${target.toFixed(2)} s). ${i <= 1 ? 'Add bass traps / membrane traps in corners.' : 'Add broadband absorbers.'}` });
    else if (b.sabine < target * 0.5) advice.push({ lvl: 'warn', text: `${b.f >= 1000 ? b.f / 1000 + 'k' : b.f} Hz is over-damped (${b.sabine.toFixed(2)} s) — swap some absorbers for diffusers to keep the room alive.` });
  });
  const hi = rt.bands[5].sabine, lo = rt.bands[0].sabine;
  if (lo > hi * 2) advice.push({ lvl: 'warn', text: 'Low end decays much slower than highs — the room will sound boomy/dark. Prioritise thick bass traps over thin panels.' });
  if (P().items.filter((i) => i.type === 'foam').length > 3 && lo > rt.target * 2) advice.push({ lvl: 'warn', text: 'Foam treats highs only — it won\'t fix low-frequency problems.' });
  if (!ratio.inBolt) advice.push({ lvl: 'warn', text: `Room ratio 1 : ${ratio.r[1].toFixed(2)} : ${ratio.r[2].toFixed(2)} is outside the Bolt area — expect uneven modal response. Closest good ratio: ${ratio.best.name}.` });
  if (tri) {
    if (Math.abs(tri.angle - 60) > 8) advice.push({ lvl: 'warn', text: `Speakers subtend ${tri.angle.toFixed(0)}° at the listener — aim for ≈ 60° (equilateral triangle).` });
    if (Math.abs(tri.dl - tri.dr) > 0.05) advice.push({ lvl: 'warn', text: `Speaker distances differ by ${fmt(Math.abs(tri.dl - tri.dr))} — centre the listening position for a stable phantom centre.` });
  }
  if (L) {
    const frac = (E[2] + R().d / 2) / R().d;
    if (Math.abs(frac - 0.38) > 0.06) advice.push({ lvl: 'info', text: `Listening position is at ${(frac * 100).toFixed(0)} % of the room length. ~38 % from the front wall usually avoids the worst length-mode nulls.` });
    if (Math.abs(E[0]) > 0.05 && rect) advice.push({ lvl: 'warn', text: 'Listening position is off the room\'s centre line — symmetry left/right is critical for stereo imaging.' });
  }
  const untreated = refl.filter((p, i) => !treated[i] && ['left', 'right', 'ceiling'].includes(p.side));
  if (shaped) advice.push({ lvl: 'info', text: `Non-rectangular room / ceiling: volume ${V.toFixed(1)} m³ is computed from the real shape; room modes are approximated with an equivalent ${room.w.toFixed(1)} × ${room.d.toFixed(1)} × ${eq.h.toFixed(2)} m box. Splayed / non-parallel walls reduce flutter echo and spread modes.` });
  if (untreated.length) advice.push({ lvl: 'bad', text: `${untreated.length} first-reflection point(s) untreated (red dots). Use "Treat reflection points".` });
  for (const s of sbir) if (s.front.d > 0.25 && s.front.d < 1.6) advice.push({ lvl: 'info', text: `${s.name}: front-wall SBIR null near ${s.front.f.toFixed(0)} Hz (${fmt(s.front.d)} from wall). Move closer (<0.3 m), further, or treat behind with thick absorption.` });
  if (!advice.length) advice.push({ lvl: 'good', text: 'Looking good — decay times are near target and reflections are treated.' });
  return { rt, modes, issues, ratio, refl, treated, tri, sbir, coverage, advice, E, L, sp, shaped, floorA, V };
}

// ===================================================================== UI: toasts, modals
function toast(msg, kind = 'info') {
  const el = h('div', { class: `toast ${kind}` }, msg);
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3700);
}
function modal(title, body, actions = [], { wide = false } = {}) {
  const wrap = $('#modal');
  wrap.innerHTML = '';
  const close = () => { wrap.hidden = true; wrap.innerHTML = ''; wrap.dispatchEvent(new Event('closed')); };
  const box = h('div', { class: 'modal-box' + (wide ? ' wide' : '') },
    h('div', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', title: 'Close', onclick: close, html: '&times;' })),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions.map((a) => h('button', { class: a.primary ? 'btn primary' : 'btn', onclick: () => { if (a.onClick?.() !== false) close(); } }, a.label))) : null);
  wrap.append(box); wrap.hidden = false;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  return { close, box };
}
function confirmDialog(title, text) {
  return new Promise((res) => {
    let answered = false;
    const m = modal(title, h('p', {}, text), [{ label: 'No', onClick: () => { answered = true; res(false); } }, { label: 'Yes', primary: true, onClick: () => { answered = true; res(true); } }]);
    $('#modal').addEventListener('closed', () => { if (!answered) res(false); }, { once: true });
    void m;
  });
}

// ===================================================================== UI: panels
const ICON = {
  select: '<path d="M5 3l14 8-6 2-3 6z"/>', move: '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>', scale: '<path d="M4 20h7v-7H4zM14 4h6v6M20 4l-8 8"/>', measure: '<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.1 3.6M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>', mirror: '<path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
};
const svg = (name, size = 18) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;

function numField(label, meters, onChange, { step = 0.01, min = -100, max = 100, unit = true, digits = 3 } = {}) {
  const val = unit ? toUnit(meters) : meters;
  const inp = h('input', { type: 'number', step: unit && S.units === 'ft' ? 0.05 : step, value: +val.toFixed(digits), min: unit ? toUnit(min) : min, max: unit ? toUnit(max) : max });
  inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (!Number.isNaN(v)) onChange(unit ? fromUnit(v) : v); });
  return h('label', { class: 'field' }, h('span', {}, label + (unit ? ` (${S.units})` : '')), inp);
}
function colorField(label, value, onChange) {
  const inp = h('input', { type: 'color', value });
  inp.addEventListener('input', () => onChange(inp.value, false));
  inp.addEventListener('change', () => onChange(inp.value, true));
  const sw = h('div', { class: 'swatches' }, ['#1a1a1a', '#2f3236', '#3b4a5a', '#1d2a44', '#5a1a1f', '#6b4a32', '#c49a6c', '#d8c3a0', '#9caf88', '#ece8df', '#f4f4f2', '#e07b2a'].map((c) => h('button', { class: 'sw', style: { background: c }, title: c, onclick: () => { inp.value = c; onChange(c, true); } })));
  return h('div', { class: 'field color-field' }, h('span', {}, label), h('div', { class: 'row' }, inp, h('code', {}, value)), sw);
}
function selectField(label, value, options, onChange) {
  const sel = h('select', { onchange: (e) => onChange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
  return h('label', { class: 'field' }, h('span', {}, label), sel);
}
function section(title, ...kids) { return h('details', { class: 'sec', open: true }, h('summary', {}, title), h('div', { class: 'sec-body' }, ...kids)); }
const finishOptions = () => Object.entries(FINISHES).map(([k, f]) => [k, f.label]);
const acousticOptions = () => Object.entries(AC.ACOUSTIC_MATERIALS).map(([k, m]) => [k, m.name]);

function renderPanels(light = false) {
  renderProps(); renderLayers(); renderStatus();
  if (S.rightTab === 'acoustics') renderAcoustics();
  if (!light) { renderRoom(); renderScenes(); }
  else if (S.leftTab === 'room') renderRoomDims();
  updateHelpers();
  $('#undo-btn').disabled = !S.hist.length; $('#redo-btn').disabled = !S.future.length;
}

// ---------------------------------------------------------------- library
function renderLibrary() {
  const pane = $('#pane-library');
  pane.innerHTML = '';
  const search = h('input', { type: 'search', placeholder: 'Search 80+ items…', class: 'search' });
  const list = h('div', { class: 'lib-list' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    for (const cat of CATEGORIES) {
      const defs = CATALOG.filter((d) => d.cat === cat && !d.hidden && (!q || (d.name + ' ' + d.cat + ' ' + (d.desc || '')).toLowerCase().includes(q)));
      if (!defs.length) continue;
      list.append(h('details', { class: 'lib-cat', open: q || ['Absorption', 'Bass Control', 'Diffusion'].includes(cat) }, h('summary', {}, cat, h('small', {}, defs.length)),
        h('div', { class: 'lib-grid' }, defs.map((d) => h('button', {
          class: 'lib-card', draggable: true, title: d.desc || d.name, 'data-type': d.type,
          ondragstart: (e) => { e.dataTransfer.setData('text/x-roomtone', d.type); e.dataTransfer.effectAllowed = 'copy'; },
          onclick: () => { addMany(d.type, {}); if (S.tool === 'select') setTool('move'); closeDrawers(); },
        }, h('img', { src: S.thumbs[d.type] || '', alt: '', 'data-thumb': d.type }), h('span', {}, d.name))))));
    }
  };
  search.addEventListener('input', draw);
  pane.append(h('div', { class: 'pane-head' }, search, h('p', { class: 'hint' }, 'Click to add · drag onto a wall, floor or ceiling to place')), list);
  draw();
}
async function generateThumbs() {
  const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  tr.setSize(112, 112); tr.outputColorSpace = THREE.SRGBColorSpace; tr.toneMapping = THREE.ACESFilmicToneMapping;
  const ts = new THREE.Scene();
  ts.environment = pmremThumb(tr);
  ts.add(new THREE.HemisphereLight('#ffffff', '#666', 1.4));
  const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(2, 4, 3); ts.add(dl);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  const ctx = { room: { ...R(), h: 3 }, assets: {}, imported: {}, onTexture: () => {} };
  for (const d of CATALOG) {
    if (d.hidden) continue;
    const it = makeItem(d.type); it.pos = [0, 0, 0];
    const g = buildItem(it, ctx);
    g.traverse((o) => { if (o.isLight) o.visible = false; });
    if (d.origin === 'corner') g.position.set(-d.size[0] / 3, 0, -d.size[2] / 3);
    ts.add(g);
    const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() / 2;
    const dist = r / Math.sin((cam.fov * DEG) / 2) * 1.02;
    cam.position.copy(c).add(new THREE.Vector3(0.75, 0.45, 1).normalize().multiplyScalar(dist)); cam.lookAt(c);
    tr.render(ts, cam);
    S.thumbs[d.type] = tr.domElement.toDataURL('image/png');
    ts.remove(g);
    const img = document.querySelector(`img[data-thumb="${d.type}"]`); if (img) img.src = S.thumbs[d.type];
    await new Promise((r2) => setTimeout(r2, 0));
  }
  tr.dispose();
}
function pmremThumb(tr) { const pm = new THREE.PMREMGenerator(tr); const t = pm.fromScene(new RoomEnvironment(), 0.04).texture; return t; }

// ---------------------------------------------------------------- room panel
function renderRoomDims() {
  const box = $('#room-dims'); if (!box) return;
  const { w, d, h: hh } = R(), V = w * d * hh;
  box.innerHTML = '';
  box.append(
    h('div', { class: 'grid3' },
      numField('Width', w, (v) => setRoom({ w: v }), { min: 1, max: 40 }),
      numField('Length', d, (v) => setRoom({ d: v }), { min: 1, max: 40 }),
      numField('Height', hh, (v) => setRoom({ h: v }), { min: 1.8, max: 12 })),
    h('p', { class: 'hint' }, `Floor ${(w * d).toFixed(1)} m² · Volume ${V.toFixed(1)} m³ (${(V * 35.315).toFixed(0)} ft³)`));
}
function setRoom(dims) {
  const room = R(), old = { w: room.w, d: room.d, h: room.h };
  const v = Object.fromEntries(Object.entries(dims).filter(([, x]) => x != null && !Number.isNaN(x)).map(([k, x]) => [k, Math.round(clamp(x, 1, 60) * 1000) / 1000]));
  const rect = G.isRect(room);
  Object.assign(room, v);
  if (v.h && room.ceiling && room.ceiling.type !== 'flat' && room.ceiling.h2 != null && ['gable', 'vault', 'dome'].includes(room.ceiling.type)) room.ceiling.h2 = Math.max(room.h + 0.1, room.ceiling.h2 + (room.h - old.h));
  const kx = room.w / old.w, kz = room.d / old.d;
  if (rect) {
    const ids = room.poly.map((p) => p.id);
    room.poly = G.rectPoly(room.w, room.d).map((p, i) => ({ ...p, id: ids[i] || p.id }));
    // keep wall-mounted items on their walls when the room resizes
    for (const it of P().items) {
      const sx = old.w / 2, sz = old.d / 2;
      if (Math.abs(Math.abs(it.pos[0]) - sx) < it.size[2] / 2 + 0.06 && Math.abs(it.pos[0]) > 0.01) it.pos[0] = Math.sign(it.pos[0]) * (room.w / 2 - (sx - Math.abs(it.pos[0])));
      if (Math.abs(Math.abs(it.pos[2]) - sz) < it.size[2] / 2 + 0.06 && Math.abs(it.pos[2]) > 0.01) it.pos[2] = Math.sign(it.pos[2]) * (room.d / 2 - (sz - Math.abs(it.pos[2])));
    }
  } else {
    room.poly = room.poly.map((p) => ({ ...p, x: p.x * kx, z: p.z * kz }));
    for (const it of P().items) { it.pos[0] *= kx; it.pos[2] *= kz; }
  }
  G.normalizeRoom(room);
  refitItemsToRoom();
  buildRoom(); rebuildAllItems(); if (orthoCams[S.view] || S.view === 'persp') setView(S.view, true);
  commit(); renderRoomDims();
}
/** After the room shape changes, re-seat corner traps, wall items and ceiling items. */
function refitItemsToRoom() {
  for (const it of P().items) {
    const def = defOf(it.type);
    if (def.origin === 'corner') {
      const vs = convexCorners();
      const v = vs.sort((a, b) => Math.hypot(a.x - it.pos[0], a.z - it.pos[2]) - Math.hypot(b.x - it.pos[0], b.z - it.pos[2]))[0];
      if (v) { const tall = it.size[1] >= (S._prevH || R().h) - 0.05; placeInCorner(it, v); if (tall) it.size[1] = +G.heightAt(R(), v.x, v.z).toFixed(3); }
    } else if (def.mount === 'wall' && it.wall) {
      const e = wallEdges().find((x) => x.id === it.wall) || nearestEdge(it.pos[0], it.pos[2]);
      if (e) placeOnWallAt(it, e, it.pos[0], it.pos[2], it.pos[1]);
    } else if (def.mount === 'ceiling') it.pos[1] = Math.max(0, ceilingYFor(it) - it.size[1] - (def.drop || 0));
  }
}
function setSurface(name, patch) {
  const ids = name === '*walls' ? wallEdges().map((e) => e.id) : [name in IDEAL_N && !wallEdges().some((e) => e.id === name) ? edgeFor(name).id : name];
  for (const id of ids) Object.assign(surf(id), patch);
  buildRoom();
}
function surfaceEditor(name, compact = false) {
  const sf = surf(name);
  const kids = [
    colorField('Colour', sf.color, (c, done) => { sf.color = c; buildRoom(); if (done) commit(); }),
    selectField('Finish', sf.finish, finishOptions(), (v) => { sf.finish = v; buildRoom(); commit(); }),
    selectField('Acoustic material', sf.acoustic, acousticOptions(), (v) => { sf.acoustic = v; commit(); }),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn small', onclick: () => openScanner(scannerApi(), { target: name }) }, '📷 Photo from camera'),
      h('button', { class: 'btn small', onclick: () => pickFile('image/*', async (u) => { sf.photo = addAsset(await compressImage(u)); sf.showPhoto = true; buildRoom(); commit(); renderPanels(); }) }, 'Upload photo')),
  ];
  if (sf.photo) kids.push(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sf.showPhoto !== false, onchange: (e) => { sf.showPhoto = e.target.checked; buildRoom(); commit(); } }), ' Show photo on surface'), h('button', { class: 'btn small ghost', onclick: () => { sf.photo = null; buildRoom(); commit(); renderPanels(); } }, 'Remove photo'));
  const area = surfaceArea(name);
  kids.push(h('p', { class: 'hint' }, `Area ${area.toFixed(2)} m² · α@500Hz ${(AC.ACOUSTIC_MATERIALS[sf.acoustic]?.a[2] ?? 0).toFixed(2)}`));
  return compact ? h('div', {}, kids) : section(surfLabel(name), ...kids);
}
function renderRoom() {
  const pane = $('#pane-room'); pane.innerHTML = '';
  const p = P();
  pane.append(
    section('Project',
      h('label', { class: 'field' }, h('span', {}, 'Project name'), h('input', { value: p.name, onchange: (e) => { p.name = e.target.value; commit(); } })),
      h('div', { class: 'grid2' },
        h('label', { class: 'field' }, h('span', {}, 'Designer'), h('input', { value: p.designer, onchange: (e) => { p.designer = e.target.value; commit(); } })),
        h('label', { class: 'field' }, h('span', {}, 'Client'), h('input', { value: p.client, onchange: (e) => { p.client = e.target.value; commit(); } }))),
      h('label', { class: 'field' }, h('span', {}, 'Notes (included in PDF)'), h('textarea', { rows: 3, value: p.notes, onchange: (e) => { p.notes = e.target.value; commit(); } }))),
    section('Room size', h('div', { id: 'room-dims' }),
      selectField('Units', S.units, [['m', 'Metres'], ['ft', 'Feet']], (v) => { S.units = v; localStorage.setItem('rt.units', v); buildRoom(); renderPanels(); })),
    section('Room shape', shapeEditor()),
    section('Ceiling', ceilingEditor()),
    section('Walls', wallsEditor()),
    section('Start from template', h('div', { class: 'tpl-grid' }, Object.entries(TEMPLATES).map(([name, t]) => h('button', { class: 'btn small', onclick: async () => { if (!P().items.length || await confirmDialog('Replace current design?', `Start a new "${name}" (${t.dims.w}×${t.dims.d}×${t.dims.h} m)? Your current design stays in undo history only if you saved it.`)) applyTemplate(name); } }, name)))),
    section('Colours & materials',
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small', onclick: () => paletteDialog() }, '🎨 Colour schemes'),
        h('button', { class: 'btn small', onclick: () => openScanner(scannerApi(), { target: 'palette' }) }, '📷 Match colours from camera')),
      h('div', { class: 'surf-tabs' }, surfaceIds().map((k) => h('details', { class: 'sub' }, h('summary', {}, h('i', { class: 'dot', style: { background: surf(k).color } }), surfLabel(k)), surfaceEditor(k, true))))),
    section('Lighting & display',
      h('label', { class: 'field' }, h('span', {}, 'Ambient / daylight level'), h('input', { type: 'range', min: 0, max: 1.5, step: 0.05, value: R().ambient, oninput: (e) => { R().ambient = +e.target.value; applyAmbient(); }, onchange: () => commit() })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: R().daylight !== false, onchange: (e) => { R().daylight = e.target.checked; applyAmbient(); commit(); } }), ' Sunlight (shadows)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.showGrid, onchange: (e) => { S.showGrid = e.target.checked; buildRoom(); } }), ' Floor grid'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.showDims, onchange: (e) => { S.showDims = e.target.checked; buildRoom(); updateHelpers(); } }), ' Dimensions'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.showReflections, onchange: (e) => { S.showReflections = e.target.checked; updateHelpers(); } }), ' Reflection points'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.shadows, onchange: (e) => { S.shadows = e.target.checked; applyAmbient(); } }), ' Shadows')),
    section('Floor-plan underlay', underlayEditor()),
  );
  renderRoomDims();
}
// ---------------------------------------------------------------- room shape editors
/** Apply an edit to the room outline, keep it centred and keep items in place. */
function changeShape(fn, { refit = true } = {}) {
  fn();
  const sh = G.normalizeRoom(R());
  for (const it of P().items) { it.pos[0] += sh.dx; it.pos[2] += sh.dz; }
  if (P().underlay) { P().underlay.x = (P().underlay.x || 0) + sh.dx; P().underlay.z = (P().underlay.z || 0) + sh.dz; }
  if (refit) refitItemsToRoom();
  buildRoom(); rebuildAllItems(); updateHelpers();
  commit();
  if (S.leftTab === 'room') renderRoom();
}
function shapeThumb(key) {
  const pts = G.SHAPES[key].pts(1, 1.2);
  const d = pts.map(([x, z], i) => `${i ? 'L' : 'M'}${(x * 30 + 22).toFixed(1)} ${(z * 30 + 22).toFixed(1)}`).join(' ') + 'Z';
  return `<svg viewBox="0 0 44 44" width="38" height="38"><path d="${d}" fill="rgba(53,196,181,.18)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><line x1="10" y1="3" x2="34" y2="3" stroke="#ffb547" stroke-width="2"/></svg>`;
}
function shapeEditor() {
  const room = R(), E = wallEdges(), per = E.reduce((a, e) => a + e.len, 0);
  return h('div', {},
    h('div', { class: 'shape-grid' }, Object.entries(G.SHAPES).map(([k, sp]) => h('button', { class: 'shape-btn', title: sp.label, onclick: () => changeShape(() => G.applyShape(R(), k)) }, h('span', { html: shapeThumb(k) }), h('small', {}, sp.label)))),
    h('p', { class: 'hint' }, 'Orange line = front wall (where the speakers face from).'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn small' + (S.tool === 'shape' ? ' primary' : ''), onclick: () => setTool(S.tool === 'shape' ? 'select' : 'shape') }, '✏️ Edit corners on plan'),
      h('button', { class: 'btn small' + (S.tool === 'draw' ? ' primary' : ''), onclick: () => setTool('draw') }, '✍️ Draw new outline'),
      h('button', { class: 'btn small', title: 'Mirror the outline left ↔ right', onclick: () => changeShape(() => { R().poly = R().poly.map((p) => ({ ...p, x: -p.x })).reverse(); const n = R().poly.length, ids = R().poly.map((p) => p.id); R().poly.forEach((p, i) => (p.id = ids[(i + 1) % n])); }) }, '⇋ Mirror'),
      h('button', { class: 'btn small', title: 'Mirror the outline front ↔ back', onclick: () => changeShape(() => { R().poly = R().poly.map((p) => ({ ...p, z: -p.z })).reverse(); const n = R().poly.length, ids = R().poly.map((p) => p.id); R().poly.forEach((p, i) => (p.id = ids[(i + 1) % n])); }) }, '⇵ Flip'),
      h('button', { class: 'btn small', title: 'Rotate the outline 90°', onclick: () => changeShape(() => { R().poly = R().poly.map((p) => ({ ...p, x: -p.z, z: p.x })); }) }, '⟳ 90°')),
    numField('Wall thickness', room.wallT ?? 0.15, (v) => { R().wallT = clamp(v, 0.02, 1); buildRoom(); commit(); }, { min: 0.02, max: 1 }),
    h('p', { class: 'hint' }, `${E.length} walls · perimeter ${fmt(per)} · floor ${G.floorArea(room).toFixed(2)} m² · volume ${G.volume(room).toFixed(1)} m³`),
    h('details', { class: 'sub' }, h('summary', {}, 'Corner coordinates'),
      h('table', { class: 'tbl coords' }, h('tr', {}, h('th', {}, '#'), h('th', {}, `X (${S.units})`), h('th', {}, `Z (${S.units})`), h('th', {}, '∠'), h('th', {})),
        G.vertexInfo(room).map((v, i) => h('tr', {},
          h('td', {}, i + 1),
          h('td', {}, h('input', { type: 'number', step: 0.01, value: +toUnit(v.x).toFixed(3), onchange: (ev) => changeShape(() => { R().poly[i].x = fromUnit(+ev.target.value); }) })),
          h('td', {}, h('input', { type: 'number', step: 0.01, value: +toUnit(v.z).toFixed(3), onchange: (ev) => changeShape(() => { R().poly[i].z = fromUnit(+ev.target.value); }) })),
          h('td', {}, `${(v.convex ? v.angle : 360 - v.angle).toFixed(0)}°`),
          h('td', {}, R().poly.length > 3 ? h('button', { class: 'icon-btn tiny', title: 'Remove corner', html: '&times;', onclick: () => changeShape(() => R().poly.splice(i, 1)) }) : null)))),
      h('p', { class: 'hint' }, 'Origin is the room centre; Z grows toward the back wall.')));
}
function ceilingEditor() {
  const c = R().ceiling, t = c.type || 'flat';
  const upd = (patch) => { Object.assign(R().ceiling, patch); refitItemsToRoom(); buildRoom(); rebuildAllItems(); commit(); renderRoom(); if (orthoCams[S.view]) setView(S.view); };
  const lowLabel = { flat: 'Height', shed: 'Low side', gable: 'Eaves height', vault: 'Springing height', dome: 'Edge height' }[t];
  const highLabel = { shed: 'High side', gable: 'Ridge height', vault: 'Crown height', dome: 'Crown height' }[t];
  return h('div', {},
    h('div', { class: 'ceil-grid' }, Object.entries(G.CEILINGS).map(([k, l]) => h('button', { class: 'btn small' + (k === t ? ' primary' : ''), onclick: () => upd({ type: k, h2: c.h2 && c.h2 > R().h ? c.h2 : +(R().h + 0.8).toFixed(2) }) }, l))),
    h('div', { class: 'grid2' },
      numField(lowLabel, R().h, (v) => setRoom({ h: v }), { min: 1, max: 30 }),
      t !== 'flat' ? numField(highLabel, c.h2 ?? R().h, (v) => upd({ h2: clamp(v, 0.5, 40) }), { min: 0.5, max: 40 }) : null),
    t === 'shed' ? selectField('Rises toward', c.dir || 'f2b', [['f2b', 'Back wall'], ['b2f', 'Front wall'], ['l2r', 'Right wall'], ['r2l', 'Left wall']], (v) => upd({ dir: v })) : null,
    t === 'gable' || t === 'vault' ? selectField('Ridge runs', c.axis || 'z', [['z', 'Front to back'], ['x', 'Left to right']], (v) => upd({ axis: v })) : null,
    h('p', { class: 'hint' }, `Peak ${fmt(S.hmax || R().h)} · ceiling area ${G.ceilingArea(R()).toFixed(2)} m². Sloped/curved ceilings change volume, reflection points and RT60 automatically.`));
}
function wallsEditor() {
  const E = wallEdges();
  const rows = E.map((e, i) => h('div', { class: 'wall-row' + (S.surfaceSel === e.id ? ' sel' : '') },
    h('i', { class: 'dot', style: { background: surf(e.id).color } }),
    h('button', { class: 'link', title: 'Edit this wall’s colour & material', onclick: () => selectSurface(e.id) }, surfLabel(e.id)),
    h('input', { type: 'number', step: 0.01, min: 0.05, value: +toUnit(e.len).toFixed(3), title: `Length (${S.units})`, onchange: (ev) => setEdgeLength(i, fromUnit(+ev.target.value)) }),
    h('small', { title: 'Direction' }, `${((Math.atan2(e.dir[1], e.dir[0]) / DEG + 360) % 360).toFixed(0)}°`),
    h('button', { class: 'icon-btn tiny', title: 'Curve this wall', html: '⌒', onclick: () => { const v = prompt('Bulge in metres (+ outward, − into the room):', '0.4'); if (v != null && !Number.isNaN(+v)) changeShape(() => { const src = surf(e.id); const ids = G.curveEdge(R(), i, fromUnit(+v)) || []; for (const id of ids) R().surfaces[id] = { ...JSON.parse(JSON.stringify(src)) }; }); } }),
    h('button', { class: 'icon-btn tiny', title: 'Split into two walls', html: '⫶', onclick: () => changeShape(() => { const id = G.splitEdge(R(), i); if (id) R().surfaces[id] = { ...JSON.parse(JSON.stringify(surf(e.id))) }; }) }),
    E.length > 3 ? h('button', { class: 'icon-btn tiny', title: 'Remove this wall (merge corners)', html: '&times;', onclick: () => changeShape(() => R().poly.splice((i + 1) % R().poly.length, 1)) }) : null));
  const body = h('div', { class: 'walls-list' }, rows);
  return E.length > 14 ? h('details', { class: 'sub' }, h('summary', {}, `${E.length} wall segments`), body) : body;
}
function setEdgeLength(i, L) {
  changeShape(() => {
    const E = wallEdges(), e = E[i], n = R().poly.length;
    const b = R().poly[(i + 1) % n];
    b.x = e.a[0] + e.dir[0] * Math.max(0.05, L); b.z = e.a[1] + e.dir[1] * Math.max(0.05, L);
  });
}

// ---------------------------------------------------------------- outline editing on the plan
const shapeGroup = new THREE.Group(); shapeGroup.name = 'ShapeHandles';
scene.add(shapeGroup);
function handleScale() { return activeCam?.isOrthographicCamera ? clamp(((activeCam.right - activeCam.left) / activeCam.zoom) / 9, 0.5, 4) : clamp(Math.max(R().w, R().d) / 6, 0.6, 3); }
function drawShapeHandles() {
  shapeGroup.clear();
  const k = handleScale();
  const ball = (r, color, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * k, 16, 12), new THREE.MeshBasicMaterial({ color, depthTest: false })); m.position.set(x, 0.04, z); m.renderOrder = 1000; return m; };
  if (S.tool === 'shape') {
    wallEdges().forEach((e, i) => {
      const v = ball(0.09, S.dragV === i ? '#ffffff' : '#ffb547', e.a[0], e.a[1]); v.userData.vertex = i; shapeGroup.add(v);
      const m = ball(0.055, '#35c4b5', e.mid[0], e.mid[1]); m.userData.insert = i; shapeGroup.add(m);
    });
  }
  if (S.tool === 'draw' && S.drawPts) {
    const pts = S.drawPts.slice(); if (S.drawHover) pts.push(S.drawHover);
    pts.forEach((p, i) => shapeGroup.add(ball(i === 0 ? 0.11 : 0.07, i === 0 ? '#ffb547' : '#35c4b5', p[0], p[1])));
    if (pts.length > 1) shapeGroup.add(line(pts.map((p) => [p[0], 0.04, p[1]]), '#35c4b5', 1));
    if (S.drawHover && S.drawPts.length) {
      const a = S.drawPts[S.drawPts.length - 1], b = S.drawHover, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const lab = labelSprite(fmt(L), { size: 0.16 * k, color: '#1b1d21', bg: '#35c4b5' }); lab.position.set((a[0] + b[0]) / 2, 0.1, (a[1] + b[1]) / 2); shapeGroup.add(lab);
    }
  }
}
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function floorPoint(e, neighbours = []) {
  ray.setFromCamera(ndc(e), activeCam);
  const v = new THREE.Vector3();
  if (!ray.ray.intersectPlane(floorPlane, v)) return null;
  let x = v.x, z = v.z;
  if (S.snap) { const g = S.units === 'ft' ? 0.3048 / 4 : 0.05; x = Math.round(x / g) * g; z = Math.round(z / g) * g; }
  // square-up: snap to the X / Z of neighbouring corners
  const tol = 0.12 * handleScale();
  for (const n of neighbours) { if (Math.abs(x - n[0]) < tol) x = n[0]; if (Math.abs(z - n[1]) < tol) z = n[1]; }
  return [x, z];
}
function shapePointerDown(e) {
  ray.setFromCamera(ndc(e), activeCam);
  const hit = ray.intersectObjects(shapeGroup.children, false)[0];
  if (!hit) return false;
  const ud = hit.object.userData;
  if (ud.insert != null) {
    const src = surf(wallEdges()[ud.insert].id);
    const id = G.splitEdge(R(), ud.insert, 0.5);
    if (id) R().surfaces[id] = { ...JSON.parse(JSON.stringify(src)) };
    S.dragV = ud.insert + 1;
  } else if (ud.vertex != null) S.dragV = ud.vertex;
  else return false;
  orbit.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
  buildRoom();
  return true;
}
let shapeRaf = 0;
function shapePointerMove(e) {
  const poly = R().poly, n = poly.length, i = S.dragV;
  const nb = [poly[(i - 1 + n) % n], poly[(i + 1) % n]].map((p) => [p.x, p.z]);
  const p = floorPoint(e, nb); if (!p) return;
  poly[i].x = p[0]; poly[i].z = p[1];
  if (!shapeRaf) shapeRaf = requestAnimationFrame(() => { shapeRaf = 0; buildRoom(); });
}
function shapePointerUp() {
  S.dragV = null;
  orbit.enabled = S.view !== 'walk';
  if (G.floorArea(R()) < 0.5) { toast('That outline is too small', 'error'); undo(); return; }
  changeShape(() => {});
}
function drawClick(e) {
  const last = S.drawPts[S.drawPts.length - 1];
  const p = floorPoint(e, last ? [last] : []); if (!p) return;
  const first = S.drawPts[0];
  if (S.drawPts.length >= 3 && Math.hypot(p[0] - first[0], p[1] - first[1]) < 0.25 * handleScale()) return finishDraw();
  S.drawPts.push(p); S.drawHover = null; drawShapeHandles();
}
function finishDraw() {
  const pts = S.drawPts || [];
  if (pts.length < 3) { toast('Click at least 3 corners, then click the first corner (or press Enter) to close', 'error'); return; }
  let poly = pts.map(([x, z]) => ({ x, z, id: G.newWallId() }));
  if (G.signedArea(poly) < 0) poly = poly.reverse();
  if (Math.abs(G.signedArea(poly)) < 0.5) { toast('That outline is too small', 'error'); return; }
  // name the wall nearest the front 'front' so speaker/treatment logic keeps working
  const tmp = { ...R(), poly };
  const fe = G.edges(tmp).filter((e) => e.n[1] > 0.5).sort((a, b) => a.mid[1] - b.mid[1])[0];
  if (fe) { poly[fe.i].id = 'front'; }
  S.drawPts = null; S.drawHover = null;
  changeShape(() => { R().poly = poly; });
  setTool('shape');
  toast('New outline created — drag corners to refine, click teal dots to add corners');
}
function underlayEditor() {
  const u = P().underlay;
  if (!u) return h('div', {}, h('p', { class: 'hint' }, 'Import a photo or scan of a floor plan, scale it to the real width and trace over it in Top view.'), h('button', { class: 'btn small', onclick: importUnderlay }, 'Import floor-plan image'));
  const upd = (patch) => { Object.assign(u, patch); buildUnderlay(); };
  return h('div', {},
    numField('Real width', u.width, (v) => { upd({ width: v }); commit(); }, { min: 0.5, max: 80 }),
    h('div', { class: 'grid2' }, numField('Offset X', u.x || 0, (v) => { upd({ x: v }); commit(); }), numField('Offset Z', u.z || 0, (v) => { upd({ z: v }); commit(); })),
    numField('Rotation (°)', u.rot || 0, (v) => { upd({ rot: v }); commit(); }, { unit: false, step: 1 }),
    h('label', { class: 'field' }, h('span', {}, 'Opacity'), h('input', { type: 'range', min: 0.05, max: 1, step: 0.05, value: u.opacity, oninput: (e) => upd({ opacity: +e.target.value }), onchange: () => commit() })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: u.visible !== false, onchange: (e) => { upd({ visible: e.target.checked }); commit(); } }), ' Visible'),
    h('button', { class: 'btn small ghost', onclick: () => { P().underlay = null; buildUnderlay(); commit(); renderRoom(); } }, 'Remove underlay'));
}

const SCHEMES = {
  'Classic dark control room': { walls: '#2f3236', floor: ['#5d4030', 'wood'], ceiling: '#2a2c30', panels: '#3b3e42', diff: '#c49a6c' },
  'Scandi light': { walls: '#ece8df', floor: ['#d8c3a0', 'wood'], ceiling: '#f4f4f2', panels: '#c8cacc', diff: '#e0c08f' },
  'Warm walnut': { walls: '#d9c7a7', floor: ['#5d4030', 'wood'], ceiling: '#efe6cf', panels: '#6b4a32', diff: '#5d4030' },
  'Midnight blue': { walls: '#1d2a44', floor: ['#3b3e42', 'carpet'], ceiling: '#1a1f2e', panels: '#2f4b7c', diff: '#c49a6c' },
  'Forest studio': { walls: '#2e4d36', floor: ['#c49a6c', 'wood'], ceiling: '#ece8df', panels: '#9caf88', diff: '#d8c3a0' },
  'Industrial concrete': { walls: '#9a9a96', floor: ['#8a8d91', 'concrete'], ceiling: '#7a7c80', panels: '#2f3236', diff: '#c49a6c' },
  'Burgundy lounge': { walls: '#5a1a1f', floor: ['#2a211c', 'wood'], ceiling: '#2a211c', panels: '#3a2a20', diff: '#c8a14a' },
  'Neon producer': { walls: '#16181c', floor: ['#2f3236', 'carpet'], ceiling: '#101114', panels: '#2a2a2e', diff: '#3a3d43' },
};
function applyScheme(sc) {
  for (const k of wallEdges().map((e) => e.id)) Object.assign(surf(k), { color: sc.walls, finish: 'paint' });
  Object.assign(surf('floor'), { color: sc.floor[0], finish: sc.floor[1], acoustic: sc.floor[1] === 'carpet' ? 'carpet_pad' : sc.floor[1] === 'concrete' ? 'concrete' : 'wood_floor' });
  Object.assign(surf('ceiling'), { color: sc.ceiling });
  for (const it of P().items) {
    const cat = defOf(it.type).cat;
    if (['Absorption', 'Bass Control', 'Ceiling'].includes(cat) && it.finish === 'fabric') it.color = sc.panels;
    if (cat === 'Diffusion' || it.type === 'slats') it.color = sc.diff;
  }
  buildRoom(); rebuildAllItems(); commit(); renderPanels();
}
function paletteDialog() {
  const body = h('div', { class: 'scheme-grid' }, Object.entries(SCHEMES).map(([name, sc]) => h('button', { class: 'scheme', onclick: () => { applyScheme(sc); toast(`Applied "${name}"`); } },
    h('div', { class: 'scheme-sw' }, [sc.walls, sc.floor[0], sc.ceiling, sc.panels, sc.diff].map((c) => h('i', { style: { background: c } }))), h('span', {}, name))));
  modal('Colour schemes', h('div', {}, h('p', { class: 'hint' }, 'Applies wall, floor and ceiling colours and recolours fabric panels and diffusers. Tweak anything afterwards.'), body));
}

// ---------------------------------------------------------------- scenes panel
function renderScenes() {
  const pane = $('#pane-scenes'); pane.innerHTML = '';
  pane.append(h('div', { class: 'pane-head' },
    h('button', { class: 'btn primary block', onclick: () => { const sc = { id: uid(), name: `Scene ${P().scenes.length + 1} — ${VIEW_NAMES[S.view === 'quad' ? 'persp' : S.view]}`, ...currentSceneState(), thumb: renderToDataURL({ scene: currentSceneState(), width: 320, height: 200, quality: 0.7 }) }; P().scenes.push(sc); commit(); renderScenes(); toast('Scene saved — it will be included in PDF export'); } }, '＋ Save current view as scene'),
    h('p', { class: 'hint' }, 'Scenes are camera angles you can return to and export as PDF pages or images.')));
  const list = h('div', { class: 'scene-list' });
  P().scenes.forEach((sc, i) => list.append(h('div', { class: 'scene-card' },
    h('img', { src: sc.thumb || '', onclick: () => gotoScene(sc) }),
    h('input', { value: sc.name, onchange: (e) => { sc.name = e.target.value; commit(); } }),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn small', onclick: () => gotoScene(sc) }, 'Go'),
      h('button', { class: 'btn small', onclick: () => { Object.assign(sc, currentSceneState(), { thumb: renderToDataURL({ scene: currentSceneState(), width: 320, height: 200, quality: 0.7 }) }); commit(); renderScenes(); } }, 'Update'),
      h('button', { class: 'btn small', onclick: () => download(`${safeName()}-${i + 1}.png`, dataUrlToBlob(renderToDataURL({ scene: sc, width: 2400, height: 1500, type: 'image/png' }))) }, 'PNG'),
      h('button', { class: 'btn small ghost', onclick: () => { P().scenes.splice(i, 1); commit(); renderScenes(); } }, 'Delete')))));
  pane.append(list);
  const sv = h('div', { class: 'std-views' }, h('h4', {}, 'Standard views'), ...['persp', 'top', 'front', 'back', 'left', 'right', 'listener'].map((v) => h('button', { class: 'btn small', onclick: () => setView(v) }, v === 'listener' ? 'Listener’s eye' : VIEW_NAMES[v])));
  pane.append(sv);
}

// ---------------------------------------------------------------- properties
function renderProps() {
  const pane = $('#pane-props'); if (!pane) return;
  pane.innerHTML = '';
  if (S.surfaceSel) { pane.append(h('div', { class: 'pane-title' }, h('h3', {}, surfLabel(S.surfaceSel)), h('small', {}, 'Room surface')), surfaceEditor(S.surfaceSel, true)); return; }
  const items = selectedItems();
  if (!items.length) {
    pane.append(h('div', { class: 'empty' },
      h('h3', {}, 'Nothing selected'),
      h('p', {}, 'Click an item or a wall to edit it. Add items from the Library, or type a request in the prompt bar below the viewport.'),
      h('div', { class: 'quick' },
        h('button', { class: 'btn', onclick: () => { ensureListening('desk'); rebuildAllItems(); commit(); renderPanels(); } }, '🎧 Set up listening position'),
        h('button', { class: 'btn primary', onclick: () => { const n = autoTreat('mixing'); toast(`Added ${n} treatment items`); } }, '✨ Auto-treat for mixing'),
        h('button', { class: 'btn', onclick: () => openScanner(scannerApi(), {}) }, '📷 Scan / capture room'))));
    return;
  }
  if (items.length > 1) {
    pane.append(h('div', { class: 'pane-title' }, h('h3', {}, `${items.length} items selected`)),
      colorField('Colour (all)', items[0].color, (c, done) => { items.forEach((i) => updateItem(i, { color: c })); if (done) commit(); }),
      selectField('Finish (all)', items[0].finish, finishOptions(), (v) => { items.forEach((i) => updateItem(i, { finish: v })); commit(); }),
      section('Align & distribute', h('div', { class: 'align-grid' },
        ...[['x', 'Left/Right'], ['z', 'Front/Back'], ['y', 'Height']].map(([ax, l]) => h('div', {}, h('small', {}, l), h('div', { class: 'row gap' }, h('button', { class: 'btn small', onclick: () => alignItems(ax, 'min') }, 'min'), h('button', { class: 'btn small', onclick: () => alignItems(ax, 'mid') }, 'centre'), h('button', { class: 'btn small', onclick: () => alignItems(ax, 'max') }, 'max'), h('button', { class: 'btn small', onclick: () => alignItems(ax, 'distribute') }, 'spread')))))),
      actionRow(items));
    return;
  }
  const it = items[0], def = defOf(it.type);
  const area = areaOf(def, it.size), am = AC.ACOUSTIC_MATERIALS[it.acoustic];
  paneAppend(pane,
    h('div', { class: 'pane-title' }, h('img', { src: S.thumbs[it.type] || '' }), h('div', {}, h('input', { class: 'name-input', value: it.name, onchange: (e) => { it.name = e.target.value; commit(); renderLayers(); } }), h('small', {}, def.cat))),
    def.desc ? h('p', { class: 'desc' }, def.desc) : null,
    actionRow(items),
    section('Position & rotation',
      h('div', { class: 'grid3' },
        numField('X', it.pos[0], (v) => { updateItem(it, { pos: [v, it.pos[1], it.pos[2]] }); commit(); }),
        numField('Elev.', it.pos[1], (v) => { updateItem(it, { pos: [it.pos[0], Math.max(0, v), it.pos[2]] }); commit(); }, { min: 0 }),
        numField('Z', it.pos[2], (v) => { updateItem(it, { pos: [it.pos[0], it.pos[1], v] }); commit(); })),
      h('div', { class: 'grid3' },
        numField('Rot Y°', it.rot[1], (v) => { updateItem(it, { rot: [it.rot[0], v, it.rot[2]] }); commit(); }, { unit: false, step: 1, digits: 1 }),
        numField('Tilt X°', it.rot[0], (v) => { updateItem(it, { rot: [v, it.rot[1], it.rot[2]] }); commit(); }, { unit: false, step: 1, digits: 1 }),
        numField('Roll Z°', it.rot[2], (v) => { updateItem(it, { rot: [it.rot[0], it.rot[1], v] }); commit(); }, { unit: false, step: 1, digits: 1 })),
      h('div', { class: 'row gap wrap' }, h('small', {}, 'Snap to wall:'), ...['front', 'back', 'left', 'right'].map((wl) => h('button', { class: 'btn small', onclick: () => snapToWall(it, wl) }, wl)), h('button', { class: 'btn small', onclick: () => snapToWall(it) }, 'nearest'))),
    section('Size',
      h('div', { class: 'grid3' },
        numField('Width', it.size[0], (v) => { updateItem(it, { size: [Math.max(0.005, v), it.size[1], it.size[2]] }); commit(); }, { min: 0.005 }),
        numField('Height', it.size[1], (v) => { updateItem(it, { size: [it.size[0], Math.max(0.005, v), it.size[2]] }); commit(); }, { min: 0.005 }),
        numField('Depth', it.size[2], (v) => { updateItem(it, { size: [it.size[0], it.size[1], Math.max(0.005, v)] }); commit(); }, { min: 0.005 })),
      h('div', { class: 'row gap wrap' }, h('small', {}, 'Presets:'), ...sizePresets(def).map(([l, s]) => h('button', { class: 'btn small', onclick: () => { updateItem(it, { size: s }); commit(); renderProps(); } }, l)))),
    section('Appearance',
      colorField('Main colour', it.color, (c, done) => { updateItem(it, { color: c }); if (done) commit(); }),
      colorField('Secondary / frame', it.color2 || '#222222', (c, done) => { updateItem(it, { color2: c }); if (done) commit(); }),
      selectField('Finish', it.finish, finishOptions(), (v) => { updateItem(it, { finish: v }); commit(); })),
    Object.keys(def.params || {}).length ? section('Options', paramFields(it, def)) : null,
    section('Acoustics',
      selectField('Acoustic behaviour', it.acoustic, acousticOptions(), (v) => { updateItem(it, { acoustic: v }, false); commit(); renderProps(); }),
      h('div', { class: 'coef' }, AC.BANDS.map((f, i) => h('div', { class: 'coef-bar' }, h('i', { style: { height: `${Math.round((am?.a[i] || 0) * 100)}%` } }), h('small', {}, f >= 1000 ? f / 1000 + 'k' : f)))),
      h('p', { class: 'hint' }, `Effective face area ${area.toFixed(2)} m² · NRC ≈ ${am ? ((am.a[1] + am.a[2] + am.a[3] + am.a[4]) / 4).toFixed(2) : '0'} · adds ${(area * (am?.a[2] || 0)).toFixed(2)} sabins @ 500 Hz${AC.DIFFUSIVE.has(it.acoustic) ? ' · diffusive' : ''}`)),
  );
}
function paneAppend(pane, ...kids) { pane.append(...kids.filter(Boolean)); }
function actionRow(items) {
  const one = items[0];
  return h('div', { class: 'action-row' },
    h('button', { class: 'icon-btn', title: 'Duplicate (Ctrl+D)', html: svg('copy'), onclick: () => duplicate(items) }),
    h('button', { class: 'icon-btn', title: 'Mirror across room centre line (symmetry)', html: svg('mirror'), onclick: () => mirror(items) }),
    h('button', { class: 'icon-btn', title: one.locked ? 'Unlock' : 'Lock', html: svg(one.locked ? 'lock' : 'unlock'), onclick: () => { items.forEach((i) => (i.locked = !one.locked)); attachGizmo(); commit(); } }),
    h('button', { class: 'icon-btn', title: one.hidden ? 'Show' : 'Hide', html: svg(one.hidden ? 'eyeOff' : 'eye'), onclick: () => { items.forEach((i) => updateItem(i, { hidden: !one.hidden })); commit(); } }),
    h('button', { class: 'btn small', title: 'Make N copies in a row', onclick: () => { const n = parseInt(prompt('How many copies in a row?', '3'), 10); if (n > 0) duplicate(items, Math.min(n, 50)); } }, 'Array…'),
    h('button', { class: 'icon-btn danger', title: 'Delete (Del)', html: svg('trash'), onclick: () => removeItems(items) }));
}
function sizePresets(def) {
  const s = def.size;
  if (['absorber', 'absorber50', 'bassPanel', 'framedPanel', 'bad', 'qrd', 'poly'].includes(def.type)) return [['60×120', [0.6, 1.2, s[2]]], ['120×60', [1.2, 0.6, s[2]]], ['60×60', [0.6, 0.6, s[2]]], ['120×120', [1.2, 1.2, s[2]]], ['60×240', [0.6, 2.4, s[2]]]];
  if (def.type === 'cloud') return [['120×180', [1.2, s[1], 1.8]], ['120×240', [1.2, s[1], 2.4]], ['180×240', [1.8, s[1], 2.4]]];
  if (def.type === 'cornerTrap') return [['40 cm', [0.4, R().h, 0.4]], ['60 cm', [0.6, R().h, 0.6]], ['80 cm', [0.8, R().h, 0.8]]];
  if (def.type === 'desk') return [['1.6 m', [1.6, 0.74, 0.8]], ['1.8 m', [1.8, 0.74, 0.85]], ['2.2 m', [2.2, 0.74, 0.9]]];
  return [['½×', s.map((v) => +(v * 0.5).toFixed(3))], ['default', s.slice()], ['2×', s.map((v) => +(v * 2).toFixed(3))]];
}
function paramFields(it, def) {
  const out = [];
  for (const [k, p] of Object.entries(def.params)) {
    const v = it.params[k] ?? p.default;
    const set = (val) => { updateItem(it, { params: { [k]: val } }); commit(); };
    if (p.type === 'bool') out.push(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!v, onchange: (e) => set(e.target.checked) }), ' ' + p.label));
    else if (p.type === 'select') out.push(selectField(p.label, v, p.options.map((o) => [o, String(o)]), (val) => set(typeof p.default === 'number' ? +val : val)));
    else if (p.type === 'number') out.push(numField(p.label, v, (val) => set(val), { unit: false, step: p.step, min: p.min, max: p.max }));
    else if (p.type === 'range') out.push(h('label', { class: 'field' }, h('span', {}, p.label), h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v, onchange: (e) => set(+e.target.value) })));
    else if (p.type === 'color') out.push(colorField(p.label, v, (c, done) => { if (done) set(c); }));
    else if (p.type === 'text') out.push(h('label', { class: 'field' }, h('span', {}, p.label), h('input', { value: v, onchange: (e) => set(e.target.value) })));
    else if (p.type === 'image') out.push(h('div', { class: 'row gap' }, h('button', { class: 'btn small', onclick: () => openScanner(scannerApi(), { target: 'item', item: it }) }, '📷 Camera'), h('button', { class: 'btn small', onclick: () => pickFile('image/*', async (u) => set(addAsset(await compressImage(u)))) }, 'Upload image')));
  }
  return out;
}

// ---------------------------------------------------------------- layers
function renderLayers() {
  const pane = $('#pane-layers'); if (!pane || S.rightTab !== 'layers') return;
  pane.innerHTML = '';
  const groups = {};
  for (const it of P().items) (groups[defOf(it.type).cat] ||= []).push(it);
  if (!P().items.length) pane.append(h('p', { class: 'hint pad' }, 'No items yet.'));
  for (const [cat, list] of Object.entries(groups)) {
    pane.append(h('details', { class: 'layer-group', open: true }, h('summary', {}, cat, h('small', {}, list.length)),
      list.map((it) => h('div', { class: 'layer' + (S.sel.includes(it.id) ? ' sel' : ''), onclick: (e) => select([it.id], e.shiftKey || e.metaKey || e.ctrlKey) },
        h('i', { class: 'dot', style: { background: it.color } }), h('span', {}, it.name),
        h('button', { class: 'icon-btn tiny', title: 'Show/hide', html: svg(it.hidden ? 'eyeOff' : 'eye', 14), onclick: (e) => { e.stopPropagation(); updateItem(it, { hidden: !it.hidden }); commit(); } }),
        h('button', { class: 'icon-btn tiny', title: 'Lock', html: svg(it.locked ? 'lock' : 'unlock', 14), onclick: (e) => { e.stopPropagation(); it.locked = !it.locked; attachGizmo(); commit(); } })))));
  }
}

// ---------------------------------------------------------------- acoustics panel
function renderAcoustics() {
  const pane = $('#pane-acoustics'); if (!pane) return;
  const A = analysis(); S.lastAnalysis = A;
  pane.innerHTML = '';
  const rt = A.rt;
  paneAppend(pane,
    h('div', { class: 'kpis' },
      kpi('RT60 (mid)', rt.mid.toFixed(2) + ' s', `target ${rt.target.toFixed(2)} s`, Math.abs(rt.mid - rt.target) < rt.target * 0.35 ? 'good' : rt.mid > rt.target ? 'bad' : 'warn'),
      kpi('Volume', rt.V.toFixed(1) + ' m³', `${(rt.V * 35.315).toFixed(0)} ft³`),
      kpi('Schroeder', rt.schroeder.toFixed(0) + ' Hz', 'modal region below'),
      kpi('Treated area', (A.coverage * 100).toFixed(0) + ' %', 'of room surface')),
    section('Recommendations', h('ul', { class: 'advice' }, A.advice.map((a) => h('li', { class: a.lvl }, a.text))),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small primary', onclick: () => { autoTreat('mixing'); renderAcoustics(); } }, 'Auto-treat: mixing'),
        h('button', { class: 'btn small', onclick: () => { autoTreat('mastering'); renderAcoustics(); } }, 'mastering'),
        h('button', { class: 'btn small', onclick: () => { autoTreat('tracking'); renderAcoustics(); } }, 'tracking'),
        h('button', { class: 'btn small', onclick: () => { autoTreat('podcast'); renderAcoustics(); } }, 'podcast'),
        h('button', { class: 'btn small', onclick: () => { autoTreat('theater'); renderAcoustics(); } }, 'home theater'))),
    section('Reverberation time (RT60)', rtChart(A), h('p', { class: 'hint' }, 'Bars: Sabine · dots: Eyring · band: EBU Tech 3276 target for critical listening. Estimates assume diffuse field; below the Schroeder frequency modes dominate.')),
    section('Room modes (to 300 Hz)', modeChart(A), h('ul', { class: 'advice small' }, A.issues.slice(0, 8).map((i) => h('li', { class: 'warn' }, i.text))), modeTable(A)),
    section('Room proportions', h('p', {}, `Ratio 1 : ${A.ratio.r[1].toFixed(2)} : ${A.ratio.r[2].toFixed(2)} — `, h('b', { class: A.ratio.inBolt ? 'ok' : 'no' }, A.ratio.inBolt ? 'inside Bolt area ✓' : 'outside Bolt area'), h('br'), `Closest recommended ratio: ${A.ratio.best.name} (1 : ${A.ratio.best.r[1]} : ${A.ratio.best.r[2]})`),
      h('button', { class: 'btn small', onclick: () => { const hh = R().h; setRoom({ w: +(hh * A.ratio.best.r[1]).toFixed(2), d: +(hh * A.ratio.best.r[2]).toFixed(2) }); renderAcoustics(); } }, `Apply ${A.ratio.best.name} for this height`)),
    section('Listening position',
      A.tri ? h('div', { class: 'kv' },
        kvRow('Speaker angle', `${A.tri.angle.toFixed(1)}° (ideal 60°)`), kvRow('Distance L / R', `${fmt(A.tri.dl)} / ${fmt(A.tri.dr)}`), kvRow('Speaker spacing', fmt(A.tri.spread)),
        kvRow('Ear height', fmt(A.E[1])), kvRow('From front wall', `${fmt(A.E[2] + R().d / 2)} (${(((A.E[2] + R().d / 2) / R().d) * 100).toFixed(0)} %)`))
        : h('p', { class: 'hint' }, 'Add a Listening Position and two monitors to analyse the stereo triangle and reflections.'),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small', onclick: () => { ensureListening('desk'); rebuildAllItems(); commit(); renderAcoustics(); } }, 'Set up listening position'),
        h('button', { class: 'btn small', onclick: () => { const L = getListener(); if (L) { L.pos[0] = 0; L.pos[2] = -R().d / 2 + R().d * 0.38; syncTransform(L); for (const [i, s] of getSpeakers().slice(0, 2).entries()) placeSpeaker(s, i), syncTransform(s); rebuildAllItems(); commit(); renderAcoustics(); } } }, 'Snap to 38 % + equilateral'),
        h('button', { class: 'btn small', onclick: () => setView('listener') }, 'View from listener'))),
    section('First reflections', reflTable(A),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small primary', onclick: () => { addMany('absorber', { qty: 0, loc: 'reflections' }); addMany('cloud', { qty: 0, loc: 'reflections' }); renderAcoustics(); } }, 'Treat reflection points'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.showReflections, onchange: (e) => { S.showReflections = e.target.checked; updateHelpers(); } }), ' Show in 3D'))),
    A.sbir.length ? section('Boundary interference (SBIR)', h('div', { class: 'kv' }, A.sbir.map((s) => kvRow(s.name, `front ${s.front.f.toFixed(0)} Hz · side ${s.side.f.toFixed(0)} Hz · floor ${s.floor.f.toFixed(0)} Hz`))), h('p', { class: 'hint' }, 'Quarter-wavelength cancellation frequencies from the nearest boundaries.')) : null,
  );
}
const kpi = (l, v, sub, lvl = '') => h('div', { class: 'kpi ' + lvl }, h('small', {}, l), h('b', {}, v), h('span', {}, sub));
const kvRow = (k, v) => h('div', { class: 'kvr' }, h('span', {}, k), h('b', {}, v));
function rtChart(A) {
  const W = 300, H = 150, pad = 26, max = Math.max(1, ...A.rt.bands.map((b) => Math.max(b.sabine, b.eyring))) * 1.1;
  const y = (v) => H - pad - (v / max) * (H - pad - 10), bw = (W - pad - 8) / A.rt.bands.length;
  const t = A.rt.target;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart"><rect x="${pad}" y="${y(t + 0.05 + 0.1)}" width="${W - pad - 4}" height="${y(Math.max(0, t - 0.05)) - y(t + 0.15)}" class="target"/>`;
  for (let v = 0; v <= max; v += max > 2 ? 0.5 : 0.2) s += `<line x1="${pad}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${pad - 4}" y="${y(v) + 3}" text-anchor="end">${v.toFixed(1)}</text>`;
  A.rt.bands.forEach((b, i) => {
    const x = pad + 4 + i * bw, cls = b.sabine > t * 1.6 ? 'bad' : b.sabine < t * 0.5 ? 'warn' : 'good';
    s += `<rect x="${x + 4}" y="${y(b.sabine)}" width="${bw - 8}" height="${H - pad - y(b.sabine)}" rx="3" class="bar ${cls}"><title>${b.f} Hz: Sabine ${b.sabine.toFixed(2)} s, Eyring ${b.eyring.toFixed(2)} s</title></rect>`;
    s += `<circle cx="${x + bw / 2}" cy="${y(b.eyring)}" r="3" class="ey"/><text x="${x + bw / 2}" y="${H - pad + 13}" text-anchor="middle">${b.f >= 1000 ? b.f / 1000 + 'k' : b.f}</text><text x="${x + bw / 2}" y="${y(b.sabine) - 4}" text-anchor="middle" class="val">${b.sabine.toFixed(2)}</text>`;
  });
  return h('div', { html: s + '</svg>' });
}
function modeChart(A) {
  const W = 300, H = 90, f0 = 20, f1 = 300, x = (f) => 8 + ((Math.log(f) - Math.log(f0)) / (Math.log(f1) - Math.log(f0))) * (W - 16);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart modes">`;
  for (const f of [20, 30, 50, 80, 100, 150, 200, 300]) s += `<line x1="${x(f)}" x2="${x(f)}" y1="8" y2="${H - 18}" class="gl"/><text x="${x(f)}" y="${H - 5}" text-anchor="middle">${f}</text>`;
  s += `<line x1="${x(A.rt.schroeder)}" x2="${x(A.rt.schroeder)}" y1="4" y2="${H - 18}" class="schroeder"/>`;
  for (const m of A.modes) {
    const hh = m.type === 'axial' ? 54 : m.type === 'tangential' ? 34 : 18;
    s += `<line x1="${x(m.f)}" x2="${x(m.f)}" y1="${H - 18}" y2="${H - 18 - hh}" class="m ${m.type}"><title>${m.f.toFixed(1)} Hz ${m.type} (${m.n.join(',')})</title></line>`;
  }
  s += `<text x="${W - 6}" y="14" text-anchor="end" class="legend"><tspan class="axial">■ axial</tspan> <tspan class="tangential">■ tangential</tspan> <tspan class="oblique">■ oblique</tspan></text></svg>`;
  return h('div', { html: s });
}
function modeTable(A) {
  const ax = A.modes.filter((m) => m.type === 'axial').slice(0, 12);
  const name = (n) => (n[0] ? 'Length' : n[1] ? 'Width' : 'Height') + ' ' + (n[0] || n[1] || n[2]);
  return h('details', { class: 'sub' }, h('summary', {}, 'Axial modes table'), h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Hz'), h('th', {}, 'Mode'), h('th', {}, 'Note')), ax.map((m) => h('tr', {}, h('td', {}, m.f.toFixed(1)), h('td', {}, name(m.n)), h('td', {}, noteName(m.f))))));
}
function noteName(f) { const n = Math.round(12 * Math.log2(f / 440)) + 57; return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][((n % 12) + 12) % 12] + Math.floor(n / 12); }
function reflTable(A) {
  if (!A.refl.length) return h('p', { class: 'hint' }, 'No speakers yet.');
  const spName = (id) => itemById(id)?.name || 'Speaker';
  return h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Speaker'), h('th', {}, 'Surface'), h('th', {}, 'Delay'), h('th', {}, 'Level'), h('th', {}, '')),
    A.refl.map((p, i) => h('tr', { class: A.treated[i] ? 'ok' : 'no' }, h('td', {}, spName(p.speaker)), h('td', {}, surfLabel(p.surface)), h('td', {}, p.delayMs.toFixed(1) + ' ms'), h('td', {}, p.levelDb.toFixed(1) + ' dB'), h('td', {}, A.treated[i] ? '✓' : '✗'))));
}

// ---------------------------------------------------------------- status bar
function renderStatus() {
  const el = $('#status-sel'); if (!el) return;
  const it = selectedItems()[0];
  if (!it) { el.textContent = S.surfaceSel ? surfLabel(S.surfaceSel) : `${P().items.length} items · Room ${fmt(R().w)} × ${fmt(R().d)} × ${fmt(R().h)}${S.hmax > R().h + 0.05 ? '–' + fmt(S.hmax) : ''} · ${wallEdges().length} walls · ${G.floorArea(R()).toFixed(1)} m²`; return; }
  const { w, d } = R();
  el.textContent = `${it.name} · ${it.size.map((v) => fmt(v)).join(' × ')} · X ${fmt(it.pos[0])} Z ${fmt(it.pos[2])} elev ${fmt(it.pos[1])} · to L ${fmt(it.pos[0] + w / 2)} · to front ${fmt(it.pos[2] + d / 2)}${S.sel.length > 1 ? ` · +${S.sel.length - 1} more` : ''}`;
}

// ---------------------------------------------------------------- tabs, tools
function renderLeftTabs() {
  $$('#left .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === S.leftTab));
  $$('#left .pane').forEach((p) => (p.hidden = p.id !== 'pane-' + S.leftTab));
}
function renderRightTabs() {
  $$('#right .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === S.rightTab));
  $$('#right .pane').forEach((p) => (p.hidden = p.id !== 'pane-' + S.rightTab));
  if (S.rightTab === 'acoustics') renderAcoustics();
  if (S.rightTab === 'layers') renderLayers();
}
function setTool(t) {
  const prevTool = S.tool;
  S.tool = t; S.measureA = null;
  if (t === 'draw') { S.drawPts = []; S.drawHover = null; if (S.view !== 'top') setView('top'); toast('Draw: click each corner on the plan · click the first corner or press Enter to close · Backspace undoes a point · Esc cancels'); }
  else S.drawPts = null;
  if (t === 'shape' && prevTool !== 'shape') { if (S.view === 'persp' || S.view === 'quad' || S.view === 'walk') setView('top'); toast('Edit shape: drag orange corners · click teal dots to add a corner · double-click a corner to delete it'); }
  drawShapeHandles();
  if (S.leftTab === 'room' && (t === 'shape' || t === 'draw' || prevTool === 'shape' || prevTool === 'draw')) renderRoom();
  $$('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  attachGizmo();
  renderer.domElement.style.cursor = t === 'measure' || t === 'draw' ? 'crosshair' : '';
  if (t === 'measure') toast('Measure: click two points. Esc to cancel.');
}
function closeDrawers() { document.body.classList.remove('show-left', 'show-right'); }

// ===================================================================== prompt bar
function promptApi() {
  return {
    items: () => P().items, selected: selectedItems, defOf, nameOf: (t) => defOf(t).name,
    select: (ids) => select(ids), removeItems, updateItem, commit: () => commit(),
    addMany: (type, o) => addMany(type, o), placeMany: (list, loc) => { list.forEach((it, i) => { placeItem(it, loc, i, list.length); syncTransform(it); rebuildItem(it); }); updateHelpers(); },
    setRoom, setSurface: (n, p) => setSurface(n, p), setView, autoTreat, undo, redo, duplicate, mirror,
    openPdf: () => openPdfDialog(exportApi()), exportGLB, showAcoustics: () => { S.rightTab = 'acoustics'; renderRightTabs(); document.body.classList.add('show-right'); },
    findTemplate: (s) => Object.keys(TEMPLATES).find((k) => s.includes(k.toLowerCase()) || s.includes(k.toLowerCase().split(' ')[0] + ' ' + (k.toLowerCase().split(' ')[1] || ''))),
    applyTemplate,
    setShape: (key) => { changeShape(() => G.applyShape(R(), key)); return G.SHAPES[key]?.label; },
    setCeiling: (patch) => { Object.assign(R().ceiling, patch); if (patch.h != null) R().h = patch.h; delete R().ceiling.h; refitItemsToRoom(); buildRoom(); rebuildAllItems(); commit(); renderRoom(); return G.CEILINGS[R().ceiling.type]; },
    curveWall: (name, sag) => { const e = edgeFor(name); if (!e) return false; changeShape(() => { const src = surf(e.id); const ids = G.curveEdge(R(), e.i, sag) || []; for (const id of ids) R().surfaces[id] = { ...JSON.parse(JSON.stringify(src)) }; }); return true; },
    setLights: (patch) => {
      const lights = P().items.filter((i) => defOf(i.type).light);
      for (const it of lights) {
        const p = { ...it.params };
        if (patch.on != null) p.on = patch.on;
        if (patch.color) p.lightColor = patch.color;
        if (patch.scale) p.intensity = clamp((p.intensity ?? 3) * patch.scale, 0, 10);
        updateItem(it, { params: p });
      }
      if (patch.on === false || patch.scale < 1) { R().ambient = Math.min(R().ambient, patch.on === false ? 0.15 : 0.35); applyAmbient(); }
      commit();
      return lights.length;
    },
  };
}
function runPromptText(text) {
  if (!text.trim()) return;
  const res = runPrompt(text, promptApi());
  for (const r of res) toast(r.msg, r.ok ? 'ok' : 'error');
  const log = $('#prompt-log');
  log.prepend(h('div', { class: 'plog' }, h('b', {}, '› ' + text), ...res.map((r) => h('div', { class: r.ok ? 'ok' : 'err' }, r.msg))));
  renderPanels();
}

// ===================================================================== scanner & export glue
function scannerApi() {
  return {
    h, toast, modal, compressImage,
    get surfaces() { return surfaceLabels(); },
    selected: () => selectedItems()[0],
    room: R,
    applyPhotoToSurface: (name, dataUrl) => { surf(name).photo = addAsset(dataUrl); surf(name).showPhoto = true; buildRoom(); commit(); renderPanels(); },
    applyColorToSurface: (name, c) => { surf(name).color = c; buildRoom(); commit(); renderPanels(); },
    applyColorToSelection: (c) => { selectedItems().forEach((i) => updateItem(i, { color: c })); commit(); renderProps(); },
    applyImageToItem: (it, dataUrl) => { updateItem(it, { params: { image: addAsset(dataUrl) } }); commit(); },
    addArtPanel: (dataUrl) => { const [it] = addMany('artPanel', { loc: 'back' }); updateItem(it, { params: { image: addAsset(dataUrl) } }); commit(); },
    setUnderlay: (dataUrl) => { const id = addAsset(dataUrl); P().underlay = { asset: id, width: R().w, opacity: 0.6, rot: 0, x: 0, z: 0, visible: true }; buildUnderlay(); commit(); setView('top'); renderRoom(); },
    setRoom: (dims) => setRoom(dims),
    importModel,
  };
}
function exportApi() {
  return {
    h, toast, modal, project: P, room: R, analysis, scheduleRows, renderToDataURL, viewNames: VIEW_NAMES,
    fmt, acousticName: (k) => AC.ACOUSTIC_MATERIALS[k]?.name || k, finishName: (k) => FINISHES[k]?.label || k, surfaceList: () => surfaceIds().map((id) => ({ id, label: surfLabel(id), s: surf(id) })), floorArea: () => G.floorArea(R()), wallCount: () => wallEdges().length, ceilingName: () => G.CEILINGS[R().ceiling?.type || 'flat'], hmax: () => S.hmax,
    safeName, download, bands: AC.BANDS, noteName, colorNames: COLOR_NAMES, defOf,
  };
}

// ===================================================================== top-bar actions & keyboard
const ACTIONS = {
  new: async () => { if (await confirmDialog('New project?', 'Start a blank project? (Your current design is autosaved until you change it.)')) { S.project = newProject(); S.sel = []; buildRoom(); rebuildAllItems(); setView('persp', true); commit(true); renderPanels(); } },
  open: () => pickFile('.json,.roomtone', (txt) => { try { loadProjectData(txt); toast('Project opened'); } catch (e) { toast('Not a valid project file', 'error'); } }, true),
  save: () => { download(`${safeName()}.roomtone.json`, JSON.stringify(P()), 'application/json'); toast('Project file downloaded'); },
  undo, redo,
  scan: () => openScanner(scannerApi(), {}),
  importModel, importUnderlay,
  importPhotoWall: () => openScanner(scannerApi(), { mode: 'upload' }),
  pdf: () => openPdfDialog(exportApi()),
  png: hqRender, pngAll: exportAllViewsPNG, glb: exportGLB, obj: exportOBJ, csv: exportCSV,
  help: () => showHelp(),
  treat: () => { autoTreat('mixing'); S.rightTab = 'acoustics'; renderRightTabs(); },
  snap: () => { S.snap = !S.snap; $('[data-action="snap"]').classList.toggle('active', S.snap); applySnap(); toast(`Snapping ${S.snap ? 'on' : 'off'}`); },
  xray: () => { S.xray = !S.xray; $('[data-action="xray"]').classList.toggle('active', S.xray); buildRoom(); },
  clearMeasure: () => { S.measurements = []; drawMeasurements(); },
  closeDrawers: () => closeDrawers(),
  toggleLeft: () => { document.body.classList.toggle('show-left'); document.body.classList.remove('show-right'); },
  toggleRight: () => { document.body.classList.toggle('show-right'); document.body.classList.remove('show-left'); },
};
function showHelp() {
  const keys = [['V', 'Select'], ['M', 'Move'], ['R', 'Rotate'], ['S', 'Scale'], ['T', 'Tape measure'], ['O', 'Edit room outline (drag corners)'], ['1–6', '3D / Top / Front / Back / Left / Right'], ['7 · 8', 'Quad view · Walkthrough'], ['F / double-click', 'Focus selection'], ['Arrows', 'Nudge 1 cm (Shift = 10 cm)'], ['[ ]', 'Rotate 15°'], ['Ctrl+D', 'Duplicate'], ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Del', 'Delete'], ['/', 'Focus prompt'], ['W A S D Q E', 'Walk (in walkthrough)']];
  modal('How to use RoomTone', h('div', { class: 'help' },
    h('p', {}, 'Design your studio in five steps: 1) set the room size (Room tab or prompt "room 4 x 5 x 2.7"), 2) add a listening position and monitors, 3) add treatment from the Library or press ✨ Auto-treat, 4) check the Acoustics tab, 5) export a PDF.'),
    h('h4', {}, 'Prompt examples (works offline)'), h('div', { class: 'chips' }, PROMPT_EXAMPLES.map((p) => h('code', {}, p))),
    h('h4', {}, 'Keyboard'), h('table', { class: 'tbl' }, keys.map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v)))),
    h('h4', {}, 'Scanning'), h('p', {}, 'Use 📷 Scan to photograph each wall: photos can be mapped onto walls, colours sampled and applied, and art panels printed. For true 3D room scans, export a GLB/OBJ from a LiDAR scanning app (e.g. on an iPhone/iPad Pro) and use Import ▸ 3D model / room scan — the room is sized automatically.'),
    h('h4', {}, 'Offline'), h('p', {}, 'Everything — 3D engine, PDF writer, prompts, analysis — runs in your browser. After the first visit the app is cached and works with no connection; projects autosave to this device.')), [], { wide: true });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action],[data-view],[data-tool],.tab');
  if (!b) { if (!e.target.closest('.menu')) $$('.menu.open').forEach((m) => m.classList.remove('open')); return; }
  if (b.classList.contains('tab')) { if (b.closest('#left')) { S.leftTab = b.dataset.tab; renderLeftTabs(); } else { S.rightTab = b.dataset.tab; renderRightTabs(); } return; }
  if (b.dataset.view) { setView(b.dataset.view); closeDrawers(); }
  if (b.dataset.tool) setTool(b.dataset.tool);
  if (b.dataset.action) { const m = b.closest('.menu'); if (b.dataset.action === 'menu') { $$('.menu.open').forEach((x) => x !== m && x.classList.remove('open')); m.classList.toggle('open'); return; } m?.classList.remove('open'); ACTIONS[b.dataset.action]?.(); }
});
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { if (e.key === 'Escape') e.target.blur(); return; }
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  if (S.view === 'walk' && ['w', 'a', 's', 'd', 'q', 'e', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && !ctrl) { walk.keys.add(k); e.preventDefault(); return; }
  if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && k === 'y') { e.preventDefault(); redo(); return; }
  if (ctrl && k === 'd') { e.preventDefault(); duplicate(); return; }
  if (ctrl && k === 's') { e.preventDefault(); ACTIONS.save(); return; }
  if (ctrl && k === 'a') { e.preventDefault(); select(P().items.map((i) => i.id)); return; }
  if (ctrl) return;
  if (S.tool === 'draw' && S.drawPts) {
    if (k === 'enter') { finishDraw(); return; }
    if (k === 'backspace') { S.drawPts.pop(); drawShapeHandles(); return; }
    if (k === 'escape') { setTool('select'); return; }
  }
  if (k === 'o') { setTool(S.tool === 'shape' ? 'select' : 'shape'); return; }
  if (k === 'delete' || k === 'backspace') { removeItems(selectedItems()); return; }
  if (k === 'escape') { if (S.measureA) { S.measureA = null; measureGroup.children.filter((c) => c.userData.pending).forEach((c) => measureGroup.remove(c)); } else select([]); return; }
  if (k === '/') { e.preventDefault(); $('#prompt').focus(); return; }
  const toolKeys = { v: 'select', m: 'move', r: 'rotate', s: 'scale', t: 'measure', g: 'move' };
  if (toolKeys[k]) return setTool(toolKeys[k]);
  const viewKeys = { 1: 'persp', 2: 'top', 3: 'front', 4: 'back', 5: 'left', 6: 'right', 7: 'quad', 8: 'walk' };
  if (viewKeys[k]) return setView(viewKeys[k]);
  if (k === 'f') return focusSelection();
  if (k === '[' || k === ']') { selectedItems().forEach((it) => updateItem(it, { rot: [it.rot[0], (it.rot[1] + (k === '[' ? 15 : -15) + 360) % 360, it.rot[2]] })); commit(); renderProps(); return; }
  if (k.startsWith('arrow') && S.sel.length) {
    e.preventDefault();
    const st = e.shiftKey ? 0.1 : 0.01;
    // nudge relative to screen in plan, world axes otherwise
    const dv = { arrowleft: [-st, 0, 0], arrowright: [st, 0, 0], arrowup: S.view === 'front' || S.view === 'back' || S.view === 'left' || S.view === 'right' ? [0, st, 0] : [0, 0, -st], arrowdown: S.view === 'front' || S.view === 'back' || S.view === 'left' || S.view === 'right' ? [0, -st, 0] : [0, 0, st] }[k];
    selectedItems().filter((i) => !i.locked).forEach((it) => updateItem(it, { pos: [it.pos[0] + dv[0], Math.max(0, it.pos[1] + dv[1]), it.pos[2] + dv[2]] }));
    clearTimeout(S._nudgeT); S._nudgeT = setTimeout(() => { commit(); renderProps(); }, 400);
    renderStatus();
  }
});
document.addEventListener('keyup', (e) => walk.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => walk.keys.clear());
$$('#walk-pad [data-walk]').forEach((b) => {
  const k = b.dataset.walk;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); walk.keys.add(k); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => walk.keys.delete(k));
});

// prompt bar
const promptEl = $('#prompt');
promptEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { runPromptText(promptEl.value); promptEl.value = ''; } });
$('#prompt-go').addEventListener('click', () => { runPromptText(promptEl.value); promptEl.value = ''; });
$('#prompt-suggest').append(...PROMPT_EXAMPLES.slice(0, 8).map((p) => h('button', { class: 'chip', onclick: () => { promptEl.value = p; promptEl.focus(); } }, p)));
promptEl.addEventListener('focus', () => $('#prompt-bar').classList.add('focus'));
promptEl.addEventListener('blur', () => setTimeout(() => $('#prompt-bar').classList.remove('focus'), 200));
// Voice input where the browser supports offline speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = h('button', { class: 'icon-btn', title: 'Speak a command', html: '🎙' });
  mic.onclick = () => { const r = new SR(); r.lang = navigator.language || 'en-US'; r.onresult = (ev) => { promptEl.value = ev.results[0][0].transcript; runPromptText(promptEl.value); promptEl.value = ''; }; r.onerror = () => toast('Voice input unavailable (may need a connection)', 'error'); r.start(); toast('Listening…'); };
  $('#prompt-go').before(mic);
}

// ===================================================================== boot
async function boot() {
  let restored = false;
  try {
    const saved = await DB.get('autosave');
    if (saved) { const p = JSON.parse(saved); if (p?.room) { S.project = { ...newProject(), ...p }; G.ensureRoom(R()); G.normalizeRoom(R()); restored = true; } }
  } catch { /* first run */ }
  buildRoom();
  await hydrateImported();
  rebuildAllItems();
  onResize();
  setView('persp', true);
  setTool('select');
  renderLibrary(); renderLeftTabs(); renderRightTabs();
  commit(true);
  renderPanels();
  loop();
  if (!restored) { applyTemplate('Home studio'); setTimeout(showWelcome, 300); }
  setTimeout(generateThumbs, 50);
  $('#loading')?.remove();
}
function showWelcome() {
  modal('Welcome to RoomTone Studio Designer', h('div', { class: 'welcome' },
    h('p', {}, 'Plan studios, treatment and aesthetics in 3D — fully offline. We started you with a small home studio.'),
    h('div', { class: 'welcome-grid' },
      h('button', { class: 'wcard', onclick: () => { $('#modal').hidden = true; autoTreat('mixing'); S.rightTab = 'acoustics'; renderRightTabs(); } }, h('b', {}, '✨ Auto-treat it'), h('span', {}, 'Bass traps, reflection panels, cloud & diffusers placed from real acoustics maths')),
      h('button', { class: 'wcard', onclick: () => { $('#modal').hidden = true; S.leftTab = 'room'; renderLeftTabs(); document.body.classList.add('show-left'); } }, h('b', {}, '📐 Set my room size'), h('span', {}, 'Templates for mix rooms, booths, live rooms, podcast & theater')),
      h('button', { class: 'wcard', onclick: () => { $('#modal').hidden = true; openScanner(scannerApi(), {}); } }, h('b', {}, '📷 Scan my room'), h('span', {}, 'Photograph walls, sample colours, or import a LiDAR scan')),
      h('button', { class: 'wcard', onclick: () => { $('#modal').hidden = true; promptEl.focus(); } }, h('b', {}, '💬 Describe it'), h('span', {}, 'Type e.g. “add bass traps in all corners and paint walls navy”'))),
    h('p', { class: 'hint' }, 'Tip: press ? or the Help button any time for shortcuts.')));
}
document.addEventListener('keydown', (e) => { if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) showHelp(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
window.addEventListener('online', () => $('#net').textContent = 'Online');
window.addEventListener('offline', () => $('#net').textContent = 'Offline ✓');
$('#net').textContent = navigator.onLine ? 'Online' : 'Offline ✓';

// expose for debugging / automation
window.roomtone = { S, P, addMany, autoTreat, setView, runPromptText, analysis, renderToDataURL, applyTemplate, select };
boot();
