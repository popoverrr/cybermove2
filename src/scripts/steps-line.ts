// «About» window: CHAOS → CORE → SYSTEM → GROWTH line (docs/12-fixes-3.md §2). An accent fill runs over the hairline;
// reaching a step lights its dot and labels. Phones: the fill follows the scroll (spring-smoothed, also backwards);
// desktop (hover): one 2.4 s pass when the window appears, replayed on hover. Then a small spark runs every ~4 s.
// Reduced motion / no JS: fully filled (CSS).
import { addTask } from './core/raf';
import { spring, stepSpring } from './core/spring';
import { reduced } from './core/motion';

const hoverMQ = window.matchMedia('(hover: hover) and (pointer: fine)');

document.querySelectorAll<HTMLElement>('[data-steps-line]').forEach((line) => {
  if (reduced()) return;
  line.classList.add('is-live');
  const fill = line.querySelector<HTMLElement>('.hwin__fill')!;
  const items = [...line.querySelectorAll<HTMLElement>('li')];
  const win = line.closest<HTMLElement>('.hwin') ?? line;
  const n = items.length;
  let shown = -1;
  const paint = (p: number) => {
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    const lit = p >= 0.999 ? n : Math.floor(p * n + 0.02); // dots sit at the start of each of the n columns
    if (lit !== shown) {
      shown = lit;
      items.forEach((li, i) => li.classList.toggle('is-lit', i < lit || (i === 0 && p > 0.01)));
      line.classList.toggle('is-done', lit >= n);
    }
  };
  paint(0);
  const measure = () => line.style.setProperty('--track-w', `${line.clientWidth - 13}px`);
  measure();
  window.addEventListener('resize', measure);

  /* desktop: timed pass on appear / hover */
  let playing = 0;
  const play = () => {
    const id = ++playing, t0 = performance.now();
    addTask({ write: (now) => {
      if (id !== playing) return false;
      const k = Math.min(1, (now - t0) / 2400);
      paint(1 - Math.pow(1 - k, 3));
      return k < 1;
    } });
  };

  /* phones: scroll-linked with a spring */
  const s = spring(0);
  let running = false, inView = false;
  const target = () => {
    const r = win.getBoundingClientRect(), vh = window.innerHeight;
    const start = vh - r.height / 3;          // window shows a third of itself from below → 0
    const end = vh / 2 - r.height / 2;        // window centre at the screen centre → 1
    return Math.min(1, Math.max(0, (start - r.top) / (start - end)));
  };
  const tick = (_n: number, dt: number) => {
    s.target = target();
    const moving = stepSpring(s, Math.min(dt, 50), 70, 15);
    paint(Math.min(1, Math.max(0, s.x)));
    if (!moving) running = false;
    return running;
  };
  const kick = () => { if (!running && inView && !hoverMQ.matches) { running = true; addTask({ write: tick }); } };

  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && hoverMQ.matches && shown <= 0) play();
    kick();
  }).observe(win);
  window.addEventListener('scroll', kick, { passive: true });
  win.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && hoverMQ.matches) { paint(0); play(); } });
});
