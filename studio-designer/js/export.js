// PDF export: cover sheet, true-to-scale plan & elevations, saved scenes,
// item schedule, colour/material board and acoustic report. Uses the vendored
// jsPDF (window.jspdf) so it works offline.

const PAPER = { A4: [297, 210], A3: [420, 297], Letter: [279.4, 215.9], Tabloid: [431.8, 279.4] };
const SCALES = [10, 20, 25, 50, 75, 100, 150, 200, 250, 500];
const txt = (s) => String(s ?? '')
  .replace(/≈/g, '~').replace(/✓/g, 'OK').replace(/✗/g, 'x').replace(/α/g, 'a').replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/→/g, '->').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/·/g, '-').replace(/–/g, '-').replace(/[^\x20-\x7E\xA0-\xFF—]/g, '');

export function openPdfDialog(app) {
  const { h } = app;
  if (!window.jspdf) return app.toast('PDF library failed to load', 'error');
  const p = app.project();
  const views = [['persp', '3D perspective'], ['top', 'Plan (top) — to scale'], ['front', 'Front elevation — to scale'], ['back', 'Back elevation — to scale'], ['left', 'Left elevation — to scale'], ['right', 'Right elevation — to scale']];
  const cb = (name, label, checked = true) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name, checked }), ' ' + label);
  const form = h('form', { class: 'pdf-form', onsubmit: (e) => e.preventDefault() },
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, 'Paper'), h('select', { name: 'paper' }, Object.keys(PAPER).map((k) => h('option', { value: k, selected: k === 'A3' }, k)))),
      h('label', { class: 'field' }, h('span', {}, 'Background'), h('select', { name: 'bg' }, h('option', { value: 'print', selected: true }, 'White drawings, light renders (print)'), h('option', { value: 'dark' }, 'Dark (screen / presentation)'))),
      h('label', { class: 'field' }, h('span', {}, 'Quality'), h('select', { name: 'quality' }, h('option', { value: '5' }, 'Standard (fast)'), h('option', { value: '8', selected: true }, 'High'), h('option', { value: '11' }, 'Print (slow)')))),
    h('h4', {}, 'Pages'),
    cb('cover', 'Cover sheet with summary'),
    h('div', { class: 'check-grid' }, views.map(([k, l]) => cb('view_' + k, l))),
    p.scenes.length ? h('div', {}, h('h4', {}, 'Saved scenes'), h('div', { class: 'check-grid' }, p.scenes.map((s, i) => cb('scene_' + i, s.name)))) : h('p', { class: 'hint' }, 'Tip: save camera angles in the Scenes tab to add them as pages.'),
    cb('schedule', 'Item schedule / bill of materials'),
    cb('materials', 'Colour & material board'),
    cb('acoustics', 'Acoustic report (RT60, modes, reflections)'),
    cb('modes', 'Room modes & low-frequency treatment zones'),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', {}, 'Designer'), h('input', { name: 'designer', value: p.designer })),
      h('label', { class: 'field' }, h('span', {}, 'Client'), h('input', { name: 'client', value: p.client }))),
    h('p', { class: 'hint pdf-progress' }, ''));
  app.modal('Export PDF', form, [
    { label: 'Cancel' },
    {
      label: 'Generate PDF', primary: true, onClick: () => {
        const fd = new FormData(form);
        const opts = Object.fromEntries([...form.querySelectorAll('input[type=checkbox]')].map((i) => [i.name, i.checked]));
        opts.paper = fd.get('paper'); opts.ppm = +fd.get('quality');
        if (fd.get('bg') === 'print') { opts.drawBg = '#ffffff'; opts.bg3d = '#eceef1'; }
        p.designer = fd.get('designer'); p.client = fd.get('client');
        form.querySelector('.pdf-progress').textContent = 'Rendering…';
        setTimeout(() => buildPdf(app, opts).catch((e) => { console.error(e); app.toast('PDF failed: ' + e.message, 'error'); }), 30);
        return false;
      },
    },
  ], { wide: true });
}

async function buildPdf(app, o) {
  const { jsPDF } = window.jspdf;
  const [PW, PH] = PAPER[o.paper] || PAPER.A3;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH], compress: true });
  const p = app.project(), room = app.room();
  const M = 10, HEAD = 12, FOOT = 20;
  const pages = [];
  const progress = document.querySelector('.pdf-progress');
  const tick = async (msg) => { if (progress) progress.textContent = msg; await new Promise((r) => setTimeout(r, 0)); };
  const date = new Date().toLocaleDateString();
  let pageNo = 0;
  const A = app.analysis();

  function frame(title, scaleText = '') {
    if (pageNo++) doc.addPage([PW, PH], 'landscape');
    doc.setFillColor(24, 26, 30); doc.rect(0, 0, PW, HEAD, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(txt(p.name || 'Studio design'), M, 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(170, 220, 255);
    doc.text(txt(title), PW - M, 8, { align: 'right' });
    // title block
    const y = PH - FOOT + 2;
    doc.setDrawColor(60); doc.setLineWidth(0.3); doc.rect(M, y, PW - 2 * M, FOOT - 6);
    const cols = [['Project', p.name], ['Client', p.client || '-'], ['Designer', p.designer || '-'], ['Date', date], ['Room', `${room.w.toFixed(2)} x ${room.d.toFixed(2)} x ${room.h.toFixed(2)} m`], ['Scale', scaleText || 'NTS'], ['Sheet', String(pageNo)]];
    const cw = (PW - 2 * M) / cols.length;
    cols.forEach(([k, v], i) => {
      const x = M + i * cw;
      if (i) doc.line(x, y, x, y + FOOT - 6);
      doc.setTextColor(120); doc.setFontSize(6.5); doc.text(k.toUpperCase(), x + 2, y + 4);
      doc.setTextColor(20); doc.setFontSize(9); doc.text(txt(v).slice(0, 40), x + 2, y + 10);
    });
    doc.setTextColor(150); doc.setFontSize(6); doc.text('Generated with RoomTone Studio Designer - acoustic figures are design estimates; verify with measurement.', M, PH - 2);
    pages.push(title);
    return { x: M, y: HEAD + 4, w: PW - 2 * M, h: PH - HEAD - FOOT - 6 };
  }
  function image(url, area, imgW, imgH) {
    const k = Math.min(area.w / imgW, area.h / imgH);
    const w = imgW * k, hh = imgH * k;
    doc.addImage(url, 'JPEG', area.x + (area.w - w) / 2, area.y + (area.h - hh) / 2, w, hh, undefined, 'FAST');
    return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - hh) / 2, w, h: hh };
  }

  // ---------------------------------------------------------------- cover
  if (o.cover) {
    await tick('Cover…');
    const a = frame('Cover sheet');
    const imgW = a.w * 0.62, imgH = a.h;
    const url = app.renderToDataURL({ view: 'persp', width: Math.round(imgW * o.ppm), height: Math.round(imgH * o.ppm), bg: o.bg3d });
    image(url, { x: a.x, y: a.y, w: imgW, h: imgH }, imgW, imgH);
    let x = a.x + imgW + 8, y = a.y + 8;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text(doc.splitTextToSize(txt(p.name), a.w - imgW - 10), x, y + 4);
    y += 18; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    const lines = [
      `Client: ${p.client || '-'}`, `Designer: ${p.designer || '-'}`, `Date: ${date}`, '',
      `Room: ${room.w.toFixed(2)} W x ${room.d.toFixed(2)} L x ${room.h.toFixed(2)}${app.hmax() > room.h + 0.05 ? '-' + app.hmax().toFixed(2) : ''} H m (overall)`, `Shape: ${app.wallCount()} walls, ${app.ceilingName()} ceiling`, `Floor area: ${app.floorArea().toFixed(1)} m2   Volume: ${A.rt.V.toFixed(1)} m3`,
      `RT60 (500 Hz-1 kHz): ${A.rt.mid.toFixed(2)} s  (target ~${A.rt.target.toFixed(2)} s)`, `Schroeder frequency: ${A.rt.schroeder.toFixed(0)} Hz`,
      `Items: ${p.items.length}   Treated surface: ${(A.coverage * 100).toFixed(0)} %`,
    ];
    for (const l of lines) { doc.text(txt(l), x, y); y += 6; }
    if (p.notes) { y += 4; doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.text('Notes', x, y); y += 5; doc.setFont('helvetica', 'normal'); doc.setTextColor(60); doc.text(doc.splitTextToSize(txt(p.notes), a.w - imgW - 12), x, y); }
    y = a.y + a.h - 40;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.text('Contents', x, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80);
    const toc = [...['top', 'front', 'back', 'left', 'right', 'persp'].filter((v) => o['view_' + v]).map((v) => app.viewNames[v]), ...p.scenes.filter((_, i) => o['scene_' + i]).map((s) => s.name), o.schedule && 'Item schedule', o.materials && 'Colour & material board', o.acoustics && 'Acoustic report'].filter(Boolean);
    doc.text(doc.splitTextToSize(toc.map((t, i) => `${i + 2}. ${t}`).join('   '), a.w - imgW - 12), x, y + 5);
  }

  // ---------------------------------------------------------------- views
  for (const v of ['top', 'front', 'back', 'left', 'right', 'persp']) {
    if (!o['view_' + v]) continue;
    await tick('Rendering ' + app.viewNames[v] + '…');
    const a0 = { x: M, y: HEAD + 4, w: PW - 2 * M, h: PH - HEAD - FOOT - 6 };
    if (v === 'persp') {
      const a = frame(app.viewNames[v]);
      const url = app.renderToDataURL({ view: v, width: Math.round(a.w * o.ppm), height: Math.round(a.h * o.ppm), bg: o.bg3d });
      image(url, a, a.w, a.h);
      continue;
    }
    // true-to-scale orthographic drawing
    const span = v === 'top' ? [room.w + 1.2, room.d + 1.2] : v === 'front' || v === 'back' ? [room.w + 1.2, room.h + 1] : [room.d + 1.2, room.h + 1];
    const scale = SCALES.find((s) => (span[0] * 1000) / s <= a0.w && (span[1] * 1000) / s <= a0.h) || 500;
    const a = frame(app.viewNames[v], `1:${scale} @ ${o.paper}`);
    if (o.drawBg) { doc.setDrawColor(200); doc.rect(a.x, a.y, a.w, a.h); }
    const spanW = (a.w * scale) / 1000;
    const url = app.renderToDataURL({ view: v, width: Math.round(a.w * o.ppm), height: Math.round(a.h * o.ppm), orthoSpan: spanW, bg: o.drawBg });
    doc.addImage(url, 'JPEG', a.x, a.y, a.w, a.h, undefined, 'FAST');
    // scale bar
    const mm = 1000 / scale, bars = scale <= 25 ? 1 : 2, unitM = scale <= 25 ? 0.5 : 1;
    const bx = a.x + 6, by = a.y + a.h - 8;
    doc.setFillColor(255, 255, 255); doc.rect(bx - 3, by - 7, mm * unitM * bars * 2 + 22, 12, 'F');
    for (let i = 0; i < bars * 2; i++) { doc.setFillColor(i % 2 ? 255 : 20, i % 2 ? 255 : 20, i % 2 ? 255 : 20); doc.setDrawColor(20); doc.rect(bx + i * mm * unitM, by, mm * unitM, 2, 'FD'); }
    doc.setTextColor(20); doc.setFontSize(7);
    for (let i = 0; i <= bars * 2; i++) doc.text(`${(i * unitM).toString()}`, bx + i * mm * unitM, by - 1.5, { align: 'center' });
    doc.text('m', bx + bars * 2 * mm * unitM + 3, by + 2);
    // north/front arrow on plan
    if (v === 'top') { doc.setFontSize(7); doc.text('FRONT WALL ^', a.x + a.w - 6, a.y + 6, { align: 'right' }); }
  }

  // ---------------------------------------------------------------- scenes
  for (const [i, sc] of p.scenes.entries()) {
    if (!o['scene_' + i]) continue;
    await tick('Rendering scene ' + (i + 1) + '…');
    const a = frame(sc.name);
    const url = app.renderToDataURL({ scene: sc, width: Math.round(a.w * o.ppm), height: Math.round(a.h * o.ppm), bg: o.bg3d });
    image(url, a, a.w, a.h);
  }

  // ---------------------------------------------------------------- schedule
  if (o.schedule) {
    await tick('Item schedule…');
    const rows = app.scheduleRows();
    const head = ['Category', 'Item', 'Qty', 'W x H x D (cm)', 'Colour', 'Finish', 'Acoustic material', 'Abs. area m2'];
    const widths = [0.13, 0.2, 0.05, 0.13, 0.11, 0.12, 0.18, 0.08];
    let a = frame('Item schedule / bill of materials'), y = a.y + 6;
    const drawHead = () => {
      doc.setFillColor(235, 238, 242); doc.rect(a.x, y - 4.5, a.w, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(30);
      let x = a.x + 2; head.forEach((t, i) => { doc.text(t, x, y); x += widths[i] * a.w; });
      doc.setFont('helvetica', 'normal'); y += 7;
    };
    drawHead();
    let total = 0;
    for (const r of rows) {
      if (y > a.y + a.h - 8) { a = frame('Item schedule (cont.)'); y = a.y + 6; drawHead(); }
      let x = a.x + 2;
      const cells = [r.cat, r.name, String(r.qty), r.size.map((v) => (v * 100).toFixed(0)).join(' x '), r.color, r.finish, r.acoustic, r.area.toFixed(2)];
      doc.setFontSize(8); doc.setTextColor(40);
      cells.forEach((t, i) => {
        if (i === 4) { const c = hexRgb(t); doc.setFillColor(...c); doc.setDrawColor(150); doc.rect(x, y - 3, 4, 4, 'FD'); doc.text(t, x + 6, y); }
        else doc.text(txt(t).slice(0, Math.floor(widths[i] * a.w / 1.6)), x, y);
        x += widths[i] * a.w;
      });
      if (r.cat !== 'Lighting') total += r.area;
      doc.setDrawColor(225); doc.line(a.x, y + 2, a.x + a.w, y + 2);
      y += 6.5;
    }
    y += 4; doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(`${rows.reduce((s, r) => s + r.qty, 0)} items in ${rows.length} line(s)`, a.x + 2, y);
  }

  // ---------------------------------------------------------------- materials board
  if (o.materials) {
    await tick('Material board…');
    const a = frame('Colour & material board');
    let x = a.x, y = a.y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20); doc.text('Room surfaces', x, y + 2); y += 8;
    const sw = (a.w - 5 * 6) / 6, y0 = y;
    app.surfaceList().slice(0, 18).forEach(({ label, s }, i) => {
      const xx = x + (i % 6) * (sw + 6), y = y0 + Math.floor(i / 6) * 46;
      doc.setFillColor(...hexRgb(s.color)); doc.setDrawColor(160); doc.roundedRect(xx, y, sw, 26, 2, 2, 'FD');
      doc.setFontSize(9); doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.text(txt(label), xx, y + 31);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80);
      doc.text([s.color.toUpperCase(), txt(app.finishName(s.finish)), txt(app.acousticName(s.acoustic))], xx, y + 35);
    });
    y = y0 + Math.ceil(Math.min(18, app.surfaceList().length) / 6) * 46 + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20); doc.text('Item colours', x, y); y += 6;
    const used = new Map();
    for (const it of p.items) for (const c of [it.color]) { const key = c + '|' + it.finish; const e = used.get(key) || { c, finish: it.finish, names: new Set() }; e.names.add(app.defOf(it.type).name); used.set(key, e); }
    const per = 6, cw = (a.w - (per - 1) * 5) / per;
    [...used.values()].slice(0, 30).forEach((e, i) => {
      const xx = x + (i % per) * (cw + 5), yy = y + Math.floor(i / per) * 30;
      if (yy > a.y + a.h - 25) return;
      doc.setFillColor(...hexRgb(e.c)); doc.setDrawColor(160); doc.roundedRect(xx, yy, 14, 14, 1.5, 1.5, 'FD');
      doc.setFontSize(8); doc.setTextColor(20); doc.text(e.c.toUpperCase() + '  ' + txt(app.finishName(e.finish)), xx + 17, yy + 4);
      doc.setFontSize(7); doc.setTextColor(90); doc.text(doc.splitTextToSize(txt([...e.names].join(', ')), cw - 18).slice(0, 3), xx + 17, yy + 8);
    });
  }

  // ---------------------------------------------------------------- acoustics
  if (o.acoustics) {
    await tick('Acoustic report…');
    const a = frame('Acoustic report');
    const colW = a.w / 2 - 5;
    let x = a.x, y = a.y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20); doc.text('Reverberation time (RT60)', x, y + 2);
    // chart
    const cx = x + 10, cy = y + 8, cw2 = colW - 14, ch = 55;
    const max = Math.max(1, ...A.rt.bands.map((b) => Math.max(b.sabine, b.eyring))) * 1.1;
    const Y = (v) => cy + ch - (v / max) * ch;
    doc.setFillColor(220, 245, 232); doc.rect(cx, Y(A.rt.target + 0.15), cw2, Y(Math.max(0, A.rt.target - 0.05)) - Y(A.rt.target + 0.15), 'F');
    doc.setDrawColor(200); doc.setFontSize(7); doc.setTextColor(110);
    for (let v = 0; v <= max; v += max > 2 ? 0.5 : 0.2) { doc.line(cx, Y(v), cx + cw2, Y(v)); doc.text(v.toFixed(1), cx - 2, Y(v) + 1, { align: 'right' }); }
    const bw = cw2 / A.rt.bands.length;
    A.rt.bands.forEach((b, i) => {
      const bx = cx + i * bw + 3, bad = b.sabine > A.rt.target * 1.6, low = b.sabine < A.rt.target * 0.5;
      doc.setFillColor(...(bad ? [230, 90, 100] : low ? [240, 170, 60] : [60, 170, 130]));
      doc.rect(bx, Y(b.sabine), bw - 6, cy + ch - Y(b.sabine), 'F');
      doc.setFillColor(30, 60, 120); doc.circle(bx + (bw - 6) / 2, Y(b.eyring), 0.9, 'F');
      doc.setTextColor(60); doc.text(b.f >= 1000 ? b.f / 1000 + 'k' : String(b.f), bx + (bw - 6) / 2, cy + ch + 4, { align: 'center' });
      doc.setTextColor(20); doc.text(b.sabine.toFixed(2), bx + (bw - 6) / 2, Y(b.sabine) - 1.5, { align: 'center' });
    });
    y = cy + ch + 10;
    doc.setFontSize(7.5); doc.setTextColor(90);
    doc.text(txt(`Bars: Sabine; dots: Eyring. Green band: EBU Tech 3276 target ${A.rt.target.toFixed(2)} s (+0.15/-0.05). V = ${A.rt.V.toFixed(1)} m3, S = ${A.rt.S.toFixed(1)} m2.`), x, y);
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20); doc.text('Recommendations', x, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    for (const adv of A.advice.slice(0, 10)) {
      const col = adv.lvl === 'bad' ? [200, 50, 60] : adv.lvl === 'warn' ? [190, 120, 20] : adv.lvl === 'good' ? [40, 140, 90] : [60, 90, 140];
      doc.setFillColor(...col); doc.circle(x + 1.5, y - 1, 1, 'F'); doc.setTextColor(40);
      const ls = doc.splitTextToSize(txt(adv.text), colW - 6);
      if (y + ls.length * 3.8 > a.y + a.h) break;
      doc.text(ls, x + 5, y); y += ls.length * 3.8 + 1.5;
    }
    // right column
    x = a.x + colW + 10; y = a.y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20); doc.text('Room modes (axial, to 300 Hz)', x, y + 2); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const ax = A.modes.filter((m) => m.type === 'axial').slice(0, 14);
    const nm = (n) => (n[0] ? 'Length' : n[1] ? 'Width' : 'Height') + ' ' + (n[0] || n[1] || n[2]);
    ax.forEach((m, i) => { const col = i % 2, row = Math.floor(i / 2); doc.setTextColor(40); doc.text(`${m.f.toFixed(1)} Hz  ${nm(m.n)}  (${app.noteName(m.f)})`, x + col * (colW / 2), y + row * 4.5); });
    y += Math.ceil(ax.length / 2) * 4.5 + 3;
    for (const iss of A.issues.slice(0, 5)) { doc.setTextColor(190, 120, 20); doc.text(txt('! ' + iss.text), x, y); y += 4.2; }
    y += 3;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Room proportions', x, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(40);
    doc.text(txt(`Ratio 1 : ${A.ratio.r[1].toFixed(2)} : ${A.ratio.r[2].toFixed(2)} - ${A.ratio.inBolt ? 'inside' : 'outside'} the Bolt area. Closest: ${A.ratio.best.name} (1 : ${A.ratio.best.r[1]} : ${A.ratio.best.r[2]}).`), x, y); y += 8;
    if (A.tri) {
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Listening position', x, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(40);
      doc.text(txt(`Speaker angle ${A.tri.angle.toFixed(1)} deg (ideal 60) - distances L ${A.tri.dl.toFixed(2)} m / R ${A.tri.dr.toFixed(2)} m - spacing ${A.tri.spread.toFixed(2)} m - ear ${A.E[1].toFixed(2)} m - ${(((A.E[2] + room.d / 2) / room.d) * 100).toFixed(0)} % of length from front wall`), x, y, { maxWidth: colW }); y += 10;
    }
    if (A.refl.length) {
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('First reflections', x, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      A.refl.slice(0, 12).forEach((r, i) => {
        if (y > a.y + a.h - 4) return;
        doc.setTextColor(...(A.treated[i] ? [40, 140, 90] : [200, 50, 60]));
        doc.text(txt(`${A.treated[i] ? 'treated  ' : 'UNTREATED'}  ${r.surface.padEnd(8)} delay ${r.delayMs.toFixed(1)} ms  level ${r.levelDb.toFixed(1)} dB  at (${r.point.map((v) => v.toFixed(2)).join(', ')})`), x, y); y += 4.2;
      });
    }
  }

  // ---------------------------------------------------------------- room modes
  if (o.modes) {
    await tick('Room modes…');
    const D = app.modeData(), rep = D.rep;
    const a = frame('Room modes & low-frequency treatment');
    const colW = a.w / 2 - 5;
    let x = a.x, y = a.y + 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20);
    doc.text(txt(`Room modes - ${rep.R.L.toFixed(2)} L x ${rep.R.W.toFixed(2)} W x ${rep.R.H.toFixed(2)} H m, c = ${rep.c.toFixed(1)} m/s`), x, y + 2); y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
    doc.text(txt(`Schroeder ${rep.schroeder.toFixed(0)} Hz - Bonello ${rep.bon.pass ? 'pass' : 'fail'} - Bolt area ${rep.bolt.inBolt ? 'inside' : 'outside'} (1 : ${rep.bolt.r1.toFixed(2)} : ${rep.bolt.r2.toFixed(2)})`), x, y); y += 6;
    // table of modes
    const head = ['Hz', 'Type', 'L W H', 'Note'], cw = [16, 24, 18, 18];
    doc.setFillColor(235, 238, 242); doc.rect(x, y - 3.8, cw.reduce((p, q) => p + q, 0) * 2 + 6, 5.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
    for (let col = 0; col < 2; col++) { let xx = x + col * (cw.reduce((p, q) => p + q, 0) + 6) + 1; head.forEach((t, i) => { doc.text(t, xx, y); xx += cw[i]; }); }
    doc.setFont('helvetica', 'normal'); y += 5;
    const list = rep.modes.filter((m) => m.type !== 'oblique').slice(0, 56), rowsPer = Math.ceil(list.length / 2);
    list.forEach((m, i) => {
      const col = Math.floor(i / rowsPer), row = i % rowsPer; let xx = x + col * (cw.reduce((p, q) => p + q, 0) + 6) + 1; const yy = y + row * 3.9;
      if (yy > a.y + a.h * 0.62) return;
      doc.setTextColor(...(m.type === 'axial' ? [190, 40, 60] : [170, 110, 20]));
      [m.f.toFixed(1), m.type, m.n.join(' '), app.noteName(m.f)].forEach((t, k) => { doc.text(String(t), xx, yy); xx += cw[k]; });
    });
    // spectrum strip
    let sy = a.y + a.h * 0.68;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('Modal spectrum (20-300 Hz)', x, sy); sy += 3;
    const sx = (f) => x + ((Math.log(f) - Math.log(20)) / (Math.log(300) - Math.log(20))) * colW, sh = 22;
    doc.setDrawColor(200); doc.rect(x, sy, colW, sh);
    for (const m of rep.modes) { const hh = sh * (m.type === 'axial' ? 0.95 : m.type === 'tangential' ? 0.6 : 0.35); doc.setDrawColor(...(m.type === 'axial' ? [220, 60, 80] : m.type === 'tangential' ? [230, 160, 40] : [90, 140, 230])); doc.line(sx(m.f), sy + sh, sx(m.f), sy + sh - hh); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110);
    for (const f of [20, 30, 50, 80, 100, 150, 200, 300]) doc.text(String(f), sx(f), sy + sh + 3.5, { align: 'center' });
    doc.setDrawColor(40, 160, 110); doc.setLineDashPattern([1, 1], 0); doc.line(sx(Math.min(300, rep.schroeder)), sy, sx(Math.min(300, rep.schroeder)), sy + sh); doc.setLineDashPattern([], 0);
    // right column: response + treatment
    x = a.x + colW + 10; y = a.y + 4;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Simulated bass response at the listening position', x, y + 2); y += 6;
    const rh = 50, rx = (f) => x + 8 + ((Math.log(f) - Math.log(20)) / (Math.log(300) - Math.log(20))) * (colW - 10), ry = (d) => y + ((20 - Math.max(-30, Math.min(20, d))) / 50) * rh;
    doc.setDrawColor(220); doc.setFontSize(6.5); doc.setTextColor(120); doc.setFont('helvetica', 'normal');
    for (const d of [20, 10, 0, -10, -20, -30]) { doc.line(x + 8, ry(d), x + colW - 2, ry(d)); doc.text(String(d), x + 6, ry(d) + 1, { align: 'right' }); }
    for (const f of [20, 50, 100, 200, 300]) doc.text(String(f), rx(f), y + rh + 4, { align: 'center' });
    const plot = (arr, col, w) => { doc.setDrawColor(...col); doc.setLineWidth(w); for (let i = 1; i < arr.length; i++) doc.line(rx(D.fs[i - 1]), ry(arr[i - 1]), rx(D.fs[i]), ry(arr[i])); doc.setLineWidth(0.2); };
    plot(D.bare, [160, 160, 160], 0.3); plot(D.resp, [30, 150, 140], 0.6);
    doc.setFontSize(7); doc.setTextColor(30, 150, 140); doc.text('with treatment', x + colW - 2, y + 3, { align: 'right' }); doc.setTextColor(140); doc.text('bare room', x + colW - 2, y + 7, { align: 'right' });
    y += rh + 10;
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Problem frequencies & where to treat', x, y); y += 5;
    doc.setFontSize(8);
    for (const p of D.treat) {
      if (y > a.y + a.h - 6) break;
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...(p.sev > 1.5 ? [200, 50, 60] : p.sev > 0.8 ? [190, 120, 20] : [60, 90, 140]));
      doc.text(txt(`${p.m.f.toFixed(1)} Hz (${p.note}) - ${p.desc}${p.tags.length ? ' - ' + p.tags.join(', ') : ''}`), x, y); y += 3.6;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
      const ls = doc.splitTextToSize(txt(p.t.how), colW); doc.text(ls, x + 2, y); y += ls.length * 3.4 + 1.6;
    }
  }

  await tick('Saving…');
  doc.save(`${app.safeName()}-design.pdf`);
  app.toast(`PDF exported (${pageNo} pages)`, 'ok');
  app.closeModals();
}

function hexRgb(hex) {
  let h = String(hex || '#888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return Number.isNaN(n) ? [136, 136, 136] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
