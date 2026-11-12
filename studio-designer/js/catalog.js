// Item catalogue: every placeable object is described here — its default size,
// colours, finish, acoustic behaviour, editable parameters and a builder that
// creates its 3D geometry. Local axes: +Z is the item's front face, Y is up,
// origin is the centre of the footprint at floor level (corner items use the
// inside corner as origin).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mat, drawnTexture, imageTexture } from './materials.js';

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
function hangWires(g, it, ctx, pts, top) {
  const len = Math.max(0.02, ctx.room.h - (it.pos[1] + top));
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
    let pts = [[0, 0], [L, 0], [0, L]];
    if (style === 'chamfer') pts = [[0, 0], [L, 0], [L, L * 0.3], [L * 0.3, L], [0, L]];
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
    const [w, h, d] = it.size, g = new THREE.Group(), fr = mat(it.color2, 'paint'), t = 0.06;
    g.add(box(t, h, d, fr, -w / 2 + t / 2, h / 2, 0), box(t, h, d, fr, w / 2 - t / 2, h / 2, 0), box(w, t, d, fr, 0, h - t / 2, 0));
    g.add(box(w - 2 * t, h - t, d * 0.8, mat(it.color, it.finish), 0, (h - t) / 2, 0));
    g.add(box(0.12, 0.025, 0.05, mat('#bbb', 'metal'), w / 2 - t - 0.1, h * 0.48, d / 2 + 0.02));
    if (it.params.window) g.add(box(0.25, 0.5, d * 0.82, mat('#cfe8ff', 'glass'), 0, h * 0.68, 0));
    if (it.params.seals !== false) g.add(box(w - 2 * t, 0.015, d * 0.82, mat('#222', 'plastic'), 0, 0.0075, 0));
    return g;
  },
  window(it) {
    const [w, h, d] = it.size, g = new THREE.Group(), fr = mat(it.color, it.finish), t = 0.06;
    g.add(box(w, t, d, fr, 0, t / 2, 0), box(w, t, d, fr, 0, h - t / 2, 0), box(t, h, d, fr, -w / 2 + t / 2, h / 2, 0), box(t, h, d, fr, w / 2 - t / 2, h / 2, 0));
    const panes = it.params.panes || 2, glass = mat('#cfe8ff', 'glass');
    for (let i = 0; i < panes; i++) {
      const pane = box(w - 2 * t, h - 2 * t, 0.01, glass, 0, h / 2, -d / 2 + (d / (panes + 1)) * (i + 1));
      if (it.params.angled && i === 0) pane.rotation.x = 6 * DEG;
      g.add(pane);
    }
    return g;
  },
  partition(it) {
    const [w, h, d] = it.size;
    const g = new THREE.Group();
    g.add(box(w, h, d, mat(it.color, it.finish), 0, h / 2, 0));
    return g;
  },
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
    const top = h * 0.3, len = Math.max(0.05, ctx.room.h - (it.pos[1] + top));
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
  D({ type: 'cornerTrap', name: 'Corner Bass Trap', cat: 'Bass Control', mount: 'corner', origin: 'corner', size: [0.6, 2.4, 0.6], color: '#2f3236', finish: 'fabric', acoustic: 'bass_trap', area: AREA.corner, build: B.cornerTrap, params: { style: { label: 'Style', type: 'select', options: ['triangle', 'chamfer'], default: 'triangle' } }, desc: 'Floor-to-ceiling superchunk. Corners are where room modes have pressure maxima — the most effective place for bass absorption.' }),
  D({ type: 'cornerTrapCeil', name: 'Wall–Ceiling Corner Trap', cat: 'Bass Control', mount: 'wall', size: [2.4, 0.4, 0.4], color: '#2f3236', finish: 'fabric', acoustic: 'bass_trap', area: (s) => s[0] * s[1] * Math.SQRT2, build: (it) => { const [w, h, d] = it.size, g = new THREE.Group(); const p = prism([[0, 0], [0, d], [0, 0]], 0, mat(it.color, it.finish)); const shape = new THREE.Shape([new THREE.Vector2(-d / 2, h), new THREE.Vector2(d / 2, h), new THREE.Vector2(-d / 2, 0)]); const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(-Math.PI / 2); g.add(new THREE.Mesh(geo, mat(it.color, it.finish))); void p; return g; }, desc: 'Triangular trap along the wall–ceiling junction (tri-corners and horizontal edges also hold modal pressure).' }),
  D({ type: 'bassPanel', name: 'Thick Bass Panel 200mm', cat: 'Bass Control', mount: 'wall', size: [0.6, 1.2, 0.2], color: '#3a3a3c', finish: 'fabric', acoustic: 'fabric_150', build: B.absorber, params: { frame: { label: 'Wood frame', type: 'bool', default: false } }, desc: 'Deep porous panel with air gap — extends absorption well below 125 Hz.' }),
  D({ type: 'membrane', name: 'Membrane Bass Trap', cat: 'Bass Control', mount: 'wall', size: [1.2, 0.6, 0.2], color: '#d0c8b8', color2: '#8a6a4a', finish: 'gloss', acoustic: 'membrane', build: B.membrane, desc: 'Limp-mass / panel resonator tuned to low frequencies (≈ 40–120 Hz). Pressure-based — mount on walls and corners.' }),
  D({ type: 'tubeTrap', name: 'Tube Trap', cat: 'Bass Control', size: [0.4, 1.2, 0.4], color: '#3b4a5a', color2: '#1a1a1a', finish: 'fabric', acoustic: 'tube_trap', area: AREA.cyl, build: B.tubeTrap, desc: 'Cylindrical trap with a reflective half — rotate to tune brightness.' }),
  D({ type: 'helmholtz', name: 'Helmholtz Perforated Panel', cat: 'Bass Control', mount: 'wall', size: [1.2, 0.6, 0.1], color: '#c49a6c', color2: '#2a2a2a', finish: 'wood', acoustic: 'helmholtz', build: B.perforated, params: { pattern: { label: 'Pattern', type: 'select', options: ['holes', 'slots'], default: 'holes' } }, desc: 'Perforated board over a cavity — resonant absorber for low-mids.' }),
  // Diffusion
  D({ type: 'qrd', name: 'QRD Diffuser (1D)', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.2], color: '#c49a6c', color2: '#a77b52', finish: 'wood', acoustic: 'qrd', build: B.qrd, params: { prime: { label: 'Prime (N)', type: 'select', options: [7, 11, 13, 17], default: 7 } }, desc: 'Quadratic-residue diffuser. Spreads energy in one plane — great on the rear wall to keep the room live but even.' }),
  D({ type: 'skyline', name: 'Skyline Diffuser (2D)', cat: 'Diffusion', mount: 'wall', size: [0.6, 0.6, 0.15], color: '#d8c3a0', color2: '#b8996a', finish: 'wood', acoustic: 'skyline', build: B.skyline, params: { grid: { label: 'Grid', type: 'select', options: [8, 10, 12, 14], default: 12 } }, desc: 'Primitive-root block diffuser — scatters in two planes. Rear wall or ceiling.' }),
  D({ type: 'poly', name: 'Polycylindrical Diffuser', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.15], color: '#e0c08f', color2: '#8a6a4a', finish: 'wood', acoustic: 'poly', build: B.poly, desc: 'Curved panel — broad diffusion plus some low-frequency absorption.' }),
  D({ type: 'bad', name: 'Hybrid Absorber-Diffuser', cat: 'Diffusion', mount: 'wall', size: [0.6, 1.2, 0.1], color: '#d8c3a0', color2: '#3b3e42', finish: 'fabric', acoustic: 'bad_panel', build: B.bad, params: {}, desc: 'Binary-amplitude (BAD) face: absorbs lows/mids, scatters highs so the room doesn\'t go dead.' }),
  D({ type: 'bookshelf', name: 'Bookcase Diffuser', cat: 'Diffusion', size: [1.2, 2.0, 0.35], color: '#5d4030', finish: 'wood', acoustic: 'books', build: B.bookshelf, params: { books: { label: 'Fill with books', type: 'bool', default: true } }, desc: 'A filled bookcase is a surprisingly effective random diffuser.' }),
  // Reflection control
  D({ type: 'slats', name: 'Wood Slat Panel', cat: 'Reflection Control', mount: 'wall', size: [0.6, 2.4, 0.022], color: '#c49a6c', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', build: B.slats, params: { slatWidth: { label: 'Slat width (m)', type: 'number', min: 0.01, max: 0.1, step: 0.001, default: 0.027 }, gap: { label: 'Gap (m)', type: 'number', min: 0.003, max: 0.06, step: 0.001, default: 0.013 } }, desc: 'Slatted wood over black felt (Akupanel style) — modern look with mid absorption.' }),
  D({ type: 'slatResonator', name: 'Slot Resonator Wall', cat: 'Reflection Control', mount: 'wall', size: [1.2, 1.2, 0.12], color: '#e0c08f', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', build: B.slats, params: { slatWidth: { label: 'Slat width (m)', type: 'number', min: 0.01, max: 0.15, step: 0.001, default: 0.07 }, gap: { label: 'Gap (m)', type: 'number', min: 0.003, max: 0.06, step: 0.001, default: 0.012 } }, desc: 'Deep slats over cavity — Helmholtz-type slot absorber tuned by slot width and depth.' }),
  D({ type: 'reflector', name: 'Reflector Panel', cat: 'Reflection Control', mount: 'wall', size: [1.0, 1.0, 0.025], color: '#e0c08f', finish: 'gloss', acoustic: 'reflector', build: B.reflector, params: { tilt: { label: 'Tilt (°)', type: 'number', min: -45, max: 45, step: 1, default: 10 } }, desc: 'Hard angled panel. Keeps energy alive (live end) or steers early reflections away from the listener (RFZ).' }),
  D({ type: 'redirector', name: 'Angled Re-director', cat: 'Reflection Control', mount: 'wall', size: [1.2, 1.2, 0.2], color: '#e0c08f', color2: '#8a6a4a', finish: 'wood', acoustic: 'reflector', build: B.redirector, params: { blades: { label: 'Blades', type: 'number', min: 2, max: 20, step: 1, default: 6 }, angle: { label: 'Blade angle (°)', type: 'number', min: 0, max: 80, step: 1, default: 30 } }, desc: 'Angled louvres that redirect side-wall reflections away from the mix position.' }),
  // Ceiling
  D({ type: 'cloud', name: 'Ceiling Cloud', cat: 'Ceiling', mount: 'ceiling', size: [1.2, 0.1, 1.8], color: '#e9e6df', color2: '#8a6a4a', finish: 'fabric', acoustic: 'fabric_100', area: AREA.top, build: B.cloud, params: { frame: { label: 'Wood edge', type: 'bool', default: false } }, desc: 'Suspended absorber above the mix position — catches the ceiling first reflection. Hang with an air gap for better low-mid absorption.' }),
  D({ type: 'baffle', name: 'Hanging Baffle', cat: 'Ceiling', mount: 'ceiling', size: [1.2, 0.6, 0.05], color: '#9caf88', finish: 'felt', acoustic: 'fabric_50', area: (s) => 2 * s[0] * s[1], build: B.baffle, desc: 'Vertical hanging absorber — great in live rooms, offices and high ceilings.' }),
  D({ type: 'ceilDiffuser', name: 'Ceiling Skyline', cat: 'Ceiling', mount: 'ceiling', size: [0.6, 0.15, 0.6], color: '#d8c3a0', color2: '#b8996a', finish: 'wood', acoustic: 'skyline', area: AREA.top, build: (it, ctx) => { const g = B.skyline({ ...it, size: [it.size[0], it.size[2], it.size[1]] }, ctx); const w = new THREE.Group(); g.rotation.x = Math.PI / 2; g.position.set(0, it.size[1], -it.size[2] / 2); w.add(g); return w; }, params: { grid: { label: 'Grid', type: 'select', options: [8, 10, 12, 14], default: 12 } }, desc: '2D diffuser for the ceiling, behind the listener.' }),
  D({ type: 'ceilTile', name: 'Acoustic Ceiling Tile Grid', cat: 'Ceiling', mount: 'ceiling', size: [2.4, 0.03, 2.4], color: '#f4f4f2', finish: 'concrete', acoustic: 'ceiling_tile', area: AREA.top, build: (it) => { const [w, h, d] = it.size, g = new THREE.Group(); const n = Math.max(1, Math.round(w / 0.6)), m = Math.max(1, Math.round(d / 0.6)), list = []; for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) list.push([-w / 2 + (w / n) * (i + 0.5), h / 2, -d / 2 + (d / m) * (j + 0.5), w / n - 0.015, h, d / m - 0.015]); g.add(instBoxes(list, mat(it.color, it.finish))); g.add(box(w, h * 0.5, d, mat('#ddd', 'metal'), 0, h * 0.75, 0)); return g; }, desc: 'Suspended mineral-fibre tile grid.' }),
  D({ type: 'canopy', name: 'Slatted Wood Canopy', cat: 'Ceiling', mount: 'ceiling', size: [2.4, 0.08, 1.2], color: '#c49a6c', color2: '#1d1d1d', finish: 'wood', acoustic: 'slat', area: AREA.top, build: (it, ctx) => { const [w, h, d] = it.size, g = new THREE.Group(); const n = Math.max(2, Math.floor(d / 0.08)), list = []; for (let i = 0; i < n; i++) list.push([0, h / 2, -d / 2 + (d / n) * (i + 0.5), w, h, 0.035]); g.add(instBoxes(list, mat(it.color, it.finish))); g.add(box(w, 0.012, d, mat(it.color2, 'felt'), 0, h + 0.006, 0)); hangWires(g, it, ctx, [[-w / 2 + 0.1, 0], [w / 2 - 0.1, 0]], h); return g; }, desc: 'Modern linear wood ceiling feature over felt.' }),
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
  D({ type: 'tv', name: 'Wall TV / Display', cat: 'Gear & Instruments', mount: 'wall', size: [1.45, 0.83, 0.05], color: '#111111', build: B.tv, params: { on: { label: 'Screen on', type: 'bool', default: true } } }),
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
  D({ type: 'pendant', name: 'Pendant Light', cat: 'Lighting', mount: 'ceiling', size: [0.4, 0.6, 0.4], color: '#1d1d1f', finish: 'metal', light: true, build: B.pendant, params: LIGHT_PARAMS }),
  D({ type: 'trackLight', name: 'Track Spotlights', cat: 'Lighting', mount: 'ceiling', size: [1.5, 0.2, 0.1], color: '#1d1d1f', light: true, build: B.trackLight, params: { ...LIGHT_PARAMS, heads: { label: 'Heads', type: 'number', min: 1, max: 8, step: 1, default: 3 } } }),
  D({ type: 'ledStrip', name: 'LED Strip (RGB)', cat: 'Lighting', mount: 'wall', size: [2.0, 0.02, 0.015], color: '#bbbbbb', light: true, build: B.ledStrip, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#7a4fff' } }, desc: 'Ambient accent / bias lighting — put behind desks, clouds or diffusers.' }),
  D({ type: 'lightBar', name: 'RGB Light Tube', cat: 'Lighting', size: [0.05, 1.2, 0.05], color: '#ffffff', light: true, build: B.lightBar, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#ff2e88' } } }),
  D({ type: 'floorLamp', name: 'Floor Lamp', cat: 'Lighting', size: [0.45, 1.6, 0.45], color: '#efe6cf', color2: '#1d1d1f', light: true, build: B.floorLamp, params: LIGHT_PARAMS }),
  D({ type: 'sconce', name: 'Wall Sconce', cat: 'Lighting', mount: 'wall', size: [0.18, 0.25, 0.15], color: '#c8a14a', finish: 'metal', light: true, build: B.sconce, params: LIGHT_PARAMS }),
  D({ type: 'neon', name: '"ON AIR" Sign', cat: 'Lighting', mount: 'wall', size: [0.6, 0.2, 0.05], color: '#111111', light: true, build: B.neon, params: { ...LIGHT_PARAMS, lightColor: { ...LIGHT_PARAMS.lightColor, default: '#ff2a2a' }, text: { label: 'Text', type: 'text', default: 'ON AIR' } } }),
  // Architecture
  D({ type: 'door', name: 'Acoustic Door', cat: 'Architecture', mount: 'wall', size: [0.9, 2.1, 0.08], color: '#5d4030', color2: '#e9e6df', finish: 'wood', acoustic: 'wood_hard', build: B.door, params: { window: { label: 'Vision panel', type: 'bool', default: false }, seals: { label: 'Drop seal', type: 'bool', default: true } } }),
  D({ type: 'window', name: 'Studio Window (double)', cat: 'Architecture', mount: 'wall', size: [1.4, 1.0, 0.2], color: '#2a211c', finish: 'wood', acoustic: 'glass', build: B.window, params: { panes: { label: 'Panes', type: 'select', options: [1, 2, 3], default: 2 }, angled: { label: 'Angled pane', type: 'bool', default: true } } }),
  D({ type: 'partition', name: 'Partition Wall', cat: 'Architecture', size: [2.0, 2.4, 0.12], color: '#ece8df', finish: 'paint', acoustic: 'drywall', area: (s) => 2 * s[0] * s[1], build: B.partition }),
  D({ type: 'soffit', name: 'Speaker Soffit Wall', cat: 'Architecture', mount: 'wall', size: [3.0, 2.4, 0.6], color: '#2f3236', finish: 'fabric', acoustic: 'none', build: B.soffit, params: { speakerHeight: { label: 'Speaker height (m)', type: 'number', min: 0.5, max: 2.2, step: 0.05, default: 1.25 } }, desc: 'Flush-mounted main monitors — removes front-wall SBIR.' }),
  D({ type: 'column', name: 'Column / Pillar', cat: 'Architecture', size: [0.3, 2.4, 0.3], color: '#ece8df', acoustic: 'concrete', area: (s) => 4 * s[0] * s[1], build: B.column, params: { round: { label: 'Round', type: 'bool', default: false } } }),
  D({ type: 'riser', name: 'Riser / Floating Floor', cat: 'Architecture', size: [2.0, 0.2, 2.0], color: '#c49a6c', color2: '#2a2a2a', finish: 'wood', build: B.riser }),
  D({ type: 'booth', name: 'Vocal / Iso Booth', cat: 'Architecture', size: [1.5, 2.2, 1.5], color: '#3a3a3c', color2: '#d8d4cc', acoustic: 'fabric_50', area: (s) => 2 * (s[0] + s[2]) * s[1], build: B.booth, desc: 'Modular isolation booth with window and door.' }),
  D({ type: 'stairs', name: 'Steps', cat: 'Architecture', size: [1.0, 0.54, 0.9], color: '#c49a6c', finish: 'wood', build: B.stairs }),
  // Decor
  D({ type: 'plant', name: 'Plant', cat: 'Decor', size: [0.5, 1.2, 0.5], color: '#3f8f4f', color2: '#e9e6df', finish: 'concrete', build: B.plant }),
  // Shapes
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
