// CORE schema motion: counter-rotating orbits, pulses along the links, cursor parallax, hover focus.
// Only SVG attributes/transforms are written, from the shared rAF loop; paused off-screen and in hidden tabs.
import { addTask } from './core/raf';
import { spring, stepSpring } from './core/spring';
import { watchInView } from './core/observe';
import { reduced, finePointer, lerpK } from './core/motion';
import { CX, CY, layout, type GeoNode } from './core-orbit-geo';

const OUTER_PERIOD = 120_000;
const INNER_PERIOD = 90_000;
const PULSE = 1800;

document.querySelectorAll<HTMLElement>('[data-core-orbit]').forEach((root) => {
  if (reduced()) return; // static final state
  const nodes = JSON.parse(root.querySelector('[data-orbit-nodes]')!.textContent || '[]') as (GeoNode & { id: string })[];
  const els = nodes.map((n) => {
    const g = root.querySelector<SVGGElement>(`[data-node="${n.id}"]`)!;
    return {
      g,
      dot: g.querySelector<SVGCircleElement>('.orbit__dot')!,
      hit: g.querySelector<SVGCircleElement>('.orbit__hit'),
      leader: g.querySelector<SVGLineElement>('.orbit__leader')!,
      text: g.querySelector<SVGTextElement>('.orbit__label')!,
      link: root.querySelector<SVGLineElement>(`[data-link="${n.id}"]`),
    };
  });
  const stage = root.querySelector<SVGGElement>('.orbit__stage')!;
  const pulses = [...root.querySelectorAll<SVGCircleElement>('.orbit__pulse')].map((el) => ({ el, node: -1, t0: 0, next: 0 }));
  const sys = nodes.map((n, i) => (n.ring === 'system' ? i : -1)).filter((i) => i >= 0);
  const fs = Number(root.dataset.fs) || 13;
  const touch = !finePointer();
  const small = window.matchMedia('(max-width: 639px)');

  let rotCore = 0, rotSys = 0, speed = 1, hover = -1;
  let running = false, inView = false;
  const px = spring(), py = spring();
  let last = 0;

  const write = (now: number, dt: number) => {
    if (!running) return false;
    speed += ((hover >= 0 ? 0 : 1) - speed) * lerpK(0.06, dt);
    rotCore -= (360 * dt / INNER_PERIOD) * speed;
    if (!touch) rotSys += (360 * dt / OUTER_PERIOD) * speed;
    const vis = (n: GeoNode) => !small.matches || (n.ring === 'system' && els[nodes.indexOf(n as never)].g.classList.contains('is-key'));
    const P = layout(nodes, rotCore, rotSys, fs, vis);
    P.forEach((p, i) => {
      const e = els[i], x = p.x.toFixed(1), y = p.y.toFixed(1);
      e.dot.setAttribute('cx', x); e.dot.setAttribute('cy', y);
      e.hit?.setAttribute('cx', x); e.hit?.setAttribute('cy', y);
      e.leader.setAttribute('x1', x); e.leader.setAttribute('y1', y);
      e.leader.setAttribute('x2', p.lx.toFixed(1)); e.leader.setAttribute('y2', (p.ly + p.ty - p.ty0).toFixed(1));
      e.text.setAttribute('x', p.tx.toFixed(1)); e.text.setAttribute('y', p.ty.toFixed(1));
      e.text.setAttribute('text-anchor', p.anchor);
      e.g.style.setProperty('--o', (0.45 + 0.55 * p.depth).toFixed(3));
      e.g.style.setProperty('--s', (0.82 + 0.3 * p.depth).toFixed(3));
      if (e.link) { e.link.setAttribute('x2', x); e.link.setAttribute('y2', y); }
    });
    // pulses: 1–2 at a time, random system node, ~1.8 s, with pauses
    for (const pl of pulses) {
      if (pl.node < 0) {
        if (now >= pl.next) { pl.node = sys[Math.floor(Math.random() * sys.length)]; pl.t0 = now; pl.el.classList.add('is-on'); }
        continue;
      }
      const k = (now - pl.t0) / PULSE;
      if (k >= 1) { pl.node = -1; pl.next = now + 900 + Math.random() * 2600; pl.el.classList.remove('is-on'); continue; }
      const e = 1 - Math.pow(1 - k, 2);
      const p = P[pl.node];
      pl.el.setAttribute('cx', (CX + (p.x - CX) * e).toFixed(1));
      pl.el.setAttribute('cy', (CY + (p.y - CY) * e).toFixed(1));
      pl.el.style.opacity = String(Math.min(1, k * 6, (1 - k) * 4));
    }
    stepSpring(px, dt, 90, 16); stepSpring(py, dt, 90, 16);
    stage.style.transform = `translate(${px.x.toFixed(2)}px, ${py.x.toFixed(2)}px)`;
    last = now;
    return true;
  };

  const start = () => { if (running || !inView || document.hidden) return; running = true; addTask({ write }); };
  const stop = () => { running = false; };
  pulses.forEach((p, i) => (p.next = performance.now() + 1700 + i * 1300)); // after the entrance sequence
  watchInView(root, () => { inView = true; start(); }, () => { inView = false; stop(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (!touch) {
    root.addEventListener('pointermove', (e) => {
      const r = root.getBoundingClientRect();
      px.target = ((e.clientX - r.left) / r.width - 0.5) * 12;
      py.target = ((e.clientY - r.top) / r.height - 0.5) * 12;
    });
    root.addEventListener('pointerleave', () => { px.target = 0; py.target = 0; });
  }
  const focus = (i: number) => {
    hover = i;
    root.classList.toggle('has-focus', i >= 0);
    els.forEach((e, k) => { e.g.classList.toggle('is-focus', k === i); e.link?.classList.toggle('is-focus', k === i); });
  };
  sys.forEach((i) => {
    const g = els[i].g;
    g.addEventListener('pointerenter', () => focus(i));
    g.addEventListener('pointerleave', () => focus(-1));
    g.addEventListener('focus', () => focus(i));
    g.addEventListener('blur', () => focus(-1));
  });
  void last;
});
