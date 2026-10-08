// Drawing library for article covers and in-article figures (docs/16-seo.md §D).
// Pure functions → SVG markup. One visual language with the site: hairlines, a fine coordinate grid, mono labels,
// one accent element. Every motif takes its content from the article (cover.data / a ```figure block) and only lays
// it out; nothing here invents numbers.
//
//   motif(name, data, box, theme) → SVG elements for a box {x, y, w, h}
//   cover({ format, theme, data, motif, fig, rubric, path, title?, brand? }) → a complete <svg>
//   figure({ motif, data, caption }) → <svg> for inside an article (light block, uses CSS variables)

export const DARK = {
  bg: '#08090B', panel: '#0D0F12', fg: '#F2F2EF', muted: '#8C9199', line: 'rgba(242,242,239,0.16)',
  strong: 'rgba(242,242,239,0.42)', grid: 'rgba(242,242,239,0.045)', gridMajor: 'rgba(242,242,239,0.085)',
  accent: '#C8FF2E', accentInk: '#0B0C0E', fill: 'rgba(242,242,239,0.05)',
  mono: "'JetBrains Mono Variable', 'JB', monospace", display: "'Inter Tight Variable', 'IT', sans-serif",
};
// inside articles: follows the block theme through CSS variables
export const INLINE = {
  bg: 'transparent', panel: 'var(--bg-raised)', fg: 'var(--fg)', muted: 'var(--fg-muted)', line: 'var(--line-strong)',
  strong: 'var(--fg)', grid: 'var(--line)', gridMajor: 'var(--line)', accent: 'var(--accent)', accentInk: 'var(--accent-ink)',
  fill: 'var(--bg-sunken)', mono: 'var(--font-mono)', display: 'var(--font-display)',
};

/* ── helpers ── */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n) => Math.round(n * 10) / 10;
export function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>> 0) / 4294967296)); }

/** greedy wrap by an approximate glyph width (em fraction) */
export function wrap(text, maxWidth, size, em = 0.56, maxLines = 4) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  const fits = (s) => s.length * size * em <= maxWidth;
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (fits(t) || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…'; return keep; }
  return lines;
}
function T(th, { x, y, size, text, anchor = 'start', fill, font = 'mono', weight = 400, ls, op }) {
  const ff = font === 'mono' ? th.mono : th.display;
  const style = `font-family:${ff};font-size:${r1(size)}px;font-weight:${weight};fill:${fill ?? th.fg}${ls != null ? `;letter-spacing:${ls}px` : ''}${op != null ? `;opacity:${op}` : ''}`;
  return `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" style="${style}">${esc(text)}</text>`;
}
function TL(th, o, lines, lh) { return lines.map((l, i) => T(th, { ...o, y: o.y + i * lh, text: l })).join(''); }
const L = (th, x1, y1, x2, y2, stroke, w = 1, dash) => `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" style="stroke:${stroke};stroke-width:${w}${dash ? `;stroke-dasharray:${dash}` : ''}"/>`;
const R = (x, y, w, h, { stroke, fill = 'none', sw = 1, rx = 0, dash } = {}) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}" style="fill:${fill};stroke:${stroke ?? 'none'};stroke-width:${sw}${dash ? `;stroke-dasharray:${dash}` : ''}"/>`;
const C = (cx, cy, r, { stroke, fill = 'none', sw = 1 } = {}) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" style="fill:${fill};stroke:${stroke ?? 'none'};stroke-width:${sw}"/>`;
const P = (d, { stroke, fill = 'none', sw = 1, dash } = {}) => `<path d="${d}" style="fill:${fill};stroke:${stroke ?? 'none'};stroke-width:${sw};stroke-linejoin:round;stroke-linecap:round${dash ? `;stroke-dasharray:${dash}` : ''}"/>`;
const pad2 = (n) => String(n).padStart(2, '0');
const num = (v) => (typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.')));
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('ru-RU').replace(/ /g, ' ') : String(v));
const S = (b) => b.s ?? Math.min(b.w / 1000, b.h / 470); // type scale relative to the 16:9 cover's motif area

/* ── motifs ── */
const M = {};

// stages narrowing left→right; widths follow the values when given
M.funnel = (d, b, th, seed) => {
  const st = (d.stages ?? []).slice(0, 7); const n = st.length || 1; const s = S(b);
  const vals = st.map((x) => num(x.value));
  const hasVals = vals.every((v) => Number.isFinite(v) && v > 0);
  const max = hasVals ? Math.max(...vals) : 1;
  const colW = b.w / n; const top = b.y + 30 * s; const hMax = b.h - 120 * s;
  const hs = st.map((_, i) => (hasVals ? Math.max(0.16, Math.sqrt(vals[i] / max)) : 1 - (i / n) * 0.78) * hMax);
  const accent = d.accent ?? (seed % n);
  let o = '';
  st.forEach((x, i) => {
    const cx = b.x + colW * i; const h = hs[i]; const hn = hs[i + 1] ?? h * 0.82;
    const y0 = top + (hMax - h) / 2; const y1 = top + (hMax - hn) / 2;
    const isA = i === accent;
    o += P(`M${r1(cx + 6)} ${r1(y0)} L${r1(cx + colW - 6)} ${r1(y1)} L${r1(cx + colW - 6)} ${r1(y1 + hn)} L${r1(cx + 6)} ${r1(y0 + h)} Z`, { stroke: isA ? th.accent : th.strong, fill: isA ? th.accent : th.fill, sw: 1.2 });
    o += T(th, { x: cx + 6, y: b.y + b.h - 58 * s, size: 15 * s, text: pad2(i + 1), fill: th.muted, ls: 1 });
    o += TL(th, { x: cx + 6, y: b.y + b.h - 34 * s, size: 19 * s, font: 'display', weight: 500, fill: th.fg }, wrap(x.label, colW - 14, 19 * s, 0.55, 2), 22 * s);
    if (x.value != null && x.value !== '') o += T(th, { x: cx + colW / 2, y: y0 + h / 2 + 7 * s, size: 22 * s, anchor: 'middle', text: fmt(x.value), fill: isA ? th.accentInk : th.fg, weight: 500 });
  });
  return o;
};

// bars or a line from the article's worked example
M.chart = (d, b, th, seed) => {
  const s = S(b); const xs = d.x ?? []; const series = (d.series ?? []).slice(0, 3);
  const all = series.flatMap((se) => se.values.map(num)).filter(Number.isFinite);
  const max = Math.max(...all, 0) * 1.15 || 1; const min = Math.min(0, ...all);
  const left = b.x + 70 * s, right = b.x + b.w - 10 * s, top = b.y + 40 * s, bottom = b.y + b.h - 70 * s;
  const H = bottom - top, W = right - left;
  const y = (v) => bottom - ((v - min) / (max - min)) * H;
  let o = '';
  for (let i = 0; i <= 4; i++) {
    const v = min + ((max - min) / 1.15) * (i / 4); const yy = y(v);
    o += L(th, left, yy, right, yy, i === 0 ? th.strong : th.line, 1, i === 0 ? null : '2 6');
    o += T(th, { x: left - 12 * s, y: yy + 5 * s, size: 13 * s, anchor: 'end', text: fmt(Math.round(v * 10) / 10), fill: th.muted });
  }
  if (d.unit) o += T(th, { x: left - 12 * s, y: top - 18 * s, size: 13 * s, anchor: 'end', text: d.unit, fill: th.muted, ls: 1 });
  const n = xs.length || 1; const step = W / n;
  const hl = d.highlight ?? -1;
  if ((d.type ?? 'bar') === 'line') {
    series.forEach((se, k) => {
      const pts = se.values.map((v, i) => [left + step * (i + 0.5), y(num(v))]);
      const acc = k === (d.accentSeries ?? 0);
      o += P('M' + pts.map((p) => p.map(r1).join(' ')).join(' L'), { stroke: acc ? th.accent : th.strong, sw: acc ? 3 : 1.6, dash: acc ? null : '6 6' });
      pts.forEach((p, i) => { o += C(p[0], p[1], (i === hl ? 7 : 4) * s, { fill: acc ? th.accent : th.bg, stroke: acc ? th.accent : th.strong, sw: 1.5 }); });
      o += T(th, { x: pts.at(-1)[0] + 10 * s, y: pts.at(-1)[1] - 10 * s, size: 14 * s, text: se.name ?? '', fill: acc ? th.accent : th.muted, anchor: 'end' });
    });
  } else {
    const k = series.length || 1; const bw = Math.min(64 * s, (step * 0.62) / k);
    series.forEach((se, j) => se.values.forEach((v, i) => {
      const val = num(v); const x0 = left + step * i + (step - bw * k) / 2 + bw * j;
      const acc = i === hl || (hl < 0 && j === 0 && i === se.values.length - 1 && k === 1);
      o += R(x0, y(Math.max(val, 0)), bw - 4 * s, Math.abs(y(val) - y(0)), { fill: acc ? th.accent : j ? th.fill : th.strong, stroke: j ? th.strong : 'none' });
      if (k === 1 && d.labels !== false) o += T(th, { x: x0 + (bw - 4 * s) / 2, y: y(Math.max(val, 0)) - 10 * s, size: 14 * s, anchor: 'middle', text: fmt(v), fill: acc ? th.fg : th.muted });
    }));
    if (k > 1) series.forEach((se, j) => { o += R(right - 220 * s, top - 34 * s + j * 20 * s, 12 * s, 12 * s, { fill: j ? th.fill : th.strong, stroke: th.strong }) + T(th, { x: right - 200 * s, y: top - 23 * s + j * 20 * s, size: 13 * s, text: se.name ?? '', fill: th.muted }); });
  }
  xs.forEach((lab, i) => { o += TL(th, { x: left + step * (i + 0.5), y: bottom + 28 * s, size: 14 * s, anchor: 'middle', fill: th.muted }, wrap(lab, step - 8, 14 * s, 0.6, 2), 17 * s); });
  if (d.xLabel) o += T(th, { x: right, y: b.y + b.h - 4 * s, size: 13 * s, anchor: 'end', text: d.xLabel, fill: th.muted, ls: 1 });
  return o;
};

// 2×2 with axes, or a comparison table
M.matrix = (d, b, th, seed) => {
  const s = S(b); let o = '';
  if (d.kind === 'table' || d.columns) {
    const cols = d.columns ?? []; const rows = (d.rows ?? []).slice(0, 7); const nc = cols.length || 1;
    const first = Math.min(0.34, 1.6 / nc); const cw0 = b.w * first; const cw = (b.w - cw0) / Math.max(1, nc - 1);
    const rh = Math.min(70 * s, (b.h - 60 * s) / (rows.length + 1)); const accCol = d.accent ?? (nc > 2 ? 1 + (seed % (nc - 1)) : 1);
    const colX = (j) => (j === 0 ? b.x : b.x + cw0 + cw * (j - 1));
    if (accCol < nc) o += R(colX(accCol), b.y, cw, rh * (rows.length + 1), { stroke: th.accent, sw: 2 });
    cols.forEach((c, j) => { o += TL(th, { x: colX(j) + 14 * s, y: b.y + rh / 2 - 2 * s, size: 15 * s, fill: j === accCol ? th.accent : th.muted, ls: 0.6 }, wrap(String(c).toUpperCase(), (j ? cw : cw0) - 20 * s, 15 * s, 0.62, 2), 17 * s); });
    o += L(th, b.x, b.y + rh, b.x + b.w, b.y + rh, th.strong);
    rows.forEach((r, i) => {
      const yy = b.y + rh * (i + 1);
      o += L(th, b.x, yy + rh, b.x + b.w, yy + rh, th.line);
      r.slice(0, nc).forEach((cell, j) => {
        const v = String(cell);
        if (v === '+' || v === '✓') o += P(`M${r1(colX(j) + 18 * s)} ${r1(yy + rh / 2)} l${r1(7 * s)} ${r1(7 * s)} l${r1(14 * s)} ${r1(-15 * s)}`, { stroke: j === accCol ? th.accent : th.fg, sw: 2.4 });
        else if (v === '−' || v === '-') o += L(th, colX(j) + 18 * s, yy + rh / 2, colX(j) + 36 * s, yy + rh / 2, th.muted, 2);
        else o += TL(th, { x: colX(j) + 14 * s, y: yy + rh / 2 + 6 * s - (wrap(v, (j ? cw : cw0) - 24 * s, 17 * s, 0.55, 2).length - 1) * 10 * s, size: 17 * s, font: j ? 'mono' : 'display', weight: j ? 400 : 500, fill: j === 0 ? th.fg : th.muted }, wrap(v, (j ? cw : cw0) - 24 * s, 17 * s, j ? 0.6 : 0.55, 2), 20 * s);
      });
    });
    for (let j = 1; j < nc; j++) o += L(th, colX(j), b.y, colX(j), b.y + rh * (rows.length + 1), th.line);
    return o;
  }
  // 2×2
  const cells = (d.cells ?? []).slice(0, 4); const acc = d.accent ?? (seed % 4);
  const ax = b.x + 40 * s, ay = b.y + 10 * s, aw = b.w - 50 * s, ah = b.h - 60 * s; const cw = aw / 2, ch = ah / 2;
  o += L(th, ax, ay + ah, ax + aw, ay + ah, th.strong, 1.4) + L(th, ax, ay, ax, ay + ah, th.strong, 1.4);
  o += P(`M${r1(ax + aw - 10 * s)} ${r1(ay + ah - 6 * s)} l${r1(10 * s)} ${r1(6 * s)} l${r1(-10 * s)} ${r1(6 * s)}`, { stroke: th.strong, sw: 1.4 });
  o += P(`M${r1(ax - 6 * s)} ${r1(ay + 10 * s)} l${r1(6 * s)} ${r1(-10 * s)} l${r1(6 * s)} ${r1(10 * s)}`, { stroke: th.strong, sw: 1.4 });
  o += L(th, ax + cw, ay, ax + cw, ay + ah, th.line, 1, '3 7') + L(th, ax, ay + ch, ax + aw, ay + ch, th.line, 1, '3 7');
  if (d.xAxis) o += T(th, { x: ax + aw, y: ay + ah + 32 * s, size: 14 * s, anchor: 'end', text: `${d.xAxis} →`.toUpperCase(), fill: th.muted, ls: 1 });
  if (d.yAxis) o += `<g transform="translate(${r1(ax - 18 * s)} ${r1(ay)}) rotate(-90)">${T(th, { x: 0, y: 0, size: 14 * s, anchor: 'end', text: `${d.yAxis} →`.toUpperCase(), fill: th.muted, ls: 1 })}</g>`;
  const pos = [[0, 0], [1, 0], [0, 1], [1, 1]];
  cells.forEach((c, i) => {
    const [cx, cy] = pos[i]; const x0 = ax + cw * cx + 18 * s, y0 = ay + ch * cy + 18 * s;
    const isA = i === acc;
    if (isA) o += R(ax + cw * cx + 8 * s, ay + ch * cy + 8 * s, cw - 16 * s, ch - 16 * s, { fill: th.accent, rx: 6 });
    const title = typeof c === 'string' ? c : c.title; const note = typeof c === 'string' ? '' : c.note;
    o += T(th, { x: x0, y: y0 + 16 * s, size: 14 * s, text: pad2(i + 1), fill: isA ? th.accentInk : th.muted, ls: 1 });
    o += TL(th, { x: x0, y: y0 + 50 * s, size: 26 * s, font: 'display', weight: 600, fill: isA ? th.accentInk : th.fg }, wrap(title, cw - 40 * s, 26 * s, 0.55, 2), 30 * s);
    if (note) o += TL(th, { x: x0, y: y0 + 50 * s + wrap(title, cw - 40 * s, 26 * s, 0.55, 2).length * 30 * s + 6 * s, size: 15 * s, fill: isA ? th.accentInk : th.muted }, wrap(note, cw - 40 * s, 15 * s, 0.6, 3), 19 * s);
  });
  return o;
};

// steps as blocks in rows, connected by arrows (snake order)
M.flow = (d, b, th, seed) => {
  const st = (d.steps ?? []).slice(0, 10); const n = st.length || 1; const s = S(b);
  const perRow = n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : 5; const rows = Math.ceil(n / perRow);
  const gx = 40 * s, gy = 46 * s; const bw = (b.w - gx * (perRow - 1)) / perRow; const bh = Math.min(150 * s, (b.h - gy * (rows - 1)) / rows);
  const oy = b.y + (b.h - (bh * rows + gy * (rows - 1))) / 2;
  const acc = d.accent ?? (seed % n); let o = '';
  const at = (i) => { const r = Math.floor(i / perRow); let c = i % perRow; if (r % 2 === 1) c = perRow - 1 - c; return [b.x + c * (bw + gx), oy + r * (bh + gy), r]; };
  st.forEach((label, i) => {
    const [x, y] = at(i); const isA = i === acc;
    o += R(x, y, bw, bh, { stroke: isA ? th.accent : th.strong, fill: isA ? th.accent : th.panel, sw: 1.2, rx: 8 });
    o += T(th, { x: x + 16 * s, y: y + 28 * s, size: 14 * s, text: `${pad2(i + 1)}`, fill: isA ? th.accentInk : th.muted, ls: 1 });
    o += TL(th, { x: x + 16 * s, y: y + 62 * s, size: 21 * s, font: 'display', weight: 500, fill: isA ? th.accentInk : th.fg }, wrap(typeof label === 'string' ? label : label.label, bw - 30 * s, 21 * s, 0.54, Math.max(1, Math.floor((bh - 60 * s) / (25 * s)))), 25 * s);
    if (i < n - 1) {
      const [x2, y2, r2] = at(i + 1); const [, , r] = at(i);
      if (r2 === r) { const goingRight = x2 > x; const sx = goingRight ? x + bw : x; const ex = goingRight ? x2 : x2 + bw; const yy = y + bh / 2;
        o += L(th, sx + 4 * s, yy, ex - 6 * s, yy, th.strong, 1.4) + P(`M${r1(ex - 14 * s)} ${r1(yy - 6 * s)} L${r1(ex - 5 * s)} ${r1(yy)} L${r1(ex - 14 * s)} ${r1(yy + 6 * s)}`.replace(/L(\S+) (\S+) L/, goingRight ? 'L$1 $2 L' : 'L$1 $2 L'), { stroke: th.strong, sw: 1.4 });
      } else { const xx = x + bw / 2; o += L(th, xx, y + bh + 4 * s, xx, y2 - 6 * s, th.strong, 1.4) + P(`M${r1(xx - 6 * s)} ${r1(y2 - 14 * s)} L${r1(xx)} ${r1(y2 - 5 * s)} L${r1(xx + 6 * s)} ${r1(y2 - 14 * s)}`, { stroke: th.strong, sw: 1.4 }); }
    }
  });
  return o;
};

// Gantt-like scale: items with spans over units
M.timeline = (d, b, th, seed) => {
  const items = (d.items ?? []).slice(0, 8); const s = S(b);
  // span: [first, last] unit numbers from 1, inclusive
  const total = d.total ?? Math.max(...items.map((it) => (it.span ? it.span[1] : 0)), items.length);
  const labW = Math.min(b.w * 0.36, 380 * s); const left = b.x + labW, right = b.x + b.w; const W = right - left;
  const rh = Math.min(64 * s, (b.h - 70 * s) / items.length); const top = b.y + 50 * s;
  let o = ''; const acc = d.accent ?? (seed % items.length);
  for (let u = 0; u <= total; u++) {
    const x = left + (W * u) / total;
    o += L(th, x, top - 18 * s, x, top + rh * items.length, u === 0 || u === total ? th.strong : th.line, 1, u === 0 || u === total ? null : '2 6');
    if (u < total && (total <= 16 || u % 2 === 0)) o += T(th, { x: x + (W / total) / 2, y: top - 26 * s, size: 13 * s, anchor: 'middle', text: `${d.unitShort ?? ''}${u + 1}`, fill: th.muted });
  }
  if (d.unit) o += T(th, { x: b.x, y: top - 26 * s, size: 13 * s, text: String(d.unit).toUpperCase(), fill: th.muted, ls: 1 });
  items.forEach((it, i) => {
    const y = top + rh * i; const [s0, s1] = it.span ?? [i + 1, i + 1]; const a = Math.max(0, s0 - 1), z = Math.max(s0, s1); const isA = i === acc;
    o += L(th, b.x, y + rh, right, y + rh, th.line);
    o += TL(th, { x: b.x, y: y + rh / 2 + 7 * s, size: 18 * s, font: 'display', weight: 500, fill: th.fg }, wrap(it.label, labW - 20 * s, 18 * s, 0.54, 1), 20 * s);
    o += R(left + (W * a) / total + 3 * s, y + rh * 0.26, (W * (z - a)) / total - 6 * s, rh * 0.48, { fill: isA ? th.accent : th.fill, stroke: isA ? th.accent : th.strong, rx: 4 });
    if (it.note) o += T(th, { x: left + (W * a) / total + 12 * s, y: y + rh / 2 + 5 * s, size: 13 * s, text: it.note, fill: isA ? th.accentInk : th.muted });
  });
  return o;
};

// a drawing sheet with ticked items
M.checklist = (d, b, th, seed) => {
  const items = (d.items ?? []).slice(0, 7); const s = S(b); const checked = d.checked ?? Math.ceil(items.length * 0.6);
  // layout variants by seed: sheet width and position differ between articles
  const v = seed % 3; const sw = Math.min(b.w, [900, 760, 1040][v] * s);
  const x0 = b.x + [(b.w - sw) / 2, 0, b.w - sw][(seed >>> 3) % 3]; const rh = Math.min([70, 62, 76][(seed >>> 5) % 3] * s, (b.h - 30 * s) / items.length);
  let o = R(x0, b.y, sw, rh * items.length + 24 * s, { stroke: th.strong, fill: th.panel, rx: 6 });
  o += L(th, x0 + 74 * s, b.y, x0 + 74 * s, b.y + rh * items.length + 24 * s, th.line);
  items.forEach((it, i) => {
    const y = b.y + 12 * s + rh * i; const on = i < checked;
    if (i) o += L(th, x0, y, x0 + sw, y, th.line, 1, '2 6');
    o += R(x0 + 26 * s, y + rh / 2 - 12 * s, 24 * s, 24 * s, { stroke: on ? th.accent : th.strong, fill: on ? th.accent : 'none', sw: 1.4, rx: 3 });
    if (on) o += P(`M${r1(x0 + 31 * s)} ${r1(y + rh / 2)} l${r1(5 * s)} ${r1(6 * s)} l${r1(10 * s)} ${r1(-12 * s)}`, { stroke: th.accentInk, sw: 2.6 });
    o += T(th, { x: x0 + 92 * s, y: y + rh / 2 - 8 * s, size: 12 * s, text: pad2(i + 1), fill: th.muted, ls: 1 });
    o += T(th, { x: x0 + 92 * s, y: y + rh / 2 + 15 * s, size: 21 * s, font: 'display', weight: 500, text: wrap(it, sw - 120 * s, 21 * s, 0.53, 1)[0], fill: on ? th.fg : th.muted });
  });
  return o;
};

// a document page with numbered sections
M.document = (d, b, th, seed) => {
  const secs = (d.sections ?? []).slice(0, 8); const s = S(b);
  const pw = Math.min(b.w * 0.62, 760 * s); const x0 = b.x + (b.w - pw) / 2 + (seed % 2 ? 60 : -60) * s;
  let o = R(x0 + 18 * s, b.y + 14 * s, pw, b.h - 14 * s, { stroke: th.line, fill: 'none', rx: 4 });
  o += R(x0, b.y, pw, b.h - 14 * s, { stroke: th.strong, fill: th.panel, rx: 4 });
  o += P(`M${r1(x0 + pw - 46 * s)} ${r1(b.y)} L${r1(x0 + pw)} ${r1(b.y + 46 * s)}`, { stroke: th.strong });
  o += T(th, { x: x0 + 34 * s, y: b.y + 48 * s, size: 13 * s, text: (d.kicker ?? 'DOC').toUpperCase(), fill: th.muted, ls: 1.4 });
  o += TL(th, { x: x0 + 34 * s, y: b.y + 86 * s, size: 28 * s, font: 'display', weight: 600, fill: th.fg }, wrap(d.title ?? '', pw - 90 * s, 28 * s, 0.55, 2), 32 * s);
  const startY = b.y + 86 * s + wrap(d.title ?? '', pw - 90 * s, 28 * s, 0.55, 2).length * 32 * s + 10 * s;
  const rh = Math.min(48 * s, (b.y + b.h - 40 * s - startY) / Math.max(1, secs.length)); const acc = d.accent ?? (seed % Math.max(1, secs.length));
  secs.forEach((sec, i) => {
    const y = startY + rh * i;
    if (i === acc) o += R(x0 + 22 * s, y - 2 * s, pw - 44 * s, rh - 4 * s, { fill: th.accent, rx: 3 });
    o += T(th, { x: x0 + 34 * s, y: y + rh / 2 + 4 * s, size: 14 * s, text: `${i + 1}.`, fill: i === acc ? th.accentInk : th.muted });
    o += T(th, { x: x0 + 66 * s, y: y + rh / 2 + 5 * s, size: 18 * s, font: 'display', weight: 500, text: wrap(sec, pw - 220 * s, 18 * s, 0.54, 1)[0], fill: i === acc ? th.accentInk : th.fg });
    o += L(th, x0 + pw - 140 * s, y + rh / 2, x0 + pw - 34 * s, y + rh / 2, i === acc ? th.accentInk : th.line, 3 * s);
  });
  return o;
};

// hub and spokes (or explicit edges)
M.network = (d, b, th, seed) => {
  const nodes = (d.nodes ?? []).slice(0, 10); const s = S(b); const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const rx = b.w * 0.39, ry = b.h * 0.38; const rot = ((seed % 360) * Math.PI) / 180;
  const pos = nodes.map((_, i) => { const a = rot + (i / nodes.length) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  let o = '';
  o += `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" style="fill:none;stroke:${th.line};stroke-dasharray:2 8"/>`;
  const edges = d.edges ?? [];
  edges.forEach(([a, z]) => { if (pos[a] && pos[z]) o += L(th, pos[a][0], pos[a][1], pos[z][0], pos[z][1], th.line, 1, '4 6'); });
  const acc = d.accent ?? (seed % nodes.length);
  pos.forEach(([x, y], i) => o += L(th, cx, cy, x, y, i === acc ? th.accent : th.strong, i === acc ? 2.4 : 1.1));
  const hubW = Math.min(300 * s, Math.max(160 * s, (d.center ?? '').length * 14 * s + 50 * s));
  o += R(cx - hubW / 2, cy - 34 * s, hubW, 68 * s, { fill: th.bg === 'transparent' ? th.panel : th.bg, stroke: th.fg, sw: 1.4, rx: 34 * s });
  o += T(th, { x: cx, y: cy + 8 * s, size: 22 * s, anchor: 'middle', font: 'display', weight: 600, text: d.center ?? '', fill: th.fg });
  pos.forEach(([x, y], i) => {
    const isA = i === acc; const label = nodes[i]; const tw = Math.min(260 * s, label.length * 10.5 * s + 34 * s);
    o += R(x - tw / 2, y - 22 * s, tw, 44 * s, { fill: isA ? th.accent : th.panel, stroke: isA ? th.accent : th.strong, rx: 6 });
    o += T(th, { x, y: y + 6 * s, size: 17 * s, anchor: 'middle', text: wrap(label, tw - 16 * s, 17 * s, 0.6, 1)[0], fill: isA ? th.accentInk : th.fg });
  });
  return o;
};

// frames of different aspect ratios, labelled
M.grid = (d, b, th, seed) => {
  const fr = (d.frames ?? []).slice(0, 6); const s = S(b);
  const ratio = (r) => { const [w, h] = String(r ?? '1:1').split(':').map(Number); return w / h; };
  const H = b.h - 70 * s; const gap = 30 * s;
  let widths = fr.map((f) => H * ratio(f.ratio)); const tot = widths.reduce((a, c) => a + c, 0) + gap * (fr.length - 1);
  const k = Math.min(1, b.w / tot); widths = widths.map((w) => w * k); const h = H * k;
  let x = b.x + (b.w - (widths.reduce((a, c) => a + c, 0) + gap * (fr.length - 1))) / 2; const y = b.y + (H - h) / 2;
  const acc = d.accent ?? (seed % fr.length); let o = '';
  fr.forEach((f, i) => {
    const w = widths[i]; const isA = i === acc;
    o += R(x, y, w, h, { stroke: isA ? th.accent : th.strong, fill: isA ? th.accent : th.panel, sw: 1.2, rx: 8 });
    // safe zones / composition guides
    o += L(th, x + w / 3, y + 8 * s, x + w / 3, y + h - 8 * s, isA ? 'rgba(11,12,14,0.25)' : th.line, 1, '2 6') + L(th, x + (2 * w) / 3, y + 8 * s, x + (2 * w) / 3, y + h - 8 * s, isA ? 'rgba(11,12,14,0.25)' : th.line, 1, '2 6');
    o += L(th, x + 8 * s, y + h / 3, x + w - 8 * s, y + h / 3, isA ? 'rgba(11,12,14,0.25)' : th.line, 1, '2 6') + L(th, x + 8 * s, y + (2 * h) / 3, x + w - 8 * s, y + (2 * h) / 3, isA ? 'rgba(11,12,14,0.25)' : th.line, 1, '2 6');
    o += T(th, { x: x + 14 * s, y: y + 28 * s, size: 14 * s, text: f.ratio ?? '', fill: isA ? th.accentInk : th.muted, ls: 1 });
    if (f.note) o += TL(th, { x: x + 14 * s, y: y + h - 18 * s - (wrap(f.note, w - 24 * s, 13 * s, 0.6, 3).length - 1) * 16 * s, size: 13 * s, fill: isA ? th.accentInk : th.muted }, wrap(f.note, w - 24 * s, 13 * s, 0.6, 3), 16 * s);
    o += TL(th, { x: x + w / 2, y: y + h + 32 * s, size: 17 * s, anchor: 'middle', font: 'display', weight: 500, fill: th.fg }, wrap(f.label, w + gap - 6 * s, 17 * s, 0.55, 2), 20 * s);
    x += w + gap;
  });
  return o;
};

// dot map of Kazakhstan: cities by real coordinates (lon/lat → plane), country outline as a dot field
const CITIES = {
  'Алматы': [76.95, 43.24], 'Астана': [71.43, 51.13], 'Шымкент': [69.6, 42.32], 'Караганда': [73.1, 49.8], 'Актобе': [57.17, 50.28],
  'Тараз': [71.37, 42.9], 'Павлодар': [76.97, 52.29], 'Усть-Каменогорск': [82.61, 49.95], 'Семей': [80.23, 50.41], 'Атырау': [51.92, 47.11],
  'Костанай': [63.62, 53.21], 'Кызылорда': [65.5, 44.85], 'Уральск': [51.37, 51.23], 'Петропавловск': [69.15, 54.87], 'Актау': [51.2, 43.65],
  'Туркестан': [68.25, 43.3], 'Талдыкорган': [78.37, 45.02], 'Кокшетау': [69.39, 53.28], 'Экибастуз': [75.32, 51.72], 'Жезказган': [67.71, 47.78],
};
// coarse outline polygon (lon, lat) used only to decide which grid dots are «inside»
const KZ = [[46.5, 48.5], [49.0, 46.4], [50.3, 44.6], [52.8, 41.8], [55.9, 41.3], [58.5, 45.6], [61.0, 44.4], [62.5, 43.5], [64.9, 43.7], [66.0, 42.0], [68.4, 40.6], [70.9, 42.2], [74.2, 42.9], [79.2, 42.8], [80.3, 45.0], [82.6, 45.2], [83.0, 47.2], [85.6, 47.1], [87.3, 49.1], [84.9, 50.3], [83.4, 51.0], [80.6, 51.0], [77.8, 53.3], [76.5, 54.0], [73.4, 53.5], [70.8, 55.1], [68.6, 54.9], [65.2, 54.6], [61.6, 54.0], [60.9, 51.0], [55.7, 50.6], [52.4, 51.8], [50.8, 51.6], [48.6, 50.0], [47.0, 49.9]];
function inside([x, y], poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
M.map = (d, b, th, seed) => {
  const s = S(b); const lon0 = 46, lon1 = 88, lat0 = 40.3, lat1 = 55.6;
  const k = Math.min(b.w / (lon1 - lon0), (b.h - 20 * s) / ((lat1 - lat0) * 1.45));
  const ox = b.x + (b.w - (lon1 - lon0) * k) / 2, oy = b.y + 10 * s;
  const P2 = ([lo, la]) => [ox + (lo - lon0) * k, oy + (lat1 - la) * k * 1.45];
  let o = ''; const step = 0.85;
  for (let la = lat0; la <= lat1; la += step * 0.7) for (let lo = lon0; lo <= lon1; lo += step) {
    if (!inside([lo, la], KZ)) continue; const [x, y] = P2([lo, la]); o += C(x, y, 1.8 * s, { fill: th.strong });
  }
  const pts = (d.points ?? []).filter((p) => CITIES[p.city]); const acc = d.accent ?? 0;
  pts.forEach((p, i) => {
    const [x, y] = P2(CITIES[p.city]); const isA = i === acc;
    if (isA) o += C(x, y, 26 * s, { stroke: th.accent, sw: 1.2 }) + C(x, y, 44 * s, { stroke: th.accent, sw: 0.8 });
    o += C(x, y, (isA ? 9 : 6) * s, { fill: isA ? th.accent : th.fg });
    const dx = p.dx ?? (x > b.x + b.w * 0.7 ? -1 : 1);
    o += L(th, x + dx * 10 * s, y, x + dx * 46 * s, y - 26 * s, isA ? th.accent : th.strong);
    o += T(th, { x: x + dx * 52 * s, y: y - 30 * s, size: 18 * s, anchor: dx < 0 ? 'end' : 'start', font: 'display', weight: 600, text: p.city, fill: th.fg });
    if (p.note) o += T(th, { x: x + dx * 52 * s, y: y - 10 * s, size: 13 * s, anchor: dx < 0 ? 'end' : 'start', text: p.note, fill: th.muted });
  });
  return o;
};

// KPI tiles; values only if the article gives them, otherwise a neutral axis
M.dashboard = (d, b, th, seed) => {
  const k = (d.kpis ?? []).slice(0, 8); const s = S(b); const n = k.length || 1;
  const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4; const rows = Math.ceil(n / cols); const g = 22 * s;
  const tw = (b.w - g * (cols - 1)) / cols, tht = (b.h - g * (rows - 1)) / rows; const acc = d.accent ?? (seed % n); const rnd = rng(seed);
  let o = '';
  k.forEach((kp, i) => {
    const x = b.x + (i % cols) * (tw + g), y = b.y + Math.floor(i / cols) * (tht + g); const isA = i === acc;
    o += R(x, y, tw, tht, { stroke: isA ? th.accent : th.strong, fill: th.panel, rx: 8, sw: isA ? 2 : 1 });
    o += T(th, { x: x + 18 * s, y: y + 30 * s, size: 13 * s, text: pad2(i + 1), fill: th.muted, ls: 1 });
    o += TL(th, { x: x + 18 * s, y: y + 60 * s, size: 19 * s, font: 'display', weight: 500, fill: th.fg }, wrap(kp.label, tw - 36 * s, 19 * s, 0.54, 2), 22 * s);
    if (kp.value != null) o += T(th, { x: x + 18 * s, y: y + tht - 22 * s, size: 30 * s, font: 'display', weight: 600, text: fmt(kp.value), fill: isA ? th.accent : th.fg });
    // weekly cadence axis: 12 ticks, the current week marked
    const ax = x + (kp.value != null ? tw * 0.5 : 18 * s), aw = x + tw - 18 * s - ax, ay = y + tht - 26 * s;
    o += L(th, ax, ay, ax + aw, ay, th.line);
    for (let w = 0; w < 12; w++) { const hh = (6 + rnd() * 18) * s * (kp.trend === 'down' ? 1 - w / 16 : 0.5 + w / 22); o += L(th, ax + (aw * (w + 0.5)) / 12, ay, ax + (aw * (w + 0.5)) / 12, ay - hh, w === 11 && isA ? th.accent : th.strong, 3 * s); }
  });
  return o;
};

export const motifs = Object.keys(M);
export function motif(name, data, box, theme = DARK, seed = 0) {
  if (!M[name]) throw new Error(`unknown motif ${name}`);
  return M[name](data ?? {}, box, theme, seed);
}

/* ── composition ── */
function gridLines(th, w, h, step, ox = 0, oy = 0) {
  let o = '';
  for (let x = ox % step; x <= w; x += step) o += L(th, x, 0, x, h, Math.round((x - ox) / step) % 5 === 0 ? th.gridMajor : th.grid);
  for (let y = oy % step; y <= h; y += step) o += L(th, 0, y, w, y, Math.round((y - oy) / step) % 5 === 0 ? th.gridMajor : th.grid);
  return o;
}
function windowFrame(th, x, y, w, h, s, path, fig) {
  let o = R(x, y, w, h, { stroke: th.line, fill: th.panel, rx: 18 * s, sw: 1.2 });
  o += L(th, x, y + 52 * s, x + w, y + 52 * s, th.line);
  for (let i = 0; i < 3; i++) o += C(x + 28 * s + i * 20 * s, y + 26 * s, 5.5 * s, { stroke: th.strong, sw: 1.2 });
  o += T(th, { x: x + 108 * s, y: y + 32 * s, size: 15 * s, text: path, fill: th.muted, ls: 0.6 });
  o += T(th, { x: x + w - 26 * s, y: y + 32 * s, size: 15 * s, anchor: 'end', text: fig, fill: th.muted, ls: 1.2 });
  return o;
}
const SIZES = { '16x9': [1600, 900], '4x3': [1200, 900], '1x1': [800, 800], og: [1200, 630] };

/** A complete cover SVG. */
export function cover({ format = '16x9', motif: m, data, fig, rubric, path, title, seed = 0, brandMark = '' }) {
  const th = DARK; const [W, H] = SIZES[format]; const s = format === '1x1' ? 0.62 : format === 'og' ? 0.72 : format === '4x3' ? 0.86 : 1;
  const rnd = rng(seed); const step = 40 * s; const ox = Math.floor(rnd() * 5) * step / 5, oy = Math.floor(rnd() * 5) * step / 5;
  let o = R(0, 0, W, H, { fill: th.bg });
  o += gridLines(th, W, H, step, ox, oy);
  if (format === 'og') {
    const wx = 560, wy = 60, ww = 580, wh = 510;
    o += windowFrame(th, wx, wy, ww, wh, 0.62, path, fig);
    o += `<g>${motif(m, data, { x: wx + 34, y: wy + 66, w: ww - 68, h: wh - 100 }, th, seed)}</g>`;
    o += T(th, { x: 64, y: 96, size: 17, text: rubric.toUpperCase(), fill: th.accent, ls: 1.6 });
    const lines = wrap(title, 440, 46, 0.52, 6);
    o += TL(th, { x: 64, y: 168, size: 46, font: 'display', weight: 600, fill: th.fg, ls: -0.8 }, lines, 54);
    o += brandMark ? `<g transform="translate(64 522)">${brandMark}</g>` : '';
    o += T(th, { x: 64, y: 590, size: 15, text: 'cybermove.asia / разборы', fill: th.muted, ls: 1 });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${o}</svg>`;
  }
  const pad = format === '1x1' ? 36 : 80 * s; const wx = pad, wy = pad, ww = W - pad * 2, wh = H - pad * 2;
  o += windowFrame(th, wx, wy, ww, wh, s, path, fig);
  const inner = { x: wx + 60 * s, y: wy + 52 * s + 54 * s, w: ww - 120 * s, h: wh - 52 * s - 54 * s - 74 * s };
  // composition varies by article: the motif area is narrowed and shifted (keeps covers of one motif distinguishable)
  const kw = [1, 0.84, 0.74, 0.92][seed % 4]; const kh = [1, 0.9, 1, 0.86][(seed >>> 2) % 4];
  const al = [0.5, 0, 1][(seed >>> 4) % 3];
  const box = { x: inner.x + (inner.w * (1 - kw)) * al, y: inner.y + (inner.h * (1 - kh)) / 2, w: inner.w * kw, h: inner.h * kh };
  o += motif(m, data, box, th, seed);
  o += L(th, wx, wy + wh - 54 * s, wx + ww, wy + wh - 54 * s, th.line);
  o += T(th, { x: wx + 26 * s, y: wy + wh - 21 * s, size: 15 * s, text: rubric.toUpperCase(), fill: th.muted, ls: 1.4 });
  o += T(th, { x: wx + ww - 26 * s, y: wy + wh - 21 * s, size: 15 * s, anchor: 'end', text: 'CHAOS → CORE → SYSTEM → GROWTH', fill: th.muted, ls: 1 });
  o += R(wx + 26 * s, wy + wh - 54 * s - 1, 64 * s, 3, { fill: th.accent });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${o}</svg>`;
}

/** In-article figure: responsive SVG, colours from the block theme. */
// the type is set larger than on covers: the figure is read on a phone at ~350 px wide
export function figure({ motif: m, data, caption = '', seed = 0, ratio = 0.62, width = 760, scale = 1.05 }) {
  const W = width, H = Math.round(W * ratio);
  const th = INLINE;
  const body = motif(m, data, { x: 12, y: 16, w: W - 24, h: H - 32, s: scale }, th, seed);
  return `<figure class="afig"><svg class="afig__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(caption)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>${caption ? `<figcaption class="label muted">${esc(caption)}</figcaption>` : ''}</figure>`;
}
