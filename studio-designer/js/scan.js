// Camera capture & "room scan" wizard. Uses getUserMedia (works offline once the
// app is cached; needs https or localhost). Falls back to photo upload, which on
// phones opens the native camera.

let stream = null;
function stop() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }

/** Dominant colours via a coarse colour histogram (fast, deterministic). */
export function extractPalette(canvas, n = 6) {
  const g = canvas.getContext('2d');
  const W = 96, H = Math.max(1, Math.round((canvas.height / canvas.width) * 96));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const cg = c.getContext('2d'); cg.drawImage(canvas, 0, 0, W, H);
  const d = cg.getImageData(0, 0, W, H).data, bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(key, b);
  }
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
  const out = [];
  for (const col of sorted) {
    if (out.every((o) => Math.hypot(o[0] - col[0], o[1] - col[1], o[2] - col[2]) > 40)) out.push(col);
    if (out.length >= n) break;
  }
  void g;
  return out.map((c3) => '#' + c3.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
}

export function openScanner(app, opts = {}) {
  const { h } = app;
  const video = h('video', { autoplay: true, playsInline: true, muted: true, class: 'scan-video' });
  const canvas = h('canvas', { class: 'scan-canvas', hidden: true });
  const status = h('p', { class: 'hint' }, 'Starting camera…');
  const palette = h('div', { class: 'palette' });
  const actions = h('div', { class: 'scan-actions' });
  let facing = 'environment', captured = null;
  const wizardSteps = Object.keys(app.surfaces);
  let wizard = opts.target === 'wizard' ? 0 : -1;

  async function start() {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) { status.textContent = 'Camera API not available here — use “Upload photo” (on phones this opens the camera).'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream; video.hidden = false; canvas.hidden = true;
      status.textContent = wizard >= 0 ? `Step ${wizard + 1}/${wizardSteps.length} — point the camera at the ${app.surfaces[wizardSteps[wizard]].toLowerCase()} and capture.` : 'Point the camera at a wall, material or artwork and press Capture.';
    } catch (e) {
      status.textContent = 'Camera unavailable (' + (e.name || 'blocked') + '). Use “Upload photo” instead.';
    }
  }
  function shoot(srcW, srcH, draw) {
    const k = Math.min(1, 1600 / Math.max(srcW, srcH));
    canvas.width = Math.round(srcW * k); canvas.height = Math.round(srcH * k);
    draw(canvas.getContext('2d'), canvas.width, canvas.height);
    captured = canvas.toDataURL('image/jpeg', 0.85);
    video.hidden = true; canvas.hidden = false;
    showResult();
  }
  function capture() {
    if (!video.videoWidth) return app.toast('Camera not ready', 'error');
    shoot(video.videoWidth, video.videoHeight, (g, w, hh) => g.drawImage(video, 0, 0, w, hh));
  }
  function upload() {
    const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => shoot(img.width, img.height, (g, w, hh) => g.drawImage(img, 0, 0, w, hh)); img.src = r.result; };
      r.readAsDataURL(f);
    };
    inp.click();
  }
  function showResult() {
    const cols = extractPalette(canvas, 6);
    palette.innerHTML = '';
    palette.append(h('small', {}, 'Sampled colours — click to apply:'), ...cols.map((c) => h('button', { class: 'sw big', style: { background: c }, title: c, onclick: () => applyColor(c) })));
    actions.innerHTML = '';
    if (wizard >= 0) {
      const surf = wizardSteps[wizard];
      actions.append(
        h('button', { class: 'btn primary', onclick: () => { app.applyPhotoToSurface(surf, captured); nextStep(); } }, `Use photo on ${app.surfaces[surf]}`),
        h('button', { class: 'btn', onclick: () => { app.applyColorToSurface(surf, cols[0]); nextStep(); } }, 'Use dominant colour only'),
        h('button', { class: 'btn ghost', onclick: () => nextStep() }, 'Skip'),
        h('button', { class: 'btn ghost', onclick: () => start() }, 'Retake'));
      return;
    }
    const t = opts.target;
    if (t && app.surfaces[t]) actions.append(h('button', { class: 'btn primary', onclick: () => { app.applyPhotoToSurface(t, captured); done(); } }, `Use on ${app.surfaces[t]}`));
    if (t === 'item' && opts.item) actions.append(h('button', { class: 'btn primary', onclick: () => { app.applyImageToItem(opts.item, captured); done(); } }, 'Print on this panel'));
    actions.append(
      h('select', { class: 'btn', onchange: (e) => { if (e.target.value) { app.applyPhotoToSurface(e.target.value, captured); app.toast('Photo mapped onto ' + app.surfaces[e.target.value]); } } },
        h('option', { value: '' }, 'Map photo onto surface…'), ...Object.entries(app.surfaces).map(([k, l]) => h('option', { value: k }, l))),
      h('button', { class: 'btn', onclick: () => { app.addArtPanel(captured); app.toast('Art panel added on back wall'); done(); } }, 'Make printed art panel'),
      h('button', { class: 'btn', onclick: () => { app.setUnderlay(captured); done(); } }, 'Use as floor-plan underlay'),
      h('button', { class: 'btn ghost', onclick: () => start() }, 'Retake'));
  }
  function applyColor(c) {
    const t = opts.target;
    if (wizard >= 0) { app.applyColorToSurface(wizardSteps[wizard], c); app.toast('Colour applied'); return; }
    if (t && app.surfaces[t]) { app.applyColorToSurface(t, c); app.toast('Colour applied to ' + app.surfaces[t]); return; }
    if (app.selected()) { app.applyColorToSelection(c); app.toast('Colour applied to selection'); return; }
    // otherwise offer surfaces
    const m = app.modal('Apply colour ' + c, h('div', { class: 'row gap wrap' }, ...Object.entries(app.surfaces).map(([k, l]) => h('button', { class: 'btn small', onclick: () => { app.applyColorToSurface(k, c); app.toast(`${l} → ${c}`); m.close(); reopen(); } }, l))));
  }
  function nextStep() {
    wizard++;
    if (wizard >= wizardSteps.length) { wizard = -1; askDims(); return; }
    start();
  }
  function askDims() {
    stop();
    const r = app.room(); void r;
    const f = (label, key) => h('label', { class: 'field' }, h('span', {}, label + ' (m)'), h('input', { type: 'number', step: 0.01, value: r[key], 'data-k': key }));
    const body = h('div', {}, h('p', {}, 'Last step: enter the measured room size (tape or laser measure). Phone LiDAR apps can export a GLB/OBJ — import it to size the room automatically.'),
      h('div', { class: 'grid3' }, f('Width', 'w'), f('Length', 'd'), f('Height', 'h')));
    app.modal('Room scan — dimensions', body, [
      { label: 'Import LiDAR scan…', onClick: () => app.importModel() },
      { label: 'Finish', primary: true, onClick: () => { const dims = {}; body.querySelectorAll('input').forEach((i) => (dims[i.dataset.k] = parseFloat(i.value))); app.setRoom(dims); app.toast('Room scan applied'); } },
    ]);
  }
  function done() { stop(); m.close(); }
  function reopen() { openScanner(app, opts); }

  const body = h('div', { class: 'scanner' },
    h('div', { class: 'scan-stage' }, video, canvas),
    status, palette, actions,
    h('div', { class: 'row gap wrap scan-controls' },
      h('button', { class: 'btn primary', onclick: capture }, '◉ Capture'),
      h('button', { class: 'btn', onclick: () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); } }, '⟲ Flip camera'),
      h('button', { class: 'btn', onclick: upload }, 'Upload photo'),
      h('button', { class: 'btn', onclick: () => { wizard = 0; start(); } }, '🧭 Guided room scan (every surface)'),
      h('button', { class: 'btn', onclick: () => { stop(); m.close(); app.importModel(); } }, 'Import 3D scan (GLB/OBJ)')));
  const m = app.modal('Scan & capture', body, [], { wide: true });
  document.getElementById('modal').addEventListener('closed', stop, { once: true });
  if (opts.mode === 'upload') { status.textContent = 'Choose a photo…'; upload(); } else start();
}
