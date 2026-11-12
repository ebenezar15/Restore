// Room Mode Calculator — in the spirit of AMROC and similar tools, extended with
// a modal low-frequency simulation at the listening position, a best-seat search,
// treatment-zone analysis, a tuned-trap designer, a tone generator for listening
// tests and a 3D pressure-map overlay.
//
// Coordinates follow the app: x = width (centred), z = length (centred, front
// wall at -L/2), y = height (floor at 0). Mode indices are [nLength, nWidth, nHeight].
import { ACOUSTIC_MATERIALS, NAMED_RATIOS } from './acoustics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FT = 0.3048;

// ---------------------------------------------------------------- physics
export const speedOfSound = (tC) => 331.3 * Math.sqrt(1 + tC / 273.15);

export function computeModes(L, W, H, c, fmax = 300) {
  const out = [];
  const nL = Math.floor((2 * L * fmax) / c) + 1, nW = Math.floor((2 * W * fmax) / c) + 1, nH = Math.floor((2 * H * fmax) / c) + 1;
  for (let a = 0; a <= nL; a++) for (let b = 0; b <= nW; b++) for (let d = 0; d <= nH; d++) {
    if (!a && !b && !d) continue;
    const f = (c / 2) * Math.sqrt((a / L) ** 2 + (b / W) ** 2 + (d / H) ** 2);
    if (f > fmax) continue;
    const zeros = (a === 0) + (b === 0) + (d === 0);
    const type = zeros === 2 ? 'axial' : zeros === 1 ? 'tangential' : 'oblique';
    out.push({ f, n: [a, b, d], type, weight: type === 'axial' ? 0 : type === 'tangential' ? -3 : -6 });
  }
  out.sort((x, y) => x.f - y.f);
  out.forEach((m, i) => { m.next = out[i + 1] ? out[i + 1].f - m.f : null; m.prev = i ? m.f - out[i - 1].f : null; });
  return out;
}

export function noteOf(f) {
  const n = 12 * Math.log2(f / 440) + 57, r = Math.round(n);
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { name: names[((r % 12) + 12) % 12] + Math.floor(r / 12), cents: Math.round((n - r) * 100) };
}

export const DIM_NAMES = ['Length', 'Width', 'Height'];
export function describeMode(m) {
  if (m.type === 'axial') { const k = m.n.findIndex((v) => v > 0); return `${DIM_NAMES[k]} ×${m.n[k]}`; }
  return m.n.map((v, k) => (v ? `${DIM_NAMES[k][0]}${v}` : '')).filter(Boolean).join(' · ');
}

/** Normalised pressure of a mode at a point (room centred on x/z, floor at y=0). */
export function psi(m, x, y, z, R) {
  return Math.cos((m.n[0] * Math.PI * (z + R.L / 2)) / R.L) * Math.cos((m.n[1] * Math.PI * (x + R.W / 2)) / R.W) * Math.cos((m.n[2] * Math.PI * y) / R.H);
}

/** Where a mode's pressure peaks and cancels, in words. */
export function zonesOf(m, R, fmtLen) {
  const walls = [];
  const nodes = [];
  m.n.forEach((v, k) => {
    if (!v) return;
    const len = [R.L, R.W, R.H][k];
    walls.push(['front & back walls', 'side walls', 'floor & ceiling'][k]);
    const pos = Array.from({ length: v }, (_, i) => ((i + 0.5) * len) / v);
    nodes.push(`${DIM_NAMES[k].toLowerCase()} nulls at ${pos.map((p) => fmtLen(p)).join(', ')} from the ${['front wall', 'left wall', 'floor'][k]}`);
  });
  return { peaks: `${walls.join(', ')} + every corner touching them`, nodes };
}

export const THIRD_OCT = [16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315];
export function bonello(modes, fmax) {
  const bands = THIRD_OCT.filter((c) => c * 2 ** (1 / 6) <= fmax + 1).map((c) => {
    const lo = c / 2 ** (1 / 6), hi = c * 2 ** (1 / 6);
    const inBand = modes.filter((m) => m.f >= lo && m.f < hi);
    let coincident = 0;
    for (let i = 1; i < inBand.length; i++) if (inBand[i].f - inBand[i - 1].f < Math.max(0.5, inBand[i].f * 0.005)) coincident++;
    return { c, count: inBand.length, coincident };
  });
  const first = bands.findIndex((b) => b.count > 0);
  let pass = true;
  bands.forEach((b, i) => {
    b.drop = i > first && first >= 0 && b.count < bands[i - 1].count;
    b.badCoinc = b.coincident > 0 && b.count < 5;
    if (b.drop || b.badCoinc) pass = false;
  });
  return { bands, pass };
}

export function boltCheck(L, W, H) {
  const d = [H, W, L].sort((a, b) => a - b), r1 = d[1] / d[0], r2 = d[2] / d[0];
  const inBolt = r2 >= 1.1 * r1 - 0.14 && r2 <= 4.5 * r1 - 4 && r2 < 3 && r1 < 2;
  let best = null;
  for (const n of NAMED_RATIOS) { const err = Math.hypot(n.r[1] - r1, n.r[2] - r2); if (!best || err < best.err) best = { ...n, err }; }
  return { r1, r2, inBolt, best };
}

// low-frequency absorption (63 Hz) to extend the 125 Hz–4 kHz tables downward
const LF63 = {
  none: 0, drywall: 0.35, double_drywall: 0.25, concrete: 0.05, brick: 0.03, plaster: 0.01, glass: 0.3, wood_floor: 0.15, tile_floor: 0.01,
  carpet: 0.02, carpet_pad: 0.05, ceiling_tile: 0.2, plywood: 0.3, wood_hard: 0.1, fabric_50: 0.05, fabric_100: 0.3, fabric_150: 0.6, foam_50: 0.03,
  pet_felt: 0.02, bass_trap: 0.6, membrane: 0.75, helmholtz: 0.2, slat: 0.2, qrd: 0.08, skyline: 0.05, poly: 0.35, bad_panel: 0.3, reflector: 0.12,
  curtain: 0.07, tube_trap: 0.4, upholstered: 0.25, books: 0.1,
};
const POROUS = new Set(['fabric_50', 'fabric_100', 'fabric_150', 'foam_50', 'pet_felt', 'carpet', 'carpet_pad', 'curtain', 'upholstered', 'bass_trap', 'tube_trap']);
const BAND_F = [63, 125, 250, 500, 1000, 2000, 4000];
export function alphaAt(mat, f, tunedHz = 0) {
  const m = ACOUSTIC_MATERIALS[mat] || ACOUSTIC_MATERIALS.drywall;
  const vals = [LF63[mat] ?? m.a[0] * 0.5, ...m.a];
  let a;
  if (f <= 63) a = POROUS.has(mat) ? vals[0] * (f / 63) ** 1.2 : vals[0];
  else if (f >= 4000) a = vals[6];
  else { let i = 0; while (BAND_F[i + 1] < f) i++; const t = Math.log(f / BAND_F[i]) / Math.log(BAND_F[i + 1] / BAND_F[i]); a = vals[i] + (vals[i + 1] - vals[i]) * t; }
  if (tunedHz) a = Math.max(a, 0.95 * Math.exp(-(Math.log2(f / tunedHz) ** 2) / (2 * 0.45 ** 2)));
  return clamp(a, 0, 1);
}
export function t60At(f, R, withItems = true) {
  let A = 0;
  for (const s of R.surfaces) A += s.area * alphaAt(s.mat, f);
  if (withItems) for (const it of R.items) A += it.area * alphaAt(it.acoustic, f, it.tunedHz);
  return clamp((0.161 * R.V) / Math.max(A, 0.05), 0.08, 6);
}

/** Modal-sum pressure response (dB) at receiver r from sources s[], frequencies fs[]. */
export function modalResponse(R, modes, srcs, r, fs, withItems = true) {
  const terms = [{ f: 0, n: [0, 0, 0], eps: 1 }, ...modes].map((m) => {
    const eps = m.eps || m.n.reduce((a, v) => a * (v ? 2 : 1), 1);
    const sp = srcs.reduce((a, s) => a + psi(m, s[0], s[1], s[2], R), 0);
    return { fn: m.f, k: eps * sp * psi(m, r[0], r[1], r[2], R), d: 6.91 / t60At(Math.max(m.f, 15), R, withItems) };
  });
  return fs.map((f) => {
    let re = 0, im = 0;
    for (const t of terms) { const a = t.fn * t.fn - f * f, b = (f * t.d) / Math.PI, den = a * a + b * b; re += (t.k * a) / den; im += (-t.k * b) / den; }
    return 20 * Math.log10(Math.hypot(re, im) + 1e-12);
  });
}
export function logFreqs(f0, f1, perOct = 24) { const out = []; for (let f = f0; f <= f1 * 1.0001; f *= 2 ** (1 / perOct)) out.push(f); return out; }
function normalise(db, fs, lo = 40, hi = 200) {
  const v = db.filter((_, i) => fs[i] >= lo && fs[i] <= hi).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)] || 0;
  return db.map((x) => x - med);
}
const stdDev = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };

/** Flatness (std-dev of the 30–150 Hz response) over a grid of seats at ear height. */
export function seatSweep(R, modes, srcs, earY, nx = 17, nz = 23, inside = () => true) {
  const fs = logFreqs(30, 150, 12), use = modes.filter((m) => m.f < 260), grid = [];
  let best = null;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = -R.W / 2 + (R.W * (i + 0.5)) / nx, z = -R.L / 2 + (R.L * (j + 0.5)) / nz;
    if (!inside(x, z)) { grid.push(null); continue; }
    const db = modalResponse(R, use, srcs, [x, earY, z], fs);
    const sd = stdDev(db);
    grid.push(sd);
    // prefer seats on the centre line and in front of the speakers
    const penalty = Math.abs(x) * 1.5 + (z < (srcs[0]?.[2] ?? -R.L / 2) + 0.6 ? 10 : 0);
    if (!best || sd + penalty < best.score) best = { x, z, sd, score: sd + penalty };
  }
  return { grid, nx, nz, best };
}

// ---------------------------------------------------------------- trap tuning
export const PANEL_MASSES = [
  ['3 mm hardboard', 3.0], ['4 mm plywood', 2.4], ['6 mm plywood', 3.6], ['6 mm MDF', 4.5], ['9 mm plywood', 5.4], ['9 mm MDF', 6.8], ['12 mm plywood', 7.2], ['12.5 mm drywall', 9.5], ['Mass-loaded vinyl 5 kg/m²', 5.0], ['Mass-loaded vinyl 10 kg/m²', 10.0],
];
/** Panel (membrane) absorber: f ≈ 60 / √(m·d), m in kg/m², d in m. */
export const membraneF = (m, d) => 60 / Math.sqrt(m * d);
export const membraneDepth = (m, f) => (60 / f) ** 2 / m;
/** Perforated Helmholtz: f = c/2π · √(P / (t' · d)), t' = t + 1.6 r. */
export function helmholtzF(c, P, t, r, d) { return (c / (2 * Math.PI)) * Math.sqrt(P / ((t + 1.6 * r) * d)); }
export function helmholtzDepth(c, P, t, r, f) { return P / ((t + 1.6 * r) * ((2 * Math.PI * f) / c) ** 2); }
/** Slot resonator: P = slot/(slot+slat), t' = t + 1.2·slot. */
export const slotF = (c, slot, slat, t, d) => helmholtzF(c, slot / (slot + slat), t, slot * 0.75, d);
export const slotDepth = (c, slot, slat, t, f) => helmholtzDepth(c, slot / (slot + slat), t, slot * 0.75, f);
/** Porous absorber starts working around the quarter wavelength of its depth (incl. air gap). */
export const porousLowF = (c, depth) => c / (4 * depth);

// ---------------------------------------------------------------- tone generator
let audio = null;
export function playTone(f, { volume = 0.15, seconds = 0 } = {}) {
  stopTone();
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
  const ctx = new Ctx(), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = 'sine'; osc.frequency.value = f; g.gain.value = 0; osc.connect(g).connect(ctx.destination);
  osc.start(); g.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.15);
  audio = { ctx, osc, g };
  if (seconds) setTimeout(stopTone, seconds * 1000);
  return true;
}
export function sweepTone(f0, f1, seconds, volume = 0.15) {
  if (!playTone(f0, { volume })) return false;
  audio.osc.frequency.setValueAtTime(f0, audio.ctx.currentTime);
  audio.osc.frequency.exponentialRampToValueAtTime(f1, audio.ctx.currentTime + seconds);
  setTimeout(stopTone, seconds * 1000 + 200);
  return true;
}
export function stopTone() {
  if (!audio) return;
  const a = audio; audio = null;
  try { a.g.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.08); setTimeout(() => { a.osc.stop(); a.ctx.close(); }, 120); } catch { /* already stopped */ }
}

// ---------------------------------------------------------------- report (used by the panel and the PDF)
export function modeReport(ctx) {
  const { L, W, H, tC, fmax } = ctx.calc;
  const c = speedOfSound(tC);
  const R = { L, W, H, V: ctx.V ?? L * W * H, surfaces: ctx.surfaces, items: ctx.items };
  const modes = computeModes(L, W, H, c, fmax);
  const all = computeModes(L, W, H, c, Math.max(fmax, 400));
  const t60mid = t60At(500, R);
  const schroeder = 2000 * Math.sqrt(t60mid / R.V);
  const bon = bonello(modes, Math.min(fmax, 250));
  const bolt = boltCheck(L, W, H);
  const axial = modes.filter((m) => m.type === 'axial');
  const issues = [];
  for (let i = 1; i < axial.length; i++) {
    const a = axial[i - 1], b = axial[i];
    if ((b.f - a.f) / a.f < 0.05) issues.push({ kind: 'coincident', f: (a.f + b.f) / 2, modes: [a, b], text: `${a.f.toFixed(1)} & ${b.f.toFixed(1)} Hz axial modes coincide — they reinforce each other` });
    if (b.f < 200 && b.f - a.f > 20) issues.push({ kind: 'gap', f: (a.f + b.f) / 2, modes: [a, b], text: `${(b.f - a.f).toFixed(0)} Hz gap between ${a.f.toFixed(0)} and ${b.f.toFixed(0)} Hz — region will sound thin/uneven` });
  }
  // listener behaviour per low mode
  const ear = ctx.ear, srcs = ctx.speakers.length ? ctx.speakers : [[-W * 0.2, 1.2, -L / 2 + 0.6], [W * 0.2, 1.2, -L / 2 + 0.6]];
  const problems = modes.filter((m) => m.f <= Math.min(schroeder * 1.15, 220) && m.type !== 'oblique').slice(0, 24).map((m) => {
    const pl = psi(m, ear[0], ear[1], ear[2], R), ps = srcs.reduce((a, s) => a + psi(m, s[0], s[1], s[2], R), 0) / srcs.length;
    const atEar = Math.abs(pl), excite = Math.abs(ps);
    const tags = [];
    if (excite > 0.5 && atEar > 0.75) tags.push('peak at listener');
    if (excite > 0.3 && atEar < 0.2) tags.push('null at listener');
    if (issues.some((i) => i.kind === 'coincident' && i.modes.includes(m))) tags.push('coincident');
    const sev = (m.type === 'axial' ? 2 : 1) * (excite + 0.2) * (tags.includes('peak at listener') ? 1.6 : tags.includes('null at listener') ? 1.3 : 0.6) * (tags.includes('coincident') ? 1.5 : 1);
    return { m, atEar, excite, tags, sev };
  }).sort((a, b) => b.sev - a.sev);
  return { c, R, modes, all, t60mid, schroeder, bon, bolt, issues, problems, srcs, ear };
}

export function treatmentFor(p, R, c, fmtLen) {
  const f = p.m.f, quarter = c / (4 * f);
  const k = p.m.n.findIndex((v) => v > 0);
  const where = p.m.type === 'axial' ? ['front & back walls (and their corners)', 'side walls (and their corners)', 'ceiling / floor junctions (ceiling corners, cloud with air gap)'][k] : 'the corners and edges shared by ' + p.m.n.map((v, i) => (v ? ['front/back', 'side', 'floor/ceiling'][i] : '')).filter(Boolean).join(' + ') + ' surfaces';
  let how;
  if (f < 80) how = `Pressure-based trap tuned to ${f.toFixed(0)} Hz (membrane or Helmholtz) at ${where}. Porous material would need ~${fmtLen(quarter)} depth — impractical.`;
  else if (f < 150) how = `Thick porous trap ≥ ${fmtLen(Math.min(quarter, 0.6))} (incl. air gap) or a tuned membrane at ${where}; floor-to-ceiling corner superchunks help every mode.`;
  else how = `Broadband porous treatment (100–200 mm with air gap) at ${where}.`;
  return { where, how, quarter };
}

// ================================================================= UI
export function openModeCalculator(app, startTab = 'modes') {
  const { h } = app;
  const room = app.roomDims();
  const st = { L: room.L, W: room.W, H: room.H, tC: +(localStorage.getItem('rt.tempC') ?? 20), fmax: 300, tab: startTab, filter: { axial: true, tangential: true, oblique: false }, sel: 0, slice: 'plan', sliceH: 1.2, sliceX: 0, which: 'both', untreated: true };
  const ft = () => app.units() === 'ft';
  const toU = (m) => (ft() ? m / FT : m), fromU = (v) => (ft() ? v * FT : v), uLab = () => (ft() ? 'ft' : 'm');
  const fmtLen = (m) => app.fmt(m);
  let rep = null;

  const head = h('div', { class: 'mc-head' });
  const tabs = h('div', { class: 'mc-tabs' });
  const body = h('div', { class: 'mc-body' });
  const TABS = [['modes', 'Mode table'], ['spectrum', 'Spectrum & Bonello'], ['map', 'Pressure map'], ['response', 'Response & best seat'], ['treat', 'Treatment zones'], ['traps', 'Trap designer'], ['ratios', 'Room ratios'], ['tone', 'Tone generator']];

  function ctx() { return { calc: st, V: st.L * st.W * st.H * (room.fill ?? 1), surfaces: app.surfacesFor(st), items: app.itemsAbs(), ear: app.ear(), speakers: app.speakers() }; }
  function recompute() { rep = modeReport(ctx()); }

  function numIn(label, val, set, step = 0.01) {
    const inp = h('input', { type: 'number', step: ft() ? 0.1 : step, value: +toU(val).toFixed(3) });
    inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (v > 0) { set(fromU(v)); refresh(); } });
    return h('label', { class: 'field' }, h('span', {}, `${label} (${uLab()})`), inp);
  }
  function drawHead() {
    head.innerHTML = '';
    const tIn = h('input', { type: 'number', step: 1, value: ft() ? Math.round(st.tC * 9 / 5 + 32) : st.tC });
    tIn.addEventListener('change', () => { const v = parseFloat(tIn.value); if (!Number.isNaN(v)) { st.tC = ft() ? (v - 32) * 5 / 9 : v; try { localStorage.setItem('rt.tempC', st.tC); } catch { /* ignore */ } refresh(); } });
    head.append(
      h('div', { class: 'mc-dims' },
        numIn('Length', st.L, (v) => (st.L = v)), numIn('Width', st.W, (v) => (st.W = v)), numIn('Height', st.H, (v) => (st.H = v)),
        h('label', { class: 'field' }, h('span', {}, `Temp (°${ft() ? 'F' : 'C'})`), tIn),
        h('label', { class: 'field' }, h('span', {}, 'Up to'), h('select', { onchange: (e) => { st.fmax = +e.target.value; refresh(); } }, [150, 200, 300, 500].map((f) => h('option', { value: f, selected: f === st.fmax }, f + ' Hz')))),
        h('div', { class: 'seg' }, ['m', 'ft'].map((u) => h('button', { class: 'seg-btn' + (app.units() === u ? ' active' : ''), onclick: () => { app.setUnits(u); refresh(); } }, u === 'm' ? 'Metres' : 'Feet')))),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn small', onclick: () => { const r = app.roomDims(); Object.assign(st, { L: r.L, W: r.W, H: r.H }); refresh(); } }, '↺ Use current room'),
        h('button', { class: 'btn small', onclick: () => { app.applyDims(st); app.toast('Room resized to calculator dimensions', 'ok'); refresh(); } }, '⇢ Apply to room'),
        h('button', { class: 'btn small', onclick: () => exportCSV() }, '⤓ CSV'),
        !room.rect ? h('span', { class: 'hint' }, 'Room is not a simple box — values use the equivalent box (exact for rectangular rooms).') : null),
      h('div', { class: 'mc-kpis' },
        kpi('Volume', `${(st.L * st.W * st.H).toFixed(1)} m³`, `${(st.L * st.W * st.H * 35.315).toFixed(0)} ft³`),
        kpi('Speed of sound', `${rep.c.toFixed(1)} m/s`, `${(rep.c / FT).toFixed(0)} ft/s`),
        kpi('First mode', `${rep.modes[0]?.f.toFixed(1) ?? '–'} Hz`, rep.modes[0] ? describeMode(rep.modes[0]) : ''),
        kpi('Schroeder', `${rep.schroeder.toFixed(0)} Hz`, 'modes dominate below'),
        kpi('Modes < Schroeder', String(rep.modes.filter((m) => m.f < rep.schroeder).length), `${rep.modes.filter((m) => m.f < rep.schroeder && m.type === 'axial').length} axial`),
        kpi('Bonello', rep.bon.pass ? 'Pass' : 'Fail', 'modal distribution', rep.bon.pass ? 'good' : 'bad'),
        kpi('Bolt area', rep.bolt.inBolt ? 'Inside' : 'Outside', `1 : ${rep.bolt.r1.toFixed(2)} : ${rep.bolt.r2.toFixed(2)}`, rep.bolt.inBolt ? 'good' : 'warn')));
  }
  const kpi = (l, v, s, lvl = '') => h('div', { class: 'kpi ' + lvl }, h('small', {}, l), h('b', {}, v), h('span', {}, s));
  function drawTabs() { tabs.innerHTML = ''; for (const [k, l] of TABS) tabs.append(h('button', { class: 'pal-tab' + (st.tab === k ? ' active' : ''), onclick: () => { st.tab = k; drawBody(); drawTabs(); } }, l)); }

  // ---------------------------------------------------------------- tabs
  function tabModes() {
    const list = rep.modes.filter((m) => st.filter[m.type]);
    const flagOf = (m) => {
      const fl = [];
      if (m.type === 'axial' && m.next != null && m.next / m.f < 0.05) fl.push('coincident ↓');
      if (m.type === 'axial' && m.prev != null && m.prev / m.f < 0.05) fl.push('coincident ↑');
      if (m.f < rep.schroeder) fl.push('modal');
      return fl.join(' · ');
    };
    return h('div', {},
      h('div', { class: 'row gap wrap' }, ...['axial', 'tangential', 'oblique'].map((t) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.filter[t], onchange: (e) => { st.filter[t] = e.target.checked; drawBody(); } }), h('i', { class: 'dot mode-' + t }), ` ${t} (${rep.modes.filter((m) => m.type === t).length})`)),
        h('span', { class: 'hint' }, 'Axial modes (one dimension) are the strongest, tangential ≈ −3 dB, oblique ≈ −6 dB.')),
      h('div', { class: 'mc-table-wrap' }, h('table', { class: 'tbl mc-table' },
        h('tr', {}, ['#', 'Hz', 'Type', 'L·W·H', 'Description', 'Note', `λ (${uLab()})`, 'Δ next', 'Flags', ''].map((t) => h('th', {}, t))),
        list.map((m, i) => { const nt = noteOf(m.f); return h('tr', { class: 'mode-row ' + m.type + (m.f < rep.schroeder ? '' : ' dim') },
          h('td', {}, i + 1), h('td', {}, h('b', {}, m.f.toFixed(1))), h('td', {}, h('i', { class: 'dot mode-' + m.type }), ' ', m.type), h('td', {}, m.n.join(' · ')), h('td', {}, describeMode(m)),
          h('td', {}, `${nt.name} ${nt.cents >= 0 ? '+' : ''}${nt.cents}¢`), h('td', {}, toU(rep.c / m.f).toFixed(2)), h('td', {}, m.next != null ? m.next.toFixed(1) : '–'), h('td', { class: 'flags' }, flagOf(m)),
          h('td', { class: 'row gap' },
            h('button', { class: 'icon-btn tiny', title: 'Play this frequency', html: '▶', onclick: () => { playTone(m.f, { seconds: 4 }) || app.toast('Audio not available', 'error'); } }),
            h('button', { class: 'icon-btn tiny', title: 'Show pressure map', html: '◧', onclick: () => { st.sel = rep.modes.indexOf(m); st.tab = 'map'; drawTabs(); drawBody(); } }),
            h('button', { class: 'icon-btn tiny', title: 'Show in 3D room', html: '⬚', onclick: () => { app.showOverlay({ kind: 'mode', mode: m, R: rep.R, height: st.sliceH }); m0.close(); } }))); }))));
  }

  function tabSpectrum() {
    const W = 760, H = 210, f0 = 15, f1 = st.fmax, x = (f) => 40 + ((Math.log(f) - Math.log(f0)) / (Math.log(f1) - Math.log(f0))) * (W - 50);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart mc-chart">`;
    for (const f of [20, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500].filter((v) => v <= f1)) s += `<line x1="${x(f)}" x2="${x(f)}" y1="10" y2="${H - 24}" class="gl"/><text x="${x(f)}" y="${H - 8}" text-anchor="middle">${f}</text>`;
    s += `<rect x="${x(Math.max(f0, Math.min(rep.schroeder, f1)))}" y="10" width="${Math.max(0, x(f1) - x(Math.min(rep.schroeder, f1)))}" height="${H - 34}" fill="rgba(61,220,151,0.06)"/>`;
    s += `<line x1="${x(Math.min(rep.schroeder, f1))}" x2="${x(Math.min(rep.schroeder, f1))}" y1="6" y2="${H - 24}" class="schroeder"/><text x="${x(Math.min(rep.schroeder, f1)) + 4}" y="18" class="legend">Schroeder ${rep.schroeder.toFixed(0)} Hz</text>`;
    for (const m of rep.modes) { const hh = (H - 40) * (m.type === 'axial' ? 1 : m.type === 'tangential' ? 0.62 : 0.38); s += `<line x1="${x(m.f)}" x2="${x(m.f)}" y1="${H - 24}" y2="${H - 24 - hh}" class="m ${m.type}"><title>${m.f.toFixed(1)} Hz ${m.type} (${m.n.join(',')})</title></line>`; }
    for (const is of rep.issues) s += `<circle cx="${x(is.f)}" cy="16" r="4" fill="${is.kind === 'gap' ? '#6aa8ff' : '#ff5d73'}"><title>${is.text}</title></circle>`;
    s += '</svg>';
    // Bonello
    const bands = rep.bon.bands, bw = 760 / bands.length, maxC = Math.max(1, ...bands.map((b) => b.count));
    let b2 = `<svg viewBox="0 0 760 170" class="chart mc-chart">`;
    bands.forEach((b, i) => {
      const hh = (b.count / maxC) * 120, cls = b.drop || b.badCoinc ? 'bad' : 'good';
      b2 += `<rect x="${i * bw + 6}" y="${140 - hh}" width="${bw - 12}" height="${hh}" rx="3" class="bar ${cls}"><title>${b.c} Hz band: ${b.count} modes${b.coincident ? `, ${b.coincident} coincident` : ''}</title></rect><text x="${i * bw + bw / 2}" y="${136 - hh}" text-anchor="middle" class="val">${b.count}</text><text x="${i * bw + bw / 2}" y="156" text-anchor="middle">${b.c}</text>`;
    });
    b2 += '</svg>';
    return h('div', {},
      h('h4', {}, 'Modal spectrum'), h('div', { html: s }),
      h('p', { class: 'hint' }, 'Red = axial, amber = tangential, blue = oblique. Red dots: coincident axial modes; blue dots: large gaps.'),
      h('ul', { class: 'advice small' }, rep.issues.length ? rep.issues.map((i) => h('li', { class: i.kind === 'gap' ? 'info' : 'warn' }, i.text)) : h('li', { class: 'good' }, 'No coincident axial modes or large gaps.')),
      h('h4', {}, `Bonello criterion — modes per ⅓-octave band (${rep.bon.pass ? 'pass' : 'fail'})`), h('div', { html: b2 }),
      h('p', { class: 'hint' }, 'Bonello: each ⅓-octave should contain at least as many modes as the one below it, and bands with fewer than 5 modes should have no coincident modes. Red bars break the rule.'));
  }

  function heat(canvas, fn, cols, rows, overlay) {
    const g = canvas.getContext('2d'), img = g.createImageData(cols, rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = fn(i, j), k = (j * cols + i) * 4;
      if (v == null) { img.data[k + 3] = 0; continue; }
      const [r, gg, b] = diverge(v); img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    const tmp = document.createElement('canvas'); tmp.width = cols; tmp.height = rows; tmp.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.clearRect(0, 0, canvas.width, canvas.height); g.drawImage(tmp, 0, 0, canvas.width, canvas.height);
    overlay?.(g);
  }
  function tabMap() {
    const m = rep.modes[st.sel] || rep.modes[0];
    if (!m) return h('p', {}, 'No modes in range.');
    const R = rep.R;
    const sel = h('select', { onchange: (e) => { st.sel = +e.target.value; drawBody(); } }, rep.modes.slice(0, 120).map((x, i) => h('option', { value: i, selected: i === st.sel }, `${x.f.toFixed(1)} Hz — ${x.type} (${x.n.join(',')}) ${describeMode(x)}`)));
    const cv = h('canvas', { class: 'mc-map' });
    const plan = st.slice === 'plan', side = st.slice === 'side';
    const dims = plan ? [R.W, R.L] : side ? [R.L, R.H] : [R.W, R.H];
    const scale = Math.min(520 / dims[0], 340 / dims[1]);
    cv.width = Math.round(dims[0] * scale); cv.height = Math.round(dims[1] * scale);
    const cols = 90, rows = Math.max(20, Math.round((90 * dims[1]) / dims[0]));
    const pt = (i, j) => {
      const u = (i + 0.5) / cols, v = (j + 0.5) / rows;
      if (plan) return [-R.W / 2 + u * R.W, st.sliceH, -R.L / 2 + v * R.L];
      if (side) return [st.sliceX, R.H * (1 - v), -R.L / 2 + u * R.L];
      return [-R.W / 2 + u * R.W, R.H * (1 - v), 0];
    };
    const inside = app.insideFn();
    heat(cv, (i, j) => { const p = pt(i, j); if (plan && !inside(p[0], p[2])) return null; return psi(m, p[0], p[1], p[2], R); }, cols, rows, (g) => {
      const toC = (x, y, z) => plan ? [(x + R.W / 2) * scale, (z + R.L / 2) * scale] : side ? [(z + R.L / 2) * scale, (R.H - y) * scale] : [(x + R.W / 2) * scale, (R.H - y) * scale];
      const dot = (p, col, lab) => { const [x, y] = toC(...p); g.fillStyle = col; g.strokeStyle = '#000'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = '11px system-ui'; g.fillText(lab, x + 8, y + 4); };
      dot(rep.ear, '#22c3c3', 'Listener'); rep.srcs.forEach((s, i) => dot(s, '#ffb547', i ? 'R' : 'L'));
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '11px system-ui'; g.fillText(plan ? 'FRONT' : side ? 'FRONT →' : '', plan ? cv.width / 2 - 18 : 6, 14);
    });
    const at = psi(m, rep.ear[0], rep.ear[1], rep.ear[2], R), z = zonesOf(m, R, fmtLen);
    return h('div', { class: 'mc-map-wrap' },
      h('div', { class: 'row gap wrap' }, sel,
        h('div', { class: 'seg' }, [['plan', 'Plan (top)'], ['side', 'Side section'], ['front', 'Front section']].map(([k, l]) => h('button', { class: 'seg-btn' + (st.slice === k ? ' active' : ''), onclick: () => { st.slice = k; drawBody(); } }, l))),
        plan ? h('label', { class: 'field inline' }, h('span', {}, `Height ${fmtLen(st.sliceH)}`), h('input', { type: 'range', min: 0, max: R.H, step: 0.05, value: st.sliceH, oninput: (e) => { st.sliceH = +e.target.value; drawBody(); } })) : null,
        side ? h('label', { class: 'field inline' }, h('span', {}, `Across ${fmtLen(st.sliceX + R.W / 2)}`), h('input', { type: 'range', min: -R.W / 2, max: R.W / 2, step: 0.05, value: st.sliceX, oninput: (e) => { st.sliceX = +e.target.value; drawBody(); } })) : null),
      h('div', { class: 'mc-map-row' }, cv,
        h('div', { class: 'mc-map-info' },
          h('h3', {}, `${m.f.toFixed(1)} Hz`), h('p', {}, `${m.type} mode ${m.n.join(' · ')} — ${describeMode(m)} · ${noteOf(m.f).name}`),
          h('p', {}, h('b', {}, 'Pressure peaks: '), z.peaks), h('p', {}, h('b', {}, 'Pressure nulls: '), z.nodes.join('; ') || '—'),
          h('p', {}, h('b', {}, 'At the listener: '), `${Math.abs(at) > 0.75 ? 'near a PEAK (boomy)' : Math.abs(at) < 0.2 ? 'near a NULL (missing bass)' : 'in between'} (${(20 * Math.log10(Math.abs(at) + 1e-3)).toFixed(1)} dB re. max)`),
          h('div', { class: 'legend-bar' }, h('span', {}, '− max'), h('i', {}), h('span', {}, '+ max')),
          h('p', { class: 'hint' }, 'Red / blue = opposite phase at full pressure; white = null. Pressure-based traps (membranes, Helmholtz) work at the red/blue zones; porous absorbers work best where pressure is low (high particle velocity).'),
          h('div', { class: 'row gap wrap' },
            h('button', { class: 'btn small', onclick: () => playTone(m.f, { seconds: 5 }) }, '▶ Play tone'),
            h('button', { class: 'btn small primary', onclick: () => { app.showOverlay({ kind: 'mode', mode: m, R, height: st.sliceH }); m0.close(); } }, 'Show in 3D room'),
            h('button', { class: 'btn small', onclick: () => { st.trapF = m.f; st.tab = 'traps'; drawTabs(); drawBody(); } }, 'Design a trap for this')))));
  }

  function tabResponse() {
    const R = rep.R, fs = logFreqs(20, Math.min(300, st.fmax), 36);
    const srcs = st.which === 'both' ? rep.srcs : st.which === 'L' ? [rep.srcs[0]] : [rep.srcs[1] || rep.srcs[0]];
    const modes = rep.all.filter((m) => m.f < 450);
    const withT = normalise(modalResponse(R, modes, srcs, rep.ear, fs, true), fs);
    const bare = st.untreated ? normalise(modalResponse(R, modes, srcs, rep.ear, fs, false), fs) : null;
    const W = 760, H = 240, x = (f) => 40 + ((Math.log(f) - Math.log(20)) / (Math.log(fs[fs.length - 1]) - Math.log(20))) * (W - 50), y = (d) => 20 + ((20 - clamp(d, -30, 20)) / 50) * (H - 44);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart mc-chart">`;
    for (const d of [20, 10, 0, -10, -20, -30]) s += `<line x1="40" x2="${W - 10}" y1="${y(d)}" y2="${y(d)}" class="gl"/><text x="34" y="${y(d) + 3}" text-anchor="end">${d}</text>`;
    for (const f of [20, 30, 40, 50, 60, 80, 100, 150, 200, 300]) s += `<line x1="${x(f)}" x2="${x(f)}" y1="16" y2="${H - 24}" class="gl"/><text x="${x(f)}" y="${H - 8}" text-anchor="middle">${f}</text>`;
    s += `<rect x="40" y="${y(3)}" width="${W - 50}" height="${y(-3) - y(3)}" fill="rgba(61,220,151,0.08)"/>`;
    const path = (arr, cls) => `<path d="${arr.map((d, i) => `${i ? 'L' : 'M'}${x(fs[i]).toFixed(1)} ${y(d).toFixed(1)}`).join(' ')}" class="${cls}"/>`;
    if (bare) s += path(bare, 'resp bare');
    s += path(withT, 'resp');
    s += `<text x="${W - 12}" y="16" text-anchor="end" class="legend">— with treatment  ${bare ? '<tspan class="bare-t">— bare room</tspan>' : ''}</text></svg>`;
    const sdT = stdDev(withT.filter((_, i) => fs[i] >= 30 && fs[i] <= 150)), sdB = bare ? stdDev(bare.filter((_, i) => fs[i] >= 30 && fs[i] <= 150)) : null;
    const box = h('div', {});
    const sweepBtn = h('button', { class: 'btn small primary', onclick: () => {
      sweepBtn.disabled = true; sweepBtn.textContent = 'Searching…';
      setTimeout(() => {
        const sw = seatSweep(R, rep.all, srcs, rep.ear[1], 17, 23, app.insideFn());
        st.sweep = sw; drawBody();
      }, 30);
    } }, '🔍 Find best listening position');
    const sw = st.sweep;
    if (sw) {
      const cv = h('canvas', { class: 'mc-map small' }), scale = Math.min(300 / R.W, 300 / R.L);
      cv.width = Math.round(R.W * scale); cv.height = Math.round(R.L * scale);
      const vals = sw.grid.filter((v) => v != null), lo = Math.min(...vals), hi = Math.max(...vals);
      heat(cv, (i, j) => { const v = sw.grid[j * sw.nx + i]; return v == null ? null : -1 + (2 * (hi - v)) / Math.max(1e-6, hi - lo); }, sw.nx, sw.nz, (g) => {
        const P2 = (px, pz) => [(px + R.W / 2) * scale, (pz + R.L / 2) * scale];
        const [bx, bz] = P2(sw.best.x, sw.best.z); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(bx, bz, 9, 0, 7); g.stroke();
        const [lx, lz] = P2(rep.ear[0], rep.ear[2]); g.fillStyle = '#22c3c3'; g.beginPath(); g.arc(lx, lz, 5, 0, 7); g.fill();
        for (const s2 of srcs) { const [sx, sz] = P2(s2[0], s2[2]); g.fillStyle = '#ffb547'; g.beginPath(); g.arc(sx, sz, 5, 0, 7); g.fill(); }
      });
      box.append(h('div', { class: 'mc-map-row' }, cv, h('div', { class: 'mc-map-info' },
        h('p', {}, 'Smoothness of the 30–150 Hz response for every seat at ear height. ', h('b', {}, 'Red = smoothest'), ', blue = roughest. White ring = recommended seat (kept on the centre line, in front of the speakers).'),
        h('p', {}, `Best seat: ${fmtLen(sw.best.z + R.L / 2)} from the front wall (${(((sw.best.z + R.L / 2) / R.L) * 100).toFixed(0)} % of length), ±${sw.best.sd.toFixed(1)} dB deviation.`),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn small primary', onclick: () => { app.moveListener(sw.best.x, sw.best.z); app.toast('Listening position moved — speakers re-aimed', 'ok'); refresh(); } }, 'Move listening position here'),
          h('button', { class: 'btn small', onclick: () => { app.showOverlay({ kind: 'grid', sweep: sw, R }); m0.close(); } }, 'Show in 3D')))));
    }
    // LF decay
    const tb = THIRD_OCT.filter((c) => c >= 25 && c <= 250);
    const t1 = tb.map((c) => t60At(c, R, true)), t0 = tb.map((c) => t60At(c, R, false)), tmax = Math.max(0.6, ...t0, ...t1) * 1.1;
    let s3 = `<svg viewBox="0 0 760 170" class="chart mc-chart">`; const bw = 700 / tb.length;
    tb.forEach((c, i) => { const xx = 50 + i * bw, hh0 = (t0[i] / tmax) * 120, hh1 = (t1[i] / tmax) * 120; s3 += `<rect x="${xx + 4}" y="${140 - hh0}" width="${bw / 2 - 5}" height="${hh0}" class="bar bare"/><rect x="${xx + bw / 2}" y="${140 - hh1}" width="${bw / 2 - 5}" height="${hh1}" class="bar ${t1[i] > rep.t60mid * 1.6 ? 'bad' : 'good'}"/><text x="${xx + bw / 2}" y="156" text-anchor="middle">${c}</text><text x="${xx + bw * 0.75}" y="${136 - hh1}" text-anchor="middle" class="val">${t1[i].toFixed(2)}</text>`; });
    s3 += `<text x="756" y="14" text-anchor="end" class="legend">grey: bare room · colour: with treatment (s)</text></svg>`;
    return h('div', {},
      h('div', { class: 'row gap wrap' },
        h('div', { class: 'seg' }, [['both', 'Both speakers'], ['L', 'Left'], ['R', 'Right']].map(([k, l]) => h('button', { class: 'seg-btn' + (st.which === k ? ' active' : ''), onclick: () => { st.which = k; st.sweep = null; drawBody(); } }, l))),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.untreated, onchange: (e) => { st.untreated = e.target.checked; drawBody(); } }), ' Compare with bare room')),
      h('h4', {}, 'Simulated low-frequency response at the listening position'),
      h('div', { html: s }),
      h('p', { class: 'hint' }, `Modal simulation from your speaker and listener positions, room size and the absorption of every surface and item (incl. tuned traps). Deviation 30–150 Hz: ±${sdT.toFixed(1)} dB${sdB != null ? ` (bare room ±${sdB.toFixed(1)} dB)` : ''}. Rigid-wall model — real rooms are smoother; use it to compare options.`),
      h('div', { class: 'row gap wrap' }, sweepBtn), box,
      h('h4', {}, 'Low-frequency decay (RT60 per ⅓-octave)'), h('div', { html: s3 }));
  }

  function tabTreat() {
    const R = rep.R;
    const rows = rep.problems.slice(0, 10).map((p) => {
      const t = treatmentFor(p, R, rep.c, fmtLen);
      return h('div', { class: 'treat-card ' + (p.sev > 1.5 ? 'bad' : p.sev > 0.8 ? 'warn' : 'info') },
        h('div', { class: 'treat-f' }, h('b', {}, `${p.m.f.toFixed(1)} Hz`), h('small', {}, noteOf(p.m.f).name), h('small', {}, p.m.type)),
        h('div', {},
          h('p', {}, h('b', {}, describeMode(p.m)), p.tags.length ? ' — ' + p.tags.join(', ') : ''),
          h('p', {}, h('b', {}, 'Treat at: '), t.where),
          h('p', { class: 'hint' }, t.how),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn small', onclick: () => playTone(p.m.f, { seconds: 4 }) }, '▶'),
            h('button', { class: 'btn small', onclick: () => { st.sel = rep.modes.indexOf(p.m); st.tab = 'map'; drawTabs(); drawBody(); } }, 'Map'),
            h('button', { class: 'btn small', onclick: () => { app.showOverlay({ kind: 'mode', mode: p.m, R, height: rep.ear[1] }); m0.close(); } }, '3D'),
            h('button', { class: 'btn small primary', onclick: () => { app.addTunedTrap({ f: p.m.f, mode: p.m, kind: p.m.f < 120 ? 'membrane' : 'porous' }); app.toast(`Added a trap tuned to ${p.m.f.toFixed(0)} Hz`, 'ok'); refresh(); } }, '+ Add tuned trap'))));
    });
    const zones = [
      ['Vertical corners (tri-corners)', 'Every room mode has a pressure maximum in the corners — floor-to-ceiling superchunks / corner membranes treat all of them at once. First priority.'],
      ['Wall–ceiling & wall–floor edges', 'Tangential and height modes peak along these edges — soffit traps, thick clouds with a large air gap.'],
      ['Front wall behind the speakers', `Quarter-wave speaker-boundary cancellation (SBIR) and length modes. Thick absorption (≥ ${fmtLen(0.2)} with gap) or soffit-mount the speakers.`],
      ['Back wall', 'Length modes peak here and the reflection returns to the listener — deep bass traps low on the wall, diffusion at ear height.'],
      ['Side walls at first reflections', 'Mid/high-frequency imaging problems — broadband panels (see Acoustics ▸ First reflections).'],
      ['Ceiling above the mix position', 'Ceiling bounce + height modes — cloud with ≥ 10–30 cm air gap.'],
    ];
    return h('div', { class: 'treat' },
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn primary', onclick: () => { const n = app.addRecommended(rep); app.toast(`Added ${n} items for the worst modes`, 'ok'); refresh(); } }, '✨ Add recommended low-frequency treatment'),
        h('button', { class: 'btn', onclick: () => { st.tab = 'response'; drawTabs(); drawBody(); } }, 'Check the response')),
      h('h4', {}, 'Problem frequencies (ranked for your speaker & listener positions)'),
      rows.length ? rows : h('p', {}, 'No significant modal problems found in this range.'),
      h('h4', {}, 'Important zones to treat'),
      h('ol', { class: 'zones' }, zones.map(([t, d]) => h('li', {}, h('b', {}, t), h('br'), h('span', { class: 'hint' }, d)))));
  }

  function tabTraps() {
    const c = rep.c, f = st.trapF || rep.problems[0]?.m.f || 60;
    const out = h('div', { class: 'trap-grid' });
    // membrane
    const mem = { mass: st.memMass ?? 3.6, f };
    const memD = membraneDepth(mem.mass, f);
    const fIn = (val, set) => { const i = h('input', { type: 'number', step: 0.5, value: +val.toFixed(1) }); i.onchange = () => { set(+i.value); drawBody(); }; return i; };
    out.append(
      h('div', { class: 'trap-card' }, h('h4', {}, 'Membrane / panel trap'),
        h('label', { class: 'field' }, h('span', {}, 'Target frequency (Hz)'), fIn(f, (v) => (st.trapF = v))),
        h('label', { class: 'field' }, h('span', {}, 'Panel'), h('select', { onchange: (e) => { st.memMass = +e.target.value; drawBody(); } }, PANEL_MASSES.map(([n, m]) => h('option', { value: m, selected: m === mem.mass }, `${n} (${m} kg/m²)`)))),
        h('p', {}, 'Cavity depth: ', h('b', {}, fmtLen(memD)), memD > 0.4 ? h('span', { class: 'warn-t' }, ' — deep; use a heavier panel') : null),
        h('p', { class: 'hint' }, 'f ≈ 60 / √(m·d). Fill the cavity loosely with mineral wool (not touching the panel); seal edges airtight.'),
        h('button', { class: 'btn small primary', onclick: () => { app.addTunedTrap({ f, kind: 'membrane', depth: memD + 0.03 }); app.toast('Membrane trap added', 'ok'); } }, '+ Add to room')),
      (() => { const P = st.hP ?? 0.05, t = st.hT ?? 0.012, r = st.hR ?? 0.005, d = helmholtzDepth(c, P, t, r, f);
        const num = (label, val, set, step) => { const i = h('input', { type: 'number', step, value: val }); i.onchange = () => { set(+i.value); drawBody(); }; return h('label', { class: 'field' }, h('span', {}, label), i); };
        return h('div', { class: 'trap-card' }, h('h4', {}, 'Perforated Helmholtz panel'),
          num('Open area (%)', +(P * 100).toFixed(1), (v) => (st.hP = clamp(v, 0.5, 40) / 100), 0.5), num('Panel thickness (mm)', +(t * 1000).toFixed(1), (v) => (st.hT = v / 1000), 1), num('Hole diameter (mm)', +(r * 2000).toFixed(1), (v) => (st.hR = v / 2000), 1),
          h('p', {}, `Target ${f.toFixed(0)} Hz → cavity depth `, h('b', {}, fmtLen(d))),
          h('p', { class: 'hint' }, `Hole spacing for this open area: ${fmtLen(Math.sqrt((Math.PI * r * r) / P))} (square grid). f = c/2π·√(P / ((t+1.6r)·d)).`),
          h('button', { class: 'btn small primary', onclick: () => { app.addTunedTrap({ f, kind: 'helmholtz', depth: d + 0.02 }); app.toast('Helmholtz panel added', 'ok'); } }, '+ Add to room')); })(),
      (() => { const slot = st.sW ?? 0.006, slat = st.sL ?? 0.045, t = st.sT ?? 0.019, d = slotDepth(c, slot, slat, t, f);
        const num = (label, val, set) => { const i = h('input', { type: 'number', step: 1, value: val }); i.onchange = () => { set(+i.value); drawBody(); }; return h('label', { class: 'field' }, h('span', {}, label), i); };
        return h('div', { class: 'trap-card' }, h('h4', {}, 'Slot resonator'),
          num('Slot width (mm)', +(slot * 1000).toFixed(1), (v) => (st.sW = v / 1000)), num('Slat width (mm)', +(slat * 1000).toFixed(1), (v) => (st.sL = v / 1000)), num('Slat thickness (mm)', +(t * 1000).toFixed(1), (v) => (st.sT = v / 1000)),
          h('p', {}, `Target ${f.toFixed(0)} Hz → cavity depth `, h('b', {}, fmtLen(d))),
          h('button', { class: 'btn small primary', onclick: () => { app.addTunedTrap({ f, kind: 'slot', depth: d + 0.02, slot, slat }); app.toast('Slot resonator added', 'ok'); } }, '+ Add to room')); })(),
      (() => { const depth = st.pD ?? 0.2; const i = h('input', { type: 'number', step: ft() ? 0.5 : 0.01, value: +toU(depth).toFixed(2) }); i.onchange = () => { st.pD = fromU(+i.value); drawBody(); };
        return h('div', { class: 'trap-card' }, h('h4', {}, 'Porous absorber depth'),
          h('label', { class: 'field' }, h('span', {}, `Thickness + air gap (${uLab()})`), i),
          h('p', {}, 'Effective down to about ', h('b', {}, `${porousLowF(c, depth).toFixed(0)} Hz`)),
          h('p', {}, `For ${f.toFixed(0)} Hz you would need `, h('b', {}, fmtLen(c / (4 * f))), ' — quarter wavelength.'),
          h('p', { class: 'hint' }, 'Rule of thumb: porous traps reach roughly c / 4·(depth). An air gap behind a panel extends the range cheaply.')); })());
    return h('div', {}, h('p', { class: 'hint' }, `Design tuned traps for problem modes. Speed of sound ${c.toFixed(1)} m/s. Pick a mode in the Treatment or Pressure-map tabs to fill in the target frequency.`), out);
  }

  function tabRatios() {
    const W = 360, H = 300, x = (v) => 40 + ((v - 1) / 1.2) * (W - 60), y = (v) => H - 30 - ((v - 1) / 2) * (H - 50);
    let pts = '';
    for (let r1 = 1; r1 <= 2.2; r1 += 0.02) { const lo = 1.1 * r1 - 0.14, hi = Math.min(4.5 * r1 - 4, 3); if (hi > lo) pts += `${x(r1)},${y(Math.max(lo, 1))} `; }
    let up = ''; for (let r1 = 2.2; r1 >= 1; r1 -= 0.02) { const lo = 1.1 * r1 - 0.14, hi = Math.min(4.5 * r1 - 4, 3); if (hi > lo) up += `${x(r1)},${y(hi)} `; }
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart mc-chart small">`;
    for (let v = 1; v <= 2.2; v += 0.2) s += `<line x1="${x(v)}" x2="${x(v)}" y1="10" y2="${H - 30}" class="gl"/><text x="${x(v)}" y="${H - 14}" text-anchor="middle">${v.toFixed(1)}</text>`;
    for (let v = 1; v <= 3; v += 0.5) s += `<line x1="40" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="34" y="${y(v) + 3}" text-anchor="end">${v.toFixed(1)}</text>`;
    s += `<polygon points="${pts}${up}" fill="rgba(61,220,151,0.18)" stroke="rgba(61,220,151,0.6)"/>`;
    for (const n of NAMED_RATIOS) s += `<circle cx="${x(n.r[1])}" cy="${y(n.r[2])}" r="3.5" fill="#6aa8ff"><title>${n.name}</title></circle><text x="${x(n.r[1]) + 5}" y="${y(n.r[2]) - 4}" class="legend">${n.name}</text>`;
    s += `<circle cx="${x(clamp(rep.bolt.r1, 1, 2.2))}" cy="${y(clamp(rep.bolt.r2, 1, 3))}" r="7" fill="#ffb547" stroke="#000"><title>Your room</title></circle><text x="${W / 2}" y="${H - 2}" text-anchor="middle">width ÷ height</text></svg>`;
    const base = Math.min(st.L, st.W, st.H);
    return h('div', { class: 'mc-map-row' }, h('div', { html: s }),
      h('div', { class: 'mc-map-info' },
        h('p', {}, `Your ratio (smallest = 1): 1 : ${rep.bolt.r1.toFixed(2)} : ${rep.bolt.r2.toFixed(2)} — `, h('b', { class: rep.bolt.inBolt ? 'ok' : 'no' }, rep.bolt.inBolt ? 'inside the Bolt area' : 'outside the Bolt area')),
        h('p', { class: 'hint' }, 'The green region (Bolt, 1946) gives the smoothest modal spread for rectangular rooms. Points: classic recommended ratios.'),
        h('table', { class: 'tbl' }, h('tr', {}, h('th', {}, 'Ratio'), h('th', {}, '1 : W : L'), h('th', {}, `Dimensions at your ${fmtLen(base)} height`), h('th', {})),
          NAMED_RATIOS.map((n) => h('tr', {}, h('td', {}, n.name), h('td', {}, `1 : ${n.r[1]} : ${n.r[2]}`), h('td', {}, `${fmtLen(base * n.r[1])} × ${fmtLen(base * n.r[2])}`), h('td', {}, h('button', { class: 'btn small', onclick: () => { st.H = base; st.W = +(base * n.r[1]).toFixed(3); st.L = +(base * n.r[2]).toFixed(3); refresh(); } }, 'Try')))))));
  }

  function tabTone() {
    let vol = st.vol ?? 0.15;
    return h('div', { class: 'tone' },
      h('p', {}, 'Listen for modes in your real room: play a mode frequency and walk around — you will hear the pressure peaks (loud) and nulls (quiet). Start quietly; protect your speakers and ears.'),
      h('label', { class: 'field' }, h('span', {}, 'Volume'), h('input', { type: 'range', min: 0.02, max: 0.5, step: 0.01, value: vol, oninput: (e) => (st.vol = vol = +e.target.value) })),
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn primary', onclick: () => sweepTone(20, 200, 25, vol) }, '▶ Sweep 20 → 200 Hz (25 s)'),
        h('button', { class: 'btn', onclick: () => sweepTone(20, 120, 20, vol) }, '▶ Sweep 20 → 120 Hz'),
        h('button', { class: 'btn', onclick: () => stopTone() }, '■ Stop')),
      h('h4', {}, 'Play a room mode'),
      h('div', { class: 'tone-grid' }, rep.modes.filter((m) => m.type !== 'oblique').slice(0, 24).map((m) => h('button', { class: 'chip', onclick: () => playTone(m.f, { volume: vol, seconds: 5 }) }, `${m.f.toFixed(1)} Hz · ${describeMode(m)}`))));
  }

  function drawBody() {
    body.innerHTML = '';
    const map = { modes: tabModes, spectrum: tabSpectrum, map: tabMap, response: tabResponse, treat: tabTreat, traps: tabTraps, ratios: tabRatios, tone: tabTone };
    body.append(map[st.tab]());
  }
  function refresh() { recompute(); drawHead(); drawTabs(); drawBody(); }
  function exportCSV() {
    const lines = ['Hz,Type,Length,Width,Height,Description,Note,Cents,Wavelength (m)'];
    for (const m of rep.modes) { const nt = noteOf(m.f); lines.push([m.f.toFixed(2), m.type, ...m.n, `"${describeMode(m)}"`, nt.name, nt.cents, (rep.c / m.f).toFixed(3)].join(',')); }
    app.download('room-modes.csv', lines.join('\n'), 'text/csv');
  }

  recompute();
  const m0 = app.modal('Room Mode Calculator', h('div', { class: 'mode-calc' }, head, tabs, body), [], { wide: true, xwide: true });
  m0.el.addEventListener('closed', stopTone, { once: true });
  drawHead(); drawTabs(); drawBody();
  return m0;
}

function diverge(v) {
  // blue (−1) → white (0) → red (+1)
  const t = clamp(v, -1, 1);
  if (t >= 0) return [255, Math.round(255 - 190 * t), Math.round(255 - 215 * t)];
  return [Math.round(255 + 215 * t), Math.round(255 + 140 * t), 255];
}
export const divergeColor = diverge;
