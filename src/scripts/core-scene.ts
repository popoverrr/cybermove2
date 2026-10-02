// CORE scene (docs/14-rework.md §3, simplified per docs/15-stabilize.md §5).
// A calm instrument: three concentric rings in close planes (≤ 12° apart) under a fixed ~65° tilt, the whole system
// turns about the vertical axis like a flywheel and sways ±4°. The core — a wireframe sphere with an inner figure —
// is large; «CORE», the drawing notes and the node labels are HTML (no text drawn per frame). Labels sit in fixed
// slots (two columns); a thin elbow leader follows each node. Static layers (floor grid, core limb) are rendered once
// to offscreen canvases. Performance: DPR ≤ 1.5 on phones, no gradients/shadows per frame, half rate while the page
// scrolls, automatic simplification, the loop stops completely off-screen / in a hidden tab.

import { subscribeScroll } from './core/scroll';

type V3 = [number, number, number];
interface Node { id: string; label: string; ring: number; theta: number; sys: boolean; index?: string; href?: string; name?: string; slot?: number; side?: number }

const TAU = Math.PI * 2;
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const basis = (n: V3): [V3, V3] => { const a: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = norm(cross(a, n)); return [u, cross(n, u)]; };
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export function initCoreScene(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = JSON.parse(root.querySelector('[data-scene-nodes]')!.textContent || '{}') as { nodes: Node[] };
  const nodes = data.nodes;
  const labels = new Map([...root.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => [el.dataset.slot!, el]));
  const pick = root.querySelector<HTMLAnchorElement>('[data-scene-pick]');
  const tip = root.querySelector<HTMLElement>('[data-scene-tip]');
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const phone = window.matchMedia('(max-width: 767px)');

  /* geometry: concentric rings in close planes */
  const rings = [
    { r: 0.72, n: norm([0.08, 1, 0.1]), spin: 0, speed: -0.05, ticks: false },  // 0 core composition
    { r: 1.0, n: norm([0, 1, 0]), spin: 0, speed: 0.03, ticks: false },           // 1 system
    { r: 1.12, n: norm([-0.1, 1, -0.12]), spin: 0, speed: 0.012, ticks: true },  // 2 outer limb with graduations
  ].map((g) => { const [u, v] = basis(g.n); return { ...g, u, v }; });
  const R0 = 0.54; // core sphere: ~23 % of the scene width on a phone

  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dust: V3[] = Array.from({ length: 24 }, () => [rnd() * 3 - 1.5, rnd() * 1.6 - 0.8, rnd() * 3 - 1.5]);

  /* state */
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, F = 0, mono = 'ui-monospace, monospace';
  let col = { fg: '#f2f2ef', muted: '#8c9199', accent: '#c8ff2e' };
  const D = 3.6, PITCH = 0.45; // fixed tilt: rings read as ellipses ~0.44 high (the CSS placeholder matches)
  let yaw = 0.5, vel = 0.06, time = 0, sway = 0;
  let selected = -1, hover = -1, selTimer = 0;
  let running = false, inView = false, frameNo = 0;
  let scrollNow = window.scrollY, scrollPrev = scrollNow, lastScrollAt = 0;
  let level = 0; // 0 full, 1 lighter (no dust, no ticks), 2 static
  let avg = 16, avgN = 0, avgT0 = 0;
  const floorLayer = document.createElement('canvas');
  const limbLayer = document.createElement('canvas');

  function readStyle() {
    const cs = getComputedStyle(root);
    const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    mono = g('--font-mono', mono);
    col = { fg: g('--fg', col.fg), muted: g('--fg-muted', col.muted), accent: g('--accent', col.accent) };
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(phone.matches ? 1.5 : 2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cx = W / 2; cy = H * 0.52;
    F = Math.min(W * (phone.matches ? 0.76 : 0.7), H * 1.5);
    readStyle();
    buildLayers();
    layoutSlots();
  }

  /* projection: yaw about Y, fixed tilt + sway about X */
  let cY = 1, sY = 0, cP = 1, sP = 0;
  const setView = () => { cY = Math.cos(yaw); sY = Math.sin(yaw); const p = PITCH + sway; cP = Math.cos(p); sP = Math.sin(p); };
  function proj(p: V3): [number, number, number] {
    const x1 = p[0] * cY + p[2] * sY, z1 = -p[0] * sY + p[2] * cY;
    const y2 = p[1] * cP - z1 * sP, z2 = p[1] * sP + z1 * cP;
    const k = F / (D - z2);
    return [cx + x1 * k, cy - y2 * k, z2];
  }
  const ringPt = (g: typeof rings[number], th: number, rr = g.r): V3 => {
    const c = Math.cos(th) * rr, s = Math.sin(th) * rr;
    return [c * g.u[0] + s * g.v[0], c * g.u[1] + s * g.v[1], c * g.u[2] + s * g.v[2]];
  };

  /* static layers, drawn once per size */
  function buildLayers() {
    // floor: perspective grid under the system, faded to the edges
    floorLayer.width = canvas.width; floorLayer.height = canvas.height;
    const f = floorLayer.getContext('2d')!;
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    const save = [cY, sY, cP, sP];
    cY = 1; sY = 0; cP = Math.cos(PITCH); sP = Math.sin(PITCH);
    f.strokeStyle = col.fg; f.lineWidth = 0.6;
    const y0 = -0.95, ext = 1.6, step = 0.2;
    for (let a = -ext; a <= ext + 1e-6; a += step) {
      for (const [A, B] of [[[a, y0, -ext], [a, y0, ext]], [[-ext, y0, a], [ext, y0, a]]] as [V3, V3][]) {
        const p = proj(A), q = proj(B);
        f.globalAlpha = 0.07; f.beginPath(); f.moveTo(p[0], p[1]); f.lineTo(q[0], q[1]); f.stroke();
      }
    }
    [cY, sY, cP, sP] = save;
    const [fx, fy] = [cx, cy + F * 0.3];
    const fade = f.createRadialGradient(fx, fy, F * 0.12, fx, fy, F * 0.6);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    f.globalAlpha = 1; f.globalCompositeOperation = 'destination-out'; f.fillStyle = fade; f.fillRect(0, 0, W, H);
    // core limb: a screen-facing graduated ring (rotated with drawImage)
    const lr = Math.ceil(F * R0 / D * 1.28);
    const size = (lr + 8) * 2;
    limbLayer.width = Math.round(size * dpr); limbLayer.height = Math.round(size * dpr);
    const l = limbLayer.getContext('2d')!;
    l.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = size / 2;
    l.strokeStyle = col.accent; l.globalAlpha = 0.5; l.lineWidth = 1;
    l.beginPath(); l.arc(c, c, lr, 0, TAU); l.stroke();
    l.globalAlpha = 0.32; l.beginPath();
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, len = i % 6 === 0 ? 5 : 2.2; l.moveTo(c + Math.cos(a) * lr, c + Math.sin(a) * lr); l.lineTo(c + Math.cos(a) * (lr + len), c + Math.sin(a) * (lr + len)); }
    l.stroke();
  }

  /* label slots: HTML links placed by CSS (two columns); the canvas only needs each visible label's anchor */
  let slotPos = new Map<string, [number, number]>();
  function layoutSlots() {
    slotPos = new Map();
    labels.forEach((el, id) => {
      if (!el.getClientRects().length) return; // hidden on this width
      const n = nodes.find((x) => x.id === id)!;
      const y = el.offsetTop; // CSS centres the label on its top (translate -50%)
      slotPos.set(id, [n.side! < 0 ? el.offsetLeft + el.offsetWidth + 4 : el.offsetLeft - 4, y]);
    });
  }

  /* batched strokes by depth (few canvas calls per frame) */
  const B = 5, buckets: number[][] = Array.from({ length: B }, () => []);
  const seg = (ax: number, ay: number, bx: number, by: number, z: number) => buckets[clamp(Math.floor(((z + 1.2) / 2.4) * B), 0, B - 1)].push(ax, ay, bx, by);
  function flush(color: string, w0: number, w1: number, a0: number, a1: number) {
    ctx!.strokeStyle = color;
    for (let b = 0; b < B; b++) {
      const arr = buckets[b]; if (!arr.length) continue;
      const k = b / (B - 1);
      ctx!.globalAlpha = a0 + (a1 - a0) * k; ctx!.lineWidth = w0 + (w1 - w0) * k;
      ctx!.beginPath();
      for (let i = 0; i < arr.length; i += 4) { ctx!.moveTo(arr[i], arr[i + 1]); ctx!.lineTo(arr[i + 2], arr[i + 3]); }
      ctx!.stroke(); arr.length = 0;
    }
    ctx!.globalAlpha = 1;
  }

  const pulses: { node: number; t: number }[] = [];
  let nextPulse = 2;
  let nodePos: [number, number, number][] = [];

  function draw(dt: number, scrolling: boolean) {
    const intro = reducedMQ.matches ? 99 : time;
    const k = (a: number, b: number) => ease((intro - a) / (b - a));
    setView();
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    ctx!.globalAlpha = k(0, 0.8); ctx!.drawImage(floorLayer, 0, 0); ctx!.globalAlpha = 1;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.lineCap = 'round';

    // dust (not while scrolling / on lighter levels)
    if (level === 0 && !scrolling) {
      ctx!.fillStyle = col.fg;
      for (const p of dust) { const [x, y, z] = proj(p); ctx!.globalAlpha = 0.06 + 0.12 * clamp((z + 1.5) / 3, 0, 1); ctx!.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); }
      ctx!.globalAlpha = 1;
    }

    // rings (+ graduations on the outer limb)
    const SEG = level ? 64 : 96;
    rings.forEach((g, gi) => {
      const grow = k(0.05 + gi * 0.12, 0.8 + gi * 0.12);
      if (grow <= 0) return;
      for (let i = 0; i < SEG; i++) {
        const a0 = g.spin + (i / SEG) * TAU * grow, a1 = g.spin + ((i + 1) / SEG) * TAU * grow;
        const A = proj(ringPt(g, a0)), C = proj(ringPt(g, a1));
        seg(A[0], A[1], C[0], C[1], (A[2] + C[2]) / 2);
      }
      flush(col.fg, 0.6, 1.35, gi === 2 ? 0.08 : 0.12, gi === 2 ? 0.35 : 0.6);
      if (g.ticks && level === 0 && grow > 0.95) {
        for (let d = 0; d < 360; d += 10) {
          const th = g.spin + (d * Math.PI) / 180, long = d % 90 === 0;
          const A = proj(ringPt(g, th)), C = proj(ringPt(g, th, g.r * (long ? 1.06 : 1.03)));
          seg(A[0], A[1], C[0], C[1], A[2]);
        }
        flush(col.fg, 0.5, 0.9, 0.08, 0.4);
      }
    });

    // core: wireframe sphere + inner octahedron (accent) + limb layer
    const ck = k(0.4, 1.1);
    if (ck > 0) {
      const R = R0 * (0.75 + 0.25 * ck), rot = time * 0.22;
      const M = level ? 8 : 10, P = level ? 4 : 5, S = level ? 18 : 24;
      for (let m = 0; m < M; m++) {
        const ph = (m / M) * Math.PI + rot;
        let prev: [number, number, number] | null = null;
        for (let i = 0; i <= S; i++) {
          const a = (i / S) * TAU;
          const p = proj([Math.cos(ph) * Math.sin(a) * R, Math.cos(a) * R, Math.sin(ph) * Math.sin(a) * R]);
          if (prev) seg(prev[0], prev[1], p[0], p[1], (prev[2] + p[2]) / 2);
          prev = p;
        }
      }
      for (let pp = 1; pp < P; pp++) {
        const lat = -Math.PI / 2 + (pp / P) * Math.PI, rr = Math.cos(lat) * R, yy = Math.sin(lat) * R;
        let prev: [number, number, number] | null = null;
        for (let i = 0; i <= S; i++) {
          const a = (i / S) * TAU + rot;
          const p = proj([Math.cos(a) * rr, yy, Math.sin(a) * rr]);
          if (prev) seg(prev[0], prev[1], p[0], p[1], (prev[2] + p[2]) / 2);
          prev = p;
        }
      }
      flush(col.fg, 0.45, 1, 0.08 * ck, 0.4 * ck);
      const oc: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      const ed = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
      const ca = Math.cos(-time * 0.5), sa = Math.sin(-time * 0.5), cb = Math.cos(time * 0.3), sb = Math.sin(time * 0.3), sc = R * 0.55;
      const tp = oc.map(([x, y, z]) => { const x1 = x * ca - z * sa, z1 = x * sa + z * ca; return proj([x1 * sc, (y * cb - z1 * sb) * sc, (y * sb + z1 * cb) * sc]); });
      for (const [a, b] of ed) seg(tp[a][0], tp[a][1], tp[b][0], tp[b][1], (tp[a][2] + tp[b][2]) / 2);
      flush(col.accent, 0.8, 1.4, 0.35 * ck, 0.9 * ck);
      const ls = limbLayer.width / dpr;
      ctx!.save(); ctx!.globalAlpha = ck; ctx!.translate(cx, cy); ctx!.rotate(-time * 0.06);
      ctx!.drawImage(limbLayer, -ls / 2, -ls / 2, ls, ls); ctx!.restore();
    }

    // nodes, links, leaders
    const P = nodes.map((n) => proj(ringPt(rings[n.ring], rings[n.ring].spin + n.theta)));
    nodePos = P;
    const lk = k(0.9, 1.6), focus = selected >= 0 ? selected : hover;
    nodes.forEach((n, i) => { if (n.sys && i !== focus && lk > 0) { const p = P[i]; seg(cx, cy, cx + (p[0] - cx) * lk, cy + (p[1] - cy) * lk, p[2]); } });
    flush(col.fg, 0.5, 0.9, 0.05, focus >= 0 ? 0.12 : 0.24);
    // leaders: slot anchor → elbow → node (depth dims, never moves the label)
    const nk = k(1.1, 1.7);
    if (nk > 0) {
      for (const [id, [ax, ay]] of slotPos) {
        const i = nodes.findIndex((n) => n.id === id), p = P[i];
        const near = clamp((p[2] + 0.9) / 1.8, 0, 1), side = nodes[i].side!;
        const ex = ax + side * -14;
        ctx!.globalAlpha = (0.12 + 0.38 * near) * nk * (focus >= 0 && focus !== i ? 0.4 : 1);
        ctx!.strokeStyle = focus === i ? col.accent : col.muted; ctx!.lineWidth = 0.75;
        ctx!.beginPath(); ctx!.moveTo(ax, ay); ctx!.lineTo(ex, ay); ctx!.lineTo(p[0], p[1]); ctx!.stroke();
        const el = labels.get(id)!;
        const o = ((0.4 + 0.6 * near) * nk * (focus >= 0 && focus !== i ? 0.45 : 1)).toFixed(1);
        if (el.style.opacity !== o) el.style.opacity = o;
      }
      ctx!.globalAlpha = 1;
    }
    nodes.forEach((n, i) => {
      const p = P[i], near = clamp((p[2] + 1) / 2, 0, 1), vis = k(1 + i * 0.02, 1.4 + i * 0.02);
      ctx!.globalAlpha = (0.3 + 0.7 * near) * vis * (focus >= 0 && focus !== i ? 0.35 : 1);
      ctx!.fillStyle = i === focus ? col.accent : n.sys ? col.fg : col.muted;
      ctx!.beginPath(); ctx!.arc(p[0], p[1], (n.sys ? 2.6 : 1.8) * (0.75 + 0.5 * near), 0, TAU); ctx!.fill();
    });
    ctx!.globalAlpha = 1;

    // pulses with a short tail
    if (!reducedMQ.matches && intro > 1.8 && level < 2) {
      if (time > nextPulse && pulses.length < 2 && selected < 0) {
        const sys = nodes.map((n, i) => (n.sys && P[i][2] > -0.5 ? i : -1)).filter((i) => i >= 0);
        if (sys.length) pulses.push({ node: sys[Math.floor(rnd() * sys.length)], t: 0 });
        nextPulse = time + 1 + rnd() * 2.2;
      }
      ctx!.fillStyle = col.accent;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i]; pl.t += dt / 1000;
        const u = pl.t / 1.8;
        if (u >= 1) { pulses.splice(i, 1); continue; }
        const p = P[pl.node];
        for (let j = 0; j < 4; j++) {
          const uu = ease(u) - j * 0.04; if (uu < 0) break;
          ctx!.globalAlpha = (1 - j / 4) * Math.min(1, (1 - u) * 4, u * 8);
          ctx!.beginPath(); ctx!.arc(cx + (p[0] - cx) * uu, cy + (p[1] - cy) * uu, 2 - j * 0.35, 0, TAU); ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
    }
  }

  /* flywheel: scroll adds angular velocity, which decays to a slow drift */
  const BASE = 0.07, VMAX = 1.0, KICK = 0.0022, TAUV = 1000;
  function step(dt: number) {
    const dy = scrollNow - scrollPrev; scrollPrev = scrollNow;
    if (selected >= 0) vel += (0 - vel) * (1 - Math.exp(-dt / 130));
    else { vel += dy * KICK; vel = BASE + (vel - BASE) * Math.exp(-dt / TAUV); }
    vel = clamp(vel, -VMAX, VMAX);
    yaw += (vel * dt) / 1000;
    rings.forEach((g) => { g.spin += g.speed * (dt / 1000) * TAU * 0.2 * (selected >= 0 ? 0 : 1); });
    sway = Math.sin(time * 0.35) * 0.07; // ±4°
  }

  let last = 0;
  function frame(now: number) {
    if (!running) return;
    const raw = last ? now - last : 16.7;
    last = now;
    const dt = Math.min(raw, 50);
    time += dt / 1000;
    step(dt);
    // automatic simplification by the average frame time over ~1 s
    avg += raw; avgN++;
    if (now - avgT0 > 1000) {
      const a = avg / avgN; avg = 0; avgN = 0; avgT0 = now;
      if (a > 28 && level < 2) { level = 2; root.classList.add('is-static'); draw(16, false); running = false; return; }
      if (a > 20 && level < 1) level = 1;
    }
    const scrolling = now - lastScrollAt < 150;
    frameNo++;
    if (!scrolling || frameNo % 2 === 0) draw(dt, scrolling); // half rate while the page scrolls
    requestAnimationFrame(frame);
  }
  const start = () => { if (running || !inView || document.hidden || reducedMQ.matches || level === 2) return; running = true; last = 0; avgT0 = performance.now(); scrollPrev = scrollNow = window.scrollY; requestAnimationFrame(frame); };
  const stop = () => { running = false; };

  /* selection */
  const sysIdx = nodes.map((n, i) => (n.sys ? i : -1)).filter((i) => i >= 0);
  const hit = (x: number, y: number) => {
    let best = -1, bd = 24;
    for (const i of sysIdx) { const p = nodePos[i]; if (!p || p[2] < -0.4) continue; const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const select = (i: number) => {
    clearTimeout(selTimer); selected = i;
    if (pick) {
      if (i < 0) pick.hidden = true;
      else {
        const n = nodes[i];
        pick.href = n.href!; pick.querySelector('[data-pick-idx]')!.textContent = n.index ?? ''; pick.querySelector('[data-pick-name]')!.textContent = n.name ?? '';
        pick.hidden = false; selTimer = window.setTimeout(() => select(-1), 6000);
      }
    }
    if (!running) draw(16, false);
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect(), i = hit(e.clientX - r.left, e.clientY - r.top);
    if (fine.matches && i >= 0) { location.href = nodes[i].href!; return; }
    select(i === selected ? -1 : i);
  });
  document.addEventListener('click', (e) => { if (selected >= 0 && e.target !== canvas && !(e.target as Element).closest('[data-scene-pick]')) select(-1); });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect(), i = hit(e.clientX - r.left, e.clientY - r.top);
    if (i !== hover) { hover = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; canvas.dataset.cursor = i >= 0 ? nodes[i].name : ''; }
    // core elements: a small caption on hover (desktop only)
    if (tip) {
      let c = -1, bd = 14;
      nodes.forEach((n, k) => { const p = nodePos[k]; if (n.sys || !p) return; const d = Math.hypot(p[0] - (e.clientX - r.left), p[1] - (e.clientY - r.top)); if (d < bd) { bd = d; c = k; } });
      if (c < 0) tip.hidden = true;
      else { tip.textContent = nodes[c].label; tip.style.left = `${nodePos[c][0]}px`; tip.style.top = `${nodePos[c][1]}px`; tip.hidden = false; }
    }
  });
  canvas.addEventListener('pointerleave', () => { hover = -1; if (tip) tip.hidden = true; });

  /* lifecycle */
  resize();
  let lastW = innerWidth;
  new ResizeObserver(() => { if (innerWidth !== lastW || !W) { lastW = innerWidth; resize(); if (!running) draw(16, false); } }).observe(canvas);
  subscribeScroll((y) => { scrollNow = y; lastScrollAt = performance.now(); }); // y is read in the shared read phase
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  root.classList.add('is-live');
  if (reducedMQ.matches) { time = 99; draw(16, false); } else draw(0, false);
  (root as HTMLElement & { __scene?: unknown }).__scene = { frames: () => frameNo, level: () => level };
}
