// Interaction #4 — bending text finale. Per frame: integrate springs → write one `d` and one `startOffset`.
import { addTask } from './core/raf';
import { subscribeScroll } from './core/scroll';
import { spring, stepSpring } from './core/spring';
import { finePointer, reduced, clamp } from './core/motion';
import { debounce } from './core/observe';

const root = document.querySelector<HTMLElement>('[data-bend]');
if (root) {
  if (reduced()) root.classList.add('is-static');
  else init(root);
}

function init(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>('svg')!;
  const path = root.querySelector<SVGPathElement>('path')!;
  const text = root.querySelector<SVGTextElement>('text')!;
  const tp = root.querySelector<SVGTextPathElement>('textPath')!;
  const phraseChars = (root.querySelector('.bend__link')?.textContent || '').length + 3; // phrase + separator

  let W = 0, H = 0, fs = 0, baseY = 0, unit = 1;
  let offset = 0;
  let start0 = 0;
  let started = false;
  let vel = 0;
  const sag = spring(0);  // vertical pull at the control point (px)
  const cx = spring(0.5); // control point x (fraction of width)
  let pointerIn = false;
  let running = false;
  let inView = false;

  function measure() {
    W = svg.clientWidth || root.clientWidth;
    fs = parseFloat(getComputedStyle(text).fontSize) || 120;
    H = Math.round(fs * 1.55);
    baseY = Math.round(H * 0.66);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    try { unit = text.getSubStringLength(0, phraseChars); } catch { unit = W; }
    if (!unit || !isFinite(unit)) unit = W;
    start0 = fs * 0.5 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter-x')) || 16); // path starts off-screen by fs/2: begin the phrase at the visible edge
    if (!started) offset = start0;
    write();
  }

  function write() {
    const pad = fs * 0.5;
    const x = cx.x * W;
    const y = baseY + sag.x;
    path.setAttribute('d', `M${(-pad).toFixed(1)} ${baseY} Q${x.toFixed(1)} ${y.toFixed(1)} ${(W + pad).toFixed(1)} ${baseY} L${(W * 8).toFixed(0)} ${baseY}`);
    tp.setAttribute('startOffset', offset.toFixed(1));
  }

  const task = {
    write: (_n: number, dt: number) => {
      // scroll velocity (px/ms) decays when scrolling stops
      vel *= Math.pow(0.82, dt / 16.67);
      if (!pointerIn) {
        sag.target = clamp(vel * fs * 0.09, -0.18 * fs, 0.18 * fs);
        cx.target = 0.5;
      }
      const a = stepSpring(sag, dt);
      const b = stepSpring(cx, dt, 120, 16);
      // slow loop: one phrase per 40 s
      offset -= (unit / 40000) * dt;
      if (offset <= start0 - unit) offset += unit;
      started = true;
      write();
      const keep = inView || a || b;
      running = keep;
      return keep;
    },
  };
  const start = () => { if (!running) { running = true; addTask(task); } };

  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView) start();
  }).observe(root);

  subscribeScroll((_y, dy, dt) => {
    if (!inView) return;
    vel = vel * 0.6 + (dy / Math.max(dt, 8)) * 0.4;
  });

  if (finePointer()) {
    root.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      pointerIn = true;
      cx.target = clamp((e.clientX - r.left) / W, 0.05, 0.95);
      sag.target = clamp(e.clientY - r.top - baseY, -0.12 * fs, 0.12 * fs);
    }, { passive: true });
    root.addEventListener('pointerleave', () => { pointerIn = false; sag.target = 0; cx.target = 0.5; });
  } else {
    // mobile: a tap plucks the line once
    root.addEventListener('pointerdown', () => {
      sag.x = (Math.random() > 0.5 ? 1 : -1) * 0.14 * fs;
      sag.v = 0;
      start();
    }, { passive: true });
  }

  window.addEventListener('resize', debounce(measure, 150));
  (document.fonts?.ready ?? Promise.resolve()).then(measure);
  measure();
  root.classList.add('is-live');
}
