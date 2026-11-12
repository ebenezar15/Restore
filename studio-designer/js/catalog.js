// Item catalogue: every placeable object is described here — its default size,
// colours, finish, acoustic behaviour, editable parameters and a builder that
// creates its 3D geometry. Local axes: +Z is the item's front face, Y is up,
// origin is the centre of the footprint at floor level (corner items use the
// inside corner as origin).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, drawnTexture, imageTexture, FINISHES } from './materials.js';
import { SMAT, STUDIO_MATERIALS } from './studiomaterials.js';

const UNIT = new THREE.BoxGeometry(1, 1, 1);
const DEG = Math.PI / 180;

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(UNIT, m);
  me.scale.set(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4));
  me.position.set(x, y, z);
  return me;
}
function rbox(w, h, d, r, m, x = 0, y = 0, z = 0) {
  const rr = Math.max(0.0005, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
  const me = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, rr), m);
  me.position.set(x, y, z);
  return me;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 24, open = false) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
  me.position.set(x, y, z);
  return me;
}
/** Cylinder whose axis points along +Z (speaker cones, knobs on a front face). */
function disc(r, depth, m, x, y, z, seg = 28) {
  const me = cyl(r, r, depth, m, x, y, z, seg);
  me.rotation.x = Math.PI / 2;
  return me;
}
function sphere(r, m, x = 0, y = 0, z = 0, ws = 20, hs = 14) {
  const me = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
  me.position.set(x, y, z);
  return me;
}
/** Many boxes as one instanced mesh: list of [x,y,z,w,h,d]. */
function instBoxes(list, m) {
  const im = new THREE.InstancedMesh(UNIT, m, Math.max(list.length, 1));
  const o = new THREE.Object3D();
  list.forEach((b, i) => {
    o.position.set(b[0], b[1], b[2]);
    o.scale.set(Math.max(b[3], 1e-4), Math.max(b[4], 1e-4), Math.max(b[5], 1e-4));
    o.rotation.set(b[6] || 0, b[7] || 0, b[8] || 0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  if (!list.length) im.count = 0;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}
/** Prism from a 2D profile in the XZ plane (x right, z forward), extruded up by h. */
function prism(points, h, m) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, m);
}
const ceilAt = (ctx, it) => (ctx.heightAt ? ctx.heightAt(it.pos[0], it.pos[2]) : ctx.room.h);
function hangWires(g, it, ctx, pts, top) {
  const len = Math.max(0.02, ceilAt(ctx, it) - (it.pos[1] + top));
  const m = mat('#9a9a9a', 'metal');
  for (const [x, z] of pts) g.add(cyl(0.002, 0.002, len, m, x, top + len / 2, z, 6));
}
function addPointLight(g, it, x, y, z, color, intensity, distance = 0) {
  const p = it.params;
  if (p.on === false) return;
  const l = new THREE.PointLight(color, intensity, distance, 2);
  l.position.set(x, y, z);
  l.userData.isLight = true;
  g.add(l);
}
function addSpot(g, it, x, y, z, tx, ty, tz, color, intensity, angle = 35) {
  if (it.params.on === false) return;
  const s = new THREE.SpotLight(color, intensity, 0, angle * DEG, 0.45, 2);
  s.position.set(x, y, z);
  s.target.position.set(tx, ty, tz);
  s.userData.isLight = true;
  g.add(s); g.add(s.target);
}
const lightOn = (it) => it.params.on !== false;
const glow = (it, color, k = 1.6) => mat('#ffffff', 'paint', { emissive: lightOn(it) ? color : '#000000', emissiveIntensity: lightOn(it) ? k * (it.params.intensity ?? 3) / 3 : 0 });

const LIGHT_PARAMS = {
  on: { label: 'Light on', type: 'bool', default: true },
  intensity: { label: 'Brightness', type: 'range', min: 0, max: 10, step: 0.1, default: 3 },
  lightColor: { label: 'Light colour', type: 'color', default: '#ffd9a8' },
};

// ---------------------------------------------------------------- builders
const B = {
  absorber(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, Math.min(0.02, d / 3), mat(it.color, it.finish), 0, h / 2, 0));
    if (it.params.frame) {
      const fm = mat(it.color2, 'wood'), t = 0.018;
      g.add(box(w, t, d + 0.004, fm, 0, t / 2, 0), box(w, t, d + 0.004, fm, 0, h - t / 2, 0));
      g.add(box(t, h, d + 0.004, fm, -w / 2 + t / 2, h / 2, 0), box(t, h, d + 0.004, fm, w / 2 - t / 2, h / 2, 0));
    }
    return g;
  },
  artPanel(it, ctx) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, 0.01, mat(it.color, 'fabric'), 0, h / 2, 0));
    const url = it.params.image && ctx.assets[it.params.image];
    const tex = url ? imageTexture(url, ctx.onTexture) : drawnTexture('art:default', 512, 512, (c, W, H) => {
      const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#1d2a44'); gr.addColorStop(0.5, '#6b3fa0'); gr.addColorStop(1, '#e07b2a');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 3;
      for (let i = 0; i < 9; i++) { c.beginPath(); for (let x = 0; x <= W; x += 8) c.lineTo(x, H / 2 + Math.sin(x * 0.02 + i) * (20 + i * 12)); c.stroke(); }
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.985, h * 0.985), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    face.position.set(0, h / 2, d / 2 + 0.001);
    g.add(face);
    return g;
  },
  cornerTrap(it) {
    const [L, h] = it.size, g = new THREE.Group();
    const style = it.params.style || 'triangle';
    const a = ((it.params.angle ?? 90) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    // legs run along both walls of the corner, whatever its angle
    let pts = [[0, 0], [L, 0], [L * ca, L * sa]];
    if (style === 'chamfer') pts = [[0, 0], [L, 0], [L * 0.85 + L * 0.3 * ca, L * 0.3 * sa], [L * 0.3 + L * 0.85 * ca, L * 0.85 * sa], [L * ca, L * sa]];
    const m = prism(pts, h, mat(it.color, it.finish));
    g.add(m);
    return g;
  },
  tubeTrap(it) {
    const [w, h] = it.size, g = new THREE.Group(), r = w / 2;
    g.add(cyl(r, r, h - 0.04, mat(it.color, 'fabric'), 0, h / 2, 0, 32));
    g.add(cyl(r * 1.02, r * 1.02, 0.02, mat(it.color2, 'plastic'), 0, h - 0.01, 0, 32));
    g.add(cyl(r * 1.02, r * 1.02, 0.02, mat(it.color2, 'plastic'), 0, 0.01, 0, 32));
    return g;
  },
  membrane(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), t = 0.02;
    const wood = mat(it.color2, 'wood');
    g.add(box(w, h, t, wood, 0, h / 2, -d / 2 + t / 2));
    g.add(box(t, h, d, wood, -w / 2 + t / 2, h / 2, 0), box(t, h, d, wood, w / 2 - t / 2, h / 2, 0));
    g.add(box(w, t, d, wood, 0, t / 2, 0), box(w, t, d, wood, 0, h - t / 2, 0));
    g.add(box(w - 2 * t, h - 2 * t, 0.006, mat(it.color, it.finish), 0, h / 2, d / 2 - 0.006));
    return g;
  },
  slats(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const sw = it.params.slatWidth ?? 0.027, gap = it.params.gap ?? 0.013, back = 0.012;
    g.add(box(w, h, back, mat(it.color2, 'felt'), 0, h / 2, -d / 2 + back / 2));
    const n = Math.max(1, Math.floor((w + gap) / (sw + gap)));
    const span = n * sw + (n - 1) * gap, list = [];
    for (let i = 0; i < n; i++) list.push([-span / 2 + sw / 2 + i * (sw + gap), h / 2, back / 2, sw, h, d - back]);
    g.add(instBoxes(list, mat(it.color, it.finish)));
    return g;
  },
  perforated(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const holes = it.params.pattern || 'holes';
    const tex = drawnTexture('perf:' + holes, 256, 256, (c, W, H) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.fillStyle = '#222';
      if (holes === 'slots') { for (let y = 8; y < H; y += 16) c.fillRect(10, y, W - 20, 4); }
      else for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, w * 4), Math.max(1, h * 4));
    g.add(box(w, h, d - 0.016, mat(it.color2, 'paint'), 0, h / 2, -0.008));
    const face = new THREE.Mesh(UNIT, mat(it.color, 'paint', { map: tex }));
    face.scale.set(w, h, 0.016); face.position.set(0, h / 2, d / 2 - 0.008);
    g.add(face);
    return g;
  },
  qrd(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const N = it.params.prime || 7, back = 0.012, fin = 0.008, maxD = d - back;
    const ww = w / N, seq = [], blocks = [], fins = [];
    for (let n = 0; n < N; n++) seq.push((n * n) % N);
    const smax = Math.max(...seq) || 1;
    seq.forEach((s, n) => {
      const depth = (s / smax) * maxD * 0.95;
      const fill = maxD - depth;
      if (fill > 0.001) blocks.push([-w / 2 + ww * (n + 0.5), h / 2, -d / 2 + back + fill / 2, ww, h, fill]);
    });
    for (let n = 0; n <= N; n++) fins.push([-w / 2 + ww * n, h / 2, -d / 2 + d / 2, fin, h, d]);
    const m = mat(it.color, it.finish);
    g.add(box(w, h, back, m, 0, h / 2, -d / 2 + back / 2));
    g.add(instBoxes(blocks, m));
    g.add(instBoxes(fins, mat(it.color2, it.finish)));
    g.add(box(w, 0.012, d, mat(it.color2, it.finish), 0, 0.006, 0), box(w, 0.012, d, mat(it.color2, it.finish), 0, h - 0.006, 0));
    return g;
  },
  skyline(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const n = it.params.grid || 12, back = 0.012, maxD = d - back;
    const bw = w / n, bh = h / n, list = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = ((i * i * 7 + j * j * 3 + i * j * 5) % 13) / 12;
      const dep = 0.08 * maxD + v * 0.92 * maxD;
      list.push([-w / 2 + bw * (i + 0.5), bh * (j + 0.5), -d / 2 + back + dep / 2, bw * 0.97, bh * 0.97, dep]);
    }
    g.add(box(w, h, back, mat(it.color2, it.finish), 0, h / 2, -d / 2 + back / 2));
    g.add(instBoxes(list, mat(it.color, it.finish)));
    return g;
  },
  poly(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const sag = Math.max(0.02, d - 0.01);
    const r = (w * w / 4 + sag * sag) / (2 * sag);
    const th = 2 * Math.asin(Math.min(1, w / (2 * r)));
    const geo = new THREE.CylinderGeometry(r, r, h, 40, 1, true, -th / 2, th);
    geo.translate(0, h / 2, -r * Math.cos(th / 2) - d / 2 + 0.01);
    g.add(new THREE.Mesh(geo, mat(it.color, it.finish, { side: THREE.DoubleSide })));
    const cap = mat(it.color2, 'wood');
    g.add(box(w, 0.018, d, cap, 0, 0.009, 0), box(w, 0.018, d, cap, 0, h - 0.009, 0));
    return g;
  },
  bad(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d - 0.004, 0.01, mat(it.color2, 'fabric'), 0, h / 2, -0.002));
    const tex = drawnTexture('bad:pattern', 256, 256, (c, W, H) => {
      c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, W, H); c.fillStyle = '#fff';
      const n = 16, s = W / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (((x * x + y * 3 + x * y) % 5) < 2) c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), new THREE.MeshStandardMaterial({ color: it.color, map: tex, transparent: true, roughness: 0.4 }));
    face.position.set(0, h / 2, d / 2 + 0.001);
    g.add(face);
    return g;
  },
  foam(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const n = Math.max(2, Math.round(w / (it.params.pitch || 0.1)));
    const p = w / n, base = d * 0.35, pts = [[-w / 2, 0]];
    for (let i = 0; i < n; i++) { const x = -w / 2 + i * p; pts.push([x, base], [x + p / 2, d], [x + p, base]); }
    pts.push([w / 2, 0]);
    const m = prism(pts, h, mat(it.color, 'foam'));
    m.position.z = -d / 2;
    g.add(m);
    return g;
  },
  cloud(it, ctx) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, Math.min(0.02, h / 3), mat(it.color, it.finish), 0, h / 2, 0));
    if (it.params.frame) {
      const fm = mat(it.color2, 'wood'), t = 0.02;
      g.add(box(w, h + 0.01, t, fm, 0, h / 2, d / 2 - t / 2), box(w, h + 0.01, t, fm, 0, h / 2, -d / 2 + t / 2));
    }
    hangWires(g, it, ctx, [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]], h);
    return g;
  },
  baffle(it, ctx) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, 0.01, mat(it.color, it.finish), 0, h / 2, 0));
    hangWires(g, it, ctx, [[-w / 2 + 0.05, 0], [w / 2 - 0.05, 0]], h);
    return g;
  },
  reflector(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const tilt = (it.params.tilt ?? 10) * DEG;
    const panel = box(w, h, d, mat(it.color, it.finish), 0, h / 2, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, 0, -d / 2); pivot.rotation.x = tilt;
    panel.position.z = d / 2; pivot.add(panel); g.add(pivot);
    return g;
  },
  redirector(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const n = it.params.blades || 6, ang = (it.params.angle ?? 30) * DEG, fm = mat(it.color2, 'wood');
    g.add(box(w, 0.02, d, fm, 0, 0.01, 0), box(w, 0.02, d, fm, 0, h - 0.01, 0));
    const bw = Math.min(d / Math.cos(ang) * 0.9, (w / n) * 1.6), list = [];
    for (let i = 0; i < n; i++) list.push([-w / 2 + (w / n) * (i + 0.5), h / 2, 0, bw, h - 0.04, 0.012, 0, ang, 0]);
    g.add(instBoxes(list, mat(it.color, it.finish)));
    return g;
  },
  curtain(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const folds = Math.max(4, Math.round(w / 0.12));
    const geo = new THREE.PlaneGeometry(w, h - 0.05, folds * 6, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / w) * folds * Math.PI * 2) * d * 0.4);
    geo.computeVertexNormals();
    const c = new THREE.Mesh(geo, mat(it.color, 'fabric', { side: THREE.DoubleSide }));
    c.position.y = (h - 0.05) / 2;
    g.add(c, cyl(0.012, 0.012, w + 0.1, mat('#888', 'metal'), 0, h - 0.02, 0));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  },
  gobo(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), lift = 0.1;
    g.add(rbox(w, h - lift, d, 0.012, mat(it.color, it.finish), 0, lift + (h - lift) / 2, 0));
    const fm = mat(it.color2, 'metal');
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) {
      g.add(box(0.04, 0.03, 0.45, fm, x, 0.06, 0));
      for (const z of [-0.2, 0.2]) g.add(sphere(0.03, mat('#111', 'plastic'), x, 0.03, z, 10, 8));
    }
    if (it.params.window) g.add(box(w * 0.6, (h - lift) * 0.3, d + 0.004, mat('#cfe8ff', 'glass'), 0, lift + (h - lift) * 0.72, 0));
    return g;
  },
  rug(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(box(w, h, d, mat(it.color2, 'carpet'), 0, h / 2, 0));
    g.add(box(w - 0.12, h + 0.002, d - 0.12, mat(it.color, 'carpet'), 0, h / 2 + 0.001, 0));
    return g;
  },
  // --------------------------------------------------------------- furniture
  desk(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), t = 0.04;
    const top = mat(it.color, it.finish), frame = mat(it.color2, 'paint');
    g.add(rbox(w, t, d, 0.008, top, 0, h - t / 2, 0));
    g.add(box(0.04, h - t, d * 0.9, frame, -w / 2 + 0.03, (h - t) / 2, 0), box(0.04, h - t, d * 0.9, frame, w / 2 - 0.03, (h - t) / 2, 0));
    g.add(box(w - 0.1, 0.3, 0.02, frame, 0, h - t - 0.15, -d / 2 + 0.06));
    if (it.params.bridge !== false) {
      g.add(box(w * 0.9, 0.025, 0.3, top, 0, h + 0.14, -d / 2 + 0.17));
      g.add(box(0.03, 0.14, 0.28, frame, -w * 0.45 + 0.02, h + 0.07, -d / 2 + 0.17), box(0.03, 0.14, 0.28, frame, w * 0.45 - 0.02, h + 0.07, -d / 2 + 0.17));
    }
    if (it.params.racks) {
      const rt = drawnTexture('rack:units', 128, 256, rackDraw);
      for (const s of [-1, 1]) {
        const r = new THREE.Group(); r.position.set(s * (w / 2 - 0.3), 0, d / 2 - 0.28); r.rotation.y = 0;
        r.add(box(0.5, 0.55, 0.45, frame, 0, 0.275, 0));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.5), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.6 }));
        face.position.set(0, 0.28, 0.226); r.add(face); g.add(r);
      }
    }
    return g;
  },
  console(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const body = mat(it.color2, 'paint');
    g.add(box(w, h * 0.62, d * 0.85, body, 0, h * 0.31, -d * 0.05));
    const tex = drawnTexture('console:' + Math.round(w * 10), 1024, 512, (c, W, H) => {
      c.fillStyle = '#2a2c30'; c.fillRect(0, 0, W, H);
      const strips = Math.round(w * 22);
      for (let i = 0; i < strips; i++) {
        const x = (i + 0.5) * W / strips;
        c.fillStyle = '#3a3d42'; c.fillRect(x - W / strips / 2 + 1, 0, W / strips - 2, H);
        for (let k = 0; k < 7; k++) { c.fillStyle = ['#d33', '#3a8', '#38c', '#ddd', '#eb3', '#ddd', '#888'][k]; c.beginPath(); c.arc(x, 18 + k * 30, 5, 0, 7); c.fill(); }
        c.fillStyle = '#111'; c.fillRect(x - 1.5, H * 0.55, 3, H * 0.38);
        c.fillStyle = '#ccc'; c.fillRect(x - 6, H * 0.55 + ((i * 37) % 60) + 40, 12, 18);
      }
    });
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, d * 0.8), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
    surf.rotation.x = -Math.PI / 2 + 0.22; surf.position.set(0, h * 0.62 + 0.05, -d * 0.03);
    g.add(surf);
    g.add(box(w, 0.06, 0.12, mat(it.color, 'leather'), 0, h * 0.6, d / 2 - 0.06));
    g.add(box(w, h * 0.25, 0.3, body, 0, h * 0.75, -d / 2 + 0.15));
    return g;
  },
  speaker(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const body = mat(it.color, it.finish), dark = mat(it.color2, 'plastic'), f = d / 2;
    g.add(rbox(w, h, d, Math.min(0.015, w / 10), body, 0, h / 2, 0));
    const wr = Math.min(w * 0.38, h * 0.22);
    const wy = h * (it.params.ways === 3 ? 0.25 : 0.33);
    g.add(disc(wr, 0.012, dark, 0, wy, f + 0.004), disc(wr * 0.75, 0.016, mat('#2a2a2a', 'plastic'), 0, wy, f + 0.006), disc(wr * 0.22, 0.02, mat('#555', 'metal'), 0, wy, f + 0.01));
    if (it.params.ways === 3) g.add(disc(wr * 0.5, 0.012, dark, 0, h * 0.58, f + 0.004));
    g.add(disc(w * 0.12, 0.012, dark, 0, h * 0.82, f + 0.004), disc(w * 0.05, 0.02, mat('#777', 'metal'), 0, h * 0.82, f + 0.008));
    if (it.params.port !== false) g.add(disc(w * 0.06, 0.012, mat('#050505', 'plastic'), w * 0.28, h * 0.1, f + 0.002));
    return g;
  },
  sub(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, 0.015, mat(it.color, it.finish), 0, h / 2, 0));
    const r = Math.min(w, h) * 0.38;
    g.add(disc(r, 0.012, mat(it.color2, 'plastic'), 0, h / 2, d / 2 + 0.004), disc(r * 0.8, 0.02, mat('#222', 'plastic'), 0, h / 2, d / 2 + 0.008));
    return g;
  },
  stand(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), m = mat(it.color, it.finish);
    g.add(box(w, 0.02, d, m, 0, 0.01, 0), box(0.08, h - 0.04, 0.08, m, 0, h / 2, 0), box(w * 0.85, 0.02, d * 0.85, m, 0, h - 0.01, 0));
    if (it.params.isoPad) g.add(box(w * 0.8, 0.03, d * 0.8, mat('#333', 'foam'), 0, h + 0.015, 0));
    return g;
  },
  screen(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), body = mat(it.color, 'plastic');
    const sh = h * 0.72;
    g.add(box(w, sh, 0.03, body, 0, h - sh / 2, 0));
    const scr = drawnTexture('screen:daw', 512, 288, (c, W, H) => {
      c.fillStyle = '#16181c'; c.fillRect(0, 0, W, H);
      const cols = ['#e05a5a', '#e0a95a', '#5ab0e0', '#7ae05a', '#b45ae0'];
      for (let i = 0; i < 8; i++) { c.fillStyle = '#22252b'; c.fillRect(0, 20 + i * 30, W, 26); c.fillStyle = cols[i % 5]; for (let k = 0; k < 6; k++) c.fillRect(70 + k * 70 + (i * 13) % 30, 24 + i * 30, 40 + (i * k * 7) % 30, 18); }
      c.fillStyle = '#0f1013'; c.fillRect(0, 0, 60, H);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.02, sh - 0.02), new THREE.MeshStandardMaterial({ map: scr, emissive: '#ffffff', emissiveMap: scr, emissiveIntensity: 0.6, roughness: 0.3 }));
    face.position.set(0, h - sh / 2, 0.016);
    g.add(face, box(0.05, h - sh, 0.05, body, 0, (h - sh) / 2, -0.02), box(0.25, 0.015, 0.18, body, 0, 0.008, 0));
    return g;
  },
  chair(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const fab = mat(it.color, it.finish), frame = mat(it.color2, 'plastic'), sh = h * 0.45;
    g.add(rbox(w, 0.08, d * 0.85, 0.03, fab, 0, sh, 0.02));
    g.add(rbox(w * 0.92, h * 0.5, 0.08, 0.03, fab, 0, sh + h * 0.28, -d * 0.38));
    g.add(cyl(0.025, 0.025, sh - 0.08, mat('#888', 'metal'), 0, sh / 2, 0));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, leg = box(0.32, 0.03, 0.04, frame, Math.cos(a) * 0.16, 0.06, Math.sin(a) * 0.16);
      leg.rotation.y = -a; g.add(leg, sphere(0.025, mat('#111', 'plastic'), Math.cos(a) * 0.31, 0.025, Math.sin(a) * 0.31, 8, 6));
    }
    for (const s of [-1, 1]) g.add(box(0.05, 0.03, d * 0.45, frame, s * w * 0.48, sh + 0.2, 0), box(0.03, 0.2, 0.03, frame, s * w * 0.48, sh + 0.1, 0));
    return g;
  },
  stool(it) {
    const [w, h] = it.size, g = new THREE.Group();
    g.add(cyl(w / 2, w / 2, 0.08, mat(it.color, it.finish), 0, h - 0.04, 0));
    g.add(cyl(0.025, 0.025, h - 0.08, mat(it.color2, 'metal'), 0, (h - 0.08) / 2, 0));
    g.add(cyl(w * 0.45, w * 0.5, 0.03, mat(it.color2, 'metal'), 0, 0.015, 0));
    return g;
  },
  sofa(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), fab = mat(it.color, it.finish), leg = mat(it.color2, 'wood');
    const sh = h * 0.5, arm = 0.18;
    g.add(rbox(w, sh - 0.1, d, 0.04, fab, 0, 0.1 + (sh - 0.1) / 2, 0));
    g.add(rbox(w, h - 0.1, 0.2, 0.05, fab, 0, 0.1 + (h - 0.1) / 2, -d / 2 + 0.1));
    g.add(rbox(arm, h * 0.72 - 0.1, d, 0.05, fab, -w / 2 + arm / 2, 0.1 + (h * 0.72 - 0.1) / 2, 0), rbox(arm, h * 0.72 - 0.1, d, 0.05, fab, w / 2 - arm / 2, 0.1 + (h * 0.72 - 0.1) / 2, 0));
    const n = Math.max(1, Math.round((w - 2 * arm) / 0.7)), cw = (w - 2 * arm) / n;
    for (let i = 0; i < n; i++) g.add(rbox(cw - 0.02, 0.14, d - 0.24, 0.05, fab, -w / 2 + arm + cw * (i + 0.5), sh + 0.07, 0.08));
    for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) g.add(cyl(0.02, 0.015, 0.1, leg, x, 0.05, z, 8));
    return g;
  },
  table(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), top = mat(it.color, it.finish), leg = mat(it.color2, 'metal');
    g.add(rbox(w, 0.035, d, 0.006, top, 0, h - 0.0175, 0));
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) g.add(box(0.035, h - 0.035, 0.035, leg, x, (h - 0.035) / 2, z));
    return g;
  },
  rack(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), body = mat(it.color, it.finish);
    g.add(box(w, h, d - 0.02, body, 0, h / 2, -0.01));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshStandardMaterial({ map: drawnTexture('rack:units', 128, 256, rackDraw), roughness: 0.5 }));
    face.position.set(0, h / 2, d / 2 - 0.019); g.add(face);
    return g;
  },
  keyboard(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), body = mat(it.color, it.finish), stand = mat(it.color2, 'metal');
    const kh = 0.1, top = h;
    g.add(rbox(w, kh, d, 0.01, body, 0, top - kh / 2, 0));
    const keys = drawnTexture('keys:88', 1024, 64, (c, W, H) => {
      c.fillStyle = '#f5f5f5'; c.fillRect(0, 0, W, H);
      const n = 52, kw = W / n; c.strokeStyle = '#999';
      for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * kw, 0); c.lineTo(i * kw, H); c.stroke(); }
      c.fillStyle = '#111';
      for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) c.fillRect((i + 1) * kw - kw * 0.3, 0, kw * 0.6, H * 0.6);
    });
    const k = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, d * 0.5), new THREE.MeshStandardMaterial({ map: keys, roughness: 0.4 }));
    k.rotation.x = -Math.PI / 2; k.position.set(0, top + 0.001, d * 0.2); g.add(k);
    if (it.params.stand !== false) for (const s of [-1, 1]) {
      const a = box(0.03, top * 1.2, 0.03, stand, s * w * 0.3, (top - kh) / 2, 0); a.rotation.z = s * 0.5; g.add(a);
      const b = box(0.03, top * 1.2, 0.03, stand, s * w * 0.3, (top - kh) / 2, 0); b.rotation.z = -s * 0.5; g.add(b);
    }
    return g;
  },
  mic(it) {
    const [, h] = it.size, g = new THREE.Group(), m = mat(it.color2, 'metal');
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, l = box(0.32, 0.02, 0.02, m, Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14); l.rotation.y = -a; l.rotation.z = 0.25; g.add(l); }
    g.add(cyl(0.012, 0.012, h - 0.25, m, 0, (h - 0.25) / 2 + 0.05, 0, 10));
    const boom = cyl(0.01, 0.01, 0.6, m, 0, h - 0.2, 0.2, 10); boom.rotation.x = Math.PI / 2 - 0.3; g.add(boom);
    const capsule = mat(it.color, it.finish);
    g.add(cyl(0.028, 0.028, 0.16, capsule, 0, h - 0.18, 0.48, 18), sphere(0.03, mat('#bbb', 'metal'), 0, h - 0.09, 0.48, 14, 10));
    if (it.params.popFilter !== false) { const pf = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.005, 6, 24), mat('#111', 'plastic')); pf.position.set(0, h - 0.12, 0.6); g.add(pf); const disk = disc(0.068, 0.002, mat('#222', 'fabric', { opacity: 0.6 }), 0, h - 0.12, 0.6); g.add(disk); }
    return g;
  },
  drums(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    const shell = mat(it.color, it.finish), head = mat('#eeeeea', 'plastic'), hw = mat('#bbb', 'metal'), cym = mat('#c8a14a', 'metal');
    const kick = cyl(0.28, 0.28, 0.4, shell, 0, 0.28, 0.05, 28); kick.rotation.x = Math.PI / 2; g.add(kick);
    const kh = cyl(0.27, 0.27, 0.41, head, 0, 0.28, 0.05, 28); kh.rotation.x = Math.PI / 2; kh.scale.set(1, 1, 1); g.add(kh);
    const drum = (r, dep, x, y, z) => { g.add(cyl(r, r, dep, shell, x, y, z, 24), cyl(r * 0.98, r * 0.98, 0.004, head, x, y + dep / 2 + 0.002, z, 24)); };
    drum(0.18, 0.14, -0.38, 0.62, 0.35); drum(0.15, 0.15, -0.14, 0.72, 0.05); drum(0.15, 0.16, 0.16, 0.72, 0.05); drum(0.22, 0.4, 0.45, 0.42, 0.35);
    const cymb = (r, x, y, z) => { g.add(cyl(0.008, 0.008, y, hw, x, y / 2, z, 6), cyl(r, r * 0.9, 0.01, cym, x, y, z, 28)); };
    cymb(0.18, -0.65, 0.95, 0.4); cymb(0.22, -0.45, 1.3, -0.15); cymb(0.25, 0.55, 1.3, -0.1); cymb(0.2, 0.3, 1.4, -0.3);
    g.add(cyl(0.18, 0.18, 0.06, mat('#222', 'leather'), 0.05, 0.55, 0.75, 20), cyl(0.02, 0.02, 0.52, hw, 0.05, 0.26, 0.75, 8));
    g.scale.set(w / 1.6, h / 1.45, d / 1.5);
    return g;
  },
  amp(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, 0.015, mat(it.color, 'leather'), 0, h / 2, 0));
    g.add(box(w - 0.06, h * 0.62, 0.006, mat(it.color2, 'fabric'), 0, h * 0.36, d / 2));
    g.add(box(w - 0.06, h * 0.18, 0.006, mat('#d8c9a8', 'metal'), 0, h * 0.82, d / 2));
    for (let i = 0; i < 6; i++) g.add(disc(0.012, 0.02, mat('#111', 'plastic'), -w / 2 + 0.1 + i * (w - 0.2) / 5, h * 0.82, d / 2 + 0.01, 12));
    return g;
  },
  piano(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), body = mat(it.color, it.finish);
    g.add(box(w, h, d * 0.55, body, 0, h / 2, -d * 0.22));
    g.add(box(w, 0.08, d * 0.45, body, 0, 0.72, d * 0.27));
    const keys = drawnTexture('keys:88', 1024, 64, () => {});
    const k = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, d * 0.25), new THREE.MeshStandardMaterial({ map: keys, roughness: 0.4 }));
    k.rotation.x = -Math.PI / 2; k.position.set(0, 0.762, d * 0.3); g.add(k);
    g.add(box(0.06, 0.66, 0.06, body, -w / 2 + 0.05, 0.33, d * 0.42), box(0.06, 0.66, 0.06, body, w / 2 - 0.05, 0.33, d * 0.42));
    return g;
  },
  guitar(it) {
    const [, h] = it.size, g = new THREE.Group(), body = mat(it.color, 'gloss'), s = mat(it.color2, 'metal');
    g.add(cyl(0.012, 0.012, 0.45, s, 0, 0.225, -0.05, 8));
    const b = sphere(0.18, body, 0, 0.32, 0, 20, 14); b.scale.set(1, 1.15, 0.28); g.add(b);
    const b2 = sphere(0.14, body, 0, 0.58, 0, 20, 14); b2.scale.set(1, 1, 0.28); g.add(b2);
    g.add(box(0.05, h * 0.45, 0.03, mat('#4a2f22', 'wood'), 0, 0.6 + h * 0.22, 0));
    return g;
  },
  bookshelf(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), m = mat(it.color, it.finish), t = 0.02;
    const shelves = Math.max(2, Math.round(h / 0.38));
    g.add(box(t, h, d, m, -w / 2 + t / 2, h / 2, 0), box(t, h, d, m, w / 2 - t / 2, h / 2, 0), box(w, h, 0.008, m, 0, h / 2, -d / 2 + 0.004));
    for (let i = 0; i <= shelves; i++) g.add(box(w, t, d, m, 0, i * (h - t) / shelves + t / 2, 0));
    if (it.params.books !== false) {
      const cols = ['#7a2e2e', '#2e4d7a', '#c8a14a', '#3f6b4f', '#ddd', '#222', '#a4502b'];
      const lists = cols.map(() => []);
      let k = 1;
      for (let s = 0; s < shelves; s++) {
        let x = -w / 2 + t + 0.01; const y0 = s * (h - t) / shelves + t;
        while (x < w / 2 - t - 0.05) { k = (k * 16807) % 2147483647; const bw = 0.02 + (k % 30) / 1000, bh = 0.2 + (k % 12) / 100, bd = d * (0.6 + (k % 30) / 100); lists[k % cols.length].push([x + bw / 2, y0 + bh / 2, -d / 2 + bd / 2 + 0.01, bw, bh, bd]); x += bw + 0.002; }
      }
      lists.forEach((l, i) => l.length && g.add(instBoxes(l, mat(cols[i], 'paint'))));
    }
    return g;
  },
  plant(it) {
    const [w, h] = it.size, g = new THREE.Group(), r = w / 2;
    g.add(cyl(r * 0.6, r * 0.45, h * 0.3, mat(it.color2, it.finish), 0, h * 0.15, 0, 20));
    const leaf = mat(it.color, 'paint');
    let k = 7;
    for (let i = 0; i < 9; i++) {
      k = (k * 48271) % 2147483647;
      const a = (k % 628) / 100, rr = r * 0.6 * ((k % 100) / 100), y = h * 0.45 + (h * 0.5 * ((k >> 3) % 100)) / 100;
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.35 + (k % 40) / 100), 0), leaf);
      s.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); g.add(s);
    }
    return g;
  },
  listener(it) {
    const [w, h] = it.size, g = new THREE.Group();
    const m = mat(it.color, 'plastic', { opacity: 0.85 });
    g.add(sphere(w * 0.22, m, 0, h * 0.92, 0));
    const torso = cyl(w * 0.28, w * 0.36, h * 0.38, m, 0, h * 0.62, 0, 16); g.add(torso);
    g.add(cyl(w * 0.3, w * 0.3, 0.02, mat(it.color, 'plastic', { opacity: 0.35 }), 0, 0.01, 0, 32));
    g.add(disc(0.03, 0.04, mat('#fff', 'plastic'), 0, h * 0.94, w * 0.2));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * 0.32, 0.006, 6, 40), mat('#ffffff', 'paint', { emissive: it.color, emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.92; g.add(ring);
    return g;
  },
  tv(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(box(w, h, d, mat(it.color, 'plastic'), 0, h / 2, 0));
    g.add(box(w - 0.02, h - 0.02, 0.002, mat('#05070a', 'gloss', { emissive: it.params.on === false ? '#000' : '#0b1a2a', emissiveIntensity: 1 }), 0, h / 2, d / 2 + 0.001));
    return g;
  },
  pc(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(rbox(w, h, d, 0.01, mat(it.color, it.finish), 0, h / 2, 0));
    g.add(box(0.004, h * 0.8, d * 0.8, mat('#9cf', 'glass'), w / 2 + 0.002, h / 2, 0));
    g.add(disc(0.01, 0.004, mat('#fff', 'paint', { emissive: '#4cf', emissiveIntensity: 2 }), 0, h * 0.9, d / 2 + 0.002, 10));
    return g;
  },
  // ------------------------------------------------------------- architecture
  door(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params;
    const style = P.style || 'flush', fr = mat(it.color2, P.frameFinish || 'paint'), t = 0.06;
    const glass = mat(P.glassColor || FINISHES[P.glass || 'glass']?.color || '#dfeff7', P.glass || 'glass');
    const leafMat = mat(it.color, it.finish), metal = mat(P.hardware || '#b9bcbf', 'metal');
    const isBarn = style === 'barn', isSliding = style === 'sliding';
    // frame (barn doors hang outside the opening, so they get a slimmer casing)
    if (!isBarn) g.add(box(t, h, d, fr, -w / 2 + t / 2, h / 2, 0), box(t, h, d, fr, w / 2 - t / 2, h / 2, 0), box(w, t, d, fr, 0, h - t / 2, 0));
    else g.add(box(0.04, h, 0.02, fr, -w / 2 + 0.02, h / 2, d / 2), box(0.04, h, 0.02, fr, w / 2 - 0.02, h / 2, d / 2), box(w, 0.04, 0.02, fr, 0, h - 0.02, d / 2));
    const ow = isBarn ? w : w - 2 * t, oh = isBarn ? h : h - t;
    const lt = style === 'acoustic' ? Math.min(0.08, d * 0.9) : Math.min(0.045, d * 0.7);
    const double = ['double', 'french'].includes(style) || (style === 'glass' && P.leaves === 2);
    const open = (P.open || 0) * DEG, hingeRight = P.hinge === 'right';
    const leaf = (lw, lh, kind) => {
      const L = new THREE.Group(), st = 0.1;
      if (kind === 'glass' || kind === 'french') {
        L.add(box(lw, st, lt, leafMat, 0, st / 2, 0), box(lw, st, lt, leafMat, 0, lh - st / 2, 0), box(st, lh, lt, leafMat, -lw / 2 + st / 2, lh / 2, 0), box(st, lh, lt, leafMat, lw / 2 - st / 2, lh / 2, 0));
        L.add(box(lw - 2 * st, lh - 2 * st, 0.008, glass, 0, lh / 2, 0));
        if (kind === 'french') { const rows = 4; for (let r2 = 1; r2 < rows; r2++) L.add(box(lw - 2 * st, 0.025, lt * 0.8, leafMat, 0, st + ((lh - 2 * st) * r2) / rows, 0)); L.add(box(0.025, lh - 2 * st, lt * 0.8, leafMat, 0, lh / 2, 0)); }
      } else if (kind === 'half') {
        L.add(box(lw, lh * 0.5, lt, leafMat, 0, lh * 0.25, 0), box(lw, st, lt, leafMat, 0, lh - st / 2, 0), box(st, lh * 0.5, lt, leafMat, -lw / 2 + st / 2, lh * 0.75, 0), box(st, lh * 0.5, lt, leafMat, lw / 2 - st / 2, lh * 0.75, 0));
        L.add(box(lw - 2 * st, lh * 0.5 - st, 0.008, glass, 0, lh * 0.5 + (lh * 0.5 - st) / 2, 0));
      } else if (kind === 'barn') {
        const n = Math.max(3, Math.round(lw / 0.14)), pw = lw / n;
        for (let k = 0; k < n; k++) L.add(box(pw - 0.004, lh, lt, leafMat, -lw / 2 + pw * (k + 0.5), lh / 2, 0));
        L.add(box(lw, 0.12, 0.02, leafMat, 0, lh * 0.15, lt / 2 + 0.01), box(lw, 0.12, 0.02, leafMat, 0, lh * 0.85, lt / 2 + 0.01));
        const diag = box(Math.hypot(lw, lh * 0.7), 0.1, 0.02, leafMat, 0, lh / 2, lt / 2 + 0.01); diag.rotation.z = Math.atan2(lh * 0.7, lw); L.add(diag);
      } else {
        L.add(box(lw, lh, lt, leafMat, 0, lh / 2, 0));
        if (kind === 'panel') { const pm = mat(it.color, it.finish); for (const [px, py, ph] of [[-1, 0.72, 0.42], [1, 0.72, 0.42], [-1, 0.27, 0.36], [1, 0.27, 0.36]]) L.add(box(lw * 0.34, lh * ph * 0.8, 0.012, pm, px * lw * 0.21, lh * py, lt / 2 + 0.006)); }
        if (kind === 'vision' || kind === 'acoustic') L.add(box(Math.min(0.22, lw * 0.3), lh * 0.32, lt + 0.004, glass, 0, lh * 0.68, 0));
        if (kind === 'acoustic') { const seal = mat('#141414', 'plastic'); L.add(box(lw, 0.02, lt + 0.006, seal, 0, 0.01, 0), box(0.012, lh, lt + 0.006, seal, -lw / 2 + 0.006, lh / 2, 0), box(0.012, lh, lt + 0.006, seal, lw / 2 - 0.006, lh / 2, 0)); }
      }
      return L;
    };
    const handle = (L, lw, lh, side) => {
      const hx = side * (lw / 2 - 0.08), z = lt / 2 + 0.03, kind = P.handle || 'lever';
      if (kind === 'none') return;
      if (kind === 'bar') { L.add(cyl(0.014, 0.014, Math.min(1.2, lh * 0.55), metal, hx, lh * 0.5, z, 12)); L.add(box(0.02, 0.02, 0.05, metal, hx, lh * 0.5 + Math.min(1.2, lh * 0.55) / 2 - 0.04, lt / 2 + 0.012), box(0.02, 0.02, 0.05, metal, hx, lh * 0.5 - Math.min(1.2, lh * 0.55) / 2 + 0.04, lt / 2 + 0.012)); }
      else if (kind === 'knob') L.add(sphere(0.03, metal, hx, lh * 0.47, z, 14, 10));
      else if (kind === 'pull') L.add(box(0.02, 0.35, 0.025, metal, hx, lh * 0.5, z - 0.01));
      else { L.add(box(0.13, 0.02, 0.02, metal, hx - side * 0.05, lh * 0.47, z), cyl(0.02, 0.02, 0.03, metal, hx, lh * 0.47, lt / 2 + 0.012, 12)); }
      if (style === 'acoustic') L.add(box(0.03, 0.18, 0.03, metal, hx, lh * 0.47, lt / 2 + 0.05));
    };
    const kind = { flush: 'flush', panel: 'panel', glass: 'glass', half: 'half', vision: 'vision', acoustic: 'acoustic', double: P.glazing ? 'glass' : 'panel', french: 'french', sliding: 'glass', barn: 'barn' }[style] || 'flush';
    if (isSliding || isBarn) {
      const frac = P.open ? Math.min(1, P.open / 90) : 0;
      const lw = isBarn ? ow + 0.12 : ow * 0.52, L = leaf(lw, isBarn ? oh + 0.04 : oh, kind);
      L.position.set(isBarn ? frac * lw : -ow / 2 + lw / 2 + frac * (ow - lw), 0, isBarn ? d / 2 + lt / 2 + 0.03 : -lt * 0.6);
      handle(L, lw, oh, isBarn ? -1 : 1);
      g.add(L);
      if (isSliding) { const F2 = leaf(lw, oh, kind); F2.position.set(ow / 2 - lw / 2, 0, lt * 0.6); g.add(F2); g.add(box(ow, 0.03, d * 0.8, fr, 0, oh - 0.015, 0)); }
      if (isBarn) { g.add(box(w * 2.1, 0.03, 0.03, metal, w / 2, h + 0.08, d / 2 + 0.04)); for (const x of [-lw / 2 + 0.1, lw / 2 - 0.1]) L.add(cyl(0.035, 0.035, 0.02, metal, x, h + 0.08 - L.position.y, -0.0, 16)); }
    } else if (double) {
      for (const side of [-1, 1]) {
        const lw = ow / 2, piv = new THREE.Group(); piv.position.set(side * ow / 2, 0, d / 2 - lt / 2);
        const L = leaf(lw, oh, kind); L.position.x = -side * lw / 2; handle(L, lw, oh, -side);
        piv.add(L); piv.rotation.y = side * open; g.add(piv);
      }
    } else {
      const s2 = hingeRight ? 1 : -1, piv = new THREE.Group(); piv.position.set(s2 * ow / 2, 0, d / 2 - lt / 2);
      const L = leaf(ow, oh, kind); L.position.x = -s2 * ow / 2; handle(L, ow, oh, -s2);
      piv.add(L); piv.rotation.y = s2 * open; g.add(piv);
      if (style === 'acoustic') for (const y of [0.25, 0.5, 0.85]) g.add(cyl(0.012, 0.012, 0.12, metal, s2 * (ow / 2), oh * y, d / 2, 10));
    }
    if (P.seals !== false && !isBarn && !isSliding) g.add(box(ow, 0.012, d * 0.82, mat('#222', 'plastic'), 0, 0.006, 0));
    return g;
  },
  window(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params, style = P.style || 'studio';
    const fr = mat(it.color, it.finish), t = P.frame ?? 0.06;
    const glass = mat(P.glassColor || FINISHES[P.glass || 'glass']?.color || '#dfeff7', P.glass || 'glass');
    const pane = (pw, ph, x, y, z, rx = 0) => { const m = box(pw, ph, 0.008, glass, x, y, z); m.rotation.x = rx; g.add(m); };
    if (style === 'round') {
      const r = Math.min(w, h) / 2, ring = new THREE.Mesh(new THREE.TorusGeometry(r - t / 2, t / 2, 10, 48), fr); ring.position.set(0, h / 2, 0); ring.scale.z = d / t; g.add(ring);
      const disc0 = new THREE.Mesh(new THREE.CircleGeometry(r - t, 48), glass); disc0.position.set(0, h / 2, 0); g.add(disc0);
      return g;
    }
    if (style === 'arch') {
      const r = w / 2, sh = new THREE.Shape(), ih = Math.max(0.05, h - r);
      sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, ih); sh.absarc(0, ih, r, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
      const hole = new THREE.Path(); hole.moveTo(-w / 2 + t, t); hole.lineTo(w / 2 - t, t); hole.lineTo(w / 2 - t, ih); hole.absarc(0, ih, r - t, 0, Math.PI, false); hole.lineTo(-w / 2 + t, t); sh.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -d / 2); g.add(new THREE.Mesh(geo, fr));
      const gs = new THREE.Shape(); gs.moveTo(-w / 2 + t, t); gs.lineTo(w / 2 - t, t); gs.lineTo(w / 2 - t, ih); gs.absarc(0, ih, r - t, 0, Math.PI, false); gs.lineTo(-w / 2 + t, t);
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(gs, 24), glass); g.add(gm);
      if (P.grid) { g.add(box(0.025, h - 2 * t, 0.02, fr, 0, h / 2, 0), box(w - 2 * t, 0.025, 0.02, fr, 0, ih, 0)); }
      return g;
    }
    g.add(box(w, t, d, fr, 0, t / 2, 0), box(w, t, d, fr, 0, h - t / 2, 0), box(t, h, d, fr, -w / 2 + t / 2, h / 2, 0), box(t, h, d, fr, w / 2 - t / 2, h / 2, 0));
    const iw = w - 2 * t, ih = h - 2 * t;
    if (style === 'studio') {
      const panes = P.panes || 2;
      for (let i = 0; i < panes; i++) pane(iw, ih, 0, h / 2, -d / 2 + (d / (panes + 1)) * (i + 1), P.angled && i === 0 ? 6 * DEG : 0);
      g.add(box(iw, 0.01, d - 0.02, mat('#141414', 'felt'), 0, t + 0.005, 0));
    } else if (style === 'casement' || style === 'sliding') {
      pane(iw / 2 - 0.01, ih, -iw / 4, h / 2, style === 'sliding' ? -0.015 : 0); pane(iw / 2 - 0.01, ih, iw / 4, h / 2, style === 'sliding' ? 0.015 : 0);
      g.add(box(0.05, ih, d * 0.6, fr, 0, h / 2, 0));
      if (style === 'casement') for (const s of [-1, 1]) g.add(box(0.012, 0.1, 0.03, mat('#bbb', 'metal'), s * 0.04, h / 2, d * 0.35));
    } else {
      pane(iw, ih, 0, h / 2, 0);
      if (style === 'grid' || P.grid) { const cols = Math.max(2, Math.round(iw / 0.35)), rows = Math.max(2, Math.round(ih / 0.35)); for (let c = 1; c < cols; c++) g.add(box(0.025, ih, 0.025, fr, -iw / 2 + (iw * c) / cols, h / 2, 0)); for (let r = 1; r < rows; r++) g.add(box(iw, 0.025, 0.025, fr, 0, t + (ih * r) / rows, 0)); }
    }
    if (P.sill !== false) g.add(box(w + 0.06, 0.03, d + 0.06, mat(it.color2 || it.color, 'paint'), 0, -0.015, 0.03));
    return g;
  },
  partition(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params, style = P.style || 'solid';
    const m = mat(it.color, it.finish), glass = mat(FINISHES[P.glass || 'glass']?.color || '#dfeff7', P.glass || 'glass'), fr = mat(it.color2, 'blackSteel');
    if (style === 'solid') g.add(box(w, h, d, m, 0, h / 2, 0));
    else if (style === 'half') { const hh = P.halfHeight ?? 1.1; g.add(box(w, hh, d, m, 0, hh / 2, 0), box(w + 0.02, 0.03, d + 0.03, mat(it.color2, 'wood'), 0, hh + 0.015, 0)); }
    else if (style === 'glassTop') { const hh = P.halfHeight ?? 1.1; g.add(box(w, hh, d, m, 0, hh / 2, 0)); g.add(box(w, h - hh, 0.012, glass, 0, hh + (h - hh) / 2, 0), box(w, 0.04, d, fr, 0, h - 0.02, 0), box(w, 0.04, d, fr, 0, hh + 0.02, 0)); }
    else if (style === 'slatted') { const n = Math.max(2, Math.floor(w / 0.09)); for (let k = 0; k < n; k++) g.add(box(0.045, h, d, m, -w / 2 + (w / n) * (k + 0.5), h / 2, 0)); }
    else if (style === 'glass' || style === 'crittall') {
      g.add(box(w, h - 0.06, 0.012, glass, 0, h / 2, 0), box(w, 0.04, d, fr, 0, 0.02, 0), box(w, 0.04, d, fr, 0, h - 0.02, 0), box(0.04, h, d, fr, -w / 2 + 0.02, h / 2, 0), box(0.04, h, d, fr, w / 2 - 0.02, h / 2, 0));
      if (style === 'crittall') { const cols = Math.max(2, Math.round(w / 0.5)), rows = Math.max(3, Math.round(h / 0.5)); for (let c = 1; c < cols; c++) g.add(box(0.025, h, d * 0.7, fr, -w / 2 + (w * c) / cols, h / 2, 0)); for (let r = 1; r < rows; r++) g.add(box(w, 0.025, d * 0.7, fr, 0, (h * r) / rows, 0)); }
    }
    return g;
  },
  cladding(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params, style = P.style || 'flat', m = mat(it.color, it.finish);
    if (style === 'flat') g.add(box(w, h, d, m, 0, h / 2, 0));
    else if (style === 'vgroove' || style === 'battens') {
      const pitch = P.pitch || 0.1, n = Math.max(2, Math.round(w / pitch)), pw = w / n;
      if (style === 'battens') g.add(box(w, h, 0.01, mat(it.color2, 'paint'), 0, h / 2, -d / 2 + 0.005));
      for (let k = 0; k < n; k++) g.add(box(style === 'battens' ? pw * 0.45 : pw - 0.004, h, style === 'battens' ? d - 0.01 : d, m, -w / 2 + pw * (k + 0.5), h / 2, style === 'battens' ? 0.005 : 0));
    } else if (style === 'tiles' || style === 'hex') {
      g.add(box(w, h, 0.006, mat(it.color2, 'paint'), 0, h / 2, -d / 2 + 0.003));
      const s0 = P.tile || 0.3;
      if (style === 'hex') {
        const R = s0 / 2, hh = Math.sqrt(3) * R, geo = new THREE.CylinderGeometry(R * 0.96, R * 0.96, d - 0.006, 6); geo.rotateX(Math.PI / 2); geo.rotateZ(Math.PI / 6);
        const pts = []; for (let c = 0; c * R * 1.5 <= w; c++) for (let r = 0; r * hh <= h; r++) { const x = -w / 2 + c * R * 1.5 + R, y = r * hh + (c % 2 ? hh / 2 : 0) + hh / 2; if (x + R <= w / 2 + 1e-3 && y + hh / 2 <= h + 1e-3) pts.push([x, y]); }
        const im = new THREE.InstancedMesh(geo, m, Math.max(1, pts.length)); const o = new THREE.Object3D();
        pts.forEach(([x, y], i) => { o.position.set(x, y, 0.003); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); im.count = pts.length; g.add(im);
      } else { const list = []; for (let x = -w / 2; x < w / 2 - 1e-3; x += s0) for (let y = 0; y < h - 1e-3; y += s0) list.push([x + Math.min(s0, w / 2 - x) / 2, y + Math.min(s0, h - y) / 2, 0.003, Math.min(s0, w / 2 - x) - 0.006, Math.min(s0, h - y) - 0.006, d - 0.006]); g.add(instBoxes(list, m)); }
    } else if (style === 'wainscot') {
      const hh = Math.min(h, P.panelHeight ?? 1.0); g.add(box(w, hh, d, m, 0, hh / 2, 0), box(w + 0.01, 0.04, d + 0.02, m, 0, hh, 0));
      const n = Math.max(1, Math.round(w / 0.6)); for (let k = 0; k < n; k++) g.add(box(w / n - 0.12, hh - 0.2, 0.012, m, -w / 2 + (w / n) * (k + 0.5), hh / 2, d / 2 + 0.006));
    }
    return g;
  },
  mirror(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params;
    if (P.round) { const r = Math.min(w, h) / 2; const f = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, 48), mat(it.color2, P.frameFinish || 'brass')); f.rotation.x = Math.PI / 2; f.position.y = h / 2; g.add(f); const mm = new THREE.Mesh(new THREE.CircleGeometry(r - 0.025, 48), mat('#e8eef2', 'mirror')); mm.position.set(0, h / 2, d / 2 + 0.001); g.add(mm); return g; }
    g.add(box(w, h, d, mat(it.color2, P.frameFinish || 'blackSteel'), 0, h / 2, 0));
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, h - 0.05), mat('#e8eef2', 'mirror')); mm.position.set(0, h / 2, d / 2 + 0.001); g.add(mm);
    return g;
  },
  sheet(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), m = SMAT[it.params.mat] || SMAT.gyp12;
    const fin = FINISHES[m.finish] ? m.finish : 'paint';
    g.add(box(w, h, Math.max(d, 0.002), mat(it.params.useColor ? it.color : m.color, fin), 0, h / 2, 0));
    return g;
  },
  studFrame(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params, m = SMAT[P.stud] || SMAT.stud2x4;
    const fm = mat(m.color, FINISHES[m.finish] ? m.finish : 'wood'), sw = m.w || 0.045, s0 = P.spacing || m.s || 0.6;
    const n = Math.max(1, Math.round(w / s0)), list = [];
    for (let k = 0; k <= n; k++) list.push([-w / 2 + sw / 2 + ((w - sw) * k) / n, h / 2, 0, sw, h - 0.09, d]);
    list.push([0, 0.0225, 0, w, 0.045, d], [0, h - 0.0225, 0, w, 0.045, d], [0, h - 0.0675, 0, w, 0.045, d]);
    g.add(instBoxes(list, fm));
    if (P.insulation) g.add(box(w - 0.02, h - 0.14, d * 0.9, mat('#d8c48a', 'felt'), 0, h / 2, 0));
    const bm = SMAT[P.board] || SMAT.gyp12, bt = bm.t, bmat = mat(bm.color, FINISHES[bm.finish] ? bm.finish : 'paint');
    if (P.sheathing === 'one' || P.sheathing === 'both') g.add(box(w, h, bt, bmat, 0, h / 2, d / 2 + bt / 2));
    if (P.sheathing === 'both') g.add(box(w, h, bt, bmat, 0, h / 2, -d / 2 - bt / 2));
    return g;
  },
  isoClipItem(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), rub = mat('#1d1d1f', 'rubber'), steel = mat('#9aa0a6', 'metal');
    g.add(box(w, h * 0.55, d * 0.5, rub, 0, h * 0.5, -d / 4), box(w * 0.8, h * 0.9, 0.003, steel, 0, h * 0.5, -d / 2 + 0.0015));
    if (it.params.channel !== false) { const cl = it.params.channelLength ?? 0.6; g.add(box(cl, 0.03, 0.025, steel, 0, h * 0.5, d / 2 - 0.0125)); }
    return g;
  },
  channelRun(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), m = SMAT[it.params.mat] || SMAT.hatChannel;
    const mm = mat(m.color, FINISHES[m.finish] ? m.finish : 'metal');
    if (m.kind === 'battens') { g.add(box(w, h, d, mm, 0, h / 2, 0)); return g; }
    g.add(box(w, 0.003, d, mm, 0, h - 0.0015, 0), box(w, h, 0.003, mm, 0, h / 2, -d / 2 + 0.0015), box(w, h, 0.003, mm, 0, h / 2, d / 2 - 0.0015));
    g.add(box(w, 0.003, 0.012, mm, 0, 0.0015, -d / 2 - 0.006), box(w, 0.003, 0.012, mm, 0, 0.0015, d / 2 + 0.006));
    return g;
  },
  hangerItem(it, ctx) {
    const [w, h, d] = it.size, g = new THREE.Group(), steel = mat('#c0c4c8', 'metal');
    const len = Math.max(0.05, (ctx.heightAt ? ctx.heightAt(it.pos[0], it.pos[2]) : ctx.room.h) - it.pos[1] - h);
    g.add(box(w, h * 0.5, d, steel, 0, h * 0.75, 0), box(w * 0.9, 0.004, d * 0.9, steel, 0, h * 0.25, 0));
    if (it.params.spring) { const sp = new THREE.Mesh(new THREE.TorusGeometry(w * 0.25, 0.004, 6, 16), mat('#c23b3b', 'metal')); for (let k = 0; k < 4; k++) { const c = sp.clone(); c.rotation.x = Math.PI / 2; c.position.y = h * 0.55 + k * 0.012; g.add(c); } }
    else g.add(box(w * 0.6, h * 0.3, d * 0.6, mat('#1d1d1f', 'rubber'), 0, h * 0.6, 0));
    g.add(cyl(0.004, 0.004, len, steel, 0, h + len / 2, 0, 8), cyl(0.004, 0.004, h * 0.6, steel, 0, h * 0.25, 0, 8));
    g.add(box(0.6, 0.03, 0.025, mat('#9aa0a6', 'metal'), 0, 0.015, 0));
    return g;
  },
  isoPadItem(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    if (it.params.spring) {
      g.add(box(w, 0.01, d, mat('#9aa0a6', 'metal'), 0, 0.005, 0), box(w, 0.01, d, mat('#9aa0a6', 'metal'), 0, h - 0.005, 0));
      const sp = new THREE.Mesh(new THREE.TorusGeometry(w * 0.22, 0.006, 6, 16), mat('#c23b3b', 'metal'));
      for (let k = 0; k < 5; k++) { const c = sp.clone(); c.rotation.x = Math.PI / 2; c.position.y = 0.015 + k * (h - 0.03) / 4; g.add(c); }
    } else g.add(cyl(w / 2, w / 2, h, mat('#2b2c2e', 'rubber'), 0, h / 2, 0, 24));
    return g;
  },
  floatingFloor(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), P = it.params;
    const pad = 0.025, sleeper = 0.07, deck = 0.036;
    const pads = [], sl = [];
    for (let z = -d / 2 + 0.2; z <= d / 2 - 0.19; z += 0.4) { sl.push([0, pad + sleeper / 2, z, w - 0.05, sleeper, 0.045]); for (let x = -w / 2 + 0.2; x <= w / 2 - 0.19; x += 0.4) pads.push([x, pad / 2, z, 0.09, pad, 0.09]); }
    g.add(instBoxes(pads, mat('#2b2c2e', 'rubber')), instBoxes(sl, mat('#d2a96f', 'wood')));
    if (P.insulation !== false) g.add(box(w - 0.06, sleeper * 0.9, d - 0.06, mat('#bba564', 'felt'), 0, pad + sleeper * 0.45, 0));
    if (!P.exploded) g.add(box(w, deck, d, mat('#dcc095', 'plywood'), 0, pad + sleeper + deck / 2, 0), box(w, Math.max(0.005, h - (pad + sleeper + deck)), d, mat(it.color, it.finish), 0, pad + sleeper + deck + Math.max(0.005, h - (pad + sleeper + deck)) / 2, 0));
    else g.add(box(w, deck, d, mat('#dcc095', 'plywood', { opacity: 0.35 }), 0, pad + sleeper + deck / 2 + 0.15, 0));
    return g;
  },
  custom(it) { return buildCustom(it); },
  column(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    if (it.params.round) g.add(cyl(w / 2, w / 2, h, mat(it.color, it.finish), 0, h / 2, 0, 32));
    else g.add(box(w, h, d, mat(it.color, it.finish), 0, h / 2, 0));
    return g;
  },
  riser(it) {
    const [w, h, d] = it.size, g = new THREE.Group();
    g.add(box(w, h - 0.02, d, mat(it.color2, 'paint'), 0, (h - 0.02) / 2, 0));
    g.add(box(w, 0.02, d, mat(it.color, it.finish), 0, h - 0.01, 0));
    return g;
  },
  booth(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), t = 0.1;
    const shell = mat(it.color2, 'paint'), inner = mat(it.color, 'fabric');
    g.add(box(w, t, d, shell, 0, t / 2, 0), box(w, t, d, shell, 0, h - t / 2, 0));
    g.add(box(w, h - 2 * t, t, inner, 0, h / 2, -d / 2 + t / 2));
    g.add(box(t, h - 2 * t, d, inner, -w / 2 + t / 2, h / 2, 0), box(t, h - 2 * t, d, inner, w / 2 - t / 2, h / 2, 0));
    const dw = Math.min(0.8, w * 0.5), wx = -w / 2 + dw;
    const fw = w - dw;
    g.add(box(fw, h - 2 * t, t, shell, wx + fw / 2, h / 2, d / 2 - t / 2));
    g.add(box(fw * 0.7, (h - 2 * t) * 0.35, t + 0.004, mat('#cfe8ff', 'glass'), wx + fw / 2, h * 0.6, d / 2 - t / 2));
    g.add(box(dw - 0.02, h - 2 * t, 0.05, mat(it.color2, 'gloss'), -w / 2 + dw / 2, h / 2, d / 2 - 0.03));
    return g;
  },
  soffit(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), s = mat(it.color, it.finish);
    const sw = Math.min(0.5, w * 0.12), sh = 0.75, sy = it.params.speakerHeight ?? 1.2;
    const xs = [-w / 2 + w * 0.22, w / 2 - w * 0.22];
    g.add(box(w, h, d, s, 0, h / 2, 0));
    const dark = mat('#141414', 'plastic');
    for (const x of xs) {
      g.add(box(sw + 0.04, sh + 0.04, 0.01, dark, x, sy, d / 2 + 0.002));
      g.add(disc(sw * 0.38, 0.02, mat('#2a2a2a', 'plastic'), x, sy - sh * 0.2, d / 2 + 0.01), disc(sw * 0.2, 0.02, mat('#2a2a2a', 'plastic'), x, sy + sh * 0.25, d / 2 + 0.01));
    }
    return g;
  },
  stairs(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), n = Math.max(2, Math.round(h / 0.18)), m = mat(it.color, it.finish);
    for (let i = 0; i < n; i++) g.add(box(w, (h / n) * (i + 1), d / n, m, 0, (h / n) * (i + 1) / 2, -d / 2 + (d / n) * (i + 0.5)));
    return g;
  },
  // --------------------------------------------------------------- lighting
  ledPanel(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(box(w, h, d, mat(it.color, 'metal'), 0, h / 2, 0));
    g.add(box(w - 0.03, 0.004, d - 0.03, glow(it, c), 0, -0.001, 0));
    addPointLight(g, it, 0, -0.25, 0, c, it.params.intensity * 9);
    return g;
  },
  downlight(it) {
    const [w, h] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(cyl(w / 2, w / 2, h, mat(it.color, 'metal'), 0, h / 2, 0, 24));
    g.add(cyl(w * 0.35, w * 0.35, 0.004, glow(it, c, 2.5), 0, -0.001, 0, 24));
    addSpot(g, it, 0, -0.02, 0, 0, -3, 0, c, it.params.intensity * 14, it.params.beam ?? 40);
    return g;
  },
  pendant(it, ctx) {
    const [w, h] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.15, w / 2, h * 0.3, 32, 1, true), mat(it.color, it.finish, { side: THREE.DoubleSide }));
    shade.position.y = h * 0.15; g.add(shade);
    g.add(sphere(w * 0.12, glow(it, c, 3), 0, h * 0.05, 0, 14, 10));
    const top = h * 0.3, len = Math.max(0.05, ceilAt(ctx, it) - (it.pos[1] + top));
    g.add(cyl(0.004, 0.004, len, mat('#111', 'plastic'), 0, top + len / 2, 0, 6));
    addPointLight(g, it, 0, 0, 0, c, it.params.intensity * 8);
    return g;
  },
  trackLight(it) {
    const [w, h] = it.size, g = new THREE.Group(), c = it.params.lightColor, m = mat(it.color, 'metal');
    g.add(box(w, 0.03, 0.04, m, 0, h - 0.015, 0));
    const n = it.params.heads || 3;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      const head = cyl(0.04, 0.035, 0.14, m, x, h - 0.11, 0.03, 16); head.rotation.x = 0.5; g.add(head);
      g.add(disc(0.03, 0.004, glow(it, c, 2.5), x, h - 0.16, 0.06, 14));
      if (i < 3) addSpot(g, it, x, h - 0.17, 0.06, x, -2, 1.2, c, it.params.intensity * 10, 30);
    }
    return g;
  },
  ledStrip(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(box(w, h, d, mat(it.color, 'metal'), 0, h / 2, 0));
    g.add(box(w - 0.01, h * 0.5, 0.004, glow(it, c, 3), 0, h / 2, d / 2 + 0.002));
    addPointLight(g, it, 0, h / 2, 0.15, c, it.params.intensity * 3, 4);
    return g;
  },
  floorLamp(it) {
    const [w, h] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(cyl(w * 0.4, w * 0.45, 0.03, mat(it.color2, 'metal'), 0, 0.015, 0, 24), cyl(0.012, 0.012, h - 0.3, mat(it.color2, 'metal'), 0, (h - 0.3) / 2, 0, 8));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w / 2, 0.3, 28, 1, true), mat(it.color, 'fabric', { side: THREE.DoubleSide })));
    g.children[g.children.length - 1].position.y = h - 0.15;
    g.add(sphere(0.04, glow(it, c, 3), 0, h - 0.18, 0, 10, 8));
    addPointLight(g, it, 0, h - 0.15, 0, c, it.params.intensity * 6);
    return g;
  },
  sconce(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(box(w, h, 0.02, mat(it.color, it.finish), 0, h / 2, -d / 2 + 0.01));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.3, h * 0.6, 24, 1, true), mat(it.color, it.finish, { side: THREE.DoubleSide }));
    cup.position.set(0, h * 0.6, 0); g.add(cup, sphere(0.03, glow(it, c, 3), 0, h * 0.6, 0, 10, 8));
    addPointLight(g, it, 0, h * 0.7, 0.1, c, it.params.intensity * 4);
    return g;
  },
  neon(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), c = it.params.lightColor, text = it.params.text || 'ON AIR';
    g.add(rbox(w, h, d, 0.01, mat(it.color, 'gloss'), 0, h / 2, 0));
    const tex = drawnTexture(`neon:${text}:${c}:${lightOn(it)}`, 512, 160, (cx, W, H) => {
      cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
      cx.font = 'bold 96px system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.shadowColor = c; cx.shadowBlur = lightOn(it) ? 24 : 0; cx.fillStyle = lightOn(it) ? c : '#333';
      cx.fillText(text, W / 2, H / 2 + 4); cx.fillText(text, W / 2, H / 2 + 4);
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.85), new THREE.MeshStandardMaterial({ map: tex, emissive: '#fff', emissiveMap: tex, emissiveIntensity: lightOn(it) ? 1.5 : 0, roughness: 0.3 }));
    face.position.set(0, h / 2, d / 2 + 0.001); g.add(face);
    addPointLight(g, it, 0, h / 2, 0.3, c, it.params.intensity * 2, 3);
    return g;
  },
  lightBar(it) {
    const [w, h] = it.size, g = new THREE.Group(), c = it.params.lightColor;
    g.add(box(0.06, 0.03, 0.06, mat('#111', 'plastic'), 0, 0.015, 0));
    g.add(cyl(w / 2, w / 2, h - 0.03, glow(it, c, 3), 0, 0.03 + (h - 0.03) / 2, 0, 12));
    addPointLight(g, it, 0, h / 2, 0, c, it.params.intensity * 4, 4);
    return g;
  },
  // ----------------------------------------------------------------- shapes
  shapeBox(it) { const [w, h, d] = it.size, g = new THREE.Group(); g.add(it.params.rounded ? rbox(w, h, d, it.params.rounded, mat(it.color, it.finish), 0, h / 2, 0) : box(w, h, d, mat(it.color, it.finish), 0, h / 2, 0)); return g; },
  shapeCylinder(it) { const [w, h, d] = it.size, g = new THREE.Group(); const c = cyl(0.5, 0.5, 1, mat(it.color, it.finish), 0, 0.5, 0, 40); c.scale.set(w, h, d); c.position.y = h / 2; g.add(c); return g; },
  shapeSphere(it) { const [w, h, d] = it.size, g = new THREE.Group(); const s = sphere(0.5, mat(it.color, it.finish), 0, 0, 0, 32, 20); s.scale.set(w, h, d); s.position.y = h / 2; g.add(s); return g; },
  shapeCone(it) { const [w, h, d] = it.size, g = new THREE.Group(); const c = cyl(0, 0.5, 1, mat(it.color, it.finish), 0, 0, 0, 40); c.scale.set(w, h, d); c.position.y = h / 2; g.add(c); return g; },
  shapePyramid(it) { const [w, h, d] = it.size, g = new THREE.Group(); const c = cyl(0, 0.7071, 1, mat(it.color, it.finish), 0, 0, 0, 4); c.rotation.y = Math.PI / 4; const p = new THREE.Group(); p.add(c); p.scale.set(w, h, d); p.position.y = h / 2; g.add(p); return g; },
  shapeWedge(it) { const [w, h, d] = it.size, g = new THREE.Group(); const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(-d / 2, h)]); const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(-Math.PI / 2); g.add(new THREE.Mesh(geo, mat(it.color, it.finish))); return g; },
  shapeHalfCyl(it) { const [w, h, d] = it.size, g = new THREE.Group(); const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, false, -Math.PI / 2, Math.PI); const m = new THREE.Mesh(geo, mat(it.color, it.finish)); m.scale.set(w, h, d * 2); m.position.set(0, h / 2, -d / 2); g.add(m); return g; },
  shapeTorus(it) { const [w, h, d] = it.size, g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 16, 48), mat(it.color, it.finish)); t.scale.set(w, h, d); t.position.y = h / 2; g.add(t); return g; },
  shapeArch(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), t = Math.min(0.2, w * 0.15);
    const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(w / 2 - t, 0); s.lineTo(w / 2 - t, h - w / 2); s.absarc(0, h - w / 2, w / 2 - t, 0, Math.PI, false); s.lineTo(-w / 2 + t, 0); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 24 }); geo.translate(0, 0, -d / 2);
    g.add(new THREE.Mesh(geo, mat(it.color, it.finish))); return g;
  },
  imported(it, ctx) {
    const g = new THREE.Group();
    const src = ctx.imported?.[it.params.model];
    if (src) {
      const clone = src.clone(true);
      const bb = new THREE.Box3().setFromObject(clone), sz = bb.getSize(new THREE.Vector3());
      const [w, h, d] = it.size;
      clone.scale.set(w / (sz.x || 1), h / (sz.y || 1), d / (sz.z || 1));
      const bb2 = new THREE.Box3().setFromObject(clone), c = bb2.getCenter(new THREE.Vector3());
      clone.position.set(-c.x, -bb2.min.y, -c.z);
      g.add(clone);
    } else {
      const [w, h, d] = it.size;
      g.add(box(w, h, d, mat('#888', 'paint', { opacity: 0.4 }), 0, h / 2, 0));
    }
    return g;
  },
};

// ---------------------------------------------------------------- custom shapes
/** Normalised 2D profiles (x, y in -0.5…0.5) for the shape builder. */
export const PROFILES = {
  rect: { label: 'Rectangle', pts: () => [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] },
  rounded: { label: 'Rounded rect', round: true, pts: () => [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] },
  circle: { label: 'Circle / ellipse', pts: () => Array.from({ length: 48 }, (_, k) => [Math.cos((k / 48) * Math.PI * 2) / 2, Math.sin((k / 48) * Math.PI * 2) / 2]) },
  triangle: { label: 'Triangle', pts: () => [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]] },
  rightTri: { label: 'Right triangle', pts: () => [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]] },
  diamond: { label: 'Diamond', pts: () => [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]] },
  polygon: { label: 'Polygon (N sides)', sides: true, pts: (n = 6) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2 + Math.PI / 2 + (n % 2 ? 0 : Math.PI / n); return [Math.cos(a) / 2, Math.sin(a) / 2]; }) },
  star: { label: 'Star', sides: true, pts: (n = 5) => Array.from({ length: n * 2 }, (_, k) => { const a = (k / (n * 2)) * Math.PI * 2 + Math.PI / 2, r = k % 2 ? 0.22 : 0.5; return [Math.cos(a) * r, Math.sin(a) * r]; }) },
  arch: { label: 'Arch', pts: () => { const p = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0]]; for (let k = 1; k < 24; k++) { const a = (k / 24) * Math.PI; p.push([Math.cos(a) / 2, Math.sin(a) / 2]); } p.push([-0.5, 0]); return p; } },
  semicircle: { label: 'Half circle', pts: () => { const p = [[-0.5, -0.5], [0.5, -0.5]]; for (let k = 1; k < 32; k++) { const a = (k / 32) * Math.PI; p.push([Math.cos(a) / 2, -0.5 + Math.sin(a)]); } return p; } },
  trapezoid: { label: 'Trapezoid', pts: () => [[-0.5, -0.5], [0.5, -0.5], [0.3, 0.5], [-0.3, 0.5]] },
  lshape: { label: 'L-shape', pts: () => [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.1], [-0.1, -0.1], [-0.1, 0.5], [-0.5, 0.5]] },
  tshape: { label: 'T-shape', pts: () => [[-0.15, -0.5], [0.15, -0.5], [0.15, 0.2], [0.5, 0.2], [0.5, 0.5], [-0.5, 0.5], [-0.5, 0.2], [-0.15, 0.2]] },
  cross: { label: 'Cross', pts: () => [[-0.15, -0.5], [0.15, -0.5], [0.15, -0.15], [0.5, -0.15], [0.5, 0.15], [0.15, 0.15], [0.15, 0.5], [-0.15, 0.5], [-0.15, 0.15], [-0.5, 0.15], [-0.5, -0.15], [-0.15, -0.15]] },
  wave: { label: 'Wave', pts: () => { const p = []; for (let k = 0; k <= 24; k++) p.push([-0.5 + k / 24, -0.5]); for (let k = 24; k >= 0; k--) p.push([-0.5 + k / 24, 0.2 + Math.sin((k / 24) * Math.PI * 2) * 0.3]); return p; } },
  custom: { label: 'Custom (draw)', pts: (n, it) => it?.params?.points?.length >= 3 ? it.params.points : [[-0.5, -0.5], [0.5, -0.5], [0.2, 0.5], [-0.4, 0.3]] },
};
/** Revolve (lathe) profiles: [radius 0…1, height 0…1]. */
export const LATHES = {
  cylinder: { label: 'Cylinder', pts: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  cone: { label: 'Cone', pts: [[0, 0], [1, 0], [0, 1]] },
  dome: { label: 'Dome', pts: [[0, 0], ...Array.from({ length: 17 }, (_, k) => [Math.cos((k / 16) * Math.PI / 2), Math.sin((k / 16) * Math.PI / 2)])] },
  sphere: { label: 'Sphere', pts: Array.from({ length: 25 }, (_, k) => { const a = -Math.PI / 2 + (k / 24) * Math.PI; return [Math.cos(a), (Math.sin(a) + 1) / 2]; }) },
  vase: { label: 'Vase', pts: [[0, 0], [0.55, 0], [0.8, 0.15], [0.95, 0.4], [0.7, 0.75], [0.5, 0.9], [0.6, 1], [0, 1]] },
  bowl: { label: 'Bowl', pts: [[0, 0], [0.5, 0], ...Array.from({ length: 12 }, (_, k) => [0.5 + 0.5 * Math.sin((k / 11) * Math.PI / 2), 1 - Math.cos((k / 11) * Math.PI / 2)]), [0, 1]] },
  column: { label: 'Column', pts: [[0, 0], [1, 0], [1, 0.06], [0.8, 0.1], [0.8, 0.9], [1, 0.94], [1, 1], [0, 1]] },
  hourglass: { label: 'Hourglass', pts: [[0, 0], [1, 0], [0.35, 0.5], [1, 1], [0, 1]] },
  tube: { label: 'Tube (hollow)', hollow: true, pts: [[0.8, 0], [1, 0], [1, 1], [0.8, 1]] },
};

function profilePoints(it) {
  const P = it.params, pr = PROFILES[P.profile] || PROFILES.rect;
  return pr.pts(Math.max(3, P.sides || 6), it);
}
function shapeFrom(pts, W, H, round = 0) {
  const sh = new THREE.Shape();
  if (round > 0) {
    const r = Math.min(round, W / 2 - 1e-3, H / 2 - 1e-3), x0 = -W / 2, y0 = -H / 2;
    sh.moveTo(x0 + r, y0); sh.lineTo(x0 + W - r, y0); sh.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + r); sh.lineTo(x0 + W, y0 + H - r); sh.quadraticCurveTo(x0 + W, y0 + H, x0 + W - r, y0 + H);
    sh.lineTo(x0 + r, y0 + H); sh.quadraticCurveTo(x0, y0 + H, x0, y0 + H - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
    return sh;
  }
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x * W, y * H) : sh.moveTo(x * W, y * H)));
  sh.closePath();
  return sh;
}
export function buildCustom(it) {
  const [w, h, d] = it.size, P = it.params, g = new THREE.Group(), m = mat(it.color, it.finish, { side: THREE.DoubleSide });
  if ((P.op || 'extrude') === 'revolve') {
    const L = LATHES[P.lathe || 'cylinder'] || LATHES.cylinder;
    const pts = L.pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r) * 0.5, y));
    const geo = new THREE.LatheGeometry(pts, 48, 0, ((P.sweep ?? 360) * Math.PI) / 180);
    const me = new THREE.Mesh(geo, m); me.scale.set(w, h, d); g.add(me);
    return g;
  }
  const orient = P.orient || 'wall';
  const W = w, H = orient === 'wall' ? h : d, depth = orient === 'wall' ? d : h;
  const pr = PROFILES[P.profile] || PROFILES.rect;
  const sh = shapeFrom(profilePoints(it), W, H, pr.round ? (P.radius ?? Math.min(W, H) * 0.15) : 0);
  const frame = P.hollow || 0;
  if (frame > 0 && frame < Math.min(W, H) / 2) {
    // inner outline = profile scaled toward its centre
    const sx = (W - 2 * frame) / W, sy = (H - 2 * frame) / H;
    const inner = shapeFrom(pr.round ? null : profilePoints(it).map(([x, y]) => [x * sx, y * sy]), W, H, 0);
    if (pr.round) { const r = Math.max(0, (P.radius ?? Math.min(W, H) * 0.15) - frame); const ih = shapeFrom(null, W - 2 * frame, H - 2 * frame, r || 1e-4); sh.holes.push(new THREE.Path(ih.getPoints(12).reverse())); }
    else sh.holes.push(new THREE.Path(inner.getPoints().reverse()));
  }
  const bevel = Math.min(P.bevel || 0, depth / 2.2, Math.min(W, H) / 4);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.001, depth - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 });
  geo.translate(0, 0, -(depth - 2 * bevel) / 2);
  if (orient === 'wall') geo.translate(0, H / 2, 0);
  else { geo.rotateX(-Math.PI / 2); geo.translate(0, depth / 2, 0); }
  // fit UVs to metres so textures keep their real scale
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.2, uv.getY(i) / 1.2);
  g.add(new THREE.Mesh(geo, m));
  return g;
}

function rackDraw(c, W, H) {
  c.fillStyle = '#1b1c1f'; c.fillRect(0, 0, W, H);
  const u = H / 14;
  for (let i = 0; i < 14; i++) {
    c.fillStyle = i % 3 === 0 ? '#2c2f34' : '#3a3d43'; c.fillRect(6, i * u + 2, W - 12, u - 4);
    c.fillStyle = ['#5f5', '#f85', '#5cf', '#ff5'][i % 4]; c.fillRect(14, i * u + u / 2 - 2, 4, 4);
    c.fillStyle = '#888'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(40 + k * 20, i * u + u / 2, 4, 0, 7); c.fill(); }
  }
}

// --------------------------------------------------------------- catalogue
const AREA = {
  front: (s) => s[0] * s[1],
  top: (s) => s[0] * s[2],
  corner: (s) => s[1] * s[0] * Math.SQRT2 + s[0] * s[0] * 0.5, // hypotenuse face + top
  cyl: (s) => Math.PI * s[0] * s[1],
  sofa: (s) => s[0] * s[2] + s[0] * s[1],
  none: () => 0,
};

const D = (o) => ({ mount: 'floor', finish: 'paint', color2: '#222222', acoustic: 'none', area: 'front', params: {}, ...o });

export const CATALOG = [
  // Absorption
  D({ type: 'absorber', name: 'Broadband Panel 100mm', cat: 'Absorption', mount: 'wall', size: [0.6, 1.2, 0.1], color: '#3b4a5a', finish: 'fabric', acoustic: 'fabric_100', build: B.absorber, params: { frame: { label: 'Wood frame', type: 'bool', default: false } }, desc: 'Mineral-wool/fibreglass panel wrapped in fabric. Works from ~250 Hz up; place at first-reflection points.' }),
  D({ type: 'absorber50', name: 'Absorber Panel 50mm', cat: 'Absorption', mount: 'wall', size: [0.6, 1.2, 0.05], color: '#6b6f73', finish: 'fabric', acoustic: 'fabric_50', build: B.absorber, params: { frame: { label: 'Wood frame', type: 'bool', default: false } }, desc: 'Thinner panel for mid/high control and flutter-echo treatment.' }),
  D({ type: 'framedPanel', name: 'Framed Fabric Panel', cat: 'Absorption', mount: 'wall', size: [1.2, 0.6, 0.1], color: '#c8b89a', color2: '#8a6a4a', finish: 'fabric', acoustic: 'fabric_100', build: B.absorber, params: { frame: { label: 'Wood frame', type: 'bool', default: true } }, desc: 'Absorber with a hardwood frame — furniture-grade look for client rooms.' }),
  D({ type: 'artPanel', name: 'Printed Art Panel', cat: 'Absorption', mount: 'wall', size: [1.0, 0.7, 0.05], color: '#ffffff', finish: 'fabric', acoustic: 'fabric_50', build: B.artPanel, params: { image: { label: 'Image', type: 'image', default: '' } }, desc: 'Absorber with printed fabric. Use the camera / photo import to put your own artwork on it.' }),
  D({ type: 'foam', name: 'Acoustic Foam (wedge)', cat: 'Absorption', mount: 'wall', size: [0.5, 0.5, 0.05], color: '#2a2a2e', finish: 'foam', acoustic: 'foam_50', build: B.foam, params: { pitch: { label: 'Wedge pitch (m)', type: 'number', min: 0.03, max: 0.3, step: 0.01, default: 0.083 } }, desc: 'Budget open-cell foam. Mid/high only — no meaningful bass control.' }),
  D({ type: 'feltTiles', name: 'PET Felt Wall Tiles', cat: 'Absorption', mount: 'wall', size: [1.2, 0.6, 0.012], color: '#7d8b74', finish: 'felt', acoustic: 'pet_felt', build: B.absorber, params: {}, desc: 'Recycled PET felt tiles — decorative, high-frequency absorption.' }),
  D({ type: 'curtain', name: 'Acoustic Curtain', cat: 'Absorption', mount: 'wall', size: [2.4, 2.4, 0.12], color: '#5a1a1f', finish: 'fabric', acoustic: 'curtain', build: B.curtain, desc: 'Heavy pleated velour. Variable acoustics over glass or hard walls.' }),
  D({ type: 'gobo', name: 'Gobo / Mobile Screen', cat: 'Absorption', size: [1.0, 1.8, 0.1], color: '#2f3236', color2: '#555555', finish: 'fabric', acoustic: 'fabric_100', area: (s) => 2 * s[0] * s[1], build: B.gobo, params: { window: { label: 'Glass window', type: 'bool', default: false } }, desc: 'Movable absorbent screen for isolating sources in a live room.' }),
  D({ type: 'rug', name: 'Rug', cat: 'Absorption', size: [2.0, 0.015, 1.4], color: '#8b7d6b', color2: '#3b3e42', finish: 'carpet', acoustic: 'carpet_pad', area: AREA.top, build: B.rug, desc: 'Thick rug — kills floor flutter and the floor reflection between desk and speakers.' }),
  // Bass control
  D({ type: 'cornerTrap', name: 'Corner Bass Trap', cat: 'Bass Control', mount: 'corner', origin: 'corner', size: [0.6, 2.4, 0.6], color: '#2f3236', finish: 'fabric', acoustic: 'bass_trap', area: AREA.corner, build: B.cornerTrap, params: { style: { label: 'Style', type: 'select', options: ['triangle', 'chamfer'], default: 'triangle' }, angle: { label: 'Corner angle (°)', type: 'number', min: 30, max: 170, step: 0.5, default: 90 } }, desc: 'Floor-to-ceiling superchunk (adapts to angled corners). Corners are where room modes have pressure maxima — the most effective place for bass absorption.' }),
  D({ type: 'cornerTrapCeil', name: 'Wall–Ceiling Corner Trap', cat: 'Bass Control', mount: 'wall', wallTop: true, size: [2.4, 0.4, 0.4], color: '#2f3236', finish: 'fabric', acoustic: 'bass_trap', area: (s) => s[0] * s[1] * Math.SQRT2, build: (it) => { const [w, h, d] = it.size, g = new THREE.Group(); const shape = new THREE.Shape([new THREE.Vector2(-d / 2, h), new THREE.Vector2(d / 2, h), new THREE.Vector2(-d / 2, 0)]); const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(-Math.PI / 2); g.add(new THREE.Mesh(geo, mat(it.color, it.finish))); return g; }, desc: 'Triangular trap along the wall–ceiling junction (tri-corners and horizontal edges also hold modal pressure).' }),
  D({ type: 'bassPanel', name: 'Thick Bass Panel 200mm', cat: 'Bass Control', mount: 'wall', size: [0.6, 1.2, 0.2], color: '#3a3a3c', finish: 'fabric', acoustic: 'fabric_150', build: B.absorber, params: { frame: { label: 'Wood frame', type: 'bool', default: false } }, desc: 'Deep porous panel with air gap — extends absorption well below 125 Hz.' }),
  D({ type: 'membrane', name: 'Membrane Bass Trap', cat: 'Bass Control', mount: 'wall', size: [1.2, 0.6, 0.2], color: '#d0c8b8', color2: '#8a6a4a', finish: 'gloss', acoustic: 'membrane', build: B.membrane, params: { tunedHz: { label: 'Tuned to (Hz, 0 = untuned)', type: 'number', min: 0, max: 400, step: 1, default: 0 } }, desc: 'Limp-mass / panel resonator tuned to low frequencies (≈ 40–120 Hz). Pressure-based — mount on walls and corners.' }),
  D({ type: 'tubeTrap', name: 'Tube Trap', cat: 'Bass Control', size: [0.4, 1.2, 0.4], color: '#3b4a5a', color2: '#1a1a1a', finish: 'fabric', acoustic: 'tube_trap', area: AREA.cyl, build: B.tubeTrap, desc: 'Cylindrical trap with a reflective half — rotate to tune brightness.' }),
  D({ type: 'helmholtz', name: 'Helmholtz Perforated Panel', cat: 'Bass Control', mount: 'wall', size: [1.2, 0.6, 0.1], color: '#c49a6c', color2: '#2a2a2a', finish: 'wood', acoustic: 'helmholtz', build: B.perforated, params: { pattern: { label: 'Pattern', type: 'select', options: ['holes', 'slots'], default: 'holes' }, tunedHz: { label: 'Tuned to (Hz, 0 = untuned)', type: 'number', min: 0, max: 400, step: 1, default: 0 } }, desc: 'Perforated board over a cavity — resonant absorber for low-mids.' }),
  // Diffusion
  D({ type: 'qrd', name: 'QRD Diffuser (1D)', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.2], color: '#c49a6c', color2: '#a77b52', finish: 'wood', acoustic: 'qrd', build: B.qrd, params: { prime: { label: 'Prime (N)', type: 'select', options: [7, 11, 13, 17], default: 7 } }, desc: 'Quadratic-residue diffuser. Spreads energy in one plane — great on the rear wall to keep the room live but even.' }),
  D({ type: 'skyline', name: 'Skyline Diffuser (2D)', cat: 'Diffusion', mount: 'wall', size: [0.6, 0.6, 0.15], color: '#d8c3a0', color2: '#b8996a', finish: 'wood', acoustic: 'skyline', build: B.skyline, params: { grid: { label: 'Grid', type: 'select', options: [8, 10, 12, 14], default: 12 } }, desc: 'Primitive-root block diffuser — scatters in two planes. Rear wall or ceiling.' }),
  D({ type: 'poly', name: 'Polycylindrical Diffuser', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.15], color: '#e0c08f', color2: '#8a6a4a', finish: 'wood', acoustic: 'poly', build: B.poly, desc: 'Curved panel — broad diffusion plus some low-frequency absorption.' }),
  D({ type: 'bad', name: 'Hybrid Absorber-Diffuser', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.1], color: '#d8c3a0', color2: '#3b3e42', finish: 'fabric', acoustic: 'bad_panel', build: B.bad, params: {}, desc: 'Binary-amplitude (BAD) face: absorbs lows/mids, scatters highs so the room doesn\'t go dead.' }),
  D({ type: 'bookshelf', name: 'Bookcase Diffuser', cat: 'Diffusion', size: [1.2, 2.0, 0.35], color: '#5d4030', finish: 'wood', acoustic: 'books', build: B.bookshelf, params: { books: { label: 'Fill with books', type: 'bool', default: true } }, desc: 'A filled bookcase is a surprisingly effective random diffuser.' }),
  // Reflection control
  D({ type: 'slats', name: 'Wood Slat Panel', cat: 'Reflection Control', mount: 'wall', size: [0.6, 2.4, 0.022], color: '#c49a6c', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', build: B.slats, params: { slatWidth: { label: 'Slat width (m)', type: 'number', min: 0.01, max: 0.1, step: 0.001, default: 0.027 }, gap: { label: 'Gap (m)', type: 'number', min: 0.003, max: 0.06, step: 0.001, default: 0.013 } }, desc: 'Slatted wood over black felt (Akupanel style) — modern look with mid absorption.' }),
  D({ type: 'slatResonator', name: 'Slot Resonator Wall', cat: 'Reflection Control', mount: 'wall', size: [1.2, 1.2, 0.12], color: '#e0c08f', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', build: B.slats, params: { slatWidth: { label: 'Slat width (m)', type: 'number', min: 0.01, max: 0.15, step: 0.001, default: 0.07 }, gap: { label: 'Gap (m)', type: 'number', min: 0.003, max: 0.06, step: 0.001, default: 0.012 }, tunedHz: { label: 'Tuned to (Hz, 0 = untuned)', type: 'number', min: 0, max: 400, step: 1, default: 0 } }, desc: 'Deep slats over cavity — Helmholtz-type slot absorber tuned by slot width and depth.' }),
  D({ type: 'reflector', name: 'Reflector Panel', cat: 'Reflection Control', mount: 'wall', size: [1.0, 1.0, 0.025], color: '#e0c08f', finish: 'gloss', acoustic: 'reflector', build: B.reflector, params: { tilt: { label: 'Tilt (°)', type: 'number', min: -45, max: 45, step: 1, default: 10 } }, desc: 'Hard angled panel. Keeps energy alive (live end) or steers early reflections away from the listener (RFZ).' }),
  D({ type: 'redirector', name: 'Angled Re-director', cat: 'Reflection Control', mount: 'wall', size: [1.2, 1.2, 0.2], color: '#e0c08f', color2: '#8a6a4a', finish: 'wood', acoustic: 'reflector', build: B.redirector, params: { blades: { label: 'Blades', type: 'number', min: 2, max: 20, step: 1, default: 6 }, angle: { label: 'Blade angle (°)', type: 'number', min: 0, max: 80, step: 1, default: 30 } }, desc: 'Angled louvres that redirect side-wall reflections away from the mix position.' }),
  // Ceiling
  D({ type: 'cloud', name: 'Ceiling Cloud', cat: 'Ceiling', mount: 'ceiling', drop: 0.25, size: [1.2, 0.1, 1.8], color: '#e9e6df', color2: '#8a6a4a', finish: 'fabric', acoustic: 'fabric_100', area: AREA.top, build: B.cloud, params: { frame: { label: 'Wood edge', type: 'bool', default: false } }, desc: 'Suspended absorber above the mix position — catches the ceiling first reflection. Hang with an air gap for better low-mid absorption.' }),
  D({ type: 'baffle', name: 'Hanging Baffle', cat: 'Ceiling', mount: 'ceiling', drop: 0.3, size: [1.2, 0.6, 0.05], color: '#9caf88', finish: 'felt', acoustic: 'fabric_50', area: (s) => 2 * s[0] * s[1], build: B.baffle, desc: 'Vertical hanging absorber — great in live rooms, offices and high ceilings.' }),
  D({ type: 'ceilDiffuser', name: 'Ceiling Skyline', cat: 'Ceiling', mount: 'ceiling', size: [0.6, 0.15, 0.6], color: '#d8c3a0', color2: '#b8996a', finish: 'wood', acoustic: 'skyline', area: AREA.top, build: (it, ctx) => { const g = B.skyline({ ...it, size: [it.size[0], it.size[2], it.size[1]] }, ctx); const w = new THREE.Group(); g.rotation.x = Math.PI / 2; g.position.set(0, it.size[1], -it.size[2] / 2); w.add(g); return w; }, params: { grid: { label: 'Grid', type: 'select', options: [8, 10, 12, 14], default: 12 } }, desc: '2D diffuser for the ceiling, behind the listener.' }),
  D({ type: 'ceilTile', name: 'Acoustic Ceiling Tile Grid', cat: 'Ceiling', mount: 'ceiling', size: [2.4, 0.03, 2.4], color: '#f4f4f2', finish: 'concrete', acoustic: 'ceiling_tile', area: AREA.top, build: (it) => { const [w, h, d] = it.size, g = new THREE.Group(); const n = Math.max(1, Math.round(w / 0.6)), m = Math.max(1, Math.round(d / 0.6)), list = []; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) list.push([-w / 2 + (w / n) * (i + 0.5), h / 2, -d / 2 + (d / m) * (j + 0.5), w / n - 0.015, h, d / m - 0.015]); g.add(instBoxes(list, mat(it.color, it.finish))); g.add(box(w, h * 0.5, d, mat('#ddd', 'metal'), 0, h * 0.75, 0)); return g; }, desc: 'Suspended mineral-fibre tile grid.' }),
  D({ type: 'canopy', name: 'Slatted Wood Canopy', cat: 'Ceiling', mount: 'ceiling', drop: 0.3, size: [2.4, 0.08, 1.2], color: '#c49a6c', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', area: AREA.top, build: (it, ctx) => { const [w, h, d] = it.size, g = new THREE.Group(); const n = Math.max(2, Math.floor(d / 0.08)), list = []; for (let i = 0; i < n; i++) list.push([0, h / 2, -d / 2 + (d / n) * (i + 0.5), w, h, 0.035]); g.add(instBoxes(list, mat(it.color, it.finish))); g.add(box(w, 0.012, d, mat(it.color2, 'felt'), 0, h + 0.006, 0)); hangWires(g, it, ctx, [[-w / 2 + 0.1, 0], [w / 2 - 0.1, 0]], h); return g; }, desc: 'Modern linear wood ceiling feature over felt.' }),
  // Studio furniture
  D({ type: 'desk', name: 'Studio Desk', cat: 'Studio Furniture', size: [1.8, 0.74, 0.85], color: '#5d4030', color2: '#1d1d1d', finish: 'wood', acoustic: 'wood_hard', area: AREA.none, build: B.desk, params: { bridge: { label: 'Monitor bridge', type: 'bool', default: true }, racks: { label: 'Rack bays', type: 'bool', default: true } }, desc: 'Producer desk with monitor bridge and rack bays.' }),
  D({ type: 'console', name: 'Mixing Console', cat: 'Studio Furniture', size: [2.2, 1.0, 1.1], color: '#3a2a20', color2: '#2a2c30', finish: 'leather', acoustic: 'none', build: B.console, desc: 'Large-format console with sloped work surface and meter bridge.' }),
  D({ type: 'chair', name: 'Studio Chair', cat: 'Studio Furniture', size: [0.6, 1.1, 0.6], color: '#1f1f22', color2: '#2a2a2a', finish: 'fabric', acoustic: 'none', build: B.chair, desc: 'Ergonomic task chair.' }),
  D({ type: 'stool', name: 'Stool', cat: 'Studio Furniture', size: [0.38, 0.65, 0.38], color: '#2a211c', color2: '#555555', finish: 'leather', build: B.stool }),
  D({ type: 'sofa', name: 'Sofa (Producer Couch)', cat: 'Studio Furniture', size: [2.1, 0.85, 0.9], color: '#4a3b30', color2: '#2a211c', finish: 'leather', acoustic: 'upholstered', area: AREA.sofa, build: B.sofa, desc: 'Back-of-room couch — also adds low-mid absorption.' }),
  D({ type: 'table', name: 'Coffee / Side Table', cat: 'Studio Furniture', size: [1.0, 0.42, 0.55], color: '#5d4030', color2: '#1d1d1d', finish: 'wood', build: B.table }),
  D({ type: 'rack', name: '19" Equipment Rack', cat: 'Studio Furniture', size: [0.55, 1.1, 0.6], color: '#1d1d1f', finish: 'paint', build: B.rack, desc: 'Floor-standing rack for outboard gear.' }),
  D({ type: 'stand', name: 'Speaker Stand', cat: 'Studio Furniture', size: [0.3, 1.0, 0.3], color: '#1d1d1f', finish: 'metal', build: B.stand, params: { isoPad: { label: 'Isolation pad', type: 'bool', default: true } } }),
  D({ type: 'listener', name: 'Listening Position', cat: 'Studio Furniture', size: [0.5, 1.3, 0.5], color: '#22c3c3', listener: true, build: B.listener, desc: 'Mix/ear position (ear ≈ 1.2 m). Drives reflection-point and listening-triangle analysis.' }),
  // Gear & instruments
  D({ type: 'monitor', name: 'Nearfield Monitor', cat: 'Gear & Instruments', size: [0.2, 0.33, 0.28], color: '#1d1d1f', color2: '#3a3a3a', finish: 'gloss', speaker: true, build: B.speaker, params: { ways: { label: 'Ways', type: 'select', options: [2, 3], default: 2 }, port: { label: 'Front port', type: 'bool', default: true } }, desc: 'Active nearfield monitor. Speakers drive reflection analysis.' }),
  D({ type: 'midfield', name: 'Midfield Monitor', cat: 'Gear & Instruments', size: [0.3, 0.55, 0.4], color: '#e8e6e0', color2: '#2a2a2a', finish: 'gloss', speaker: true, build: B.speaker, params: { ways: { label: 'Ways', type: 'select', options: [2, 3], default: 3 }, port: { label: 'Front port', type: 'bool', default: true } } }),
  D({ type: 'mains', name: 'Main Monitor (Soffit)', cat: 'Gear & Instruments', size: [0.6, 0.9, 0.55], color: '#1a1a1a', color2: '#3a3a3a', finish: 'gloss', speaker: true, build: B.speaker, params: { ways: { label: 'Ways', type: 'select', options: [2, 3], default: 3 }, port: { label: 'Front port', type: 'bool', default: false } } }),
  D({ type: 'sub', name: 'Subwoofer', cat: 'Gear & Instruments', size: [0.4, 0.4, 0.4], color: '#1d1d1f', color2: '#2a2a2a', finish: 'paint', build: B.sub, desc: 'Try the "subwoofer crawl" — place at the listening position and move it to where bass sounds best.' }),
  D({ type: 'screen', name: 'Computer Display', cat: 'Gear & Instruments', size: [0.62, 0.48, 0.2], color: '#1d1d1f', build: B.screen }),
  D({ type: 'tv', name: 'Wall TV / Display', cat: 'Gear & Instruments', mount: 'wall', wallY: 1.0, size: [1.45, 0.83, 0.05], color: '#111111', build: B.tv, params: { on: { label: 'Screen on', type: 'bool', default: true } } }),
  D({ type: 'pc', name: 'Computer Tower', cat: 'Gear & Instruments', size: [0.22, 0.48, 0.48], color: '#1d1d1f', build: B.pc }),
  D({ type: 'keyboard', name: 'Keyboard / Synth (88)', cat: 'Gear & Instruments', size: [1.35, 0.85, 0.35], color: '#1d1d1f', color2: '#555555', build: B.keyboard, params: { stand: { label: 'X-stand', type: 'bool', default: true } } }),
  D({ type: 'piano', name: 'Upright Piano', cat: 'Gear & Instruments', size: [1.5, 1.25, 0.62], color: '#111111', finish: 'gloss', acoustic: 'wood_hard', build: B.piano }),
  D({ type: 'drums', name: 'Drum Kit', cat: 'Gear & Instruments', size: [1.6, 1.45, 1.5], color: '#7a1f2a', finish: 'gloss', build: B.drums }),
  D({ type: 'amp', name: 'Guitar Amp', cat: 'Gear & Instruments', size: [0.6, 0.5, 0.26], color: '#1d1d1f', color2: '#4a4a40', build: B.amp }),
  D({ type: 'guitar', name: 'Guitar on Stand', cat: 'Gear & Instruments', size: [0.4, 1.05, 0.3], color: '#c0392b', color2: '#222222', build: B.guitar }),
  D({ type: 'mic', name: 'Microphone on Stand', cat: 'Gear & Instruments', size: [0.6, 1.6, 0.8], color: '#c8c8c8', color2: '#222222', finish: 'metal', build: B.mic, params: { popFilter: { label: 'Pop filter', type: 'bool', default: true } } }),
  // Lighting
  D({ type: 'ledPanel', name: 'LED Ceiling Panel', cat: 'Lighting', mount: 'ceiling', size: [0.6, 0.03, 0.6], color: '#f4f4f2', light: true, area: AREA.none, build: B.ledPanel, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#f3f6ff' } } }),
  D({ type: 'downlight', name: 'Recessed Downlight', cat: 'Lighting', mount: 'ceiling', size: [0.12, 0.03, 0.12], color: '#f4f4f2', light: true, build: B.downlight, params: { ...LIGHT_PARAMS, beam: { label: 'Beam angle (°)', type: 'number', min: 10, max: 80, step: 1, default: 40 } } }),
  D({ type: 'pendant', name: 'Pendant Light', cat: 'Lighting', mount: 'ceiling', drop: 0.7, size: [0.4, 0.6, 0.4], color: '#1d1d1f', finish: 'metal', light: true, build: B.pendant, params: LIGHT_PARAMS }),
  D({ type: 'trackLight', name: 'Track Spotlights', cat: 'Lighting', mount: 'ceiling', size: [1.5, 0.2, 0.1], color: '#1d1d1f', light: true, build: B.trackLight, params: { ...LIGHT_PARAMS, heads: { label: 'Heads', type: 'number', min: 1, max: 8, step: 1, default: 3 } } }),
  D({ type: 'ledStrip', name: 'LED Strip (RGB)', cat: 'Lighting', mount: 'wall', size: [2.0, 0.02, 0.015], color: '#bbbbbb', light: true, build: B.ledStrip, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#7a4fff' } }, desc: 'Ambient accent / bias lighting — put behind desks, clouds or diffusers.' }),
  D({ type: 'lightBar', name: 'RGB Light Tube', cat: 'Lighting', size: [0.05, 1.2, 0.05], color: '#ffffff', light: true, build: B.lightBar, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#ff2e88' } } }),
  D({ type: 'floorLamp', name: 'Floor Lamp', cat: 'Lighting', size: [0.45, 1.6, 0.45], color: '#efe6cf', color2: '#1d1d1f', light: true, build: B.floorLamp, params: LIGHT_PARAMS }),
  D({ type: 'sconce', name: 'Wall Sconce', cat: 'Lighting', mount: 'wall', wallY: 1.7, size: [0.18, 0.25, 0.15], color: '#c8a14a', finish: 'metal', light: true, build: B.sconce, params: LIGHT_PARAMS }),
  D({ type: 'neon', name: '"ON AIR" Sign', cat: 'Lighting', mount: 'wall', wallY: 1.95, size: [0.6, 0.2, 0.05], color: '#111111', light: true, build: B.neon, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#ff2a2a' }, text: { label: 'Text', type: 'text', default: 'ON AIR' } } }),
  // Architecture
  D({ type: 'door', name: 'Door', cat: 'Doors & Windows', mount: 'wall', opening: true, size: [0.9, 2.1, 0.1], color: '#5d4030', color2: '#e9e6df', finish: 'walnut', acoustic: 'wood_hard', build: B.door, params: { style: { label: 'Style', type: 'select', options: ['flush', 'panel', 'acoustic', 'vision', 'half', 'glass', 'double', 'french', 'sliding', 'barn'], default: 'acoustic' }, hinge: { label: 'Hinge side', type: 'select', options: ['left', 'right'], default: 'left' }, open: { label: 'Open angle (°) / slide', type: 'range', min: 0, max: 90, step: 1, default: 0 }, handle: { label: 'Handle', type: 'select', options: ['lever', 'bar', 'knob', 'pull', 'none'], default: 'lever' }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'glass' }, glazing: { label: 'Glazed (double)', type: 'bool', default: false }, frameFinish: { label: 'Frame material', type: 'finish', default: 'paint' }, hardware: { label: 'Hardware colour', type: 'color', default: '#b9bcbf' }, seals: { label: 'Drop seal', type: 'bool', default: true }, cutWall: { label: 'Cut opening in wall', type: 'bool', default: true } }, desc: 'Studio, panel, glass, French, double, sliding or barn door. Pick style, glass, handle, hinge side and swing.' }),
  D({ type: 'doubleDoor', name: 'Double Door', cat: 'Doors & Windows', mount: 'wall', opening: true, size: [1.6, 2.1, 0.1], color: '#ece8df', color2: '#ece8df', finish: 'satin', acoustic: 'wood_hard', build: B.door, params: { style: { label: 'Style', type: 'select', options: ['double', 'french', 'sliding', 'barn'], default: 'french' }, open: { label: 'Open angle (°) / slide', type: 'range', min: 0, max: 90, step: 1, default: 0 }, handle: { label: 'Handle', type: 'select', options: ['lever', 'bar', 'knob', 'pull', 'none'], default: 'bar' }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'glass' }, glazing: { label: 'Glazed', type: 'bool', default: true }, frameFinish: { label: 'Frame material', type: 'finish', default: 'paint' }, hardware: { label: 'Hardware colour', type: 'color', default: '#2a2b2e' }, seals: { label: 'Drop seal', type: 'bool', default: true }, cutWall: { label: 'Cut opening in wall', type: 'bool', default: true } } }),
  D({ type: 'window', name: 'Window', cat: 'Doors & Windows', mount: 'wall', wallY: 1.4, opening: true, size: [1.4, 1.0, 0.2], color: '#2a211c', color2: '#ece8df', finish: 'walnut', acoustic: 'glass', build: B.window, params: { style: { label: 'Style', type: 'select', options: ['studio', 'fixed', 'grid', 'casement', 'sliding', 'arch', 'round'], default: 'studio' }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'acousticGlass' }, panes: { label: 'Panes (studio)', type: 'select', options: [1, 2, 3], default: 2 }, angled: { label: 'Angled pane', type: 'bool', default: true }, grid: { label: 'Glazing bars', type: 'bool', default: false }, frame: { label: 'Frame width (m)', type: 'number', min: 0.02, max: 0.2, step: 0.005, default: 0.06 }, sill: { label: 'Sill', type: 'bool', default: true }, cutWall: { label: 'Cut opening in wall', type: 'bool', default: true } }, desc: 'Studio (double/triple, angled), fixed, grid, casement, sliding, arched or round window — choose the glass type too.' }),
  D({ type: 'skylightWin', name: 'Tall / Floor-to-ceiling Window', cat: 'Doors & Windows', mount: 'wall', opening: true, size: [2.4, 2.3, 0.15], color: '#2a2b2e', color2: '#2a2b2e', finish: 'blackSteel', acoustic: 'glass', build: B.window, params: { style: { label: 'Style', type: 'select', options: ['fixed', 'grid', 'sliding', 'studio'], default: 'grid' }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'glass' }, grid: { label: 'Glazing bars', type: 'bool', default: true }, frame: { label: 'Frame width (m)', type: 'number', min: 0.02, max: 0.2, step: 0.005, default: 0.05 }, sill: { label: 'Sill', type: 'bool', default: false }, cutWall: { label: 'Cut opening in wall', type: 'bool', default: true } } }),
  D({ type: 'opening', name: 'Wall Opening / Pass-through', cat: 'Doors & Windows', mount: 'wall', opening: true, size: [1.2, 2.1, 0.2], color: '#c9c5bd', area: AREA.none, build: (it) => { const [w, h, d] = it.size, g = new THREE.Group(); const m = mat(it.color, 'paint', { opacity: 0.0001 }); g.add(box(w, h, d, m, 0, h / 2, 0)); return g; }, params: { cutWall: { label: 'Cut opening in wall', type: 'bool', default: true } }, desc: 'An open doorway / pass-through / niche cut into a wall.' }),
  D({ type: 'partition', name: 'Partition / Wall', cat: 'Walls & Glass', size: [2.0, 2.4, 0.12], color: '#ece8df', color2: '#2a2b2e', finish: 'paint', acoustic: 'drywall', area: (s) => 2 * s[0] * s[1], build: B.partition, params: { style: { label: 'Style', type: 'select', options: ['solid', 'half', 'glassTop', 'slatted', 'glass', 'crittall'], default: 'solid' }, halfHeight: { label: 'Lower part height (m)', type: 'number', min: 0.3, max: 2.4, step: 0.05, default: 1.1 }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'glass' } }, desc: 'Solid, half-height, glass-topped, slatted, frameless glass or steel-framed (Crittall-style) wall.' }),
  D({ type: 'glassWall', name: 'Glass Wall / Screen', cat: 'Walls & Glass', size: [2.4, 2.4, 0.06], color: '#ece8df', color2: '#2a2b2e', finish: 'paint', acoustic: 'glass', area: (s) => 2 * s[0] * s[1], build: B.partition, params: { style: { label: 'Style', type: 'select', options: ['glass', 'crittall', 'glassTop'], default: 'crittall' }, halfHeight: { label: 'Lower part height (m)', type: 'number', min: 0.3, max: 2.4, step: 0.05, default: 0.9 }, glass: { label: 'Glass type', type: 'select', options: ['glass', 'frosted', 'tinted', 'bronzeGlass', 'reflective', 'fluted', 'acousticGlass'], default: 'glass' } }, desc: 'Glass partition between control room and live room — choose clear, frosted, tinted, fluted or laminated acoustic glass.' }),
  D({ type: 'cladding', name: 'Wall Cladding / Feature Wall', cat: 'Walls & Glass', mount: 'wall', size: [2.4, 2.4, 0.02], color: '#c49a6c', color2: '#1d1d1d', finish: 'oak', acoustic: 'plywood', build: B.cladding, params: { style: { label: 'Style', type: 'select', options: ['flat', 'vgroove', 'battens', 'tiles', 'hex', 'wainscot'], default: 'vgroove' }, pitch: { label: 'Board / batten pitch (m)', type: 'number', min: 0.03, max: 0.4, step: 0.005, default: 0.1 }, tile: { label: 'Tile size (m)', type: 'number', min: 0.05, max: 1.2, step: 0.01, default: 0.3 }, panelHeight: { label: 'Wainscot height (m)', type: 'number', min: 0.3, max: 2.4, step: 0.05, default: 1.0 } }, desc: 'Cover any wall area with wood boards, battens, tiles, hex tiles, stone, brick, wallpaper or wainscot — pick any material.' }),
  D({ type: 'mirror', name: 'Mirror', cat: 'Walls & Glass', mount: 'wall', wallY: 1.4, size: [0.8, 1.2, 0.03], color: '#e8eef2', color2: '#2a2b2e', finish: 'mirror', acoustic: 'glass', build: B.mirror, params: { round: { label: 'Round', type: 'bool', default: false }, frameFinish: { label: 'Frame material', type: 'finish', default: 'blackSteel' } } }),
  D({ type: 'soffit', name: 'Speaker Soffit Wall', cat: 'Architecture', mount: 'wall', size: [3.0, 2.4, 0.6], color: '#2f3236', finish: 'fabric', acoustic: 'none', build: B.soffit, params: { speakerHeight: { label: 'Speaker height (m)', type: 'number', min: 0.5, max: 2.2, step: 0.05, default: 1.25 } }, desc: 'Flush-mounted main monitors — removes front-wall SBIR.' }),
  D({ type: 'column', name: 'Column / Pillar', cat: 'Architecture', size: [0.3, 2.4, 0.3], color: '#ece8df', acoustic: 'concrete', area: (s) => 4 * s[0] * s[1], build: B.column, params: { round: { label: 'Round', type: 'bool', default: false } } }),
  D({ type: 'riser', name: 'Riser / Floating Floor', cat: 'Architecture', size: [2.0, 0.2, 2.0], color: '#c49a6c', color2: '#2a2a2a', finish: 'wood', build: B.riser }),
  D({ type: 'booth', name: 'Vocal / Iso Booth', cat: 'Architecture', size: [1.5, 2.2, 1.5], color: '#3a3a3c', color2: '#d8d4cc', acoustic: 'fabric_50', area: (s) => 2 * (s[0] + s[2]) * s[1], build: B.booth, desc: 'Modular isolation booth with window and door.' }),
  D({ type: 'stairs', name: 'Steps', cat: 'Architecture', size: [1.0, 0.54, 0.9], color: '#c49a6c', finish: 'wood', build: B.stairs }),
  // Decor
  D({ type: 'plant', name: 'Plant', cat: 'Decor', size: [0.5, 1.2, 0.5], color: '#3f8f4f', color2: '#e9e6df', finish: 'concrete', build: B.plant }),
  // Shapes
  D({ type: 'sheet', name: 'Board / Sheet Material', cat: 'Construction & Isolation', mount: 'wall', size: [1.2, 2.4, 0.0125], color: '#e9e7e2', acoustic: 'none', area: AREA.none, build: B.sheet, params: { mat: { label: 'Material', type: 'smat', kinds: ['board', 'membrane', 'insulation', 'glazing', 'masonry', 'underlay'], default: 'gyp12' }, useColor: { label: 'Use my colour instead', type: 'bool', default: false } }, desc: 'Drywall, plywood, OSB, MDF, MLV, insulation, glass… — any board from the studio materials library.' }),
  D({ type: 'studFrame', name: 'Stud Frame Section', cat: 'Construction & Isolation', size: [2.4, 2.4, 0.095], color: '#d2a96f', acoustic: 'none', area: AREA.none, build: B.studFrame, params: { stud: { label: 'Studs', type: 'smat', kinds: ['studs', 'joists'], default: 'stud2x4' }, spacing: { label: 'Spacing (m)', type: 'number', min: 0.2, max: 1.2, step: 0.05, default: 0.6 }, insulation: { label: 'Cavity insulation', type: 'bool', default: true }, sheathing: { label: 'Boards', type: 'select', options: ['none', 'one', 'both'], default: 'one' }, board: { label: 'Board', type: 'smat', kinds: ['board'], default: 'gyp15' } }, desc: 'Timber or steel stud panel with plates, optional insulation and boards — build partitions and room-in-room walls.' }),
  D({ type: 'isoClipItem', name: 'Isolation Clip + Hat Channel', cat: 'Construction & Isolation', mount: 'wall', size: [0.06, 0.08, 0.06], color: '#1d1d1f', acoustic: 'none', area: AREA.none, build: B.isoClipItem, params: { channel: { label: 'Show channel', type: 'bool', default: true }, channelLength: { label: 'Channel length (m)', type: 'number', min: 0.1, max: 3.6, step: 0.05, default: 0.6 } } }),
  D({ type: 'channelRun', name: 'Channel / Batten Run', cat: 'Construction & Isolation', mount: 'wall', size: [2.4, 0.025, 0.06], color: '#9aa0a6', acoustic: 'none', area: AREA.none, build: B.channelRun, params: { mat: { label: 'Type', type: 'smat', kinds: ['channel', 'battens'], default: 'hatChannel' } } }),
  D({ type: 'hangerItem', name: 'Ceiling Isolation Hanger', cat: 'Construction & Isolation', mount: 'ceiling', drop: 0.3, size: [0.07, 0.12, 0.05], color: '#c0c4c8', acoustic: 'none', area: AREA.none, build: B.hangerItem, params: { spring: { label: 'Spring (instead of neoprene)', type: 'bool', default: true } } }),
  D({ type: 'isoPadItem', name: 'Isolation Pad / Spring Mount', cat: 'Construction & Isolation', size: [0.09, 0.025, 0.09], color: '#2b2c2e', acoustic: 'none', area: AREA.none, build: B.isoPadItem, params: { spring: { label: 'Steel spring', type: 'bool', default: false } } }),
  D({ type: 'floatingFloor', name: 'Floating Floor Platform', cat: 'Construction & Isolation', size: [2.4, 0.16, 2.4], color: '#b88a5c', finish: 'plank', acoustic: 'wood_floor', area: AREA.top, build: B.floatingFloor, params: { insulation: { label: 'Mineral wool between sleepers', type: 'bool', default: true }, exploded: { label: 'Exploded (show pads & sleepers)', type: 'bool', default: false } }, desc: 'Drum riser / booth floor: deck on sleepers on neoprene pads.' }),
  D({ type: 'custom', name: 'Custom Shape', cat: 'Shapes', size: [0.8, 0.8, 0.8], color: '#b0b4b8', finish: 'paint', acoustic: 'wood_hard', build: B.custom, custom: true, params: { op: { label: 'Operation', type: 'hidden', default: 'extrude' }, orient: { label: 'Orientation', type: 'hidden', default: 'floor' }, profile: { type: 'hidden', default: 'polygon' }, sides: { type: 'hidden', default: 6 } }, desc: 'Build any shape: pick or draw a profile, then extrude or revolve it to exact dimensions.' }),
  D({ type: 'customWall', name: 'Custom Wall Panel', cat: 'Shapes', mount: 'wall', size: [0.6, 0.6, 0.05], color: '#3b4a5a', finish: 'fabric', acoustic: 'fabric_50', build: B.custom, custom: true, hidden: true, params: { op: { type: 'hidden', default: 'extrude' }, orient: { type: 'hidden', default: 'wall' }, profile: { type: 'hidden', default: 'polygon' }, sides: { type: 'hidden', default: 6 } } }),
  D({ type: 'customCeiling', name: 'Custom Ceiling Shape', cat: 'Shapes', mount: 'ceiling', drop: 0.25, size: [1.2, 0.08, 1.2], color: '#e9e6df', finish: 'fabric', acoustic: 'fabric_100', area: AREA.top, build: B.custom, custom: true, hidden: true, params: { op: { type: 'hidden', default: 'extrude' }, orient: { type: 'hidden', default: 'floor' }, profile: { type: 'hidden', default: 'circle' } } }),
  D({ type: 'shapeBox', name: 'Box', cat: 'Shapes', size: [1, 1, 1], color: '#b0b4b8', acoustic: 'wood_hard', build: B.shapeBox, params: { rounded: { label: 'Corner radius (m)', type: 'number', min: 0, max: 0.3, step: 0.005, default: 0 } } }),
  D({ type: 'shapeBoard', name: 'Board / Panel', cat: 'Shapes', mount: 'wall', size: [1.2, 0.6, 0.02], color: '#c49a6c', finish: 'wood', acoustic: 'plywood', build: B.shapeBox, params: {} }),
  D({ type: 'shapeCylinder', name: 'Cylinder', cat: 'Shapes', size: [0.6, 1, 0.6], color: '#b0b4b8', acoustic: 'wood_hard', area: AREA.cyl, build: B.shapeCylinder }),
  D({ type: 'shapeSphere', name: 'Sphere', cat: 'Shapes', size: [0.6, 0.6, 0.6], color: '#b0b4b8', build: B.shapeSphere }),
  D({ type: 'shapeCone', name: 'Cone', cat: 'Shapes', size: [0.6, 0.8, 0.6], color: '#b0b4b8', build: B.shapeCone }),
  D({ type: 'shapePyramid', name: 'Pyramid', cat: 'Shapes', size: [0.6, 0.6, 0.6], color: '#b0b4b8', build: B.shapePyramid }),
  D({ type: 'shapeWedge', name: 'Wedge / Ramp', cat: 'Shapes', size: [1, 0.5, 0.8], color: '#b0b4b8', acoustic: 'wood_hard', build: B.shapeWedge }),
  D({ type: 'shapeHalfCyl', name: 'Half Cylinder', cat: 'Shapes', mount: 'wall', size: [0.6, 1.2, 0.3], color: '#b0b4b8', acoustic: 'poly', build: B.shapeHalfCyl }),
  D({ type: 'shapeArch', name: 'Arch', cat: 'Shapes', size: [1.2, 2.2, 0.2], color: '#ece8df', build: B.shapeArch }),
  D({ type: 'shapeTorus', name: 'Ring / Torus', cat: 'Shapes', size: [0.8, 0.8, 0.2], color: '#c8a14a', finish: 'metal', build: B.shapeTorus }),
  D({ type: 'imported', name: 'Imported Model', cat: 'Imported', size: [1, 1, 1], color: '#888888', hidden: true, build: B.imported }),
];

export const CATEGORIES = [...new Set(CATALOG.filter((c) => !c.hidden).map((c) => c.cat))];
export const BY_TYPE = Object.fromEntries(CATALOG.map((c) => [c.type, c]));

export function areaOf(def, size) {
  if (typeof def.area === 'function') return def.area(size);
  return (AREA[def.area] || AREA.front)(size);
}

export function defaultParams(def) {
  const p = {};
  for (const [k, v] of Object.entries(def.params || {})) p[k] = v.default;
  return p;
}

export function buildItem(it, ctx) {
  const def = BY_TYPE[it.type] || BY_TYPE.shapeBox;
  const full = { ...it, params: { ...defaultParams(def), ...(it.params || {}) } };
  const g = def.build(full, ctx);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
