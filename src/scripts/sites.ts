// Website previews (docs/13-fixes-4.md §4.2): the long screenshot «scrolls» inside the window.
// Phones / touch: tied to the page scroll while the card crosses the screen (up to ~60 % of the strip, spring).
// Desktop: hover → the strip glides down over ~6 s (CSS transition), back on leave. transform only.
import { addTask } from './core/raf';
import { spring, stepSpring } from './core/spring';
import { reduced, finePointer } from './core/motion';

document.querySelectorAll<HTMLElement>('[data-site]').forEach((card) => {
  if (reduced()) return;
  const screen = card.querySelector<HTMLElement>('.site__screen')!;
  const strip = card.querySelector<HTMLElement>('[data-site-strip]')!;
  let travel = 0, maxTouch = 0, top = 0, vh = 0, h = 0;
  const measure = () => {
    const sh = strip.offsetHeight, wh = screen.clientHeight;
    travel = Math.max(0, sh - wh);
    maxTouch = Math.min(travel, sh * 0.6);
    strip.style.setProperty('--travel', `${-travel}px`);
    const r = card.getBoundingClientRect();
    top = r.top + window.scrollY; h = r.height; vh = window.innerHeight;
  };
  new ResizeObserver(measure).observe(strip);
  let lastW = innerWidth;
  window.addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; measure(); } });
  measure();
  if (finePointer()) { card.classList.add('is-hover-mode'); return; }

  const s = spring(0);
  let running = false, inView = false;
  const tick = (_n: number, dt: number) => {
    const k = Math.min(1, Math.max(0, (window.scrollY + vh - top) / (vh + h)));
    s.target = -k * maxTouch;
    const moving = stepSpring(s, Math.min(dt, 50), 60, 14);
    strip.style.transform = `translate3d(0, ${s.x.toFixed(2)}px, 0)`;
    if (!moving && !inView) running = false;
    return running && (moving || inView);
  };
  const kick = () => { if (!running && inView) { running = true; addTask({ write: tick }); } };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); }).observe(card);
  window.addEventListener('scroll', kick, { passive: true });
});
