// Case ribbons (rework §6). Native horizontal scrolling everywhere (touch swipe with snap works as is).
// auto: advances scrollLeft at ~30 px/s from the shared rAF, wraps at the second copy (no seam), pauses while the
// pointer is over it or a finger is on it, resumes 3 s after a manual scroll; off-screen / hidden tab → stopped.
// manual: arrow buttons, mouse drag, Shift + wheel. Filtering (home): CustomEvent 'crow:filter' {sector}.
import { addTask } from './core/raf';
import { reduced } from './core/motion';

const SPEED = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--speed-ribbon')) || 30;

document.querySelectorAll<HTMLElement>('[data-crow]').forEach((row) => {
  const vp = row.querySelector<HTMLElement>('.crow__viewport')!;
  const track = row.querySelector<HTMLElement>('.crow__track')!;
  const cards = [...track.querySelectorAll<HTMLElement>('.pcard')];
  const auto = row.dataset.crow === 'auto' && !reduced();

  /* filtering (both copies) */
  row.addEventListener('crow:filter', ((e: CustomEvent<{ sector: string }>) => {
    const s = e.detail.sector;
    track.classList.add('is-swapping');
    setTimeout(() => {
      cards.forEach((c) => c.classList.toggle('is-off', s !== 'all' && c.dataset.sector !== s));
      vp.scrollLeft = 0; pos = 0;
      measure();
      track.classList.remove('is-swapping');
    }, 180);
  }) as EventListener);

  /* manual: arrows, drag, shift-wheel */
  const stepBy = (dir: number) => {
    const card = cards.find((c) => !c.classList.contains('is-off'));
    const w = card ? card.getBoundingClientRect().width + 16 : vp.clientWidth * 0.8;
    vp.scrollBy({ left: dir * w, behavior: reduced() ? 'auto' : 'smooth' });
  };
  row.querySelector('[data-crow-prev]')?.addEventListener('click', () => stepBy(-1));
  row.querySelector('[data-crow-next]')?.addEventListener('click', () => stepBy(1));
  let drag: { x: number; left: number; moved: boolean } | null = null;
  vp.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, left: vp.scrollLeft, moved: false }; } });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) { drag.moved = true; row.classList.add('is-dragging'); }
    vp.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => { if (drag) { setTimeout(() => row.classList.remove('is-dragging'), 0); drag = null; } });
  vp.addEventListener('click', (e) => { if (row.classList.contains('is-dragging')) { e.preventDefault(); e.stopPropagation(); } }, true);

  /* auto mode */
  let half = 0, pos = 0, running = false, inView = false, paused = false, resumeAt = 0, v = auto ? SPEED : 0;
  function measure() {
    // the second copy starts at half of the visible cards
    const vis = cards.filter((c) => !c.classList.contains('is-off'));
    const n = vis.length / 2;
    half = n >= 1 && vis[n] ? vis[n].offsetLeft - vis[0].offsetLeft : 0;
  }
  if (!auto) return;
  measure();
  new ResizeObserver(measure).observe(track);
  const write = (now: number, dt: number) => {
    if (!running) return false;
    dt = Math.min(dt, 50);
    const target = paused || now < resumeAt ? 0 : SPEED;
    v += (target - v) * (1 - Math.exp(-dt / 160));
    if (v > 0.5 && half > 0) {
      pos = vp.scrollLeft + (v * dt) / 1000;
      if (pos >= half) pos -= half;
      vp.scrollLeft = pos;
    }
    return true;
  };
  const start = () => { if (running || !inView || document.hidden) return; running = true; addTask({ write }); };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) start(); else running = false; }).observe(row);
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else start(); });
  row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') paused = true; });
  row.addEventListener('pointerleave', () => { paused = false; });
  vp.addEventListener('touchstart', () => { paused = true; row.classList.add('is-touch'); }, { passive: true });
  vp.addEventListener('touchend', () => { paused = false; resumeAt = performance.now() + 3000; }, { passive: true });
  // a manual wrap for swipes past the second copy
  vp.addEventListener('scroll', () => { if (half > 0 && vp.scrollLeft >= half * 1.5 && !running) vp.scrollLeft -= half; }, { passive: true });
});
