// Studio construction & isolation materials, wall / floor / ceiling build-up
// presets and a sound-insulation estimator (mass law, mass–air–mass resonance,
// decoupling, ISO 717-style single-number rating). All figures are typical
// generic values for planning — check manufacturer data for real projects.

// kind = how the layer behaves and renders:
//   board / masonry / membrane / glazing → mass leaves
//   cavity / insulation / studs / joists / battens / channel / clips / hangers / pads / springs / underlay → spacing & decoupling
//   damping → viscoelastic layer between boards; sealant → perimeter seal; finish → surface finish
const M = (id, name, cat, kind, o = {}) => ({ id, name, cat, kind, t: 0.0125, color: '#cccccc', finish: 'paint', ...o });

export const MAT_CATS = ['Mass & boards', 'Structure & masonry', 'Damping', 'Decoupling hardware', 'Framing', 'Insulation & cavity', 'Seals & joints', 'Floor build-up', 'Glazing', 'Treatment media', 'Finishes'];

export const STUDIO_MATERIALS = [
  // ---- mass & boards (density kg/m³)
  M('gyp12', 'Gypsum board 12.5 mm', 'Mass & boards', 'board', { t: 0.0125, rho: 690, color: '#e9e7e2', note: 'Standard plasterboard / drywall. Cheap mass; use 2+ layers with damping between.' }),
  M('gyp15', 'Gypsum board 15 mm', 'Mass & boards', 'board', { t: 0.015, rho: 700, color: '#e6e4de' }),
  M('gypX', 'Fire-rated gypsum (Type X) 15.9 mm', 'Mass & boards', 'board', { t: 0.0159, rho: 760, color: '#f0d6d6', note: 'Denser core, also needed for fire ratings.' }),
  M('gypSound', 'High-density acoustic gypsum 15 mm', 'Mass & boards', 'board', { t: 0.015, rho: 850, color: '#cfe0f0', note: 'Heavier "sound" board — more mass per layer.' }),
  M('gypDamped', 'Laminated damped gypsum 13 mm', 'Mass & boards', 'board', { t: 0.013, rho: 900, color: '#d9e9d9', damped: true, note: 'Factory-laminated board with viscoelastic core (constrained-layer damping).' }),
  M('cementBoard', 'Cement board 12 mm', 'Mass & boards', 'board', { t: 0.012, rho: 1250, color: '#b9b6ae', finish: 'concrete' }),
  M('fibreGyp', 'Gypsum fibreboard 12.5 mm', 'Mass & boards', 'board', { t: 0.0125, rho: 1150, color: '#e0ddd5', note: 'Dense, stiff; good for floating floors and impact.' }),
  M('osb18', 'OSB 18 mm', 'Mass & boards', 'board', { t: 0.018, rho: 620, color: '#c8a26a', finish: 'wood', note: 'Sheathing / backing for screws and heavy treatment.' }),
  M('ply12', 'Plywood 12 mm', 'Mass & boards', 'board', { t: 0.012, rho: 550, color: '#dcc095', finish: 'plywood' }),
  M('ply18', 'Plywood 18 mm', 'Mass & boards', 'board', { t: 0.018, rho: 550, color: '#dcc095', finish: 'plywood', note: 'Floating-floor decks, wall backing, cabinetry.' }),
  M('mdf18', 'MDF 18 mm', 'Mass & boards', 'board', { t: 0.018, rho: 750, color: '#b48a5a', finish: 'wood', note: 'Dense and well damped — doors, diffusers, speaker boxes.' }),
  M('particle18', 'Particleboard 18 mm', 'Mass & boards', 'board', { t: 0.018, rho: 680, color: '#c9b08a', finish: 'wood' }),
  M('clt100', 'CLT / solid timber panel 100 mm', 'Mass & boards', 'board', { t: 0.1, rho: 480, color: '#d9b47e', finish: 'wood' }),
  M('mlv5', 'Mass-loaded vinyl 5 kg/m²', 'Mass & boards', 'membrane', { t: 0.0025, mass: 5, color: '#26272a', finish: 'rubber', note: 'Limp mass layer; seal all seams. Best sandwiched between boards.' }),
  M('mlv10', 'Mass-loaded vinyl 10 kg/m²', 'Mass & boards', 'membrane', { t: 0.0048, mass: 10, color: '#1d1e20', finish: 'rubber' }),
  M('leadSheet', 'Lead sheet 1.8 mm (code 4)', 'Mass & boards', 'membrane', { t: 0.0018, mass: 20, color: '#7d8186', finish: 'metal', note: 'Historic / special use only.' }),
  // ---- structure
  M('concrete150', 'Concrete 150 mm', 'Structure & masonry', 'masonry', { t: 0.15, rho: 2300, color: '#9a9a96', finish: 'concrete' }),
  M('concrete200', 'Concrete 200 mm', 'Structure & masonry', 'masonry', { t: 0.2, rho: 2300, color: '#9a9a96', finish: 'concrete' }),
  M('blockDense', 'Dense concrete block 190 mm (filled)', 'Structure & masonry', 'masonry', { t: 0.19, rho: 2000, color: '#a9a6a0', finish: 'concrete' }),
  M('blockHollow', 'Hollow concrete block 190 mm', 'Structure & masonry', 'masonry', { t: 0.19, rho: 1100, color: '#b3b0aa', finish: 'concrete' }),
  M('brick215', 'Solid brick 215 mm', 'Structure & masonry', 'masonry', { t: 0.215, rho: 1800, color: '#b5654a', finish: 'brick' }),
  M('brick102', 'Brick 102 mm (half brick)', 'Structure & masonry', 'masonry', { t: 0.102, rho: 1800, color: '#b5654a', finish: 'brick' }),
  M('aac', 'Aerated (AAC) block 150 mm', 'Structure & masonry', 'masonry', { t: 0.15, rho: 500, color: '#e3e1db', finish: 'concrete', note: 'Light — poor isolation for its thickness.' }),
  M('screed', 'Sand/cement screed 50 mm', 'Structure & masonry', 'masonry', { t: 0.05, rho: 2000, color: '#a3a19b', finish: 'concrete' }),
  M('timberFloor', 'Existing timber floor (boards on joists)', 'Structure & masonry', 'board', { t: 0.022, rho: 600, color: '#b88a5c', finish: 'plank' }),
  // ---- damping
  M('damping', 'Viscoelastic damping compound (2 tubes/sheet)', 'Damping', 'damping', { t: 0.001, mass: 0.8, color: '#4f8f6b', note: 'Between two rigid boards — converts vibration to heat (constrained-layer damping). Not a sealant.' }),
  M('dampTape', 'Damping tape / pads', 'Damping', 'damping', { t: 0.001, mass: 0.3, color: '#6aa88a' }),
  M('cldSheet', 'Constrained-layer damping sheet', 'Damping', 'damping', { t: 0.002, mass: 2, color: '#3b7a5a' }),
  // ---- decoupling hardware (q = decoupling quality 0…1)
  M('isoClip', 'Rubber isolation clip + hat channel', 'Decoupling hardware', 'clips', { t: 0.04, q: 0.9, s: 0.6, rows: 0.6, color: '#1d1d1f', finish: 'rubber', note: 'Clips at studs every ~600 × 1200 mm; 25 mm hat channel snaps in. Board must not touch floor/ceiling — leave 6 mm gap + sealant.' }),
  M('hatChannel', 'Steel hat / furring channel 25 mm (rigid)', 'Decoupling hardware', 'channel', { t: 0.025, q: 0.35, s: 0.6, color: '#9aa0a6', finish: 'metal', note: 'Rigid when screwed directly — use on clips or hangers to decouple.' }),
  M('rc', 'Resilient channel 12.7 mm', 'Decoupling hardware', 'channel', { t: 0.0127, q: 0.7, s: 0.6, color: '#b3b8bd', finish: 'metal', note: 'Easily short-circuited by a single screw into a stud.' }),
  M('woodChannel', 'Timber batten / wood channel 25 × 50', 'Decoupling hardware', 'battens', { t: 0.025, q: 0.2, s: 0.4, color: '#d2a96f', finish: 'wood', note: 'Rigid furring — adds a cavity but little decoupling.' }),
  M('isoHanger', 'Neoprene isolation hanger + steel channel', 'Decoupling hardware', 'hangers', { t: 0.1, q: 0.9, s: 1.2, color: '#c0c4c8', finish: 'metal', note: 'Ceiling suspended on rubber-in-shear hangers from joists/slab.' }),
  M('springHanger', 'Spring isolation hanger + steel channel', 'Decoupling hardware', 'hangers', { t: 0.15, q: 0.97, s: 1.2, color: '#c0c4c8', finish: 'metal', spring: true, note: 'Lowest natural frequency (≈ 3–5 Hz) — best for heavy ceilings.' }),
  M('isoPad', 'Neoprene isolation pads / pucks (floor)', 'Decoupling hardware', 'pads', { t: 0.025, q: 0.85, s: 0.4, color: '#2b2c2e', finish: 'rubber', note: 'Under sleepers or a plywood deck; size the pad for the load.' }),
  M('springMount', 'Spring floor isolators (jack-up slab)', 'Decoupling hardware', 'springs', { t: 0.05, q: 0.97, s: 0.9, color: '#c23b3b', finish: 'metal', note: 'Concrete floating slab on steel springs — drum rooms, live rooms.' }),
  M('elastomerStrip', 'Elastomeric bearing strip', 'Decoupling hardware', 'pads', { t: 0.0125, q: 0.75, s: 0.6, color: '#3a3b3e', finish: 'rubber' }),
  // ---- framing
  M('stud2x4', 'Timber studs 45 × 95 (2×4) @ 600', 'Framing', 'studs', { t: 0.095, w: 0.045, s: 0.6, q: 0.3, color: '#d2a96f', finish: 'wood' }),
  M('stud2x6', 'Timber studs 45 × 145 (2×6) @ 600', 'Framing', 'studs', { t: 0.145, w: 0.045, s: 0.6, q: 0.3, color: '#d2a96f', finish: 'wood' }),
  M('steelStud70', 'Steel C-studs 70 mm @ 600', 'Framing', 'studs', { t: 0.07, w: 0.05, s: 0.6, q: 0.45, color: '#a7adb3', finish: 'metal', note: 'Light-gauge studs are more flexible than timber → better isolation.' }),
  M('steelStud92', 'Steel C-studs 92 mm @ 600', 'Framing', 'studs', { t: 0.092, w: 0.05, s: 0.6, q: 0.45, color: '#a7adb3', finish: 'metal' }),
  M('staggered', 'Staggered studs 2×4 on 2×6 plate', 'Framing', 'studs', { t: 0.145, w: 0.045, s: 0.3, q: 0.6, stagger: true, color: '#d2a96f', finish: 'wood' }),
  M('doubleStud', 'Independent stud wall (room-in-room)', 'Framing', 'studs', { t: 0.095, w: 0.045, s: 0.6, q: 0.95, color: '#c99a5a', finish: 'wood', note: 'Own frame, no contact with the existing structure — the gold standard.' }),
  M('joist195', 'Timber joists 45 × 195 @ 400', 'Framing', 'joists', { t: 0.195, w: 0.045, s: 0.4, q: 0.3, color: '#d2a96f', finish: 'wood' }),
  M('sleeper70', 'Timber sleepers 45 × 70 @ 400', 'Framing', 'joists', { t: 0.07, w: 0.045, s: 0.4, q: 0.4, color: '#d2a96f', finish: 'wood' }),
  M('steelJoist', 'Light steel joists 150 mm @ 600', 'Framing', 'joists', { t: 0.15, w: 0.05, s: 0.6, q: 0.4, color: '#a7adb3', finish: 'metal' }),
  // ---- insulation & cavity
  M('airGap', 'Air gap', 'Insulation & cavity', 'cavity', { t: 0.05, q: 1, color: '#9fd3ff', note: 'Deeper gaps lower the mass–air–mass resonance.' }),
  M('mw40', 'Mineral wool batt 40 kg/m³', 'Insulation & cavity', 'insulation', { t: 0.075, rho: 40, color: '#d8c48a', finish: 'felt', note: 'Fill stud cavities to damp the cavity resonance (+4–8 dB).' }),
  M('mw60', 'Mineral wool slab 60 kg/m³', 'Insulation & cavity', 'insulation', { t: 0.1, rho: 60, color: '#cdb877', finish: 'felt' }),
  M('mw100', 'Rigid mineral wool 100 kg/m³', 'Insulation & cavity', 'insulation', { t: 0.05, rho: 100, color: '#bba564', finish: 'felt', note: 'Under floating floors and in dense panels.' }),
  M('glassWool', 'Glass wool batt 12–16 kg/m³', 'Insulation & cavity', 'insulation', { t: 0.09, rho: 14, color: '#f0d57a', finish: 'felt' }),
  M('rigidFG48', 'Rigid fibreglass 48 kg/m³ (3 pcf)', 'Insulation & cavity', 'insulation', { t: 0.05, rho: 48, color: '#ecd27c', finish: 'felt', note: 'Classic panel / trap core.' }),
  M('rigidFG96', 'Rigid fibreglass 96 kg/m³ (6 pcf)', 'Insulation & cavity', 'insulation', { t: 0.05, rho: 96, color: '#e0c46a', finish: 'felt' }),
  M('polyBatt', 'Polyester (PET) batt', 'Insulation & cavity', 'insulation', { t: 0.075, rho: 20, color: '#f2f2f2', finish: 'felt' }),
  M('cellulose', 'Blown cellulose', 'Insulation & cavity', 'insulation', { t: 0.09, rho: 50, color: '#9e8f7a', finish: 'felt' }),
  M('woodFibre', 'Wood-fibre insulation board', 'Insulation & cavity', 'insulation', { t: 0.06, rho: 160, color: '#a57b52', finish: 'cork' }),
  M('cottonBatt', 'Recycled cotton / denim batt', 'Insulation & cavity', 'insulation', { t: 0.09, rho: 25, color: '#6b85a8', finish: 'felt' }),
  // ---- seals & joints
  M('sealant', 'Non-hardening acoustic sealant (perimeter)', 'Seals & joints', 'sealant', { t: 0, color: '#ece8df', note: 'Seal every board edge, gap and penetration — air leaks kill isolation.' }),
  M('perimeterStrip', 'Resilient perimeter isolation strip', 'Seals & joints', 'sealant', { t: 0, color: '#2b2c2e', note: 'Separates floating floors / walls from the structure at the edges.' }),
  M('puttyPad', 'Acoustic putty pads (outlets & boxes)', 'Seals & joints', 'sealant', { t: 0, color: '#555' }),
  M('backerRod', 'Backer rod + sealant joint', 'Seals & joints', 'sealant', { t: 0, color: '#bbb' }),
  // ---- floor build-up
  M('rubberUnderlay10', 'Recycled rubber underlay 10 mm', 'Floor build-up', 'underlay', { t: 0.01, mass: 8, q: 0.5, color: '#2b2c2e', finish: 'rubber', note: 'Impact & modest airborne improvement under a floating deck.' }),
  M('corkUnderlay', 'Cork underlay 6 mm', 'Floor build-up', 'underlay', { t: 0.006, mass: 1.2, q: 0.3, color: '#c49a6c', finish: 'cork' }),
  M('foamUnderlay', 'Foam / felt underlay 3 mm', 'Floor build-up', 'underlay', { t: 0.003, mass: 0.3, q: 0.15, color: '#8a8d91', finish: 'felt' }),
  M('hardwood20', 'Hardwood flooring 20 mm', 'Floor build-up', 'board', { t: 0.02, rho: 700, color: '#b88a5c', finish: 'plank' }),
  M('engineered14', 'Engineered wood flooring 14 mm', 'Floor build-up', 'board', { t: 0.014, rho: 650, color: '#a87a4c', finish: 'parquet' }),
  M('rubberFloor', 'Rubber floor tiles 10 mm', 'Floor build-up', 'board', { t: 0.01, rho: 1300, color: '#3a3d42', finish: 'rubber' }),
  M('carpetPad', 'Carpet on underlay', 'Floor build-up', 'board', { t: 0.015, rho: 200, color: '#6e6a64', finish: 'carpet' }),
  // ---- glazing
  M('float6', 'Float glass 6 mm', 'Glazing', 'glazing', { t: 0.006, rho: 2500, color: '#cfe8ff', finish: 'glass' }),
  M('lam68', 'Laminated acoustic glass 6.8 mm', 'Glazing', 'glazing', { t: 0.0068, rho: 2500, damped: true, color: '#cfe8dc', finish: 'acousticGlass' }),
  M('lam108', 'Laminated acoustic glass 10.8 mm', 'Glazing', 'glazing', { t: 0.0108, rho: 2500, damped: true, color: '#cfe8dc', finish: 'acousticGlass' }),
  M('float10', 'Float glass 10 mm', 'Glazing', 'glazing', { t: 0.01, rho: 2500, color: '#cfe8ff', finish: 'glass' }),
  // ---- treatment media (exposed absorbers)
  M('melamine50', 'Melamine foam 50 mm', 'Treatment media', 'insulation', { t: 0.05, rho: 9, color: '#e8e8e6', finish: 'foam', ac: 'foam_50' }),
  M('puFoam50', 'Polyurethane acoustic foam 50 mm', 'Treatment media', 'insulation', { t: 0.05, rho: 30, color: '#2a2a2e', finish: 'foam', ac: 'foam_50' }),
  M('woodWool25', 'Wood-wool panel 25 mm', 'Treatment media', 'board', { t: 0.025, rho: 400, color: '#d6c39e', finish: 'cork', ac: 'pet_felt' }),
  M('petFelt12', 'PET felt panel 12 mm', 'Treatment media', 'board', { t: 0.012, rho: 200, color: '#7d8b74', finish: 'felt', ac: 'pet_felt' }),
  M('perfMDF', 'Perforated / grooved MDF panel 16 mm', 'Treatment media', 'board', { t: 0.016, rho: 750, color: '#c49a6c', finish: 'perforated', ac: 'helmholtz' }),
  M('acPlaster', 'Seamless acoustic plaster system 30 mm', 'Treatment media', 'board', { t: 0.03, rho: 300, color: '#f1eee8', finish: 'plaster', ac: 'fabric_50' }),
  M('stretchFabric', 'Stretched fabric wall system (track + 50 mm core)', 'Treatment media', 'insulation', { t: 0.05, rho: 48, color: '#5a6470', finish: 'linen', ac: 'fabric_50' }),
  M('acFabric', 'Acoustically transparent fabric', 'Treatment media', 'finish', { t: 0.001, color: '#3b4a5a', finish: 'fabric' }),
  M('mineralTile', 'Mineral-fibre ceiling tile 15 mm', 'Treatment media', 'board', { t: 0.015, rho: 250, color: '#f4f4f2', finish: 'concrete', ac: 'ceiling_tile' }),
  // ---- finishes
  M('paintFinish', 'Paint (finish only)', 'Finishes', 'finish', { t: 0, color: '#ece8df' }),
  M('veneer', 'Wood veneer / panelling 10 mm', 'Finishes', 'board', { t: 0.01, rho: 600, color: '#c49a6c', finish: 'oak' }),
  M('tileFinish', 'Ceramic tile + adhesive 12 mm', 'Finishes', 'board', { t: 0.012, rho: 2000, color: '#f4f4f2', finish: 'subway' }),
];
export const SMAT = Object.fromEntries(STUDIO_MATERIALS.map((m) => [m.id, m]));
export const MASS_KINDS = new Set(['board', 'masonry', 'membrane', 'glazing']);
export const LAYER_GROUP = { board: 'boards', masonry: 'structure', membrane: 'membranes', glazing: 'boards', damping: 'membranes', underlay: 'membranes', cavity: 'insulation', insulation: 'insulation', studs: 'framing', joists: 'framing', battens: 'framing', channel: 'hardware', clips: 'hardware', hangers: 'hardware', pads: 'hardware', springs: 'hardware', sealant: 'hardware', finish: 'boards' };

export function layerMass(L) {
  const m = SMAT[L.mat]; if (!m) return 0;
  if (m.mass != null) return m.mass * ((L.t ?? m.t) / (m.t || 1) || 1);
  if (m.kind === 'studs' || m.kind === 'joists') return (m.rho ?? 500) * (L.t ?? m.t) * (m.w || 0.045) / (L.s ?? m.s ?? 0.6);
  return (m.rho ?? 0) * (L.t ?? m.t);
}

// ---------------------------------------------------------------- presets (room side first, outward)
const Ly = (mat, o = {}) => ({ mat, t: o.t ?? SMAT[mat].t, ...(SMAT[mat].s ? { s: SMAT[mat].s } : {}), ...o });
export const ASSEMBLIES = {
  wall: {
    none: { name: 'Plain wall (no build-up)', layers: [] },
    masonry: { name: 'Existing masonry wall', layers: [Ly('brick215')] },
    stud: { name: 'Single stud + 1× drywall each side', layers: [Ly('gyp12'), Ly('stud2x4'), Ly('mw40', { t: 0.075 }), Ly('gyp12')] },
    stud2: { name: 'Single stud + 2× drywall + damping', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('stud2x4'), Ly('mw40', { t: 0.075 }), Ly('gyp15'), Ly('damping'), Ly('gyp15')] },
    rc: { name: 'Resilient channel + 2× drywall', layers: [Ly('gyp15'), Ly('gyp15'), Ly('rc'), Ly('stud2x4'), Ly('mw40', { t: 0.075 }), Ly('gyp15')] },
    clips: { name: 'Isolation clips + hat channel + 2× drywall (on masonry)', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('isoClip'), Ly('mw40', { t: 0.04 }), Ly('blockDense')] },
    clipsStud: { name: 'Clips + hat channel on stud wall (MLV)', layers: [Ly('gypSound'), Ly('damping'), Ly('gypSound'), Ly('isoClip'), Ly('stud2x6'), Ly('mw40', { t: 0.1 }), Ly('mlv5'), Ly('osb18')] },
    staggered: { name: 'Staggered stud wall', layers: [Ly('gyp15'), Ly('gyp15'), Ly('staggered'), Ly('mw40', { t: 0.1 }), Ly('gyp15'), Ly('gyp15')] },
    roomInRoom: { name: 'Room-in-room: independent stud wall + air gap + masonry', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('doubleStud'), Ly('mw60', { t: 0.095 }), Ly('airGap', { t: 0.05 }), Ly('concrete150')] },
    doubleStud: { name: 'Double stud wall (two independent frames)', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('stud2x4'), Ly('mw40', { t: 0.095 }), Ly('airGap', { t: 0.025 }), Ly('doubleStud'), Ly('mw40', { t: 0.095 }), Ly('gyp15'), Ly('damping'), Ly('gyp15')] },
    steel: { name: 'Steel stud + 2× drywall each side', layers: [Ly('gyp15'), Ly('gyp15'), Ly('steelStud92'), Ly('mw40', { t: 0.09 }), Ly('gyp15'), Ly('gyp15')] },
    battens: { name: 'Wood battens + plywood + drywall (treatment-ready)', layers: [Ly('gyp12'), Ly('ply12'), Ly('woodChannel'), Ly('mw40', { t: 0.025 }), Ly('blockHollow')] },
  },
  floor: {
    none: { name: 'Plain floor (no build-up)', layers: [] },
    slab: { name: 'Concrete slab', layers: [Ly('concrete150')] },
    padsDeck: { name: 'Floating floor: 2× ply on sleepers + isolation pads', layers: [Ly('ply18'), Ly('damping'), Ly('ply18'), Ly('sleeper70'), Ly('mw100', { t: 0.07 }), Ly('isoPad'), Ly('concrete150')] },
    underlay: { name: 'Floating deck on rubber underlay', layers: [Ly('engineered14'), Ly('ply18'), Ly('damping'), Ly('ply18'), Ly('rubberUnderlay10'), Ly('concrete150')] },
    screed: { name: 'Floating screed on rigid mineral wool', layers: [Ly('screed', { t: 0.065 }), Ly('mw100', { t: 0.025 }), Ly('concrete150')] },
    springSlab: { name: 'Spring-isolated concrete slab (jack-up)', layers: [Ly('concrete150', { t: 0.1 }), Ly('springMount'), Ly('airGap', { t: 0.05 }), Ly('concrete200')] },
    joists: { name: 'Raised timber floor on joists', layers: [Ly('hardwood20'), Ly('ply18'), Ly('joist195'), Ly('mw40', { t: 0.1 }), Ly('timberFloor')] },
  },
  ceiling: {
    none: { name: 'Plain ceiling (no build-up)', layers: [] },
    plain: { name: 'Drywall on joists', layers: [Ly('gyp12'), Ly('joist195'), Ly('mw40', { t: 0.1 })] },
    rc: { name: 'Resilient channel ceiling', layers: [Ly('gyp15'), Ly('gyp15'), Ly('rc'), Ly('joist195'), Ly('mw40', { t: 0.15 })] },
    clips: { name: 'Clips + hat channel + 2× drywall + damping', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('isoClip'), Ly('joist195'), Ly('mw40', { t: 0.15 }), Ly('ply18')] },
    hangers: { name: 'Spring hangers + steel channel + 2× drywall', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('springHanger'), Ly('mw60', { t: 0.1 }), Ly('airGap', { t: 0.15 }), Ly('concrete200')] },
    independent: { name: 'Independent joist ceiling (room-in-room)', layers: [Ly('gyp15'), Ly('damping'), Ly('gyp15'), Ly('doubleStud', { t: 0.145 }), Ly('mw40', { t: 0.145 }), Ly('airGap', { t: 0.1 }), Ly('joist195'), Ly('ply18')] },
  },
};

// ---------------------------------------------------------------- insulation estimate
export const TL_BANDS = [63, 125, 250, 500, 1000, 2000, 4000];
const tlMass = (m, f) => Math.max(0, 20 * Math.log10(Math.max(m, 0.1) * f) - 50); // field-incidence mass law, conservative

/** Split a build-up into mass leaves separated by decoupling gaps. */
export function leavesOf(layers) {
  const leaves = [], gaps = [];
  let leaf = null, gap = null;
  for (const L of layers) {
    const m = SMAT[L.mat]; if (!m) continue;
    if (MASS_KINDS.has(m.kind) || m.kind === 'damping' || m.kind === 'finish') {
      if (m.kind === 'finish' && !leaf) continue;
      if (!leaf) { leaf = { m: 0, damped: false, names: [] }; if (gap) { gaps.push(gap); gap = null; } leaves.push(leaf); }
      leaf.m += layerMass(L); leaf.names.push(m.name);
      if (m.kind === 'damping' || m.damped) leaf.damped = true;
    } else if (m.kind !== 'sealant') {
      if (leaf) { leaf = null; gap = { d: 0, insul: false, q: 0, qConn: 0, conn: false, names: [] }; }
      if (!gap) continue; // decoupler before any leaf (rare): ignore
      gap.d += L.t ?? m.t; gap.names.push(m.name);
      if (m.kind === 'insulation') gap.insul = true;
      if (m.kind === 'cavity') gap.q = Math.max(gap.q, 0);
      else { gap.conn = true; gap.qConn = Math.max(gap.qConn, m.q ?? 0.3); }
    }
  }
  for (const g of gaps) g.q = g.conn ? g.qConn : 1;
  return { leaves, gaps };
}

export function estimateIsolation(layers) {
  const { leaves, gaps } = leavesOf(layers);
  const totalM = leaves.reduce((a, l) => a + l.m, 0);
  const thick = layers.reduce((a, L) => a + (L.t ?? SMAT[L.mat]?.t ?? 0), 0);
  const warn = [];
  if (!leaves.length) return { tl: TL_BANDS.map(() => 0), rw: 0, mass: 0, thick, f0: null, leaves, gaps, warn: ['No mass layers — this build-up gives almost no sound isolation.'] };
  let f0 = null;
  const tl = TL_BANDS.map((f) => {
    const single = (l) => tlMass(l.m, f) + (l.damped && f >= 500 ? 3 : 0);
    let t = single(leaves[0]);
    let mAcc = leaves[0].m, accDamped = leaves[0].damped;
    for (let i = 1; i < leaves.length; i++) {
      const g = gaps[i - 1] || { d: 0.02, q: 0.3, insul: false }, m1 = mAcc, m2 = leaves[i].m, d = Math.max(g.d, 0.005);
      const fr = 60 * Math.sqrt((m1 + m2) / (m1 * m2 * d));
      if (i === 1) f0 = fr;
      const tm = tlMass(m1 + m2, f) + ((accDamped || leaves[i].damped) && f >= 500 ? 3 : 0);
      const t1 = t, t2 = single(leaves[i]);
      let td;
      if (f < fr / 1.4) td = tm;
      else if (f < fr * 1.4) td = tm - 8 * (1 - Math.abs(Math.log2(f / fr)) / 0.5);
      else if (f < 55 / d) td = t1 + t2 + 20 * Math.log10(f * d) - 29;
      else td = t1 + t2 - 6;
      if (g.insul && f > fr * 1.4) td += 5;
      t = f > fr * 1.4 ? tm + g.q * Math.min(Math.max(td, tm) - tm, 22) : Math.min(td, tm);
      mAcc = m1 + m2; accDamped = accDamped || leaves[i].damped;
    }
    return Math.max(0, Math.min(t, 78));
  });
  const rw = ratingRw(tl);
  if (f0 && f0 > 50) warn.push(`Mass–air–mass resonance ≈ ${f0.toFixed(0)} Hz — studios aim for < 40–50 Hz. Add mass or a deeper cavity.`);
  if (gaps.some((g) => g.q < 0.45 && g.conn)) warn.push('Leaves are rigidly connected (studs/battens/rigid channel) — add clips, resilient channel or an independent frame.');
  if (gaps.some((g) => !g.insul && g.d > 0.03)) warn.push('Cavity has no insulation — fill it with mineral wool (+4–8 dB).');
  if (leaves.length >= 2 && !leaves.some((l) => l.damped)) warn.push('No damping layer — viscoelastic compound between boards adds 3–8 dB, especially in the mids.');
  if (leaves.length >= 3) warn.push('Three-leaf construction (e.g. existing wall + air + independent wall attached elsewhere) can perform worse than two leaves at low frequencies — keep the cavity deep.');
  return { tl, rw, mass: totalM, thick, f0, leaves, gaps, warn };
}

// ISO 717-1 style rating using octave bands 125–2000 Hz.
export function ratingRw(tl) {
  const ref = [36, 45, 52, 55, 56], vals = tl.slice(1, 6);
  let shift = -60;
  for (let s = -60; s <= 60; s++) {
    const unfav = ref.reduce((a, r, i) => a + Math.max(0, r + s - vals[i]), 0);
    if (unfav <= 10) shift = s; else break;
  }
  return Math.max(0, 52 + shift);
}

/** Typical airborne isolation of doors / windows (Rw, dB) for composite calculations. */
export function openingRw(it) {
  const p = it.params || {};
  if (it.type === 'opening') return 0;
  if (it.type === 'window' || it.type === 'skylightWin') {
    const base = { studio: p.panes >= 3 ? 55 : p.panes === 1 ? 32 : 50, fixed: 32, grid: 30, casement: 28, sliding: 25, arch: 32, round: 32 }[p.style || 'studio'] ?? 30;
    return base + (p.glass === 'acousticGlass' ? 4 : 0);
  }
  if (it.type === 'door' || it.type === 'doubleDoor') {
    const base = { acoustic: 45, vision: 40, flush: 28, panel: 25, half: 26, glass: 30, double: 30, french: 28, sliding: 25, barn: 15 }[p.style || 'flush'] ?? 28;
    return base - (p.seals === false ? 8 : 0);
  }
  return 30;
}
/** Composite Rw of a surface with openings: −10·log Σ (Sᵢ/S)·10^(−Rᵢ/10). */
export function compositeRw(parts) {
  const S = parts.reduce((a, p) => a + p.area, 0) || 1;
  return -10 * Math.log10(parts.reduce((a, p) => a + (p.area / S) * 10 ** (-p.rw / 10), 0));
}
