// "Pro" workflow features: Studio Score with one-click fixes, design wizard,
// cost estimate / bill of quantities, design options compare, CAD interchange
// (DXF / SVG), single-file sharing and an AI-render hand-off pack.
import { SMAT, LAYER_GROUP } from './studiomaterials.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const std = (a) => { if (!a.length) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

// ================================================================= Studio Score
export function computeScore(app) {
  const A = app.analysis(), D = app.modeData(), iso = app.isolationData().filter((r) => r.layers.length), corners = app.cornerStats();
  const parts = [];
  const add = (key, label, weight, score, detail, fix) => parts.push({ key, label, weight, score: score == null ? null : Math.round(clamp(score, 0, 100)), detail, fix });
  // low-frequency smoothness at the listening position
  const lf = D.resp.filter((_, i) => D.fs[i] >= 30 && D.fs[i] <= 150), sd = std(lf);
  add('lf', 'Bass response at the mix position', 20, (100 * (12 - sd)) / 8, `±${sd.toFixed(1)} dB (30–150 Hz, simulated)`, sd > 5 ? { label: 'Add tuned bass treatment', run: () => app.addRecommended(D.rep) } : null);
  // decay time
  const r = A.rt.mid / A.rt.target, s1 = 100 - clamp(Math.abs(Math.log2(r)) * 100, 0, 100);
  const b = A.rt.bands.slice(1).map((x) => x.sabine), even = 100 - clamp((Math.max(...b) / Math.min(...b) - 1.3) * 80, 0, 100);
  add('rt', 'Reverberation time', 20, 0.7 * s1 + 0.3 * even, `${A.rt.mid.toFixed(2)} s (target ≈ ${A.rt.target.toFixed(2)} s)`, r > 1.4 ? { label: 'Auto-treat for mixing', run: () => app.autoTreat('mixing') } : r < 0.6 ? { label: 'Open acoustics (room is over-damped)', run: () => app.showAcoustics() } : null);
  // first reflections
  const pts = A.refl.map((p, i) => ({ p, t: A.treated[i] })).filter((x) => ['left', 'right', 'ceiling'].includes(x.p.side));
  add('refl', 'First reflections treated', 15, pts.length ? (100 * pts.filter((x) => x.t).length) / pts.length : A.sp.length ? 100 : 0, pts.length ? `${pts.filter((x) => x.t).length} of ${pts.length} points` : 'No speakers / listening position yet', !A.sp.length ? { label: 'Set up listening position', run: () => app.setupListening() } : pts.some((x) => !x.t) ? { label: 'Treat reflection points', run: () => app.treatReflections() } : null);
  // geometry
  let g = A.tri ? 100 : 0, gd = 'Add a listening position and two monitors';
  if (A.tri) {
    const frac = (A.E[2] + app.room().d / 2) / app.room().d;
    g -= Math.min(40, Math.abs(A.tri.angle - 60) * 3) + Math.min(30, Math.abs(A.tri.dl - A.tri.dr) * 200) + Math.min(25, Math.abs(frac - 0.38) * 120) + Math.min(25, Math.abs(A.E[0]) * 80);
    gd = `${A.tri.angle.toFixed(0)}° triangle · seat at ${(frac * 100).toFixed(0)} % of length`;
  }
  add('geo', 'Speaker / listener geometry', 15, g, gd, g < 80 ? { label: A.tri ? 'Snap to 38 % + equilateral' : 'Set up listening position', run: () => (A.tri ? app.snapListening() : app.setupListening()) } : null);
  // modes
  const coinc = D.rep.issues.filter((i) => i.kind === 'coincident' && i.f < 200).length;
  add('modes', 'Room proportions & modes', 10, 100 - (D.rep.bon.pass ? 0 : 25) - (D.rep.bolt.inBolt ? 0 : 25) - Math.min(40, coinc * 12), `Bonello ${D.rep.bon.pass ? 'pass' : 'fail'} · Bolt ${D.rep.bolt.inBolt ? 'inside' : 'outside'} · ${coinc} coincident mode(s) < 200 Hz`, coinc || !D.rep.bolt.inBolt ? { label: 'Open mode calculator', run: () => app.openModes('ratios') } : null);
  // bass trapping
  const lfRT = (D.t63 + D.t125) / 2, lfScore = 100 - clamp((lfRT / Math.max(A.rt.mid, 0.15) - 1.3) * 80, 0, 100);
  add('bass', 'Bass trapping', 10, (corners.convex ? (60 * Math.min(corners.trapped, 4)) / Math.min(corners.convex, 4) : 0) + 0.4 * lfScore, `${corners.trapped} of ${corners.convex} corners trapped · LF decay ${lfRT.toFixed(2)} s`, corners.trapped < Math.min(4, corners.convex) ? { label: 'Add corner bass traps', run: () => app.addCornerTraps() } : null);
  // isolation
  if (iso.length) { const min = Math.min(...iso.map((x) => x.comp)); add('iso', 'Sound isolation', 10, ((min - 30) / 35) * 100, `weakest element ≈ ${min.toFixed(0)} dB (${iso.reduce((a, x) => (x.comp < a.comp ? x : a)).label})`, min < 50 ? { label: 'Apply room-in-room construction', run: () => app.applyConstructionSet('pro') } : null); }
  else add('iso', 'Sound isolation', 10, null, 'No construction build-ups defined (not scored)', { label: 'Apply home-studio construction', run: () => app.applyConstructionSet('home') });
  const scored = parts.filter((p) => p.score != null), W = scored.reduce((a, p) => a + p.weight, 0);
  const total = Math.round(scored.reduce((a, p) => a + p.score * p.weight, 0) / (W || 1));
  return { total, parts, grade: total >= 85 ? 'Excellent' : total >= 70 ? 'Good' : total >= 50 ? 'Fair' : 'Needs work' };
}
export function openScore(app) {
  const { h } = app;
  const body = h('div', { class: 'score-modal' });
  let m;
  const draw = () => {
    const sc = computeScore(app);
    app.onScore?.(sc);
    body.innerHTML = '';
    const col = (v) => (v == null ? 'var(--faint)' : v >= 80 ? 'var(--green)' : v >= 55 ? 'var(--amber)' : 'var(--red)');
    body.append(
      h('div', { class: 'score-top' },
        h('div', { class: 'score-ring', style: { '--v': sc.total, '--c': col(sc.total) } }, h('b', {}, sc.total), h('small', {}, sc.grade)),
        h('div', {}, h('h3', {}, 'Studio Score'), h('p', { class: 'hint' }, 'One number for how well this room should work as a critical-listening space — from the same physics as the Acoustics and Modes panels. Fix the lowest bars first.'),
          h('button', { class: 'btn primary', onclick: () => { let n = 0; for (const p of computeScore(app).parts) if (p.fix && (p.score ?? 0) < 70 && p.key !== 'modes') { p.fix.run(); n++; } app.toast(n ? `Applied ${n} fixes` : 'Nothing urgent to fix', 'ok'); draw(); } }, '⚡ Fix everything below 70'))),
      ...sc.parts.map((p) => h('div', { class: 'score-row' },
        h('div', { class: 'score-lab' }, h('b', {}, p.label), h('small', {}, p.detail)),
        h('div', { class: 'score-bar' }, h('i', { style: { width: `${p.score ?? 0}%`, background: col(p.score) } })),
        h('span', { class: 'score-num' }, p.score == null ? '—' : p.score),
        p.fix ? h('button', { class: 'btn small', onclick: () => { p.fix.run(); if (p.key === 'modes') m.close(); else draw(); } }, p.fix.label) : h('span', { class: 'ok-t' }, '✓'))));
  };
  m = app.modal('Studio Score', body, [], { wide: true });
  draw();
}

// ================================================================= cost estimate
const ITEM_PRICES = { absorber: 90, absorber50: 60, framedPanel: 140, artPanel: 120, foam: 15, feltTiles: 45, curtain: 180, gobo: 350, rug: 200, cornerTrap: 180, cornerTrapCeil: 160, bassPanel: 150, membrane: 260, tubeTrap: 300, helmholtz: 240, qrd: 320, skyline: 220, poly: 260, bad: 240, bookshelf: 250, slats: 120, slatResonator: 420, reflector: 120, redirector: 380, cloud: 260, baffle: 90, ceilDiffuser: 260, ceilTile: 180, canopy: 520, desk: 900, console: 15000, chair: 350, stool: 90, sofa: 900, table: 180, rack: 300, stand: 120, listener: 0, monitor: 400, midfield: 1500, mains: 6000, sub: 700, screen: 300, tv: 700, pc: 1500, keyboard: 900, piano: 4500, drums: 1800, amp: 800, guitar: 900, mic: 450, ledPanel: 70, downlight: 25, pendant: 120, trackLight: 160, ledStrip: 40, lightBar: 90, floorLamp: 110, sconce: 80, neon: 150, door: 1200, doubleDoor: 2200, window: 1400, skylightWin: 2500, opening: 0, partition: 600, glassWall: 1800, cladding: 400, mirror: 150, soffit: 1500, column: 300, riser: 500, booth: 4500, stairs: 300, plant: 60, floatingFloor: 900, studFrame: 220, isoClipItem: 7, channelRun: 8, hangerItem: 35, isoPadItem: 6, sheet: 20, custom: 150, customWall: 90, customCeiling: 180, note: 0, imported: 0 };
const SCALE_BY_AREA = new Set(['absorber', 'absorber50', 'framedPanel', 'artPanel', 'foam', 'feltTiles', 'curtain', 'rug', 'bassPanel', 'membrane', 'helmholtz', 'qrd', 'skyline', 'poly', 'bad', 'slats', 'slatResonator', 'reflector', 'redirector', 'cloud', 'baffle', 'ceilTile', 'canopy', 'partition', 'glassWall', 'cladding', 'mirror', 'floatingFloor', 'studFrame', 'window', 'skylightWin', 'customWall', 'customCeiling', 'riser']);
// [price, unit] — unit: m2 | m | each | tube
const MAT_PRICES = { gyp12: [6, 'm2'], gyp15: [8, 'm2'], gypX: [9, 'm2'], gypSound: [14, 'm2'], gypDamped: [45, 'm2'], cementBoard: [16, 'm2'], fibreGyp: [15, 'm2'], osb18: [11, 'm2'], ply12: [14, 'm2'], ply18: [20, 'm2'], mdf18: [14, 'm2'], particle18: [9, 'm2'], clt100: [120, 'm2'], mlv5: [22, 'm2'], mlv10: [38, 'm2'], leadSheet: [90, 'm2'], concrete150: [45, 'm2'], concrete200: [60, 'm2'], blockDense: [55, 'm2'], blockHollow: [40, 'm2'], brick215: [95, 'm2'], brick102: [55, 'm2'], aac: [35, 'm2'], screed: [25, 'm2'], timberFloor: [0, 'm2'], damping: [12, 'm2'], dampTape: [4, 'm2'], cldSheet: [30, 'm2'], isoClip: [7, 'each'], hatChannel: [2.5, 'm'], rc: [2, 'm'], woodChannel: [1.5, 'm'], isoHanger: [12, 'each'], springHanger: [35, 'each'], isoPad: [6, 'each'], springMount: [60, 'each'], elastomerStrip: [9, 'm'], stud2x4: [3, 'm'], stud2x6: [4.5, 'm'], steelStud70: [3.2, 'm'], steelStud92: [3.8, 'm'], staggered: [3, 'm'], doubleStud: [3, 'm'], joist195: [7, 'm'], sleeper70: [2.5, 'm'], steelJoist: [8, 'm'], airGap: [0, 'm2'], mw40: [6, 'm2'], mw60: [9, 'm2'], mw100: [12, 'm2'], glassWool: [4, 'm2'], rigidFG48: [14, 'm2'], rigidFG96: [22, 'm2'], polyBatt: [8, 'm2'], cellulose: [5, 'm2'], woodFibre: [16, 'm2'], cottonBatt: [10, 'm2'], sealant: [9, 'tube'], perimeterStrip: [2, 'm'], puttyPad: [6, 'each'], backerRod: [0.5, 'm'], rubberUnderlay10: [18, 'm2'], corkUnderlay: [9, 'm2'], foamUnderlay: [3, 'm2'], hardwood20: [70, 'm2'], engineered14: [55, 'm2'], rubberFloor: [40, 'm2'], carpetPad: [35, 'm2'], float6: [45, 'm2'], lam68: [110, 'm2'], lam108: [160, 'm2'], float10: [80, 'm2'], melamine50: [45, 'm2'], puFoam50: [20, 'm2'], woodWool25: [35, 'm2'], petFelt12: [30, 'm2'], perfMDF: [70, 'm2'], acPlaster: [150, 'm2'], stretchFabric: [90, 'm2'], acFabric: [18, 'm2'], mineralTile: [20, 'm2'], paintFinish: [4, 'm2'], veneer: [60, 'm2'], tileFinish: [45, 'm2'] };
const UNIT_LABEL = { m2: 'm²', m: 'm', each: 'pcs', tube: 'tubes' };

export function costSettings() { try { return { currency: '$', waste: 10, labour: 35, contingency: 10, budget: 0, prices: {}, ...JSON.parse(localStorage.getItem('rt.cost') || '{}') }; } catch { return { currency: '$', waste: 10, labour: 35, contingency: 10, budget: 0, prices: {} }; } }
function saveCost(s) { try { localStorage.setItem('rt.cost', JSON.stringify(s)); } catch { /* ignore */ } }

export function costData(app) {
  const set = costSettings(), rows = [], waste = 1 + set.waste / 100;
  const price = (key, def) => (set.prices[key] != null ? set.prices[key] : def);
  // placed items
  for (const r of app.scheduleRows()) {
    const def = app.defByName(r.name), type = def?.type;
    let unit = ITEM_PRICES[type] ?? 100;
    if (def && SCALE_BY_AREA.has(type)) { const a0 = def.size[0] * (def.mount === 'ceiling' || type === 'rug' || type === 'floatingFloor' || type === 'riser' ? def.size[2] : def.size[1]) || 1, a = r.size[0] * (def.mount === 'ceiling' || type === 'rug' || type === 'floatingFloor' || type === 'riser' ? r.size[2] : r.size[1]); unit = Math.round(unit * clamp(a / a0, 0.25, 8)); }
    const key = 'item:' + type + ':' + r.size.map((v) => v.toFixed(2)).join('x');
    const group = ['Absorption', 'Bass Control', 'Diffusion', 'Reflection Control', 'Ceiling'].includes(r.cat) ? 'Acoustic treatment' : r.cat === 'Lighting' ? 'Lighting' : ['Doors & Windows', 'Walls & Glass', 'Architecture', 'Construction & Isolation'].includes(r.cat) ? 'Doors, glass & built items' : 'Furniture & equipment';
    rows.push({ key, group, name: `${r.name} (${r.size.map((v) => (v * 100).toFixed(0)).join('×')} cm)`, qty: r.qty, unit: 'each', price: price(key, unit) });
  }
  // construction build-ups → quantities
  const acc = new Map();
  const put = (mat, qty, unit) => { if (!(qty > 0)) return; const k = mat + '|' + unit; const e = acc.get(k) || { mat, unit, qty: 0 }; e.qty += qty; acc.set(k, e); };
  for (const r of app.isolationData()) {
    if (!r.layers.length) continue;
    const area = app.surfaceArea(r.id), e = app.edgeOf(r.id), len = e ? e.len : Math.sqrt(area), hgt = e ? area / Math.max(len, 0.1) : Math.sqrt(area);
    for (const L of r.layers) {
      const m = SMAT[L.mat]; if (!m) continue;
      const s = L.s ?? m.s ?? 0.6, [, unit] = MAT_PRICES[L.mat] || [0, 'm2'];
      if (['board', 'masonry', 'membrane', 'glazing', 'insulation', 'damping', 'underlay', 'finish'].includes(m.kind)) put(L.mat, area * waste * (unit === 'm2' && m.t && ['insulation', 'masonry'].includes(m.kind) ? (L.t ?? m.t) / m.t : 1), 'm2');
      else if (m.kind === 'studs' || m.kind === 'joists') put(L.mat, ((Math.ceil(len / s) + 1) * hgt + 3 * len) * waste * (m.stagger ? 1 : 1), 'm');
      else if (m.kind === 'channel' || m.kind === 'battens') put(L.mat, Math.ceil(hgt / (m.kind === 'battens' ? 0.4 : 0.6)) * len * waste, 'm');
      else if (m.kind === 'clips') { const rows2 = Math.ceil(hgt / 0.6); put(L.mat, Math.ceil(rows2 * (len / s + 1)), 'each'); put('hatChannel', rows2 * len * waste, 'm'); }
      else if (m.kind === 'hangers') { put(L.mat, Math.ceil(area / (1.2 * s)), 'each'); put('hatChannel', (area / s) * waste, 'm'); }
      else if (m.kind === 'pads' || m.kind === 'springs') put(L.mat, Math.ceil(area / (s * s)), unit === 'm' ? 'm' : 'each');
      else if (m.kind === 'sealant') put(L.mat, unit === 'tube' ? Math.ceil((2 * (len + hgt)) / 6) : 2 * (len + hgt), unit);
    }
    // every boarded surface needs perimeter sealant even if not listed
    if (!r.layers.some((L) => SMAT[L.mat]?.kind === 'sealant')) put('sealant', Math.ceil((2 * (len + hgt)) / 6), 'tube');
  }
  for (const e of acc.values()) {
    const m = SMAT[e.mat], [def] = MAT_PRICES[e.mat] || [0];
    rows.push({ key: 'mat:' + e.mat, group: 'Construction materials', name: m.name, qty: +e.qty.toFixed(e.unit === 'each' || e.unit === 'tube' ? 0 : 1), unit: e.unit, price: price('mat:' + e.mat, def), layer: LAYER_GROUP[m.kind] });
  }
  for (const r of rows) r.total = r.qty * r.price;
  const groups = {};
  for (const r of rows) groups[r.group] = (groups[r.group] || 0) + r.total;
  const materials = rows.reduce((a, r) => a + r.total, 0);
  const labour = ((groups['Construction materials'] || 0) + (groups['Acoustic treatment'] || 0) * 0.3) * (set.labour / 100);
  const contingency = (materials + labour) * (set.contingency / 100);
  return { rows, groups, materials, labour, contingency, total: materials + labour + contingency, set };
}
const money = (v, c) => `${c}${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(v < 10 && v % 1 ? 2 : 0)}`;
export function openCost(app) {
  const { h } = app, body = h('div', { class: 'cost-modal' });
  const draw = () => {
    const C = costData(app), s = C.set;
    body.innerHTML = '';
    const num = (label, key, step = 1, w = 70) => { const i = h('input', { type: 'number', step, value: s[key], style: { width: w + 'px' } }); i.onchange = () => { s[key] = +i.value || 0; saveCost(s); draw(); app.onCost?.(); }; return h('label', { class: 'field inline' }, h('span', {}, label), i); };
    const cur = h('input', { value: s.currency, style: { width: '46px' }, maxlength: 4 }); cur.onchange = () => { s.currency = cur.value || '$'; saveCost(s); draw(); };
    const over = s.budget > 0 ? C.total - s.budget : 0;
    body.append(
      h('div', { class: 'kpis cost-kpis' },
        ...Object.entries(C.groups).map(([g, v]) => kpiEl(h, g, money(v, s.currency), '')),
        kpiEl(h, 'Labour (est.)', money(C.labour, s.currency), `${s.labour}% of construction`), kpiEl(h, 'Contingency', money(C.contingency, s.currency), `${s.contingency}%`),
        kpiEl(h, 'TOTAL', money(C.total, s.currency), s.budget > 0 ? (over > 0 ? `${money(over, s.currency)} over budget` : `${money(-over, s.currency)} under budget`) : 'set a budget →', s.budget > 0 ? (over > 0 ? 'bad' : 'good') : '')),
      h('div', { class: 'row gap wrap' }, h('label', { class: 'field inline' }, h('span', {}, 'Currency'), cur), num('Budget', 'budget', 100, 100), num('Waste %', 'waste'), num('Labour %', 'labour'), num('Contingency %', 'contingency'),
        h('button', { class: 'btn small', onclick: () => exportCostCSV(app) }, '⤓ CSV'), h('button', { class: 'btn small ghost', onclick: () => { s.prices = {}; saveCost(s); draw(); } }, 'Reset prices')),
      h('p', { class: 'hint' }, 'Unit prices are rough placeholders — type your local prices into the table (they are remembered on this device). Quantities come from the model: board and insulation areas (+ waste), stud / channel lengths, clip, hanger and pad counts, sealant tubes.'),
      h('div', { class: 'mc-table-wrap' }, h('table', { class: 'tbl cost-tbl' }, h('tr', {}, ['Group', 'Item', 'Qty', 'Unit', 'Unit price', 'Total'].map((t) => h('th', {}, t))),
        C.rows.sort((a, b) => a.group.localeCompare(b.group) || b.total - a.total).map((r) => { const i = h('input', { type: 'number', step: 0.5, value: r.price }); i.onchange = () => { s.prices[r.key] = +i.value || 0; saveCost(s); draw(); app.onCost?.(); };
          return h('tr', {}, h('td', {}, r.group), h('td', {}, r.name), h('td', {}, r.qty), h('td', {}, UNIT_LABEL[r.unit] || r.unit), h('td', {}, i), h('td', {}, h('b', {}, money(r.total, s.currency)))); }))));
  };
  app.modal('Cost estimate & bill of quantities', body, [], { wide: true, xwide: true });
  draw();
}
const kpiEl = (h, l, v, s, lvl = '') => h('div', { class: 'kpi ' + lvl }, h('small', {}, l), h('b', {}, v), h('span', {}, s));
export function exportCostCSV(app) {
  const C = costData(app), esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['Group', 'Item', 'Qty', 'Unit', 'Unit price', 'Total'].map(esc).join(',')];
  for (const r of C.rows) lines.push([r.group, r.name, r.qty, r.unit, r.price, r.total.toFixed(2)].map(esc).join(','));
  lines.push(['', 'Labour (est.)', '', '', '', C.labour.toFixed(2)].map(esc).join(','), ['', 'Contingency', '', '', '', C.contingency.toFixed(2)].map(esc).join(','), ['', 'TOTAL', '', '', '', C.total.toFixed(2)].map(esc).join(','));
  app.download(`${app.safeName()}-cost.csv`, lines.join('\n'), 'text/csv');
}

// ================================================================= design wizard
export function openWizard(app) {
  const { h } = app, r = app.room(), ft = app.units() === 'ft', k = ft ? 0.3048 : 1;
  const b = { purpose: 'mixing', keep: false, w: r.w, d: r.d, h: r.h, shape: 'rect', ceiling: 'flat', isolation: 'home', level: 'standard', scheme: 'Classic dark control room', light: 'warm', furniture: true };
  const sel = (label, key, opts) => app.selectField(label, b[key], opts, (v) => { b[key] = v; });
  const num = (label, key) => { const i = h('input', { type: 'number', step: 0.05, value: +(b[key] / k).toFixed(2) }); i.onchange = () => (b[key] = (+i.value || 1) * k); return h('label', { class: 'field' }, h('span', {}, `${label} (${ft ? 'ft' : 'm'})`), i); };
  const body = h('div', { class: 'wizard' },
    h('p', {}, 'Answer a few questions and RoomTone builds a complete starting design — room, listening position, treatment at the calculated reflection points, tuned bass traps, construction build-ups, colours and lighting. Everything stays editable.'),
    h('div', { class: 'grid2' },
      sel('What is the room for?', 'purpose', [['mixing', 'Mixing / production'], ['mastering', 'Mastering'], ['tracking', 'Tracking / live room'], ['podcast', 'Podcast / voice-over'], ['booth', 'Vocal booth'], ['theater', 'Home theater / listening room']]),
      sel('Budget level', 'level', [['lean', 'Lean — essentials only'], ['standard', 'Standard'], ['premium', 'Premium — diffusion, slats, feature lighting']])),
    h('div', { class: 'grid3' }, num('Width', 'w'), num('Length', 'd'), num('Height', 'h')),
    h('div', { class: 'grid2' },
      sel('Room shape', 'shape', [['rect', 'Rectangle'], ['splayed', 'Splayed control room'], ['trapezoid', 'Trapezoid'], ['angled', 'Angled corner'], ['lshape', 'L-shape'], ['octagon', 'Octagon']]),
      sel('Ceiling', 'ceiling', [['flat', 'Flat'], ['shed', 'Sloped (rising to the back)'], ['gable', 'Pitched'], ['vault', 'Vaulted']])),
    h('div', { class: 'grid2' },
      sel('Sound isolation', 'isolation', [['none', 'None — treatment only'], ['home', 'Home studio (clips, double drywall, floating deck)'], ['pro', 'Professional (room-in-room, floating floor, hung ceiling)']]),
      sel('Colour scheme', 'scheme', app.schemeNames().map((n) => [n, n]))),
    h('div', { class: 'grid2' },
      sel('Lighting mood', 'light', [['warm', 'Warm white'], ['cool', 'Neutral / daylight'], ['rgb', 'Coloured accent (RGB)']]),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => (b.furniture = e.target.checked) }), ' Add furniture & gear')));
  app.modal('✨ Design wizard — brief to design', body, [{ label: 'Cancel' }, { label: 'Generate design', primary: true, onClick: () => { setTimeout(() => { app.buildFromBrief(b); const sc = computeScore(app); app.onScore?.(sc); app.toast(`Design generated — Studio Score ${sc.total} (${sc.grade})`, 'ok'); }, 30); } }], { wide: true });
}

// ================================================================= design options (A/B compare)
export function openOptions(app) {
  const { h } = app, body = h('div', { class: 'options-modal' });
  const draw = () => {
    const list = app.options();
    body.innerHTML = '';
    body.append(
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn primary', onclick: async () => { const name = await app.ask('Save design option', 'Name this option', `Option ${String.fromCharCode(65 + list.length)}`); if (name) { app.saveOption(name); draw(); } } }, '＋ Save current design as an option'),
        h('span', { class: 'hint' }, 'Options are full snapshots of the design. Try alternatives, then compare score, acoustics, isolation and cost side by side.')),
      list.length ? h('div', { class: 'opt-grid' }, list.map((o) => h('div', { class: 'opt-card' + (o.id === app.currentOption() ? ' sel' : '') },
        h('img', { src: o.thumb || '' }), h('b', {}, o.name),
        h('table', { class: 'tbl' },
          [['Studio Score', o.m.score, 'hi'], ['RT60 (mid)', o.m.rt.toFixed(2) + ' s', ''], ['Bass ±dB', o.m.lf.toFixed(1), 'lo'], ['Weakest isolation', o.m.iso ? o.m.iso.toFixed(0) + ' dB' : '—', 'hi'], ['Items', o.m.items, ''], ['Est. cost', money(o.m.cost, costSettings().currency), 'lo']].map(([k, v, dir]) => {
            const vals = list.map((x) => ({ 'Studio Score': x.m.score, 'Bass ±dB': x.m.lf, 'Weakest isolation': x.m.iso || 0, 'Est. cost': x.m.cost })[k]).filter((x) => x != null);
            const mine = ({ 'Studio Score': o.m.score, 'Bass ±dB': o.m.lf, 'Weakest isolation': o.m.iso || 0, 'Est. cost': o.m.cost })[k];
            const best = dir && list.length > 1 && mine === (dir === 'hi' ? Math.max(...vals) : Math.min(...vals));
            return h('tr', { class: best ? 'ok' : '' }, h('td', {}, k), h('td', {}, h('b', {}, String(v)), best ? ' ★' : ''));
          })),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn small primary', onclick: () => { app.loadOption(o.id); m.close(); } }, 'Open'),
          h('button', { class: 'btn small', onclick: () => { app.saveOption(o.name, o.id); draw(); } }, 'Overwrite'),
          h('button', { class: 'btn small ghost', onclick: () => { app.deleteOption(o.id); draw(); } }, 'Delete')))))
        : h('p', { class: 'hint' }, 'No options saved yet.'));
  };
  const m = app.modal('Design options — compare alternatives', body, [], { wide: true, xwide: true });
  draw();
}

// ================================================================= CAD interchange
const dxfLine = (x1, y1, x2, y2, layer) => `0\nLINE\n8\n${layer}\n10\n${x1.toFixed(1)}\n20\n${y1.toFixed(1)}\n30\n0\n11\n${x2.toFixed(1)}\n21\n${y2.toFixed(1)}\n31\n0\n`;
const dxfText = (x, y, hgt, text, layer) => `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(1)}\n20\n${y.toFixed(1)}\n30\n0\n40\n${hgt}\n1\n${String(text).replace(/[^\x20-\x7E]/g, '')}\n`;
function footprint(it) {
  const a = (it.rot[1] * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hw = it.size[0] / 2, hd = it.size[2] / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [it.pos[0] + u * c + v * s, it.pos[2] - u * s + v * c]);
}
/** Plan as DXF (R12 ASCII, millimetres, Y up = front of room). */
export function exportDXF(app) {
  const room = app.room(), E = app.wallEdges(), ring = app.outerRing(), P2 = (x, z) => [x * 1000, -z * 1000];
  const layers = ['WALLS', 'WALLS-OUTER', 'OPENINGS', 'TREATMENT', 'FURNITURE', 'LIGHTING', 'CONSTRUCTION', 'DIMENSIONS', 'TEXT'];
  let out = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n`;
  layers.forEach((l, i) => (out += `0\nLAYER\n2\n${l}\n70\n0\n62\n${[7, 8, 1, 3, 5, 2, 6, 4, 7][i]}\n6\nCONTINUOUS\n`));
  out += '0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  E.forEach((e, i) => {
    const [x1, y1] = P2(...e.a), [x2, y2] = P2(...e.b); out += dxfLine(x1, y1, x2, y2, 'WALLS');
    const o1 = P2(...ring[i]), o2 = P2(...ring[(i + 1) % ring.length]); out += dxfLine(o1[0], o1[1], o2[0], o2[1], 'WALLS-OUTER');
    if (e.len > 0.5) { const [mx, my] = P2(e.mid[0] - e.n[0] * 0.45, e.mid[1] - e.n[1] * 0.45); out += dxfText(mx, my, 90, `${(e.len * 1000).toFixed(0)}`, 'DIMENSIONS'); }
  });
  for (const it of app.project().items) {
    if (it.hidden) continue;
    const layer = { treatment: 'TREATMENT', openings: 'OPENINGS', lighting: 'LIGHTING', construction: 'CONSTRUCTION' }[app.layerOfItem(it)] || 'FURNITURE';
    const fp = footprint(it).map(([x, z]) => P2(x, z));
    fp.forEach((p, i) => { const q = fp[(i + 1) % 4]; out += dxfLine(p[0], p[1], q[0], q[1], layer); });
    const [tx, ty] = P2(it.pos[0], it.pos[2]); out += dxfText(tx, ty, 50, it.name, 'TEXT');
  }
  out += dxfText(-room.w * 500, room.d * 500 + 700, 150, `${app.project().name} - plan (mm)`, 'TEXT');
  out += '0\nENDSEC\n0\nEOF\n';
  app.download(`${app.safeName()}-plan.dxf`, out, 'application/dxf');
}
/** Read closed outlines from a DXF; returns [[x, z] in drawing units]. */
export function parseDXF(text) {
  const lines = text.split(/\r?\n/), pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  const polys = [], segs = [];
  let cur = null, mode = null, inEnt = false;
  const flush = () => { if (cur && cur.pts.length >= 3) { cur.pts.layer = cur.layer; polys.push(cur.pts); } cur = null; };
  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 2 && v === 'ENTITIES') inEnt = true;
    if (!inEnt) continue;
    if (c === 0) {
      if (mode === 'LWPOLYLINE') flush();
      if (v === 'SEQEND' || v === 'ENDSEC') flush();
      if (v === 'LWPOLYLINE' || v === 'POLYLINE') { flush(); cur = { pts: [], layer: '' }; }
      if (v === 'LINE') segs.push({ layer: '' });
      mode = v;
    } else if (c === 8 && (mode === 'LINE' || ((mode === 'LWPOLYLINE' || mode === 'POLYLINE') && cur))) { if (mode === 'LINE') segs[segs.length - 1].layer = v; else cur.layer = v; }
    else if (mode === 'LWPOLYLINE' && cur) { if (c === 10) cur.pts.push([parseFloat(v), 0]); else if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = parseFloat(v); }
    else if (mode === 'VERTEX' && cur) { if (c === 10) cur.pts.push([parseFloat(v), 0]); else if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = parseFloat(v); }
    else if (mode === 'LINE') { const s = segs[segs.length - 1]; if (c === 10) s.x1 = +v; if (c === 20) s.y1 = +v; if (c === 11) s.x2 = +v; if (c === 21) s.y2 = +v; }
  }
  flush();
  // chain loose LINE segments into loops
  const tol = 1e-3, left = segs.filter((s) => s.x1 != null && s.x2 != null);
  while (left.length) {
    const s = left.shift(), loop = [[s.x1, s.y1], [s.x2, s.y2]];
    let grew = true;
    while (grew) { grew = false; const end = loop[loop.length - 1]; const scale = Math.max(1, Math.abs(end[0]), Math.abs(end[1]));
      for (let i = 0; i < left.length; i++) { const t = left[i]; const near = (x, y) => Math.hypot(x - end[0], y - end[1]) < tol * scale;
        if (t.layer !== s.layer) continue;
        if (near(t.x1, t.y1)) { loop.push([t.x2, t.y2]); left.splice(i, 1); grew = true; break; }
        if (near(t.x2, t.y2)) { loop.push([t.x1, t.y1]); left.splice(i, 1); grew = true; break; } } }
    loop.layer = s.layer;
    if (loop.length >= 4 && Math.hypot(loop[0][0] - loop[loop.length - 1][0], loop[0][1] - loop[loop.length - 1][1]) < tol * Math.max(1, Math.abs(loop[0][0]))) { loop.pop(); polys.push(loop); }
  }
  const area = (p) => Math.abs(p.reduce((a, q, i) => { const n = p[(i + 1) % p.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0)) / 2;
  return polys.map((p) => ({ pts: p, area: area(p), layer: p.layer || '' })).sort((a, b) => b.area - a.area);
}
export async function importDXF(app, text) {
  const polys = parseDXF(text);
  if (!polys.length) return app.toast('No closed outline found in that DXF (need a closed polyline or lines forming a loop)', 'error');
  // prefer a layer that names the interior wall line; otherwise the largest closed outline
  const pick = polys.find((q) => /^(walls?|a-wall|room|outline|interior)$/i.test(q.layer)) || polys[0];
  const p = pick.pts, xs = p.map((q) => q[0]), ys = p.map((q) => q[1]), span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const guess = span > 250 ? 'mm' : span > 60 ? 'in' : span > 25 ? 'ft' : 'm';
  const u = ((await app.ask('Import DXF outline', `Outline found: ${p.length} corners, ${span.toFixed(1)} drawing units across. Drawing units? (mm, cm, m, in, ft)`, guess)) || '').trim().toLowerCase();
  const k = { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 }[u];
  if (!k) return;
  app.setOutline(p.map(([x, y]) => [x * k, -y * k]));
  app.toast(`Room outline imported from DXF (${p.length} walls)`, 'ok');
}
/** Plan as a standalone SVG drawing. */
export function exportSVG(app) {
  const room = app.room(), E = app.wallEdges(), ring = app.outerRing(), S = 100, pad = 80;
  const W = room.w * S + pad * 2, H = room.d * S + pad * 2, X = (x) => (x + room.w / 2) * S + pad, Y = (z) => (z + room.d / 2) * S + pad;
  const colors = { treatment: '#3b7a8c', openings: '#b5654a', lighting: '#d9a520', construction: '#8a8d91' };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<path d="${ring.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(z).toFixed(1)}`).join(' ')}Z ${E.map((e, i) => `${i ? 'L' : 'M'}${X(e.a[0]).toFixed(1)} ${Y(e.a[1]).toFixed(1)}`).join(' ')}Z" fill="#333" fill-rule="evenodd"/>`;
  for (const it of app.project().items) {
    if (it.hidden) continue;
    const fp = footprint(it), col = colors[app.layerOfItem(it)] || '#777';
    s += `<polygon points="${fp.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ')}" fill="${it.color}" fill-opacity="0.55" stroke="${col}" stroke-width="1.2"><title>${it.name}</title></polygon>`;
    if (it.size[0] * it.size[2] > 0.25) s += `<text x="${X(it.pos[0]).toFixed(1)}" y="${Y(it.pos[2]).toFixed(1)}" font-size="9" text-anchor="middle" fill="#111">${it.name.replace(/[<&>]/g, '')}</text>`;
  }
  for (const e of E) if (e.len > 0.5) s += `<text x="${X(e.mid[0] - e.n[0] * 0.5).toFixed(1)}" y="${Y(e.mid[1] - e.n[1] * 0.5).toFixed(1)}" font-size="12" text-anchor="middle" fill="#0b5aa5">${app.fmt(e.len)}</text>`;
  s += `<text x="${pad}" y="28" font-size="16" font-weight="bold">${app.project().name.replace(/[<&>]/g, '')} — plan</text><text x="${pad}" y="46" font-size="11" fill="#555">Scale 1 m = ${S} px · front wall at top</text></svg>`;
  app.download(`${app.safeName()}-plan.svg`, s, 'image/svg+xml');
}

// ================================================================= share & AI-render hand-off
export async function shareHTML(app) {
  let base = app.pristineHTML();
  // (markup fragments are assembled from pieces so this file can itself be inlined into an HTML page)
  const LT = String.fromCharCode(60); // built at runtime so a minifier cannot fold it back into literal markup
  if (base.includes(LT + 'script type="importmap"')) {
    try { base = await (await fetch('dist/RoomTone-standalone.html')).text(); }
    catch { return app.toast('Sharing needs the standalone build (dist/RoomTone-standalone.html) next to the app', 'error'); }
  }
  const json = JSON.stringify(app.project()).split(LT).join('\\u003c');
  const tag = `${LT}script id="embedded-project" type="application/json">${json}${LT}/script>`;
  // put the design at the top of <body> so it is parsed before the app starts
  const b0 = base.indexOf(LT + 'body'), i = b0 >= 0 ? base.indexOf('>', b0) + 1 : -1;
  let html = i > 0 ? base.slice(0, i) + tag + base.slice(i) : tag + base;
  if (!/^\s*.!doctype/i.test(html)) html = LT + '!doctype html>\n' + html;
  app.download(`${app.safeName()}-shareable.html`, html, 'text/html');
  app.toast('Shareable file saved — anyone can open it in a browser, orbit, walk and edit. No install, works offline.', 'ok');
}
export function aiPrompt(app) {
  const p = app.project(), room = app.room(), names = app.colorNamer();
  const count = {}; for (const it of p.items) if (!it.hidden) count[app.defOf(it.type).name] = (count[app.defOf(it.type).name] || 0) + 1;
  const top = Object.entries(count).filter(([n]) => !/Listening|Imported|note/i.test(n)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n, c]) => (c > 1 ? `${c} ${n.toLowerCase()}s` : `a ${n.toLowerCase()}`));
  const sf = room.surfaces, wall = sf[app.wallEdges()[0].id] || sf.front;
  const lights = p.items.filter((i) => app.defOf(i.type).light && i.params.on !== false);
  const mood = lights.length ? `lit by ${[...new Set(lights.map((l) => app.defOf(l.type).name.toLowerCase()))].slice(0, 3).join(', ')}, ${names(lights[0].params.lightColor || '#ffd9a8')} light` : 'soft natural daylight';
  return `Photorealistic interior architectural photograph of a professional ${/booth/i.test(p.name) ? 'vocal booth' : 'recording studio control room'}, about ${room.w.toFixed(1)} × ${room.d.toFixed(1)} m with a ${room.h.toFixed(1)} m ${app.ceilingName().toLowerCase()} ceiling. Walls in ${names(wall.color)} ${app.finishName(wall.finish).toLowerCase()}, ${names(sf.floor.color)} ${app.finishName(sf.floor.finish).toLowerCase()} floor, ${names(sf.ceiling.color)} ceiling. The room contains ${top.join(', ')}. ${mood}. Keep the exact geometry, camera and layout of the reference image; wide-angle lens at eye level, realistic materials and fabric textures, subtle depth of field, high dynamic range, editorial interior photography.`;
}
export function openAIRender(app) {
  const { h } = app, ta = h('textarea', { rows: 9, value: aiPrompt(app) });
  app.modal('AI render hand-off', h('div', { class: 'ai-pack' },
    h('p', {}, 'RoomTone works offline, so it renders in real time rather than with cloud AI. For a photoreal marketing image, hand this pack to an AI renderer (e.g. mnml.ai or any image-to-image tool) when you are online: a reference image of this exact view plus a prompt written from your design.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn primary', onclick: () => app.downloadView('clay') }, '⤓ Reference image — clay model'),
      h('button', { class: 'btn', onclick: () => app.downloadView('sketch') }, '⤓ Line drawing'),
      h('button', { class: 'btn', onclick: () => app.downloadView('real') }, '⤓ Colour render')),
    h('label', { class: 'field' }, h('span', {}, 'Prompt (edit freely)'), ta),
    h('div', { class: 'row gap' }, h('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(ta.value); app.toast('Prompt copied', 'ok'); } catch { ta.select(); document.execCommand('copy'); app.toast('Prompt copied', 'ok'); } } }, 'Copy prompt'),
      h('button', { class: 'btn', onclick: () => app.download(`${app.safeName()}-ai-prompt.txt`, ta.value, 'text/plain') }, 'Save as .txt'))), [], { wide: true });
}
