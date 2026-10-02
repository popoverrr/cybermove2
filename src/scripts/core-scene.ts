// CORE scene (docs/14-rework.md §3): a precise instrument — a gyroscope / armillary sphere drawn with thin lines in
// real 3D (own perspective projection on a 2D canvas, no libraries). Rings in different planes spin about their own
// axes, the whole scene precesses; depth = line width + opacity. Core: wireframe sphere + counter-rotating
// octahedron/cube + a graduated limb with «CORE». Nodes ride the rings, labels always face the viewer and never
// overlap (greedy placement with eased fades). Links from the core with tailed pulses; a dot occasionally runs a
// full ring. Flywheel rotation (scroll adds angular velocity that decays to a drift), cursor tilt on desktop,
// tap to select a system node. Paused off-screen / hidden tab; reduced motion = one static frame.

type V3 = [number, number, number];
interface Node { id: string; label: string; ring: number; theta: number; sys: boolean; index?: string; href?: string; name?: string }
interface Ring { r: number; n: V3; spin: number; speed: number; dashed?: boolean; ticks: boolean; u: V3; v: V3 }

const TAU = Math.PI * 2;
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const basis = (n: V3): [V3, V3] => {
  const a: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(a, n));
  return [u, cross(n, u)];
};
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function initCoreScene(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const data = JSON.parse(root.querySelector('[data-scene-nodes]')!.textContent || '{}') as { nodes: Node[] };
  const pick = root.querySelector<HTMLAnchorElement>('[data-scene-pick]');
  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const compact = root.hasAttribute('data-compact');

  /* ── geometry ── */
  const rings: Ring[] = [
    { r: 0.56, n: norm([0.22, 1, 0.12]), spin: 0, speed: -0.10, ticks: true, u: [0, 0, 0], v: [0, 0, 0] },  // 0 core composition
    { r: 1.0, n: norm([0, 1, 0.04]), spin: 0, speed: 0.045, ticks: true, u: [0, 0, 0], v: [0, 0, 0] },     // 1 system A
    { r: 0.86, n: norm([0.62, 1, -0.38]), spin: 0, speed: -0.06, ticks: true, u: [0, 0, 0], v: [0, 0, 0] }, // 2 system B
    { r: 0.74, n: norm([-0.45, 1, 0.55]), spin: 0, speed: 0.08, dashed: true, ticks: false, u: [0, 0, 0], v: [0, 0, 0] }, // 3 auxiliary
    { r: 1.02, n: norm([1, 0.12, 0.38]), spin: 0, speed: 0.02, ticks: true, u: [0, 0, 0], v: [0, 0, 0] },   // 4 meridian (armillary)
  ];
  rings.forEach((g) => { [g.u, g.v] = basis(g.n); });
  const nodes = data.nodes;

  // dust: fixed random points in a volume (deterministic)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dustAll: V3[] = Array.from({ length: 54 }, () => [rnd() * 3 - 1.5, rnd() * 2.2 - 1.1, rnd() * 3 - 1.5]);
  let dustN = compact ? 30 : 54;

  // core figures
  const octa: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const octaE = [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]];
  const cube: V3[] = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const cubeE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  /* ── state ── */
  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, F = 0;
  let mono = 'ui-monospace, monospace';
  let colors = { fg: '#f2f2ef', muted: '#8c9199', line: 'rgba(242,242,239,.14)', accent: '#c8ff2e', bg: '#08090b' };
  const D = 3.6; // camera distance
  let yaw = 0.4, vel = 0.05, pitch = -0.5, prec = 0, t0 = 0, last = 0, time = 0;
  let tiltX = 0, tiltY = 0, tvx = 0, tvy = 0, tgx = 0, tgy = 0;
  let hover = -1, selected = -1, selTimer = 0;
  let running = false, inView = false;
  let scrollNow = window.scrollY, scrollPrev = scrollNow;
  let slowFrames = 0, simplified = false;
  const labelState = new Map<string, { a: number; x: number; y: number; side: number }>();
  const pulses: { node: number; t: number; dur: number }[] = [];
  let nextPulse = 1.9, ringRun: { ring: number; t: number } | null = null, nextRun = 6;

  function readColors() {
    const cs = getComputedStyle(root);
    const g = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
    mono = g('--font-mono', mono);
    colors = { fg: g('--fg', colors.fg), muted: g('--fg-muted', colors.muted), line: g('--line-strong', colors.line), accent: g('--accent', colors.accent), bg: g('--bg', colors.bg) };
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(simplified ? 1.5 : 2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cx = W / 2; cy = H * 0.5;
    F = Math.min(W * 0.9, H * 1.42);
    readColors();
  }

  /* ── projection ── */
  let cY = 1, sY = 0, cP = 1, sP = 0;
  function setView() {
    const y = yaw + tiltX, p = pitch + tiltY + Math.sin(prec) * 0.06;
    cY = Math.cos(y); sY = Math.sin(y); cP = Math.cos(p); sP = Math.sin(p);
  }
  // returns [sx, sy, z (toward camera +), scale]
  function proj(p: V3): [number, number, number, number] {
    const x1 = p[0] * cY + p[2] * sY, z1 = -p[0] * sY + p[2] * cY;
    const y2 = p[1] * cP - z1 * sP, z2 = p[1] * sP + z1 * cP;
    const k = F / (D - z2);
    return [cx + x1 * k, cy - y2 * k, z2, k / F * D];
  }
  const ringPoint = (g: Ring, th: number, rr = g.r): V3 => {
    const c = Math.cos(th) * rr, s = Math.sin(th) * rr;
    return [c * g.u[0] + s * g.v[0], c * g.u[1] + s * g.v[1], c * g.u[2] + s * g.v[2]];
  };

  /* ── batched strokes by depth bucket (few canvas calls per frame) ── */
  const BUCKETS = 7;
  const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);
  const depthBucket = (z: number) => clamp(Math.floor(((z + 1.3) / 2.6) * BUCKETS), 0, BUCKETS - 1);
  function seg(ax: number, ay: number, bx: number, by: number, z: number) { buckets[depthBucket(z)].push(ax, ay, bx, by); }
  function flush(color: string, wMin: number, wMax: number, aMin: number, aMax: number, dim = 1) {
    ctx!.strokeStyle = color;
    for (let b = 0; b < BUCKETS; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      const k = b / (BUCKETS - 1);
      ctx!.globalAlpha = (aMin + (aMax - aMin) * k) * dim;
      ctx!.lineWidth = wMin + (wMax - wMin) * k;
      ctx!.beginPath();
      for (let i = 0; i < arr.length; i += 4) { ctx!.moveTo(arr[i], arr[i + 1]); ctx!.lineTo(arr[i + 2], arr[i + 3]); }
      ctx!.stroke();
      arr.length = 0;
    }
    ctx!.globalAlpha = 1;
  }

  /* ── frame ── */
  function draw(dt: number) {
    const intro = reducedMQ.matches ? 99 : time; // seconds since start
    const k = (a: number, b: number) => ease((intro - a) / (b - a));
    setView();
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, W, H);
    ctx!.lineCap = 'round';
    const dimAll = selected >= 0 || hover >= 0 ? 0.45 : 1;

    const [ccx, ccy] = proj([0, 0, 0]);
    // floor grid in perspective
    const fl = k(0.1, 1.0);
    if (fl > 0) {
      const y0 = -1.0, ext = 1.7, step = simplified ? 0.34 : 0.17;
      for (let a = -ext; a <= ext + 1e-6; a += step) {
        const A = proj([a, y0, -ext]), B = proj([a, y0, ext]);
        seg(A[0], A[1], B[0], B[1], (A[2] + B[2]) / 2);
        const C = proj([-ext, y0, a]), E = proj([ext, y0, a]);
        seg(C[0], C[1], E[0], E[1], (C[2] + E[2]) / 2);
      }
      flush(colors.fg, 0.5, 0.7, 0.02 * fl, 0.09 * fl);
      // fade the floor out towards the edges of the area (no hard borders)
      const [fx, fy] = proj([0, y0, 0]);
      const fade = ctx!.createRadialGradient(fx, fy, F * 0.18, fx, fy, F * 0.62);
      fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.fillStyle = fade; ctx!.fillRect(0, Math.max(0, fy - F * 0.75), W, H);
      ctx!.globalCompositeOperation = 'source-over';
    }

    // light: one low-contrast radial gradient under the core
    const grd = ctx!.createRadialGradient(ccx, ccy, 0, ccx, ccy, F * 0.42);
    grd.addColorStop(0, colors.fg); grd.addColorStop(1, 'transparent');
    ctx!.globalAlpha = 0.05 * k(0.3, 1.2); ctx!.fillStyle = grd; ctx!.fillRect(ccx - F * 0.42, ccy - F * 0.42, F * 0.84, F * 0.84); ctx!.globalAlpha = 1;

    // dust
    ctx!.fillStyle = colors.fg;
    for (let i = 0; i < dustN; i++) {
      const p = dustAll[i];
      const q: V3 = [p[0], p[1] + Math.sin(time * 0.15 + i) * 0.02, p[2]];
      const [x, y, z, s] = proj(q);
      ctx!.globalAlpha = (0.06 + 0.14 * clamp((z + 1.5) / 3, 0, 1)) * k(0.6, 1.6);
      const r = 0.6 + 0.9 * s * clamp((z + 1.5) / 3, 0, 1);
      ctx!.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx!.globalAlpha = 1;

    // rings: arcs assemble during the intro, then full; ticks every 10°, long every 90°
    const SEG = simplified ? 56 : 96;
    rings.forEach((g, gi) => {
      const grow = k(0.05 + gi * 0.08, 0.75 + gi * 0.1);
      if (grow <= 0) return;
      const span = TAU * grow;
      for (let i = 0; i < SEG; i++) {
        const a0 = g.spin + (i / SEG) * span, a1 = g.spin + ((i + 1) / SEG) * span;
        if (g.dashed && i % 3 === 2) continue;
        const A = proj(ringPoint(g, a0)), B = proj(ringPoint(g, a1));
        seg(A[0], A[1], B[0], B[1], (A[2] + B[2]) / 2);
      }
      flush(colors.fg, 0.55, 1.45, g.dashed ? 0.06 : 0.1, g.dashed ? 0.3 : 0.62, dimAll > 0.5 ? 1 : 0.7);
      if (g.ticks && grow > 0.95) {
        const step = simplified ? 20 : 10;
        for (let d = 0; d < 360; d += step) {
          const th = g.spin + (d * Math.PI) / 180;
          const long = d % 90 === 0;
          const A = proj(ringPoint(g, th, g.r)), B = proj(ringPoint(g, th, g.r * (long ? 1.07 : 1.035)));
          seg(A[0], A[1], B[0], B[1], A[2]);
        }
        flush(colors.fg, 0.5, 1, 0.08, 0.5, dimAll > 0.5 ? 1 : 0.7);
      }
    });

    // core: wireframe sphere (meridians + parallels), inner counter-rotating figures, limb with graduations
    const ck = k(0.45, 1.15);
    if (ck > 0) {
      const R0 = 0.3 * (0.7 + 0.3 * ck);
      const rot = time * 0.25;
      const M = simplified ? 8 : 12, P = simplified ? 4 : 6, S = simplified ? 20 : 28;
      for (let m = 0; m < M; m++) {
        const ph = (m / M) * Math.PI + rot;
        for (let i = 0; i < S; i++) {
          const a0 = (i / S) * TAU, a1 = ((i + 1) / S) * TAU;
          const p0: V3 = [Math.cos(ph) * Math.sin(a0) * R0, Math.cos(a0) * R0, Math.sin(ph) * Math.sin(a0) * R0];
          const p1: V3 = [Math.cos(ph) * Math.sin(a1) * R0, Math.cos(a1) * R0, Math.sin(ph) * Math.sin(a1) * R0];
          const A = proj(p0), B = proj(p1);
          seg(A[0], A[1], B[0], B[1], (A[2] + B[2]) / 2);
        }
      }
      for (let p = 1; p < P; p++) {
        const lat = -Math.PI / 2 + (p / P) * Math.PI, rr = Math.cos(lat) * R0, yy = Math.sin(lat) * R0;
        for (let i = 0; i < S; i++) {
          const a0 = (i / S) * TAU + rot, a1 = ((i + 1) / S) * TAU + rot;
          const A = proj([Math.cos(a0) * rr, yy, Math.sin(a0) * rr]), B = proj([Math.cos(a1) * rr, yy, Math.sin(a1) * rr]);
          seg(A[0], A[1], B[0], B[1], (A[2] + B[2]) / 2);
        }
      }
      flush(colors.fg, 0.45, 1.1, 0.06 * ck, 0.42 * ck);
      // inner figures (accent): octahedron and cube turning the other way
      const fig = (pts: V3[], edges: number[][], sc: number, ax: number, ay: number) => {
        const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay);
        const tp = pts.map(([x, y, z]) => { const x1 = x * ca - z * sa, z1 = x * sa + z * ca; const y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb; return proj([x1 * sc, y1 * sc, z2 * sc]); });
        for (const [a, b] of edges) seg(tp[a][0], tp[a][1], tp[b][0], tp[b][1], (tp[a][2] + tp[b][2]) / 2);
      };
      fig(octa, octaE, R0 * 0.58, -time * 0.55, time * 0.3);
      flush(colors.accent, 0.7, 1.4, 0.3 * ck, 0.9 * ck);
      fig(cube, cubeE, R0 * 0.3, time * 0.7, -time * 0.4);
      flush(colors.accent, 0.6, 1.1, 0.25 * ck, 0.7 * ck);
      // limb: a screen-facing graduated ring
      const lr = F * R0 / (D) * 1.48;
      ctx!.globalAlpha = 0.42 * ck * dimAll; ctx!.strokeStyle = colors.accent; ctx!.lineWidth = 0.9;
      ctx!.beginPath(); ctx!.arc(ccx, ccy, lr, 0, TAU); ctx!.stroke();
      ctx!.beginPath();
      const tickN = simplified ? 36 : 72, lrot = -time * 0.08;
      for (let i = 0; i < tickN; i++) {
        const a = (i / tickN) * TAU + lrot, len = i % 6 === 0 ? 5 : 2.2;
        ctx!.moveTo(ccx + Math.cos(a) * lr, ccy + Math.sin(a) * lr);
        ctx!.lineTo(ccx + Math.cos(a) * (lr + len), ccy + Math.sin(a) * (lr + len));
      }
      ctx!.globalAlpha = 0.28 * ck * dimAll; ctx!.stroke();
      // CORE label — always facing the viewer
      ctx!.globalAlpha = ck; ctx!.fillStyle = colors.fg;
      ctx!.font = `500 ${Math.round(clamp(8.5 + W * 0.004, 9, 12))}px ${mono}`;
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
      const lbl = 'C O R E';
      // a thin plate keeps the label readable over the wireframe
      const tw = ctx!.measureText(lbl).width;
      ctx!.fillStyle = colors.bg; ctx!.globalAlpha = 0.6 * ck;
      ctx!.fillRect(ccx - tw / 2 - 4, ccy - 7, tw + 8, 14);
      ctx!.globalAlpha = ck; ctx!.fillStyle = colors.fg; ctx!.fillText(lbl, ccx, ccy + 0.5);
      ctx!.globalAlpha = 1;
    }

    // node positions
    const P = nodes.map((n) => { const g = rings[n.ring]; return proj(ringPoint(g, g.spin + n.theta)); });

    // links from the core to the system nodes (grow out of the core)
    const lk = k(1.0, 1.7);
    if (lk > 0) {
      nodes.forEach((n, i) => {
        if (!n.sys) return;
        const p = P[i];
        const x = ccx + (p[0] - ccx) * lk, y = ccy + (p[1] - ccy) * lk;
        const on = selected === i || hover === i;
        if (on) return;
        seg(ccx, ccy, x, y, p[2]);
      });
      flush(colors.fg, 0.5, 1, 0.05, 0.28, dimAll);
      const focus = selected >= 0 ? selected : hover;
      if (focus >= 0) {
        const p = P[focus];
        ctx!.globalAlpha = 0.9; ctx!.strokeStyle = colors.fg; ctx!.lineWidth = 1.2;
        ctx!.beginPath(); ctx!.moveTo(ccx, ccy); ctx!.lineTo(p[0], p[1]); ctx!.stroke(); ctx!.globalAlpha = 1;
      }
    }

    // pulses with a fading tail
    if (!reducedMQ.matches && intro > 1.8) {
      if (time > nextPulse && pulses.length < 2 && selected < 0) {
        const sys = nodes.map((n, i) => (n.sys ? i : -1)).filter((i) => i >= 0 && P[i][2] > -0.6);
        if (sys.length) pulses.push({ node: sys[Math.floor(Math.random() * sys.length)], t: 0, dur: 1.8 });
        nextPulse = time + 0.9 + Math.random() * 2.2;
      }
      ctx!.fillStyle = colors.accent;
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pl = pulses[i]; pl.t += dt / 1000;
        const u = pl.t / pl.dur;
        if (u >= 1) { pulses.splice(i, 1); continue; }
        const p = P[pl.node];
        for (let j = 0; j < 6; j++) {
          const uu = ease(u) - j * 0.035;
          if (uu < 0) break;
          ctx!.globalAlpha = (1 - j / 6) * Math.min(1, (1 - u) * 4, u * 8);
          const r = 2.2 - j * 0.28;
          ctx!.beginPath(); ctx!.arc(ccx + (p[0] - ccx) * uu, ccy + (p[1] - ccy) * uu, r, 0, TAU); ctx!.fill();
        }
      }
      // a dot running a full ring now and then
      if (!ringRun && time > nextRun) { ringRun = { ring: 1 + Math.floor(Math.random() * 2), t: 0 }; }
      if (ringRun) {
        ringRun.t += dt / 1000;
        const u = ringRun.t / 5.5;
        if (u >= 1) { ringRun = null; nextRun = time + 7 + Math.random() * 6; }
        else {
          const g = rings[ringRun.ring];
          for (let j = 0; j < 10; j++) {
            const th = g.spin + ease(u) * TAU - j * 0.035;
            const [x, y, z] = proj(ringPoint(g, th));
            ctx!.globalAlpha = (1 - j / 10) * clamp((z + 1.2) / 2.2, 0.15, 1) * Math.min(1, u * 10, (1 - u) * 10);
            ctx!.beginPath(); ctx!.arc(x, y, 1.8 - j * 0.12, 0, TAU); ctx!.fill();
          }
        }
      }
      ctx!.globalAlpha = 1;
    }

    // nodes + labels (greedy, front first, eased fades, no overlaps, far side = dot only)
    const fs = Math.round(clamp(W * 0.021, 9.5, 12.5));
    ctx!.font = `${fs}px ${mono}`;
    ctx!.textBaseline = 'middle';
    const order = nodes.map((_, i) => i).sort((a, b) => P[b][2] - P[a][2]);
    const lrr = F * 0.3 / D * 1.5;
    const placed: [number, number, number, number][] = [[ccx - lrr, ccy - lrr, ccx + lrr, ccy + lrr]];
    const nk = (i: number) => k(1.05 + (nodes[i].sys ? 0.25 : 0) + i * 0.02, 1.45 + (nodes[i].sys ? 0.25 : 0) + i * 0.02);
    const small = W < 520;
    order.forEach((i) => {
      const n = nodes[i], p = P[i];
      const vis = nk(i);
      if (vis <= 0) return;
      const depth = clamp((p[2] + 1.1) / 2.2, 0, 1);
      const focus = i === selected || i === hover;
      const dim = (selected >= 0 || hover >= 0) && !focus ? 0.28 : 1;
      // marker: dot + short radial tick
      const rr = (n.sys ? 2.4 : 1.8) * (0.7 + 0.6 * depth);
      ctx!.globalAlpha = (0.3 + 0.7 * depth) * vis * dim;
      ctx!.fillStyle = focus ? colors.accent : n.sys ? colors.fg : colors.muted;
      ctx!.beginPath(); ctx!.arc(p[0], p[1], rr, 0, TAU); ctx!.fill();
      const dx = p[0] - ccx, dy = p[1] - ccy, dl = Math.hypot(dx, dy) || 1;
      ctx!.strokeStyle = ctx!.fillStyle; ctx!.lineWidth = 1;
      ctx!.globalAlpha *= 0.6;
      ctx!.beginPath(); ctx!.moveTo(p[0] + (dx / dl) * (rr + 2), p[1] + (dy / dl) * (rr + 2)); ctx!.lineTo(p[0] + (dx / dl) * (rr + 5), p[1] + (dy / dl) * (rr + 5)); ctx!.stroke();
      // label
      const st = labelState.get(n.id) ?? { a: 0, x: p[0], y: p[1], side: Math.sign(dx) || 1 };
      let want = 0;
      const text = n.sys ? `${n.index} ${n.label}` : n.label;
      const show = p[2] > -0.25 && (n.sys || (!small && !compact)) && vis > 0.5;
      if (show) {
        // side with hysteresis
        if (Math.abs(dx) > 18) st.side = Math.sign(dx);
        const w = ctx!.measureText(text).width, h = fs + 4;
        let tx = p[0] + st.side * (rr + 12), ty = p[1];
        const box = (y: number): [number, number, number, number] => st.side > 0 ? [tx - 2, y - h / 2, tx + w + 2, y + h / 2] : [tx - w - 2, y - h / 2, tx + 2, y + h / 2];
        const hit = (b: [number, number, number, number]) => b[0] < 4 || b[2] > W - 4 || placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
        let ok = false;
        for (const off of [0, -h, h, -2 * h, 2 * h]) { if (!hit(box(p[1] + off))) { ty = p[1] + off; ok = true; break; } }
        if (ok || focus) { placed.push(box(ty)); want = 1; st.x += (tx - st.x) * (st.a < 0.05 ? 1 : 0.25); st.y += (ty - st.y) * (st.a < 0.05 ? 1 : 0.25); }
      }
      st.a = reducedMQ.matches ? want : st.a + (want - st.a) * Math.min(1, dt / 180); // static frame: final state at once
      labelState.set(n.id, st);
      if (st.a > 0.02) {
        ctx!.globalAlpha = st.a * (0.35 + 0.65 * depth) * vis * dim * (n.sys ? 1 : 0.7);
        ctx!.fillStyle = focus ? colors.fg : n.sys ? colors.fg : colors.muted;
        ctx!.textAlign = st.side > 0 ? 'left' : 'right';
        if (n.sys) {
          // index muted + label
          const idx = `${n.index} `;
          ctx!.fillStyle = colors.muted;
          const iw = ctx!.measureText(idx).width;
          if (st.side > 0) { ctx!.fillText(idx, st.x, st.y); ctx!.fillStyle = focus ? colors.accent : colors.fg; ctx!.fillText(n.label, st.x + iw, st.y); }
          else { ctx!.fillStyle = focus ? colors.accent : colors.fg; ctx!.fillText(n.label, st.x, st.y); ctx!.fillStyle = colors.muted; ctx!.fillText(idx, st.x - ctx!.measureText(n.label).width, st.y); }
        } else ctx!.fillText(n.label, st.x, st.y);
        // thin leader from the marker to the label if the label was pushed
        if (Math.abs(st.y - p[1]) > 2) {
          ctx!.globalAlpha *= 0.5; ctx!.strokeStyle = colors.muted; ctx!.lineWidth = 0.75;
          ctx!.beginPath(); ctx!.moveTo(p[0] + st.side * (rr + 3), p[1]); ctx!.lineTo(st.x - st.side * 3, st.y); ctx!.stroke();
        }
      }
    });
    ctx!.globalAlpha = 1;

    // angle marks on the outer orbit (fixed to the ring)
    if (k(0.9, 1.4) > 0 && !compact && W >= 720) {
      ctx!.font = `${Math.round(9 + W * 0.004)}px ${mono}`;
      ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
      for (const d of [0, 90, 180, 270]) {
        const g = rings[1], th = g.spin + (d * Math.PI) / 180;
        const [x, y, z] = proj(ringPoint(g, th, g.r * 1.16));
        const txt = `${String(d).padStart(3, '0')}°`, mw = ctx!.measureText(txt).width / 2 + 3;
        const bx: [number, number, number, number] = [x - mw, y - 8, x + mw, y + 8];
        if (placed.some((q) => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1])) continue;
        placed.push(bx);
        ctx!.globalAlpha = 0.45 * clamp((z + 1) / 2, 0.15, 1) * k(0.9, 1.4) * dimAll;
        ctx!.fillStyle = colors.muted;
        ctx!.fillText(txt, x, y);
      }
      ctx!.globalAlpha = 1;
    }

    // drawing notes in the corners
    const nk2 = k(1.2, 1.8);
    if (nk2 > 0) {
      ctx!.globalAlpha = 0.5 * nk2; ctx!.fillStyle = colors.muted;
      ctx!.font = `${Math.round(clamp(W * 0.018, 9, 11))}px ${mono}`;
      ctx!.textAlign = 'right'; ctx!.textBaseline = 'top'; ctx!.fillText('FIG. 01', W - 2, 2);
      ctx!.textAlign = 'left'; ctx!.textBaseline = 'bottom'; ctx!.fillText('CHAOS → CORE → SYSTEM → GROWTH', 2, H - 2);
      ctx!.globalAlpha = 1;
    }
    nodePos = P;
  }
  let nodePos: [number, number, number, number][] = [];

  /* ── physics: flywheel (scroll adds angular velocity, decays to a drift), precession, cursor spring ── */
  const BASE = 0.05, VMAX = 1.05, KICK = 0.0024, TAUV = 1000;
  function step(dt: number) {
    const dy = scrollNow - scrollPrev; scrollPrev = scrollNow;
    if (selected >= 0) vel += (0 - vel) * (1 - Math.exp(-dt / 130));
    else { vel += dy * KICK; vel = BASE + (vel - BASE) * Math.exp(-dt / TAUV); }
    vel = clamp(vel, -VMAX, VMAX);
    yaw += vel * dt / 1000;
    const spinK = selected >= 0 ? Math.abs(vel) / VMAX : 1;
    rings.forEach((g) => { g.spin += g.speed * spinK * dt / 1000 * TAU * 0.25; });
    prec += dt / 1000 * 0.21;
    // cursor tilt spring
    const kS = 60, dmp = 13, h = dt / 1000;
    tvx += (kS * (tgx - tiltX) - dmp * tvx) * h; tiltX += tvx * h;
    tvy += (kS * (tgy - tiltY) - dmp * tvy) * h; tiltY += tvy * h;
  }

  function frame(now: number) {
    if (!running) return;
    let dt = last ? now - last : 16.7;
    last = now;
    if (dt > 34) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (!simplified && slowFrames > 45) { simplified = true; dustN = 14; resize(); } // < ~40 fps for a while → lighter scene (and DPR ≤ 1.5)
    dt = Math.min(dt, 50);
    time += dt / 1000;
    step(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }
  const start = () => { if (running || !inView || document.hidden || reducedMQ.matches) return; running = true; last = 0; scrollPrev = scrollNow = window.scrollY; requestAnimationFrame(frame); };
  const stop = () => { running = false; };

  /* ── selection / interaction ── */
  const sysIdx = nodes.map((n, i) => (n.sys ? i : -1)).filter((i) => i >= 0);
  const hitNode = (x: number, y: number) => {
    let best = -1, bd = 26;
    for (const i of sysIdx) {
      const p = nodePos[i];
      if (!p || p[2] < -0.35) continue;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const select = (i: number) => {
    clearTimeout(selTimer);
    selected = i;
    if (pick) {
      if (i < 0) pick.hidden = true;
      else {
        const n = nodes[i];
        pick.href = n.href!;
        pick.querySelector('[data-pick-idx]')!.textContent = n.index ?? '';
        pick.querySelector('[data-pick-name]')!.textContent = n.name ?? '';
        pick.hidden = false;
        selTimer = window.setTimeout(() => select(-1), 6000);
      }
    }
    if (!running) draw(16);
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = hitNode(e.clientX - r.left, e.clientY - r.top);
    if (fine.matches && i >= 0) { location.href = nodes[i].href!; return; }
    select(i === selected ? -1 : i);
  });
  document.addEventListener('click', (e) => {
    if (selected < 0) return;
    const t = e.target as Element;
    if (t === canvas || t.closest('[data-scene-pick]')) return;
    select(-1);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tgx = (x / r.width - 0.5) * 0.18; tgy = (y / r.height - 0.5) * 0.1;
    const i = hitNode(x, y);
    if (i !== hover) { hover = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; root.dataset.cursor = i >= 0 ? nodes[i].name : ''; }
  });
  canvas.addEventListener('pointerleave', () => { tgx = 0; tgy = 0; hover = -1; canvas.style.cursor = ''; });

  /* ── lifecycle ── */
  resize();
  let lastW = innerWidth;
  new ResizeObserver(() => { if (innerWidth !== lastW || !W) { lastW = innerWidth; resize(); if (!running) draw(16); } }).observe(canvas);
  window.addEventListener('scroll', () => { scrollNow = window.scrollY; }, { passive: true });
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  root.classList.add('is-live');
  if (reducedMQ.matches) { time = 99; draw(16); }
  else draw(0);
}
