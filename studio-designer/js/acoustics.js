// Room acoustics maths: Sabine / Eyring RT60, room modes, Bolt area,
// first-reflection points (image source), SBIR and listening-triangle checks.
// These are design estimates for planning, not a substitute for measurement.

export const BANDS = [125, 250, 500, 1000, 2000, 4000];
export const C = 343; // speed of sound m/s @ 20°C

// Absorption coefficients per octave band (125 Hz … 4 kHz). Values follow common
// published tables (rounded, capped at 1.0 for Sabine use).
export const ACOUSTIC_MATERIALS = {
  none:        { name: 'Acoustically neutral',            a: [0, 0, 0, 0, 0, 0] },
  drywall:     { name: 'Gypsum board on studs',            a: [0.29, 0.10, 0.05, 0.04, 0.07, 0.09] },
  double_drywall: { name: 'Double gypsum, insulated cavity', a: [0.20, 0.09, 0.05, 0.04, 0.05, 0.06] },
  concrete:    { name: 'Concrete / block (painted)',       a: [0.10, 0.05, 0.06, 0.07, 0.09, 0.08] },
  brick:       { name: 'Brick (unglazed)',                 a: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07] },
  plaster:     { name: 'Plaster on masonry',               a: [0.013, 0.015, 0.02, 0.03, 0.04, 0.05] },
  glass:       { name: 'Window glass',                     a: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04] },
  wood_floor:  { name: 'Wood floor on joists',             a: [0.15, 0.11, 0.10, 0.07, 0.06, 0.07] },
  tile_floor:  { name: 'Tile / stone floor',               a: [0.01, 0.01, 0.015, 0.02, 0.02, 0.02] },
  carpet:      { name: 'Carpet on concrete',               a: [0.02, 0.06, 0.14, 0.37, 0.60, 0.65] },
  carpet_pad:  { name: 'Carpet on underlay',               a: [0.08, 0.24, 0.57, 0.69, 0.71, 0.73] },
  ceiling_tile:{ name: 'Mineral-fibre ceiling tile',       a: [0.30, 0.32, 0.55, 0.75, 0.80, 0.75] },
  plywood:     { name: 'Plywood panelling',                a: [0.28, 0.22, 0.17, 0.09, 0.10, 0.11] },
  wood_hard:   { name: 'Solid wood / hard furniture',      a: [0.10, 0.07, 0.05, 0.05, 0.05, 0.05] },
  fabric_50:   { name: '50 mm mineral wool panel',         a: [0.17, 0.86, 1.00, 1.00, 1.00, 0.98] },
  fabric_100:  { name: '100 mm mineral wool panel',        a: [0.84, 1.00, 1.00, 1.00, 1.00, 0.97] },
  fabric_150:  { name: '150 mm panel + air gap',           a: [1.00, 1.00, 1.00, 1.00, 1.00, 0.97] },
  foam_50:     { name: '50 mm acoustic foam',              a: [0.08, 0.25, 0.60, 0.90, 0.95, 0.90] },
  pet_felt:    { name: '12 mm PET felt',                   a: [0.05, 0.12, 0.35, 0.65, 0.80, 0.85] },
  bass_trap:   { name: 'Porous corner bass trap',          a: [0.90, 1.00, 1.00, 1.00, 1.00, 0.95] },
  membrane:    { name: 'Membrane / limp-mass trap',        a: [0.85, 0.60, 0.30, 0.15, 0.10, 0.10] },
  helmholtz:   { name: 'Perforated Helmholtz panel',       a: [0.40, 0.90, 0.80, 0.50, 0.40, 0.30] },
  slat:        { name: 'Slat resonator / slotted panel',   a: [0.45, 0.75, 0.85, 0.65, 0.45, 0.35] },
  qrd:         { name: 'QRD diffuser (1D)',                a: [0.15, 0.20, 0.25, 0.30, 0.30, 0.30] },
  skyline:     { name: '2D skyline diffuser',              a: [0.10, 0.15, 0.20, 0.25, 0.25, 0.25] },
  poly:        { name: 'Polycylindrical diffuser',         a: [0.40, 0.30, 0.20, 0.15, 0.10, 0.10] },
  bad_panel:   { name: 'Binary amplitude (hybrid) panel',  a: [0.60, 0.95, 0.90, 0.70, 0.45, 0.35] },
  reflector:   { name: 'Hard reflector (wood / acrylic)',  a: [0.12, 0.10, 0.08, 0.06, 0.05, 0.05] },
  curtain:     { name: 'Heavy velour curtain (pleated)',   a: [0.14, 0.35, 0.55, 0.72, 0.70, 0.65] },
  tube_trap:   { name: 'Tube trap',                        a: [0.60, 0.70, 0.60, 0.50, 0.40, 0.40] },
  upholstered: { name: 'Upholstered furniture',            a: [0.35, 0.45, 0.60, 0.70, 0.70, 0.70] },
  books:       { name: 'Book shelf (filled)',              a: [0.20, 0.25, 0.30, 0.30, 0.30, 0.30] },
};

export const DIFFUSIVE = new Set(['qrd', 'skyline', 'poly', 'bad_panel', 'books']);

export const SURFACES = ['front', 'back', 'left', 'right', 'floor', 'ceiling'];

export function surfaceArea(room, s) {
  if (s === 'front' || s === 'back') return room.w * room.h;
  if (s === 'left' || s === 'right') return room.d * room.h;
  return room.w * room.d;
}

// Air absorption (4mV) at 20°C / 50 % RH, per band.
const AIR_M = [0.0001, 0.0002, 0.0005, 0.001, 0.0024, 0.0066];

/**
 * RT60 estimate. `items` is [{acoustic, area}] from the catalogue.
 */
export function reverbTime(room, items) {
  const V = room.w * room.h * room.d;
  const surfaces = SURFACES.map((s) => ({ s, area: surfaceArea(room, s), mat: room.surfaces[s].acoustic }));
  const S = surfaces.reduce((t, x) => t + x.area, 0);
  const bands = BANDS.map((f, i) => {
    let A = 0;
    for (const x of surfaces) A += x.area * ((ACOUSTIC_MATERIALS[x.mat] || ACOUSTIC_MATERIALS.drywall).a[i]);
    let itemsA = 0;
    for (const it of items) itemsA += it.area * ((ACOUSTIC_MATERIALS[it.acoustic] || ACOUSTIC_MATERIALS.none).a[i]);
    A += itemsA;
    const air = 4 * AIR_M[i] * V;
    const Atot = A + air;
    const abar = Math.min(0.99, A / S);
    const sabine = 0.161 * V / Math.max(Atot, 0.01);
    const eyring = 0.161 * V / (-S * Math.log(1 - abar) + air);
    return { f, A: Atot, itemsA, sabine, eyring, abar };
  });
  // EBU Tech 3276 reference for critical listening rooms
  const target = 0.25 * Math.cbrt(V / 100);
  const mid = (bands[2].sabine + bands[3].sabine) / 2;
  return { V, S, bands, target, mid, schroeder: 2000 * Math.sqrt(Math.max(mid, 0.05) / V) };
}

export function roomModes(room, fmax = 300) {
  const { w, h, d } = room;
  const out = [];
  const nMax = (L) => Math.floor((2 * L * fmax) / C) + 1;
  for (let nx = 0; nx <= nMax(d); nx++) for (let ny = 0; ny <= nMax(w); ny++) for (let nz = 0; nz <= nMax(h); nz++) {
    if (!nx && !ny && !nz) continue;
    const f = (C / 2) * Math.sqrt((nx / d) ** 2 + (ny / w) ** 2 + (nz / h) ** 2);
    if (f > fmax) continue;
    const zeros = [nx, ny, nz].filter((n) => n === 0).length;
    const type = zeros === 2 ? 'axial' : zeros === 1 ? 'tangential' : 'oblique';
    out.push({ f, n: [nx, ny, nz], type });
  }
  out.sort((a, b) => a.f - b.f);
  return out;
}

/** Axial-mode issues: coincident (within 5 %) and large gaps (> 20 Hz below 200 Hz). */
export function modeIssues(modes) {
  const ax = modes.filter((m) => m.type === 'axial');
  const issues = [];
  for (let i = 1; i < ax.length; i++) {
    const a = ax[i - 1], b = ax[i];
    if ((b.f - a.f) / a.f < 0.05) issues.push({ kind: 'cluster', f: (a.f + b.f) / 2, text: `Coincident axial modes near ${a.f.toFixed(0)}–${b.f.toFixed(0)} Hz` });
    if (b.f < 200 && b.f - a.f > 20) issues.push({ kind: 'gap', f: (a.f + b.f) / 2, text: `Gap of ${(b.f - a.f).toFixed(0)} Hz between ${a.f.toFixed(0)} and ${b.f.toFixed(0)} Hz` });
  }
  return issues;
}

export const NAMED_RATIOS = [
  { name: 'Sepmeyer A', r: [1, 1.14, 1.39] },
  { name: 'Sepmeyer B', r: [1, 1.28, 1.54] },
  { name: 'Louden', r: [1, 1.4, 1.9] },
  { name: 'Bolt', r: [1, 1.5, 2.5] },
  { name: 'IEC 60268-13', r: [1, 1.6, 2.33] },
  { name: 'Golden', r: [1, 1.618, 2.618] },
];

export function ratioCheck(room) {
  const dims = [room.h, room.w, room.d].sort((a, b) => a - b);
  const r = [1, dims[1] / dims[0], dims[2] / dims[0]];
  // Bolt area (normalised to smallest dimension)
  const inBolt = r[2] >= 1.1 * r[1] - 0.14 && r[2] <= 4.5 * r[1] - 4 && r[2] < 3 && r[1] < 2;
  let best = null;
  for (const n of NAMED_RATIOS) {
    const err = Math.hypot(n.r[1] - r[1], n.r[2] - r[2]);
    if (!best || err < best.err) best = { ...n, err };
  }
  return { r, inBolt, best };
}

/** Mirror-image first-reflection point of source S on a room surface, seen from listener L. */
export function reflectionPoint(room, S, L, surface) {
  const planes = {
    left: { axis: 0, v: -room.w / 2 }, right: { axis: 0, v: room.w / 2 },
    floor: { axis: 1, v: 0 }, ceiling: { axis: 1, v: room.h },
    front: { axis: 2, v: -room.d / 2 }, back: { axis: 2, v: room.d / 2 },
  };
  const p = planes[surface];
  const img = S.slice(); img[p.axis] = 2 * p.v - S[p.axis];
  const denom = L[p.axis] - img[p.axis];
  if (Math.abs(denom) < 1e-6) return null;
  const t = (p.v - img[p.axis]) / denom;
  if (t <= 0 || t >= 1) return null;
  const pt = [0, 1, 2].map((k) => img[k] + (L[k] - img[k]) * t);
  pt[p.axis] = p.v;
  const direct = Math.hypot(L[0] - S[0], L[1] - S[1], L[2] - S[2]);
  const reflected = Math.hypot(L[0] - img[0], L[1] - img[1], L[2] - img[2]);
  const delayMs = ((reflected - direct) / C) * 1000;
  // Inside bounds of the surface?
  const inside = Math.abs(pt[0]) <= room.w / 2 + 1e-6 && pt[1] >= -1e-6 && pt[1] <= room.h + 1e-6 && Math.abs(pt[2]) <= room.d / 2 + 1e-6;
  return inside ? { surface, point: pt, delayMs, levelDb: 20 * Math.log10(direct / reflected) } : null;
}

export function sbir(room, speakerPos) {
  const dFront = speakerPos[2] + room.d / 2;
  const dSide = room.w / 2 - Math.abs(speakerPos[0]);
  const dFloor = speakerPos[1];
  const f = (dist) => C / (4 * Math.max(dist, 0.01));
  return { front: { d: dFront, f: f(dFront) }, side: { d: dSide, f: f(dSide) }, floor: { d: dFloor, f: f(dFloor) } };
}

export function listeningTriangle(L, SL, SR) {
  const v = (a, b) => [b[0] - a[0], b[2] - a[2]];
  const a = v(L, SL), b = v(L, SR);
  const la = Math.hypot(...a), lb = Math.hypot(...b);
  const ang = (Math.acos((a[0] * b[0] + a[1] * b[1]) / (la * lb)) * 180) / Math.PI;
  const spread = Math.hypot(SR[0] - SL[0], SR[2] - SL[2]);
  return { angle: ang, dl: la, dr: lb, spread };
}
