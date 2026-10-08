// Crop dialog (docs/17-cases-editor.md §2): a frame of the slot's aspect ratio over the photo; the photo is moved
// by dragging and scaled by pinch / wheel / slider; rule-of-thirds grid. Returns { params: {x,y,w,h} in fractions
// of the source image, blob: JPEG of the cropped area } or null when cancelled.

export function loadBitmap(src) {
  // src: Blob/File or same-origin URL
  if (src instanceof Blob) return createImageBitmap(src);
  return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('image')); im.src = src; });
}

/** Normalises a picked file: decodes it (orientation applied), downsizes to ≤ maxSide, re-encodes as JPEG. */
export async function normaliseFile(file, maxSide = 3000) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Файл больше 20 МБ');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(/heic|heif/i.test(file.type + file.name) ? 'Этот браузер не открывает HEIC. На iPhone выберите фото через «Фото» (оно придёт в JPEG) или сохраните его как JPEG.' : 'Не удалось открыть файл как изображение'); }
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  return { blob, bitmap: c };
}

export function cropDialog({ image, ratio, title, initial, free = false }) {
  return new Promise((resolve) => {
    const iw = image.width, ih = image.height;
    const dlg = document.createElement('div'); dlg.className = 'crop'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
    const head = document.createElement('div'); head.className = 'crop__head';
    const h = document.createElement('p'); h.className = 'crop__title'; h.textContent = title;
    const hint = document.createElement('p'); hint.className = 'crop__hint'; hint.textContent = 'Двигайте фото, масштаб — двумя пальцами, колесом или ползунком';
    head.append(h, hint);
    const stage = document.createElement('div'); stage.className = 'crop__stage';
    const cv = document.createElement('canvas'); cv.className = 'crop__canvas'; stage.append(cv);
    const bar = document.createElement('div'); bar.className = 'crop__bar';
    const zoom = document.createElement('input'); zoom.type = 'range'; zoom.min = '1'; zoom.max = '6'; zoom.step = '0.01'; zoom.value = '1'; zoom.setAttribute('aria-label', 'Масштаб');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn--ghost'; cancel.textContent = 'Отмена';
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn btn--primary'; ok.textContent = 'Применить';
    bar.append(zoom, cancel, ok);
    dlg.append(head, stage, bar); document.body.append(dlg); document.documentElement.classList.add('modal-open');

    const r = free ? iw / ih : ratio;
    // view: frame rect in canvas px; image placed with scale s (screen px per image px) and offset (ox, oy)
    let W = 0, H = 0, fr = { x: 0, y: 0, w: 0, h: 0 }, s = 1, minS = 1, ox = 0, oy = 0; const dpr = Math.min(2, devicePixelRatio || 1);
    function layout() {
      const b = stage.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * dpr; cv.height = H * dpr;
      const pad = 18; const fw = Math.min(W - pad * 2, (H - pad * 2) * r); const fh = fw / r;
      fr = { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
      minS = Math.max(fr.w / iw, fr.h / ih);
    }
    function clamp() {
      s = Math.max(minS, Math.min(minS * 6, s));
      ox = Math.min(fr.x, Math.max(fr.x + fr.w - iw * s, ox)); oy = Math.min(fr.y, Math.max(fr.y + fr.h - ih * s, oy));
      zoom.value = String(s / minS);
    }
    function draw() {
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      c.drawImage(image, ox, oy, iw * s, ih * s);
      c.fillStyle = 'rgba(8,9,11,0.62)';
      c.fillRect(0, 0, W, fr.y); c.fillRect(0, fr.y + fr.h, W, H - fr.y - fr.h); c.fillRect(0, fr.y, fr.x, fr.h); c.fillRect(fr.x + fr.w, fr.y, W - fr.x - fr.w, fr.h);
      c.strokeStyle = 'rgba(242,242,239,0.35)'; c.lineWidth = 1; c.beginPath();
      for (let i = 1; i < 3; i++) { c.moveTo(fr.x + (fr.w * i) / 3, fr.y); c.lineTo(fr.x + (fr.w * i) / 3, fr.y + fr.h); c.moveTo(fr.x, fr.y + (fr.h * i) / 3); c.lineTo(fr.x + fr.w, fr.y + (fr.h * i) / 3); }
      c.stroke(); c.strokeStyle = '#C8FF2E'; c.lineWidth = 2; c.strokeRect(fr.x, fr.y, fr.w, fr.h);
    }
    function init() {
      layout();
      if (initial) { s = fr.w / (initial.w * iw); ox = fr.x - initial.x * iw * s; oy = fr.y - initial.y * ih * s; }
      else { s = minS; ox = fr.x + (fr.w - iw * s) / 2; oy = fr.y + (fr.h - ih * s) / 2; }
      clamp(); draw();
    }
    const zoomAt = (ns, cx, cy) => { const k = ns / s; ox = cx - (cx - ox) * k; oy = cy - (cy - oy) * k; s = ns; clamp(); draw(); };
    const pts = new Map(); let pinch = null;
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s }; } });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const rect = cv.getBoundingClientRect(); zoomAt(pinch.s * (d / pinch.d), (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top); }
      else if (pts.size === 1) { ox += dx; oy += dy; clamp(); draw(); }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const rect = cv.getBoundingClientRect(); zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top); }, { passive: false });
    zoom.addEventListener('input', () => zoomAt(minS * Number(zoom.value), fr.x + fr.w / 2, fr.y + fr.h / 2));
    const onResize = () => { const p = params(); layout(); s = fr.w / (p.w * iw); ox = fr.x - p.x * iw * s; oy = fr.y - p.y * ih * s; clamp(); draw(); };
    addEventListener('resize', onResize);
    function params() { return { x: (fr.x - ox) / s / iw, y: (fr.y - oy) / s / ih, w: fr.w / s / iw, h: fr.h / s / ih }; }
    function close(v) { removeEventListener('resize', onResize); removeEventListener('keydown', onKey); dlg.remove(); document.documentElement.classList.remove('modal-open'); resolve(v); }
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    addEventListener('keydown', onKey);
    cancel.addEventListener('click', () => close(null));
    ok.addEventListener('click', async () => {
      const p = params(); const sw = p.w * iw, sh = p.h * ih;
      const outW = Math.round(Math.min(sw, 2400)); const outH = Math.round(outW * (sh / sw));
      const c = document.createElement('canvas'); c.width = outW; c.height = outH;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, outW, outH);
      g.drawImage(image, p.x * iw, p.y * ih, sw, sh, 0, 0, outW, outH);
      const blob = await new Promise((rr) => c.toBlob(rr, 'image/jpeg', 0.9));
      close({ params: p, blob, preview: c.toDataURL('image/jpeg', 0.8) });
    });
    requestAnimationFrame(init);
  });
}
