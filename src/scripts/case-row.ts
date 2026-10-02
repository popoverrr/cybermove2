// Case ribbons (docs/15-stabilize.md §3).
// auto: position x is a float kept here and written as translate3d — never read back from the DOM. The set is
// duplicated for the loop; x wraps at the width of one set (measured on init, image loads and width changes).
// Own horizontal gesture: captured only when the move is clearly horizontal (> 8 px and > vertical); release →
// inertia → after 2.5 s the ribbon speeds up again over 0.6 s. A finger held still > 150 ms pauses it; a plain
// vertical page scroll does not. manual: native scrolling (arrows / mouse drag only on desktop).
import { addTask } from './core/raf';
import { reduced } from './core/motion';

const SPEED = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--speed-ribbon')) || 30;

document.querySelectorAll<HTMLElement>('[data-crow]').forEach((row) => {
  const vp = row.querySelector<HTMLElement>('.crow__viewport')!;
  const track = row.querySelector<HTMLElement>('.crow__track')!;

  if (row.dataset.crow !== 'auto') {
    // manual rows: native scroll; arrow buttons and mouse drag are desktop-only conveniences
    const stepBy = (dir: number) => vp.scrollBy({ left: dir * Math.max(240, vp.clientWidth * 0.8), behavior: reduced() ? 'auto' : 'smooth' });
    row.querySelector('[data-crow-prev]')?.addEventListener('click', () => stepBy(-1));
    row.querySelector('[data-crow-next]')?.addEventListener('click', () => stepBy(1));
    let drag: { x: number; left: number } | null = null, moved = false;
    vp.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, left: vp.scrollLeft }; moved = false; } });
    window.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) moved = true; vp.scrollLeft = drag.left - dx; });
    window.addEventListener('pointerup', () => { drag = null; });
    vp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    return;
  }

  /* ── auto ribbon ── */
  const still = reduced();
  let setW = 0, loop = false;
  let x = 0, v = still ? 0 : SPEED, target = v;
  let running = false, inView = false, resumeAt = 0, hover = false, holding = false;
  const write = () => { track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`; };

  // build the visible set (+ a copy for the loop when there are ≥ 3 cards)
  const strip = (el: Element) => {
    el.setAttribute('aria-hidden', 'true');
    el.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
    el.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach((n) => n.style.removeProperty('view-transition-name'));
  };
  function build(cards: Element[]) {
    track.replaceChildren(...cards);
    loop = !still && cards.length >= 3;
    if (loop) cards.forEach((c) => { const d = c.cloneNode(true) as Element; strip(d); track.append(d); });
    x = 0; write(); measure();
  }
  function measure() {
    if (!loop) { setW = 0; return; }
    const n = track.children.length / 2;
    const first = track.children[0] as HTMLElement, dup = track.children[n] as HTMLElement;
    setW = dup && first ? dup.offsetLeft - first.offsetLeft : 0;
  }
  build([...track.children]);
  new ResizeObserver(() => measure()).observe(track);
  let lastW = innerWidth;
  window.addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; measure(); } });

  // filter: swap in the category set from its <template> in one frame
  const pools = new Map([...row.querySelectorAll<HTMLTemplateElement>('template[data-pool]')].map((tp) => [tp.dataset.pool!, tp]));
  row.addEventListener('crow:filter', ((e: CustomEvent<{ sector: string }>) => {
    const tp = pools.get(e.detail.sector);
    if (!tp) return;
    build([...(tp.content.cloneNode(true) as DocumentFragment).children]);
    v = still ? 0 : SPEED * 0.4;
  }) as EventListener);
  // keep the «All» set to come back to
  const allTpl = document.createElement('template');
  allTpl.dataset.pool = 'all';
  allTpl.content.append(...[...track.children].slice(0, loop ? track.children.length / 2 : track.children.length).map((c) => c.cloneNode(true)));
  pools.set('all', allTpl);

  const wrap = () => { if (setW > 0) { while (x <= -setW) x += setW; while (x > 0) x -= setW; } else x = Math.min(0, Math.max(x, -(track.scrollWidth - vp.clientWidth))); };
  const tick = (now: number, dt: number) => {
    if (!running) return false;
    dt = Math.min(dt, 50);
    if (!dragging) {
      target = still || hover || holding || now < resumeAt || !loop ? 0 : SPEED;
      // inertia after a fling decays to the target speed; resuming takes ~0.6 s
      const tau = Math.abs(v) > SPEED * 1.5 ? 350 : 600;
      v += (target - v) * (1 - Math.exp(-dt / tau));
      x -= (v * dt) / 1000;
      wrap();
      write();
    }
    return true;
  };
  const start = () => { if (running || !inView || document.hidden) return; running = true; addTask({ write: tick }); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; row.classList.toggle('is-run', inView); if (inView) start(); else running = false; }).observe(row);
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else start(); });
  row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = false; });

  /* own horizontal gesture */
  let dragging = false, decided = false, sx = 0, sy = 0, lx = 0, lt = 0, vel = 0, holdT = 0, pid = -1, moved = false;
  vp.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    pid = e.pointerId; sx = lx = e.clientX; sy = e.clientY; lt = performance.now(); decided = false; dragging = false; moved = false; vel = 0;
    holdT = window.setTimeout(() => { holding = true; }, 150);
  });
  vp.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(holdT);
      decided = true;
      if (Math.abs(dx) > Math.abs(dy)) { dragging = true; moved = true; holding = false; vp.setPointerCapture(pid); }
      else { holding = false; pid = -1; return; } // vertical: the page scrolls, the ribbon keeps moving
    }
    if (!dragging) return;
    const now = performance.now(), ddx = e.clientX - lx;
    x += ddx; wrap(); write();
    vel = ddx / Math.max(1, now - lt) * 1000; // px/s
    lx = e.clientX; lt = now;
  });
  const end = () => {
    clearTimeout(holdT);
    if (dragging) { v = -vel; resumeAt = performance.now() + 2500; }
    else if (holding) resumeAt = performance.now() + 600;
    dragging = false; holding = false; pid = -1;
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);
  vp.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
});
