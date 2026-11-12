// Room-shape geometry: arbitrary polygon floor plans (any number of walls,
// splayed / angled / curved walls), ceiling profiles (flat, shed, gable,
// barrel vault, dome) and the measurements acoustics needs (areas, volume).
// Coordinates: x = width (left → right), z = length (front → back), y = up.
// The polygon is kept centred on the origin with positive signed area, so the
// inward normal of edge a→b is (-dz, dx).
import * as THREE from 'three';

const rid = () => 'w' + Math.random().toString(36).slice(2, 8);

export function rectPoly(w, d) {
  return [{ x: -w / 2, z: -d / 2, id: 'front' }, { x: w / 2, z: -d / 2, id: 'right' }, { x: w / 2, z: d / 2, id: 'back' }, { x: -w / 2, z: d / 2, id: 'left' }];
}

export function ensureRoom(room) {
  if (!room.poly || room.poly.length < 3) room.poly = rectPoly(room.w, room.d);
  if (!room.ceiling) room.ceiling = { type: 'flat', h2: room.h + 0.6, axis: 'z', dir: 'f2b' };
  if (room.wallT == null) room.wallT = 0.15;
  for (const p of room.poly) if (!p.id) p.id = rid();
  return room;
}

export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z; }
  return a / 2;
}

/** Fix orientation, re-centre on the bounding box and refresh w/d. Returns the shift applied. */
export function normalizeRoom(room) {
  ensureRoom(room);
  let pts = room.poly;
  if (signedArea(pts) < 0) {
    // reverse vertex order but keep each wall's id on the same physical edge
    const n = pts.length, ids = pts.map((p) => p.id);
    const rev = pts.slice().reverse();
    pts = rev.map((p, i) => ({ x: p.x, z: p.z, id: ids[(n - 2 - i + n) % n] }));
  }
  const xs = pts.map((p) => p.x), zs = pts.map((p) => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const dx = -(minX + maxX) / 2, dz = -(minZ + maxZ) / 2;
  room.poly = pts.map((p) => ({ ...p, x: round(p.x + dx), z: round(p.z + dz) }));
  room.w = round(maxX - minX); room.d = round(maxZ - minZ);
  return { dx, dz };
}
const round = (v) => Math.round(v * 10000) / 10000;

export function isRect(room) {
  const p = room.poly;
  if (!p) return true;
  if (p.length !== 4) return false;
  for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; if (Math.abs(a.x - b.x) > 1e-4 && Math.abs(a.z - b.z) > 1e-4) return false; }
  return true;
}

export function edges(room) {
  const p = ensureRoom(room).poly, n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1e-6;
    const dir = [dx / len, dz / len];
    out.push({ i, id: a.id, a: [a.x, a.z], b: [b.x, b.z], len, dir, n: [-dir[1], dir[0]], mid: [(a.x + b.x) / 2, (a.z + b.z) / 2] });
  }
  return out;
}

export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return { d: Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)), t };
}

// ---------------------------------------------------------------- ceilings
export const CEILINGS = {
  flat: 'Flat',
  shed: 'Sloped (shed / mono-pitch)',
  gable: 'Pitched (gable / cathedral)',
  vault: 'Barrel vault (curved)',
  dome: 'Dome',
};

export function heightAt(room, x, z) {
  const c = room.ceiling || { type: 'flat' }, h = room.h, h2 = c.h2 ?? h;
  const hx = room.w / 2 || 1, hz = room.d / 2 || 1;
  const nx = Math.max(-1, Math.min(1, x / hx)), nz = Math.max(-1, Math.min(1, z / hz));
  switch (c.type) {
    case 'shed': {
      const t = { f2b: (nz + 1) / 2, b2f: (1 - nz) / 2, l2r: (nx + 1) / 2, r2l: (1 - nx) / 2 }[c.dir || 'f2b'];
      return h + (h2 - h) * t;
    }
    case 'gable': return h + (h2 - h) * (1 - Math.abs(c.axis === 'x' ? nz : nx));
    case 'vault': { const u = c.axis === 'x' ? nz : nx; return h + (h2 - h) * Math.sqrt(Math.max(0, 1 - u * u)); }
    case 'dome': return h + (h2 - h) * Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz));
    default: return h;
  }
}

export function maxHeight(room) {
  let m = room.h;
  for (const p of room.poly || []) m = Math.max(m, heightAt(room, p.x, p.z));
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const x = -room.w / 2 + (room.w * i) / 8, z = -room.d / 2 + (room.d * j) / 8;
    if (pointInPoly(x, z, room.poly)) m = Math.max(m, heightAt(room, x, z));
  }
  return m;
}

/** Ceiling as a list of triangles [[x,y,z]×3], subdivided so curved / pitched ceilings follow their profile. */
export function ceilingTriangles(room) {
  const pts = ensureRoom(room).poly;
  const contour = pts.map((p) => new THREE.Vector2(p.x, p.z));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const curved = room.ceiling?.type && room.ceiling.type !== 'flat';
  const maxEdge = curved ? 0.35 : 1e9;
  const out = [];
  const split = (a, b, c, depth) => {
    const l = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (l <= maxEdge || depth > 6) { out.push([a, b, c]); return; }
    const ab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bc = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2], ca = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
    split(a, ab, ca, depth + 1); split(ab, b, bc, depth + 1); split(ca, bc, c, depth + 1); split(ab, bc, ca, depth + 1);
  };
  for (const [i, j, k] of tris) split([pts[i].x, pts[i].z], [pts[j].x, pts[j].z], [pts[k].x, pts[k].z], 0);
  return out.map((t) => t.map(([x, z]) => [x, heightAt(room, x, z), z]));
}

export function floorArea(room) { return Math.abs(signedArea(ensureRoom(room).poly)); }

export function ceilingArea(room) {
  let A = 0;
  for (const [a, b, c] of ceilingTriangles(room)) {
    const u = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    A += u.cross(v).length() / 2;
  }
  return A;
}

export function volume(room) {
  let V = 0;
  for (const [a, b, c] of ceilingTriangles(room)) {
    const area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2;
    V += area * (a[1] + b[1] + c[1]) / 3;
  }
  return V;
}

export function wallArea(room, e) {
  const n = Math.max(4, Math.ceil(e.len / 0.2));
  let A = 0;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    A += heightAt(room, e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t) * (e.len / n);
  }
  return A;
}

/** Wall top profile sampled along the edge: [[u, y], ...] from u = 0 to len. */
export function wallTop(room, e, step = 0.25) {
  const curved = room.ceiling?.type && room.ceiling.type !== 'flat';
  const n = curved ? Math.max(1, Math.ceil(e.len / step)) : 1;
  const out = [];
  for (let k = 0; k <= n; k++) { const u = (e.len * k) / n; out.push([u, heightAt(room, e.a[0] + e.dir[0] * u, e.a[1] + e.dir[1] * u)]); }
  return out;
}

/** Outer (thickness) ring with mitred corners. */
export function offsetRing(room, t) {
  const E = edges(room), n = E.length;
  return E.map((e, i) => {
    const prev = E[(i - 1 + n) % n];
    const nx = prev.n[0] + e.n[0], nz = prev.n[1] + e.n[1];
    const dot = prev.n[0] * e.n[0] + prev.n[1] * e.n[1];
    let k = t / Math.max(0.2, 1 + dot);
    const len = Math.hypot(nx, nz) || 1;
    k = Math.min(k * len, t * 3) / len;
    return [e.a[0] - nx * k, e.a[1] - nz * k];
  });
}

export function vertexInfo(room) {
  const E = edges(room), n = E.length;
  return E.map((e, i) => {
    const prev = E[(i - 1 + n) % n];
    const toPrev = [-prev.dir[0], -prev.dir[1]], toNext = e.dir;
    const cross = prev.dir[0] * e.dir[1] - prev.dir[1] * e.dir[0];
    const ang = Math.acos(Math.max(-1, Math.min(1, toPrev[0] * toNext[0] + toPrev[1] * toNext[1])));
    return { i, x: e.a[0], z: e.a[1], toPrev, toNext, convex: cross > 0, angle: (ang * 180) / Math.PI };
  });
}

// ---------------------------------------------------------------- presets
export const SHAPES = {
  rect: { label: 'Rectangle', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] },
  trapezoid: { label: 'Trapezoid (splayed sides)', pts: (w, d) => [[-w * 0.36, -d / 2], [w * 0.36, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] },
  splayed: { label: 'Splayed control room', pts: (w, d) => [[-w * 0.26, -d / 2], [w * 0.26, -d / 2], [w / 2, -d / 2 + d * 0.32], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2 + d * 0.32]] },
  lshape: { label: 'L-shape', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d * 0.05], [w * 0.05, d * 0.05], [w * 0.05, d / 2], [-w / 2, d / 2]] },
  tshape: { label: 'T-shape', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, -d * 0.1], [w * 0.2, -d * 0.1], [w * 0.2, d / 2], [-w * 0.2, d / 2], [-w * 0.2, -d * 0.1], [-w / 2, -d * 0.1]] },
  ushape: { label: 'U-shape', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [w * 0.18, d / 2], [w * 0.18, d * 0.1], [-w * 0.18, d * 0.1], [-w * 0.18, d / 2], [-w / 2, d / 2]] },
  alcove: { label: 'Rectangle + alcove', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d * 0.3], [w * 0.2, d * 0.3], [w * 0.2, d / 2], [-w * 0.2, d / 2], [-w * 0.2, d * 0.3], [-w / 2, d * 0.3]] },
  angled: { label: 'Angled corner', pts: (w, d) => { const c = Math.min(w, d) * 0.35; return [[-w / 2 + c, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2 + c]]; } },
  pentagon: { label: 'Pentagon (pointed back)', pts: (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d * 0.15], [0, d / 2], [-w / 2, d * 0.15]] },
  hexagon: { label: 'Hexagon', pts: (w, d) => [0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * w / 2, Math.sin(a) * d / 2]; }) },
  octagon: { label: 'Octagon', pts: (w, d) => { const c = Math.min(w, d) * 0.29; return [[-w / 2 + c, -d / 2], [w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c]]; } },
  round: { label: 'Round / oval', pts: (w, d) => Array.from({ length: 32 }, (_, k) => { const a = (k / 32) * Math.PI * 2; return [Math.cos(a) * w / 2, Math.sin(a) * d / 2]; }) },
  curvedBack: { label: 'Curved back wall', pts: (w, d) => { const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d * 0.3]]; for (let k = 1; k < 12; k++) { const a = (k / 12) * Math.PI; pts.push([Math.cos(a) * w / 2, d * 0.3 + Math.sin(a) * d * 0.2]); } pts.push([-w / 2, d * 0.3]); return pts; } },
  fan: { label: 'Fan / auditorium', pts: (w, d) => { const pts = [[-w * 0.25, -d / 2], [w * 0.25, -d / 2], [w / 2, d * 0.35]]; for (let k = 1; k < 8; k++) { const t = k / 8; pts.push([w / 2 - w * t, d * 0.35 + Math.sin(t * Math.PI) * d * 0.15]); } pts.push([-w / 2, d * 0.35]); return pts; } },
};

export function applyShape(room, key) {
  const s = SHAPES[key]; if (!s) return;
  const pts = s.pts(room.w, room.d);
  const keep = rectPoly(1, 1).map((p) => p.id);
  room.poly = pts.map(([x, z], i) => ({ x, z, id: key === 'rect' ? keep[i] : i === 0 ? 'front' : rid() }));
  if (signedArea(room.poly) < 0) room.poly.reverse();
  normalizeRoom(room);
}

/** Replace edge i by an arc bulging outward by `sag` metres (negative = into the room). */
export function curveEdge(room, i, sag, segments = 0) {
  const E = edges(room), e = E[i];
  if (!e || Math.abs(sag) < 0.01) return;
  const c = e.len, s = Math.abs(sag);
  const r = (c * c / 4 + s * s) / (2 * s);
  const bd = sag > 0 ? [-e.n[0], -e.n[1]] : [e.n[0], e.n[1]]; // bulge direction
  const apex = [e.mid[0] + bd[0] * s, e.mid[1] + bd[1] * s];
  const cx = e.mid[0] + bd[0] * (s - r), cz = e.mid[1] + bd[1] * (s - r);
  const a0 = Math.atan2(e.a[1] - cz, e.a[0] - cx), aApex = Math.atan2(apex[1] - cz, apex[0] - cx);
  let half = aApex - a0; while (half > Math.PI) half -= 2 * Math.PI; while (half <= -Math.PI) half += 2 * Math.PI;
  const n = segments || Math.max(6, Math.ceil((Math.abs(half) * 2 * r) / 0.3));
  const newPts = [];
  for (let k = 1; k < n; k++) { const a = a0 + (2 * half * k) / n; newPts.push({ x: round(cx + Math.cos(a) * r), z: round(cz + Math.sin(a) * r), id: rid() }); }
  room.poly.splice(i + 1, 0, ...newPts);
  return newPts.map((p) => p.id);
}

export function splitEdge(room, i, t = 0.5) {
  const E = edges(room), e = E[i]; if (!e) return null;
  const p = { x: round(e.a[0] + (e.b[0] - e.a[0]) * t), z: round(e.a[1] + (e.b[1] - e.a[1]) * t), id: rid() };
  room.poly.splice(i + 1, 0, p);
  return p.id;
}

export const newWallId = rid;
