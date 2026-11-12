// Custom shape builder: pick or draw a 2D profile, extrude or revolve it to exact
// dimensions, choose material / colour / acoustics, preview in 3D, then place it
// or save it to "My Shapes".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PROFILES, LATHES, buildCustom } from './catalog.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function openShapeBuilder(app, { item = null, preset = null } = {}) {
  const { h } = app;
  const base = item || preset || {};
  const st = {
    name: base.name || 'Custom Shape',
    type: base.type || 'custom',
    size: (base.size || [0.8, 0.8, 0.8]).slice(),
    color: base.color || '#b0b4b8', finish: base.finish || 'paint', acoustic: base.acoustic || 'wood_hard',
    params: { op: 'extrude', orient: 'floor', profile: 'polygon', sides: 6, radius: 0.08, bevel: 0, hollow: 0, lathe: 'vase', sweep: 360, points: null, ...(base.params || {}) },
  };
  if (!st.params.points) st.params.points = PROFILES.custom.pts().map((p) => p.slice());
  const P = st.params;

  // ---------------------------------------------------------------- 2D profile editor
  const cv = h('canvas', { width: 300, height: 300, class: 'sb-canvas' });
  const g2 = cv.getContext('2d');
  let drag = -1;
  const isCustom = () => P.op === 'extrude' && P.profile === 'custom';
  const aspect = () => (P.orient === 'wall' ? st.size[1] / st.size[0] : st.size[2] / st.size[0]);
  const frame = () => { const a = aspect(), s = 240; return a >= 1 ? { w: s / a, h: s } : { w: s, h: s * a }; };
  const toPx = ([x, y]) => { const f = frame(); return [150 + x * f.w, 150 - y * f.h]; };
  const fromPx = (px, py) => { const f = frame(); return [clamp((px - 150) / f.w, -0.5, 0.5), clamp(-(py - 150) / f.h, -0.5, 0.5)]; };
  const snap = (v) => Math.round(v * 20) / 20;
  function profilePts() {
    if (P.op === 'revolve') return null;
    if (P.profile === 'custom') return P.points;
    return (PROFILES[P.profile] || PROFILES.rect).pts(P.sides || 6, { params: P });
  }
  function draw2d() {
    g2.fillStyle = '#121418'; g2.fillRect(0, 0, 300, 300);
    g2.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i <= 300; i += 15) { g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 300); g2.stroke(); g2.beginPath(); g2.moveTo(0, i); g2.lineTo(300, i); g2.stroke(); }
    const f = frame();
    g2.strokeStyle = 'rgba(255,181,71,0.5)'; g2.setLineDash([4, 4]); g2.strokeRect(150 - f.w / 2, 150 - f.h / 2, f.w, f.h); g2.setLineDash([]);
    g2.fillStyle = '#9aa3ad'; g2.font = '11px system-ui'; g2.textAlign = 'center';
    g2.fillText(app.fmt(st.size[0]), 150, 150 + f.h / 2 + 14);
    g2.save(); g2.translate(150 - f.w / 2 - 10, 150); g2.rotate(-Math.PI / 2); g2.fillText(app.fmt(P.orient === 'wall' || P.op === 'revolve' ? st.size[1] : st.size[2]), 0, 0); g2.restore();
    if (P.op === 'revolve') {
      const L = LATHES[P.lathe] || LATHES.cylinder;
      g2.strokeStyle = 'rgba(255,255,255,0.25)'; g2.setLineDash([3, 3]); g2.beginPath(); g2.moveTo(150, 20); g2.lineTo(150, 280); g2.stroke(); g2.setLineDash([]);
      for (const side of [1, -1]) {
        g2.beginPath();
        L.pts.forEach(([r, y], i) => { const x = 150 + side * r * (f.w / 2), yy = 150 + f.h / 2 - y * f.h; i ? g2.lineTo(x, yy) : g2.moveTo(x, yy); });
        g2.strokeStyle = side > 0 ? '#35c4b5' : 'rgba(53,196,181,0.35)'; g2.lineWidth = 2; g2.stroke(); g2.lineWidth = 1;
      }
      g2.fillStyle = '#9aa3ad'; g2.fillText('Revolved around the dashed axis', 150, 292);
      return;
    }
    const pts = profilePts();
    g2.beginPath(); pts.forEach((p, i) => { const [x, y] = toPx(p); i ? g2.lineTo(x, y) : g2.moveTo(x, y); }); g2.closePath();
    g2.fillStyle = 'rgba(53,196,181,0.18)'; g2.fill(); g2.strokeStyle = '#35c4b5'; g2.lineWidth = 2; g2.stroke(); g2.lineWidth = 1;
    if (isCustom()) {
      pts.forEach((p, i) => { const [x, y] = toPx(p); g2.fillStyle = i === drag ? '#fff' : '#ffb547'; g2.beginPath(); g2.arc(x, y, 5, 0, 7); g2.fill(); });
      g2.fillStyle = '#9aa3ad'; g2.fillText('Click to add · drag to move · double-click to delete', 150, 292);
    }
  }
  const evPt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 300, ((e.clientY - r.top) / r.height) * 300]; };
  const nearest = (px, py) => P.points.findIndex((p) => { const [x, y] = toPx(p); return Math.hypot(x - px, y - py) < 9; });
  cv.addEventListener('pointerdown', (e) => {
    if (!isCustom()) return;
    const [px, py] = evPt(e), i = nearest(px, py);
    if (i >= 0) { drag = i; cv.setPointerCapture(e.pointerId); return; }
    // insert the new point into the closest edge so the outline stays tidy
    const p = fromPx(px, py).map(snap);
    let best = P.points.length, bd = Infinity;
    P.points.forEach((a, k) => { const b = P.points[(k + 1) % P.points.length]; const d = segDist(p, a, b); if (d < bd) { bd = d; best = k + 1; } });
    P.points.splice(best, 0, p); drag = best; cv.setPointerCapture(e.pointerId); update();
  });
  cv.addEventListener('pointermove', (e) => { if (drag < 0) return; const [px, py] = evPt(e); P.points[drag] = fromPx(px, py).map(snap); update(false); });
  cv.addEventListener('pointerup', () => { if (drag >= 0) { drag = -1; update(); } });
  cv.addEventListener('dblclick', (e) => { if (!isCustom()) return; const [px, py] = evPt(e), i = nearest(px, py); if (i >= 0 && P.points.length > 3) { P.points.splice(i, 1); update(); } });

  // ---------------------------------------------------------------- 3D preview
  const pv = h('canvas', { class: 'sb-preview' });
  const r3 = new THREE.WebGLRenderer({ canvas: pv, antialias: true, alpha: true });
  r3.setPixelRatio(Math.min(2, window.devicePixelRatio)); r3.setSize(320, 260, false);
  r3.outputColorSpace = THREE.SRGBColorSpace; r3.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(r3);
  sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  sc.add(new THREE.HemisphereLight('#fff', '#555', 1.1));
  const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(2, 4, 3); sc.add(dl);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 1 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
  const cam = new THREE.PerspectiveCamera(35, 320 / 260, 0.01, 100);
  let obj = null, ang = 0.6, alive = true, dragging = null;
  pv.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, a: ang }; pv.setPointerCapture(e.pointerId); });
  pv.addEventListener('pointermove', (e) => { if (dragging) ang = dragging.a - (e.clientX - dragging.x) * 0.01; });
  pv.addEventListener('pointerup', () => (dragging = null));
  function rebuild3d() {
    if (obj) sc.remove(obj);
    try { obj = buildCustom({ ...st, pos: [0, 0, 0], rot: [0, 0, 0], params: { ...P } }); } catch (err) { console.error(err); obj = new THREE.Group(); }
    sc.add(obj);
  }
  (function spin() {
    if (!alive) return;
    requestAnimationFrame(spin);
    if (!dragging) ang += 0.006;
    const r = Math.max(...st.size) * 1.9 + 0.3;
    cam.position.set(Math.sin(ang) * r, st.size[1] * 0.6 + r * 0.45, Math.cos(ang) * r); cam.lookAt(0, st.size[1] / 2, 0);
    r3.render(sc, cam);
  })();

  // ---------------------------------------------------------------- form
  const presetRow = h('div', { class: 'sb-presets' });
  const optsBox = h('div', { class: 'sb-opts' });
  function drawPresets() {
    presetRow.innerHTML = '';
    const list = P.op === 'revolve' ? Object.entries(LATHES) : Object.entries(PROFILES);
    for (const [k, v] of list) {
      const active = P.op === 'revolve' ? P.lathe === k : P.profile === k;
      presetRow.append(h('button', { class: 'pal-tab' + (active ? ' active' : ''), onclick: () => { if (P.op === 'revolve') P.lathe = k; else P.profile = k; update(); drawForm(); } }, v.label));
    }
  }
  function drawForm() {
    optsBox.innerHTML = '';
    const num = (label, val, set, o = {}) => app.numField(label, val, (v) => { set(v); update(); drawForm(); }, o);
    const rows = [
      h('label', { class: 'field' }, h('span', {}, 'Name'), h('input', { value: st.name, onchange: (e) => (st.name = e.target.value) })),
      h('div', { class: 'grid2' },
        app.selectField('Operation', P.op, [['extrude', 'Extrude (profile → solid)'], ['revolve', 'Revolve (lathe)']], (v) => { P.op = v; update(); drawPresets(); drawForm(); }),
        app.selectField('Placement', st.type, [['custom', 'Free-standing / floor'], ['customWall', 'Wall-mounted'], ['customCeiling', 'Hanging from ceiling']], (v) => { st.type = v; if (v === 'customWall') P.orient = 'wall'; if (v === 'customCeiling') P.orient = 'floor'; update(); drawForm(); })),
      P.op === 'extrude' ? app.selectField('Profile is drawn in', P.orient, [['wall', 'Front view (upright, extruded toward you)'], ['floor', 'Plan view (flat, extruded upward)']], (v) => { P.orient = v; update(); drawForm(); }) : null,
      h('div', { class: 'grid3' },
        num('Width', st.size[0], (v) => (st.size[0] = Math.max(0.01, v)), { min: 0.01 }),
        num('Height', st.size[1], (v) => (st.size[1] = Math.max(0.005, v)), { min: 0.005 }),
        num('Depth', st.size[2], (v) => (st.size[2] = Math.max(0.005, v)), { min: 0.005 })),
      P.op === 'extrude' && (PROFILES[P.profile]?.sides) ? num(P.profile === 'star' ? 'Points' : 'Sides', P.sides || 6, (v) => (P.sides = clamp(Math.round(v), 3, 64)), { unit: false, step: 1 }) : null,
      P.op === 'extrude' && PROFILES[P.profile]?.round ? num('Corner radius', P.radius ?? 0.08, (v) => (P.radius = Math.max(0, v))) : null,
      P.op === 'extrude' ? h('div', { class: 'grid2' }, num('Edge bevel', P.bevel || 0, (v) => (P.bevel = Math.max(0, v))), num('Frame (hollow) width', P.hollow || 0, (v) => (P.hollow = Math.max(0, v)))) : null,
      P.op === 'revolve' ? num('Sweep angle (°)', P.sweep ?? 360, (v) => (P.sweep = clamp(v, 10, 360)), { unit: false, step: 5 }) : null,
      isCustom() ? h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small', onclick: () => { P.points = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]; update(); } }, 'Reset to square'),
        h('button', { class: 'btn small', onclick: () => { P.points = P.points.map(([x, y]) => [-x, y]).reverse(); update(); } }, 'Mirror'),
        h('button', { class: 'btn small', onclick: () => { const n = P.points.length; const out = []; for (let i = 0; i < n; i++) { const a = P.points[i], b = P.points[(i + 1) % n]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } P.points = out; update(); } }, 'Smooth')) : null,
      app.materialField('Material', st.finish, st.color, ({ finish, color }) => { st.finish = finish; if (color) st.color = color; update(); drawForm(); }),
      app.colorField('Colour', st.color, (c) => { st.color = c; rebuild3d(); }),
      app.selectField('Acoustic behaviour', st.acoustic, app.acousticOptions(), (v) => (st.acoustic = v)),
    ];
    optsBox.append(...rows.filter(Boolean));
  }
  function update(full = true) { draw2d(); if (full) rebuild3d(); else rebuild3d(); }

  const save = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !item }), ' Also save to “My Shapes” in the library');
  const body = h('div', { class: 'shape-builder' },
    h('div', { class: 'sb-left' }, presetRow, cv),
    h('div', { class: 'sb-right' }, pv, h('p', { class: 'hint' }, 'Drag the preview to rotate.'), optsBox, save));
  const m = app.modal(item ? 'Edit custom shape' : 'Shape builder', body, [
    { label: 'Cancel' },
    {
      label: item ? 'Update shape' : 'Create & place', primary: true,
      onClick: () => {
        const out = JSON.parse(JSON.stringify({ name: st.name, type: st.type, size: st.size, color: st.color, finish: st.finish, acoustic: st.acoustic, params: P }));
        if (save.querySelector('input').checked) app.saveMyShape(out);
        if (item) app.onUpdate(item, out); else app.onCreate(out);
      },
    },
  ], { wide: true });
  m.el.addEventListener('closed', () => { alive = false; r3.dispose(); pm.dispose(); }, { once: true });
  drawPresets(); drawForm(); update();
}

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1);
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}
