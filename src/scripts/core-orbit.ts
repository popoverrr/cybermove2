// CORE schema motion: counter-rotating orbits, pulses along the links, cursor parallax, hover focus.
// Mobile / touch (< 1024 px or no hover, docs/11-fixes-2.md §A1): rotation follows the page scroll (spring-smoothed),
// a tap selects a system node and shows a caption link under the schema; second tap / tap outside / 6 s → reset.
// Only SVG attributes/transforms are written, from the shared rAF loop; paused off-screen and in hidden tabs.
import { addTask } from './core/raf';
import { spring, stepSpring } from './core/spring';
import { watchInView } from './core/observe';
import { reduced, finePointer, lerpK } from './core/motion';
import { CX, CY, layout, type GeoNode } from './core-orbit-geo';

const OUTER_PERIOD = 120_000;
const INNER_PERIOD = 90_000;
const PULSE = 1800;
const MOBILE_HIT = 62; // viewBox units → ≥ 44 px at 375 px wide

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
  const pick = root.querySelector<HTMLAnchorElement>('[data-orbit-pick]');
  const pulses = [...root.querySelectorAll<SVGCircleElement>('.orbit__pulse')].map((el) => ({ el, node: -1, t0: 0, next: 0 }));
  const sys = nodes.map((n, i) => (n.ring === 'system' ? i : -1)).filter((i) => i >= 0);
  const fs = Number(root.dataset.fs) || 13;
  const mobileMQ = window.matchMedia('(max-width: 1023px), (hover: none)');
  const small = window.matchMedia('(max-width: 639px)');
  const mobile = () => mobileMQ.matches || !finePointer();

  let rotCore = 0, rotSys = 0, speed = 1, hover = -1;
  let running = false, inView = false;
  const px = spring(), py = spring();
  const scrollRot = spring(); // extra rotation from page scroll (degrees of the outer orbit)

  const write = (now: number, dt: number) => {
    if (!running) return false;
    speed += ((hover >= 0 ? 0 : 1) - speed) * lerpK(0.06, dt);
    const m = mobile();
    rotCore -= (360 * dt / INNER_PERIOD) * speed;
    rotSys += (360 * dt / OUTER_PERIOD) * speed * (m ? 0.35 : 1);
    if (m && hover < 0) stepSpring(scrollRot, dt, 60, 14);
    const sOff = m ? scrollRot.x : 0;
    const vis = (n: GeoNode) => !small.matches || (n.ring === 'system' && els[nodes.indexOf(n as never)].g.classList.contains('is-key'));
    const P = layout(nodes, rotCore - sOff * 0.7, rotSys + sOff, fs, vis);
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
    // pulses: 1–2 at a time, random system node (or the hint sequence), ~1.8 s, with pauses
    for (const pl of pulses) {
      if (pl.node < 0) {
        if (now >= pl.next && hover < 0) {
          pl.node = hint.length ? hint.shift()! : sys[Math.floor(Math.random() * sys.length)];
          pl.t0 = now; pl.el.classList.add('is-on');
        }
        continue;
      }
      const dur = hintMode ? 900 : PULSE;
      const k = (now - pl.t0) / dur;
      if (k >= 1) {
        els[pl.node].g.classList.remove('is-hint');
        pl.node = -1; pl.el.classList.remove('is-on');
        pl.next = now + (hint.length ? 60 : 900 + Math.random() * 2600);
        if (!hint.length) hintMode = false;
        continue;
      }
      const e = 1 - Math.pow(1 - k, 2);
      const p = P[pl.node];
      if (k > 0.75 && hintMode) els[pl.node].g.classList.add('is-hint');
      pl.el.setAttribute('cx', (CX + (p.x - CX) * e).toFixed(1));
      pl.el.setAttribute('cy', (CY + (p.y - CY) * e).toFixed(1));
      pl.el.style.opacity = String(Math.min(1, k * 6, (1 - k) * 4));
    }
    stepSpring(px, dt, 90, 16); stepSpring(py, dt, 90, 16);
    stage.style.transform = `translate(${px.x.toFixed(2)}px, ${py.x.toFixed(2)}px)`;
    return true;
  };

  const start = () => { if (running || !inView || document.hidden) return; running = true; addTask({ write }); };
  const stop = () => { running = false; };
  pulses.forEach((p, i) => (p.next = performance.now() + 1700 + i * 1300)); // after the entrance sequence

  // one-time hint on mobile: a single pulse runs over three labelled nodes in a row
  let hint: number[] = [];
  let hintMode = false;
  let hinted = false;
  watchInView(root, () => {
    inView = true;
    if (!hinted && mobile()) {
      hinted = true; hintMode = true;
      const keys = sys.filter((i) => els[i].g.classList.contains('is-key'));
      hint = keys.slice(0, 3);
      pulses[0].next = performance.now() + 1700; pulses[1].next = Infinity;
      setTimeout(() => { pulses[1].next = performance.now() + 1500; }, 5000);
    }
    start();
  }, () => { inView = false; stop(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // scroll-linked rotation (mobile): about half a turn of the outer orbit while the schema crosses the screen
  const onScroll = () => {
    if (!mobile() || !inView) return;
    const r = root.getBoundingClientRect();
    const k = (window.innerHeight - r.top) / (window.innerHeight + r.height); // 0 → 1 across the screen
    scrollRot.target = k * 180;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); scrollRot.x = scrollRot.target;

  if (finePointer()) {
    root.addEventListener('pointermove', (e) => {
      if (mobile()) return;
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

  /* desktop: hover / keyboard focus */
  sys.forEach((i) => {
    const g = els[i].g;
    g.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType === 'mouse' && !mobile()) focus(i); });
    g.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType === 'mouse' && !mobile()) focus(-1); });
    g.addEventListener('focus', () => { if (!mobile()) focus(i); });
    g.addEventListener('blur', () => { if (!mobile()) focus(-1); });
  });

  /* mobile: tap selects, the caption link under the schema navigates */
  let timer = 0;
  const select = (i: number) => {
    clearTimeout(timer);
    focus(i);
    if (!pick) return;
    if (i < 0) { pick.hidden = true; return; }
    const g = els[i].g as unknown as SVGAElement;
    pick.href = g.getAttribute('href')!;
    pick.querySelector('[data-pick-idx]')!.textContent = nodes[i].index ?? '';
    pick.querySelector('[data-pick-name]')!.textContent = g.dataset.cursor ?? '';
    pick.hidden = false;
    timer = window.setTimeout(() => select(-1), 6000);
  };
  const applyHit = () => sys.forEach((i) => els[i].hit?.setAttribute('r', mobile() ? String(MOBILE_HIT) : '42'));
  applyHit();
  mobileMQ.addEventListener('change', () => { applyHit(); select(-1); });
  sys.forEach((i) => {
    els[i].g.addEventListener('click', (e) => {
      if (!mobile()) return;
      if (small.matches && !els[i].g.classList.contains('is-key')) { e.preventDefault(); return; }
      e.preventDefault();
      select(hover === i ? -1 : i);
    });
  });
  document.addEventListener('click', (e) => {
    if (hover < 0 || !mobile()) return;
    const t = e.target as Element;
    if (t.closest('.orbit__node--sys') || t.closest('[data-orbit-pick]')) return;
    select(-1);
  });
});
