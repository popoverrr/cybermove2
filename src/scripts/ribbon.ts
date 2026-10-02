// «Cases» window ribbon (docs/12-fixes-3.md §4): two copies of the industry groups move up at ~20 px/s and wrap
// seamlessly; the window title shows the industry at the top. Hover / touch slows it to a stop in ~0.3 s.
// Geometry is measured on init and on width changes only; each frame writes one transform. Paused off-screen.
import { addTask } from './core/raf';
import { reduced } from './core/motion';

const SPEED = 20; // px/s

document.querySelectorAll<HTMLElement>('[data-ribbon]').forEach((ribbon) => {
  if (reduced()) return;
  const win = ribbon.closest<HTMLElement>('.hwin')!;
  const title = win.querySelector<HTMLElement>('[data-ribbon-title]');
  const firstSet = ribbon.querySelector<HTMLElement>('.hwin__ribbon-set')!;
  const groups = [...firstSet.querySelectorAll<HTMLElement>('.hwin__group')];
  let setH = 0, offsets: number[] = [];
  const measure = () => {
    setH = firstSet.offsetHeight;
    offsets = groups.map((g) => g.offsetTop);
  };
  measure();
  let lastW = innerWidth;
  window.addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; measure(); } });
  new ResizeObserver(() => measure()).observe(firstSet); // images arriving change the height

  let y = 0, v = SPEED, target = SPEED, running = false, inView = false, current = -1;
  const setTitle = (i: number) => {
    if (!title || i === current) return;
    current = i;
    title.textContent = groups[i].dataset.group || '';
    title.classList.remove('is-swap'); void title.offsetWidth; title.classList.add('is-swap');
  };
  const write = (_now: number, dt: number) => {
    if (!running) return false;
    dt = Math.min(dt, 50);
    v += (target - v) * (1 - Math.exp(-dt / 100)); // ~0.3 s to stop / resume
    if (setH > 0) {
      y = (y + (v * dt) / 1000) % setH;
      ribbon.style.transform = `translate3d(0, ${(-y).toFixed(2)}px, 0)`;
      let i = 0;
      for (let k = 0; k < offsets.length; k++) if (offsets[k] <= y + 24) i = k;
      setTitle(i);
    }
    return true;
  };
  const start = () => { if (running || !inView || document.hidden) return; running = true; addTask({ write }); };
  const stop = () => { running = false; };
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); }).observe(win);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  win.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') target = 0; });
  win.addEventListener('pointerleave', () => { target = SPEED; });
  win.addEventListener('touchstart', () => { target = 0; }, { passive: true });
  win.addEventListener('touchend', () => { target = SPEED; }, { passive: true });
  win.addEventListener('touchcancel', () => { target = SPEED; }, { passive: true });
  setTitle(0);
});
