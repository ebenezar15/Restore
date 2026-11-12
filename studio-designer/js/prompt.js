// Offline natural-language command interpreter. No network / AI service is
// needed: commands are matched with a small grammar of verbs, objects,
// quantities, colours and locations. Several commands can be chained with
// "and", "then", "," or ";".
import { COLOR_NAMES, parseColor } from './materials.js';

const NUM_WORDS = { a: 1, an: 1, one: 1, single: 1, two: 2, pair: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12 };

// Longest phrases first so "bass trap" wins over "trap".
const ITEM_WORDS = [
  ['wall ceiling trap', 'cornerTrapCeil'], ['ceiling corner trap', 'cornerTrapCeil'], ['soffit trap', 'cornerTrapCeil'],
  ['corner bass trap', 'cornerTrap'], ['corner trap', 'cornerTrap'], ['superchunk', 'cornerTrap'], ['bass trap', 'cornerTrap'],
  ['membrane trap', 'membrane'], ['membrane', 'membrane'], ['limp mass', 'membrane'], ['tube trap', 'tubeTrap'],
  ['bass panel', 'bassPanel'], ['thick panel', 'bassPanel'], ['helmholtz', 'helmholtz'], ['perforated', 'helmholtz'],
  ['framed panel', 'framedPanel'], ['art panel', 'artPanel'], ['artwork', 'artPanel'], ['printed panel', 'artPanel'],
  ['felt', 'feltTiles'], ['foam', 'foam'], ['50mm panel', 'absorber50'], ['thin panel', 'absorber50'],
  ['absorber', 'absorber'], ['absorption panel', 'absorber'], ['acoustic panel', 'absorber'], ['broadband', 'absorber'], ['panel', 'absorber'],
  ['curtain', 'curtain'], ['drape', 'curtain'], ['gobo', 'gobo'], ['screen divider', 'gobo'], ['rug', 'rug'], ['carpet', 'rug'],
  ['ceiling diffuser', 'ceilDiffuser'], ['skyline', 'skyline'], ['2d diffuser', 'skyline'], ['poly', 'poly'], ['polycylindrical', 'poly'],
  ['hybrid', 'bad'], ['bad panel', 'bad'], ['qrd', 'qrd'], ['diffuser', 'qrd'], ['diffusor', 'qrd'], ['bookcase', 'bookshelf'], ['bookshelf', 'bookshelf'], ['shelf', 'bookshelf'],
  ['slot resonator', 'slatResonator'], ['slat', 'slats'], ['slats', 'slats'], ['wood slat', 'slats'],
  ['re-director', 'redirector'], ['redirector', 'redirector'], ['louvre', 'redirector'], ['reflector', 'reflector'],
  ['cloud', 'cloud'], ['baffle', 'baffle'], ['ceiling tile', 'ceilTile'], ['canopy', 'canopy'],
  ['desk', 'desk'], ['console', 'console'], ['mixer', 'console'], ['chair', 'chair'], ['stool', 'stool'], ['sofa', 'sofa'], ['couch', 'sofa'],
  ['coffee table', 'table'], ['table', 'table'], ['rack', 'rack'], ['speaker stand', 'stand'], ['stand', 'stand'],
  ['listening position', 'listener'], ['listener', 'listener'], ['sweet spot', 'listener'],
  ['nearfield', 'monitor'], ['studio monitor', 'monitor'], ['monitors', 'monitor'], ['speaker', 'monitor'], ['midfield', 'midfield'], ['main monitor', 'mains'], ['mains', 'mains'],
  ['subwoofer', 'sub'], ['sub', 'sub'], ['computer screen', 'screen'], ['display', 'screen'], ['monitor screen', 'screen'], ['tv', 'tv'], ['television', 'tv'],
  ['computer', 'pc'], ['pc', 'pc'], ['keyboard', 'keyboard'], ['synth', 'keyboard'], ['piano', 'piano'], ['drum', 'drums'], ['drums', 'drums'],
  ['amp', 'amp'], ['amplifier', 'amp'], ['guitar', 'guitar'], ['microphone', 'mic'], ['mic', 'mic'],
  ['led panel', 'ledPanel'], ['downlight', 'downlight'], ['spotlight', 'trackLight'], ['track light', 'trackLight'], ['pendant', 'pendant'],
  ['led strip', 'ledStrip'], ['strip light', 'ledStrip'], ['rgb tube', 'lightBar'], ['light tube', 'lightBar'], ['floor lamp', 'floorLamp'], ['lamp', 'floorLamp'],
  ['sconce', 'sconce'], ['on air', 'neon'], ['neon', 'neon'], ['sign', 'neon'], ['light', 'ledPanel'],
  ['door', 'door'], ['window', 'window'], ['partition', 'partition'], ['wall', 'partition'], ['soffit', 'soffit'], ['column', 'column'], ['pillar', 'column'],
  ['riser', 'riser'], ['platform', 'riser'], ['booth', 'booth'], ['iso booth', 'booth'], ['steps', 'stairs'], ['stairs', 'stairs'], ['plant', 'plant'],
  ['cube', 'shapeBox'], ['box', 'shapeBox'], ['board', 'shapeBoard'], ['cylinder', 'shapeCylinder'], ['sphere', 'shapeSphere'], ['ball', 'shapeSphere'],
  ['cone', 'shapeCone'], ['pyramid', 'shapePyramid'], ['wedge', 'shapeWedge'], ['ramp', 'shapeWedge'], ['half cylinder', 'shapeHalfCyl'], ['arch', 'shapeArch'], ['torus', 'shapeTorus'], ['ring', 'shapeTorus'],
].sort((a, b) => b[0].length - a[0].length);

const GROUP_WORDS = {
  panels: (d) => d.cat === 'Absorption' || d.cat === 'Bass Control', absorbers: (d) => d.cat === 'Absorption', traps: (d) => d.cat === 'Bass Control',
  diffusers: (d) => d.cat === 'Diffusion', lights: (d) => d.cat === 'Lighting', treatment: (d) => ['Absorption', 'Bass Control', 'Diffusion', 'Reflection Control', 'Ceiling'].includes(d.cat),
  furniture: (d) => d.cat === 'Studio Furniture', gear: (d) => d.cat === 'Gear & Instruments', shapes: (d) => d.cat === 'Shapes', everything: () => true,
};

const LOCATIONS = [
  ['first reflection', 'reflections'], ['reflection point', 'reflections'], ['reflection', 'reflections'],
  ['all corners', 'corners'], ['every corner', 'corners'], ['front corners', 'frontCorners'], ['rear corners', 'backCorners'], ['back corners', 'backCorners'], ['corners', 'corners'], ['corner', 'corners'],
  ['side walls', 'sides'], ['both sides', 'sides'], ['all walls', 'allWalls'], ['every wall', 'allWalls'],
  ['front wall', 'front'], ['back wall', 'back'], ['rear wall', 'back'], ['left wall', 'left'], ['right wall', 'right'],
  ['behind the speakers', 'front'], ['behind speakers', 'front'], ['behind listener', 'back'], ['behind the listener', 'back'],
  ['above listener', 'aboveListener'], ['above the listener', 'aboveListener'], ['over the desk', 'aboveListener'], ['above the desk', 'aboveListener'], ['above mix', 'aboveListener'],
  ['ceiling', 'ceiling'], ['floor', 'floor'], ['center', 'center'], ['centre', 'center'], ['middle', 'center'],
  ['front', 'front'], ['back', 'back'], ['rear', 'back'], ['left', 'left'], ['right', 'right'],
].sort((a, b) => b[0].length - a[0].length);

const SURFACE_WORDS = [['front wall', ['front']], ['back wall', ['back']], ['rear wall', ['back']], ['left wall', ['left']], ['right wall', ['right']], ['side walls', ['left', 'right']], ['walls', ['*walls']], ['wall', ['*walls']], ['floor', ['floor']], ['ceiling', ['ceiling']]];

const FINISH_WORDS = { oak: ['wood', '#c49a6c'], walnut: ['wood', '#5d4030'], wood: ['wood', null], wooden: ['wood', null], timber: ['wood', null], concrete: ['concrete', '#9a9a96'], brick: ['brick', '#b5654a'], carpet: ['carpet', null], carpeted: ['carpet', null], tile: ['tile', null], tiled: ['tile', null], marble: ['marble', '#efefef'], stone: ['marble', null], fabric: ['fabric', null], felt: ['felt', null], metal: ['metal', null], gloss: ['gloss', null], glossy: ['gloss', null], matte: ['paint', null], leather: ['leather', null] };
const SURFACE_ACOUSTIC = { wood: 'wood_floor', concrete: 'concrete', brick: 'brick', carpet: 'carpet_pad', tile: 'tile_floor', marble: 'tile_floor' };

const DIRS = { left: [-1, 0, 0], right: [1, 0, 0], forward: [0, 0, -1], forwards: [0, 0, -1], ahead: [0, 0, -1], back: [0, 0, 1], backward: [0, 0, 1], backwards: [0, 0, 1], up: [0, 1, 0], down: [0, -1, 0], higher: [0, 1, 0], lower: [0, -1, 0] };

function lengthIn(str) {
  // returns metres from "1.2m", "120 cm", "4 ft", "48in", "3'"
  const m = str.match(/(-?\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|foot|'|in|inch|inches|")?/);
  if (!m) return null;
  return toMetres(parseFloat(m[1]), m[2]);
}
function toMetres(v, unit) {
  if (!unit) return v;
  if (unit === 'mm') return v / 1000;
  if (unit === 'cm') return v / 100;
  if (/^(ft|feet|foot|')$/.test(unit)) return v * 0.3048;
  if (/^(in|inch|inches|")$/.test(unit)) return v * 0.0254;
  return v;
}

function findColor(s) {
  const hex = s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/);
  if (hex) return hex[0];
  const names = Object.keys(COLOR_NAMES).sort((a, b) => b.length - a.length);
  for (const n of names) if (new RegExp(`\\b${n}\\b`).test(s)) return parseColor(n);
  return null;
}
function findItem(s) {
  // Earliest mention wins ("cloud above the listener" → cloud); ties → longest phrase.
  s = s.replace(/\b(above|behind|over|near|beside|next to|in front of|facing)\s+(the\s+)?(listener|listening position|desk|speakers?|monitors?|mix position|sweet spot|console)\b/g, ' ');
  let best = null;
  for (const [w, t] of ITEM_WORDS) {
    const m = new RegExp(`\\b${w}(e?s)?\\b`).exec(s);
    if (m && (!best || m.index < best.index || (m.index === best.index && w.length > best.word.length))) best = { type: t, word: w, index: m.index };
  }
  return best;
}
function findLocation(s) {
  for (const [w, l] of LOCATIONS) if (new RegExp(`\\b(on|at|in|to|by|along|across|near|into|onto|over|above|behind|under)?\\s*(the\\s+)?${w}s?\\b`).test(s)) return l;
  return null;
}
function findQty(s, itemWord) {
  const re = new RegExp(`\\b(\\d+|${Object.keys(NUM_WORDS).join('|')})\\s+(?:[a-z#0-9-]+\\s+){0,3}${itemWord ? itemWord.split(' ')[0] : ''}`);
  const m = s.match(re);
  if (m) return /\d/.test(m[1]) ? parseInt(m[1], 10) : NUM_WORDS[m[1]];
  const any = s.match(/\b(\d+)\s*x\b(?!\s*\d)/);
  if (any) return parseInt(any[1], 10);
  return null;
}
function findSize(s) {
  // "60x120cm", "0.6 x 1.2 x 0.1 m", "1.2m wide", "2m tall"
  const m = s.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in)?)?/);
  const out = {};
  if (m) {
    const u = m[6] || m[4] || m[2];
    out.w = toMetres(parseFloat(m[1]), m[2] || u); out.h = toMetres(parseFloat(m[3]), m[4] || u);
    if (m[5]) out.d = toMetres(parseFloat(m[5]), m[6] || u);
  }
  const wide = s.match(/(\d+(?:\.\d+)?\s*(?:mm|cm|m|ft|in|')?)\s*(wide|width)/); if (wide) out.w = lengthIn(wide[1]);
  const tall = s.match(/(\d+(?:\.\d+)?\s*(?:mm|cm|m|ft|in|')?)\s*(tall|high|height)/); if (tall) out.h = lengthIn(tall[1]);
  const deep = s.match(/(\d+(?:\.\d+)?\s*(?:mm|cm|m|ft|in|')?)\s*(deep|thick|depth)/); if (deep) out.d = lengthIn(deep[1]);
  return Object.keys(out).length ? out : null;
}

function splitCommands(text) {
  const t = text
    .replace(/\bleft and right( side)? walls?\b/gi, 'side walls').replace(/\bleft and right\b/gi, 'side walls')
    .replace(/\bfront and (back|rear) corners\b/gi, 'all corners').replace(/\bfront and (back|rear) walls?\b/gi, 'front wall, back wall');
  return t.split(/\s*(?:;|,|\bthen\b|\band\b|\.\s+)\s*/i).map((s) => s.trim()).filter(Boolean);
}

export const PROMPT_EXAMPLES = [
  'room 4.5 x 6 x 2.8',
  'make the room L shaped',
  'sloped ceiling 2.4 to 3.4',
  'curve the back wall 0.6',
  'add bass traps in all corners',
  'add 2 absorbers at first reflections',
  'add a cloud above the listener',
  'add 3 diffusers on the back wall',
  'paint walls charcoal and floor oak',
  'make selected navy',
  'treat room for mixing',
  'add desk, monitors and chair',
  'move selected 0.3 left',
  'rotate 45',
  'lights warm',
  'delete all diffusers',
  'top view',
  'export pdf',
];

export function runPrompt(text, api) {
  const results = [];
  let lastVerb = null, lastItem = null, lastQty = '';
  const stripLoc = (s) => s.replace(/\b(front|back|rear|left|right|side|all|every)?\s*(walls?|ceiling|floor|corners?)\b/g, ' ');
  for (let raw of splitCommands(text)) {
    let s = ' ' + raw.toLowerCase().replace(/[!?]/g, '').replace(/\s+/g, ' ') + ' ';
    const verbMatch = s.match(/\b(add|place|put|insert|create|make|paint|colou?r|set|change|move|shift|nudge|rotate|turn|spin|delete|remove|clear|select|show|view|go to|switch|dim|brighten|treat|mirror|duplicate|copy|clone|export|save|undo|redo|analy[sz]e|check|reset|new|resize|scale|hide|curve|curved|bow)\b/);
    let verb = verbMatch ? verbMatch[1] : null;
    if (!verb && /\blights?\b|\blighting\b/.test(s) && /\b(on|off|warm|cool|cold|daylight|mood|rgb|dim|bright)\b|#|\b(red|blue|purple|green|pink|amber|orange)\b/.test(s)) verb = 'set';
    else if (!verb && !lastVerb && findColor(s) && !/\b(\d+|a|an)\s/.test(s)) verb = 'paint';
    const isAdd = (v) => ['add', 'place', 'put', 'insert', 'create'].includes(v);
    if (!verb && lastVerb) {
      const item = findItem(stripLoc(s));
      if (!item && isAdd(lastVerb) && lastItem && findLocation(s)) s = ` ${lastVerb} ${lastQty} ${lastItem}s on ${s}`;
      else s = ` ${lastVerb} ${s}`;
      verb = lastVerb;
    } else if (!verb && findItem(s)) { verb = 'add'; s = ` add ${s}`; }
    if (verb) lastVerb = verb;
    if (isAdd(verb)) {
      const it = findItem(stripLoc(s));
      if (it) { lastItem = it.word; const q = s.match(/\b(\d+|two|three|four|five|six)\b/); lastQty = q ? q[1] : ''; }
    }
    try {
      results.push(handle(s, verb, api));
    } catch (e) {
      console.error(e);
      results.push({ ok: false, msg: `Couldn't do "${raw}": ${e.message}` });
    }
  }
  return results;
}

function handle(s, verb, api) {
  // ---- history / export / views
  if (verb === 'undo') { api.undo(); return { ok: true, msg: 'Undone' }; }
  if (verb === 'redo') { api.redo(); return { ok: true, msg: 'Redone' }; }
  if (/\b(export|save)\b.*\bpdf\b|\bpdf\b/.test(s)) { api.openPdf(); return { ok: true, msg: 'Opening PDF export' }; }
  if (/\b(export|download)\b.*\b(glb|gltf|3d model)\b/.test(s)) { api.exportGLB(); return { ok: true, msg: 'Exporting GLB' }; }
  if (/\b(top|plan|front|back|rear|left|right|3d|perspective|quad|walk|walkthrough|first person|listener|listening)\b.*\bview\b|\bview\b.*\b(top|plan|front|back|left|right|3d|quad|walk)\b|^\s*(top|plan|3d|quad|walk)\s*$/.test(s) && !/\b(add|place|put)\b/.test(s)) {
    const v = s.match(/\b(top|plan|front|back|rear|left|right|3d|perspective|quad|walk|walkthrough|first person|listener|listening)\b/)[1];
    const map = { top: 'top', plan: 'top', front: 'front', back: 'back', rear: 'back', left: 'left', right: 'right', '3d': 'persp', perspective: 'persp', quad: 'quad', walk: 'walk', walkthrough: 'walk', 'first person': 'walk', listener: 'listener', listening: 'listener' };
    api.setView(map[v]); return { ok: true, msg: `Switched to ${v} view` };
  }
  if (/\b(analy[sz]e|check|rt60|reverb|room modes?|acoustics?)\b/.test(s) && !/\b(add|place)\b/.test(s)) { api.showAcoustics(); return { ok: true, msg: 'Showing acoustic analysis' }; }

  // ---- room shape / ceiling / curved walls
  const SHAPE_WORDS = [['l-shape', 'lshape'], ['l shape', 'lshape'], ['l-shaped', 'lshape'], ['l shaped', 'lshape'], ['t-shape', 'tshape'], ['t shape', 'tshape'], ['t-shaped', 'tshape'], ['u-shape', 'ushape'], ['u shape', 'ushape'], ['u-shaped', 'ushape'],
    ['trapezoid', 'trapezoid'], ['trapezoidal', 'trapezoid'], ['splayed', 'splayed'], ['octagon', 'octagon'], ['octagonal', 'octagon'], ['hexagon', 'hexagon'], ['hexagonal', 'hexagon'], ['pentagon', 'pentagon'],
    ['round', 'round'], ['circular', 'round'], ['circle', 'round'], ['oval', 'round'], ['angled corner', 'angled'], ['curved back', 'curvedBack'], ['fan', 'fan'], ['auditorium', 'fan'], ['alcove', 'alcove'], ['rectangular', 'rect'], ['rectangle', 'rect'], ['square', 'rect']];
  if (/\b(room|shape|shaped|floor ?plan|outline|make it)\b/.test(s) && !/\b(add|place|put|insert)\b/.test(s) && !/\bceiling\b/.test(s)) {
    const hit = SHAPE_WORDS.find(([w]) => new RegExp(`\\b${w}\\b`).test(s));
    if (hit) { const label = api.setShape(hit[1]); return { ok: true, msg: `Room shape: ${label}` }; }
  }
  if (/\bceiling\b/.test(s) && /\b(slop|shed|mono|pitch|gable|cathedral|vault|barrel|arch|dome|domed|flat|raked|rais|angled|tilt)/.test(s) && !/\b(add|place|put|insert|paint|colou?r)\b/.test(s)) {
    const type = /dome|domed/.test(s) ? 'dome' : /vault|barrel|arch/.test(s) ? 'vault' : /pitch|gable|cathedral|peak/.test(s) ? 'gable' : /flat/.test(s) ? 'flat' : 'shed';
    const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|ft|feet|foot|'|m\b)?/g)].map((m) => toMetres(parseFloat(m[1]), m[2]));
    const patch = { type };
    if (nums.length >= 2) { patch.h = Math.min(nums[0], nums[1]); patch.h2 = Math.max(nums[0], nums[1]); }
    else if (nums.length === 1) { if (type === 'flat') patch.h = nums[0]; else patch.h2 = nums[0]; }
    if (type === 'shed') patch.dir = /\b(front)\b/.test(s) ? 'b2f' : /\bleft\b/.test(s) ? 'r2l' : /\bright\b/.test(s) ? 'l2r' : 'f2b';
    if (type === 'gable' || type === 'vault') patch.axis = /\b(across|left to right|side to side|width)\b/.test(s) ? 'x' : 'z';
    const label = api.setCeiling(patch);
    return { ok: true, msg: `Ceiling: ${label}${patch.h2 ? ` (${(patch.h ?? 0) ? patch.h.toFixed(2) + ' → ' : 'up to '}${patch.h2.toFixed(2)} m)` : ''}` };
  }
  if (/\b(curve|curved|bow|round off)\b/.test(s) && /\bwall\b/.test(s) && !/\b(add|place)\b/.test(s)) {
    const wall = (s.match(/\b(front|back|rear|left|right)\b/) || [])[1];
    const num = s.match(/(-?\d+(?:\.\d+)?)\s*(mm|cm|ft|m\b)?/);
    let sag = num ? toMetres(parseFloat(num[1]), num[2]) : 0.5;
    if (/\b(inward|into the room|concave in)\b/.test(s)) sag = -Math.abs(sag);
    const ok = api.curveWall(wall === 'rear' ? 'back' : wall || 'back', sag);
    return { ok, msg: ok ? `Curved the ${wall || 'back'} wall by ${sag.toFixed(2)} m` : 'No such wall' };
  }

  // ---- room dims
  if (/\b(room|dimensions?|size of room)\b/.test(s) && /\d/.test(s) && !/\b(add|place|put)\b/.test(s) || /^\s*(set |resize )?room\b/.test(s) && /\d/.test(s)) {
    const globalUnit = (s.match(/\b(ft|feet|foot|cm|mm)\b/) || [])[1];
    const vals = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|ft|feet|foot|'|in\b|m\b)?/g)].map((m) => toMetres(parseFloat(m[1]), m[2] || globalUnit));
    if (vals.length >= 2) {
      const [w, b, c] = vals;
      // Accept "W x D x H" (most common for floor plans); 2 values keep height.
      const dims = vals.length >= 3 ? { w, d: b, h: c } : { w, d: b };
      if (/height\s*(\d)/.test(s)) dims.h = lengthIn(s.split('height')[1]);
      api.setRoom(dims);
      return { ok: true, msg: `Room set to ${dims.w.toFixed(2)} × ${dims.d.toFixed(2)}${dims.h ? ' × ' + dims.h.toFixed(2) : ''} m (W×D×H)` };
    }
  }
  if (/\b(new|template|preset|start)\b/.test(s)) {
    const t = api.findTemplate(s);
    if (t) { api.applyTemplate(t); return { ok: true, msg: `Loaded template "${t}"` }; }
  }

  // ---- auto-treatment
  if (/\btreat\b|\bauto[- ]?treat|\bacoustic treatment\b/.test(s)) {
    const mode = /master/.test(s) ? 'mastering' : /(track|live|record)/.test(s) ? 'tracking' : /(podcast|voice|vocal|broadcast)/.test(s) ? 'podcast' : /(theat|cinema|movie)/.test(s) ? 'theater' : 'mixing';
    const n = api.autoTreat(mode);
    return { ok: true, msg: `Applied ${mode} treatment (${n} items)` };
  }

  // ---- lights
  if (/\blights?\b|\blighting\b/.test(s) && /\b(on|off|dim|brighten|bright|warm|cool|cold|daylight|colou?r|red|blue|purple|green|pink|mood|rgb)\b/.test(s) && !/\b(add|place|put|insert)\b/.test(s)) {
    const patch = {};
    if (/\boff\b/.test(s)) patch.on = false;
    if (/\bon\b/.test(s)) patch.on = true;
    if (/\bdim\b/.test(s)) patch.scale = 0.5;
    if (/\b(brighten|bright|brighter)\b/.test(s)) patch.scale = 1.6;
    if (/\bwarm\b/.test(s)) patch.color = '#ffc98a';
    else if (/\b(cool|cold|daylight)\b/.test(s)) patch.color = '#e8f0ff';
    else { const c = findColor(s); if (c) patch.color = c; }
    if (/\bmood\b/.test(s)) { patch.scale = 0.45; patch.color = patch.color || '#ff9a5a'; }
    const n = api.setLights(patch);
    return { ok: true, msg: `Updated ${n} light${n === 1 ? '' : 's'}` };
  }

  // ---- delete / clear
  if (/\b(delete|remove|clear)\b/.test(s)) {
    if (/\b(clear|delete|remove)\s+(all|everything|the room|room)\b\s*$/.test(s) || /\bclear room\b/.test(s)) { const n = api.removeItems(api.items()); return { ok: true, msg: `Removed ${n} items` }; }
    const targets = resolveTargets(s, api);
    const n = api.removeItems(targets);
    return { ok: n > 0, msg: n ? `Removed ${n} item${n > 1 ? 's' : ''}` : 'Nothing matched to remove' };
  }

  // ---- select
  if (verb === 'select') {
    const t = resolveTargets(s, api, true);
    api.select(t.map((i) => i.id));
    return { ok: t.length > 0, msg: `Selected ${t.length}` };
  }
  if (verb === 'mirror') { const n = api.mirror(resolveTargets(s, api)); return { ok: n > 0, msg: n ? `Mirrored ${n} item(s) across the room centre` : 'Select something to mirror' }; }
  if (['duplicate', 'copy', 'clone'].includes(verb)) {
    const times = findQty(s) || 1;
    const n = api.duplicate(resolveTargets(s, api), times);
    return { ok: n > 0, msg: n ? `Created ${n} copies` : 'Select something to duplicate' };
  }
  if (verb === 'hide') { const t = resolveTargets(s, api); t.forEach((i) => api.updateItem(i, { hidden: true })); api.commit(); return { ok: true, msg: `Hid ${t.length}` }; }

  // ---- move / rotate / resize
  if (['move', 'shift', 'nudge'].includes(verb)) {
    const targets = resolveTargets(s, api);
    if (!targets.length) return { ok: false, msg: 'Select something to move first' };
    const loc = findLocation(s.replace(/\b(left|right|up|down|forward|back|backwards?|forwards?)\b\s*$/, ''));
    const amount = s.match(/(-?\d+(?:\.\d+)?)\s*(mm|cm|m|ft|in|')?/);
    const dirWord = Object.keys(DIRS).find((d) => new RegExp(`\\b${d}\\b`).test(s));
    if (amount && dirWord) {
      const dv = toMetres(parseFloat(amount[1]), amount[2]);
      const dir = DIRS[dirWord];
      targets.forEach((it) => api.updateItem(it, { pos: it.pos.map((p, k) => p + dir[k] * dv) }));
      api.commit();
      return { ok: true, msg: `Moved ${targets.length} item(s) ${dv.toFixed(2)} m ${dirWord}` };
    }
    if (loc) { api.placeMany(targets, loc); api.commit(); return { ok: true, msg: `Moved to ${loc}` }; }
    return { ok: false, msg: 'Try "move selected 0.5 m left" or "move it to the back wall"' };
  }
  if (['rotate', 'spin'].includes(verb) || (verb === 'turn' && /\d/.test(s))) {
    const targets = resolveTargets(s, api);
    const a = s.match(/(-?\d+(?:\.\d+)?)/);
    const deg = a ? parseFloat(a[1]) : 90;
    targets.forEach((it) => api.updateItem(it, { rot: [it.rot[0], (it.rot[1] + (/(counter|anti)/.test(s) ? deg : -deg) + 360) % 360, it.rot[2]] }));
    api.commit();
    return { ok: targets.length > 0, msg: `Rotated ${targets.length} by ${deg}°` };
  }
  if (['resize', 'scale'].includes(verb)) {
    const targets = resolveTargets(s, api), size = findSize(s), f = s.match(/(\d+(?:\.\d+)?)\s*(%|x|times)/);
    targets.forEach((it) => {
      let ns = it.size.slice();
      if (size) ns = [size.w ?? ns[0], size.h ?? ns[1], size.d ?? ns[2]];
      else if (f) { const k = f[2] === '%' ? parseFloat(f[1]) / 100 : parseFloat(f[1]); ns = ns.map((v) => v * k); }
      api.updateItem(it, { size: ns });
    });
    api.commit();
    return { ok: targets.length > 0, msg: `Resized ${targets.length}` };
  }

  // ---- add
  if (['add', 'place', 'put', 'insert', 'create'].includes(verb) || (verb === 'make' && /\b(a|an|\d+)\s/.test(s) && findItem(s) && !findSurfaceTarget(s))) {
    const found = findItem(s.replace(/\b(on|at|in|to|along|onto|over|above|behind|near)\s+(the\s+)?(front|back|rear|left|right|side|all)?\s*(walls?|ceiling|floor|corners?)\b/g, ' '));
    if (!found) return { ok: false, msg: 'Which item? e.g. "add 2 absorbers on the left wall"' };
    let loc = findLocation(s);
    let qty = findQty(s, found.word);
    const plural = /s$/.test(found.word) || new RegExp(`\\b${found.word}(e?s)\\b`).test(s);
    if (!qty) qty = loc === 'corners' ? 4 : loc === 'frontCorners' || loc === 'backCorners' || loc === 'sides' ? 2 : loc === 'reflections' ? 0 : found.type === 'monitor' && plural ? 2 : plural ? 2 : 1;
    const color = findColor(s.replace(/\bwood\b|\boak\b|\bwalnut\b/g, (m) => (found.type === 'desk' ? m : m)));
    const size = findSize(s);
    const items = api.addMany(found.type, { qty, loc, color, size });
    return { ok: items.length > 0, msg: items.length ? `Added ${items.length} × ${api.nameOf(found.type)}${loc ? ' (' + loc + ')' : ''}` : 'Could not place that' };
  }

  // ---- paint / colour / finish
  if (['make', 'paint', 'color', 'colour', 'set', 'change'].includes(verb) || findColor(s)) {
    const color = findColor(s);
    const finishWord = Object.keys(FINISH_WORDS).find((f) => new RegExp(`\\b${f}\\b`).test(s));
    const surf = findSurfaceTarget(s);
    if (surf && (color || finishWord)) {
      // "paint walls charcoal and floor oak" is split earlier; apply here
      surf.forEach((name) => {
        const patch = {};
        if (finishWord) { const [fin, fc] = FINISH_WORDS[finishWord]; patch.finish = fin; if (fc && !color) patch.color = fc; if (name === 'floor' && SURFACE_ACOUSTIC[fin]) patch.acoustic = SURFACE_ACOUSTIC[fin]; if (name !== 'floor' && fin === 'brick') patch.acoustic = 'brick'; }
        if (color) patch.color = color;
        api.setSurface(name, patch);
      });
      api.commit();
      return { ok: true, msg: `Updated ${surf.map((x) => (x === '*walls' ? 'all walls' : x)).join(', ')}` };
    }
    const targets = resolveTargets(s, api);
    if (targets.length && (color || finishWord)) {
      const second = /\b(frame|trim|accent|secondary|edge|legs?)\b/.test(s);
      targets.forEach((it) => {
        const patch = {};
        if (color) patch[second ? 'color2' : 'color'] = color;
        if (finishWord) patch.finish = FINISH_WORDS[finishWord][0];
        api.updateItem(it, patch);
      });
      api.commit();
      return { ok: true, msg: `Recoloured ${targets.length} item(s)` };
    }
    if (color && !targets.length) return { ok: false, msg: 'Select an item first, or say e.g. "paint the front wall ' + Object.keys(COLOR_NAMES).find((k) => COLOR_NAMES[k] === color) + '"' };
  }
  return { ok: false, msg: `Sorry, I didn't understand "${s.trim()}". Try: ${PROMPT_EXAMPLES.slice(0, 4).join(' · ')}` };
}

function findSurfaceTarget(s) {
  if (/\b(selected|selection|it|this|these|them)\b/.test(s)) return null;
  if (findItem(s.replace(/\b(walls?|floor|ceiling)\b/g, ''))) return null;
  for (const [w, list] of SURFACE_WORDS) if (new RegExp(`\\b${w}\\b`).test(s)) return list;
  return null;
}

function resolveTargets(s, api, forSelect = false) {
  const all = api.items();
  if (/\b(selected|selection|it|this|these|them|those)\b/.test(s) && !forSelect) return api.selected();
  if (/\b(everything|all items|all objects)\b/.test(s)) return all;
  for (const [g, fn] of Object.entries(GROUP_WORDS)) if (new RegExp(`\\b(all\\s+)?(the\\s+)?${g}\\b`).test(s)) return all.filter((i) => fn(api.defOf(i.type)));
  const f = findItem(s);
  if (f) {
    const same = all.filter((i) => i.type === f.type || api.defOf(i.type).cat === api.defOf(f.type).cat && /\b(all|every)\b/.test(s));
    if (same.length) return /\b(all|every)\b/.test(s) || new RegExp(`\\b${f.word}s\\b`).test(s) ? same : [same[same.length - 1]];
  }
  return forSelect ? [] : api.selected();
}
