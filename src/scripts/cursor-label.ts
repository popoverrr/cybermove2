// Interaction #6b — contextual label attached to the (always visible, native) cursor. Zero interpolation.
import { addTask } from './core/raf';
import { finePointer } from './core/motion';

const label = document.querySelector<HTMLElement>('.cursor-label');
if (label && finePointer()) {
  let x = 0, y = 0, shown = false, queued = false;
  const span = label.querySelector('span')!;
  const def = span.textContent!.replace(/\s*→$/, '');
  let cur = def;
  const write = () => { label.style.transform = `translate3d(${x + 16}px, ${y + 16}px, 0)`; queued = false; return false; };
  const hide = () => { if (shown) { shown = false; label.classList.remove('is-on'); } };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    const el = (e.target as Element).closest?.<HTMLElement | SVGElement>('[data-cursor]');
    const over = !!el;
    // an element may carry its own label text (data-cursor="…"); otherwise the default «Open →»
    const text = el?.dataset.cursor || def;
    if (over && text !== cur) { cur = text; span.textContent = `${text} →`; }
    if (!queued) { queued = true; addTask({ write }); }
    if (over !== shown) { shown = over; label.classList.toggle('is-on', over); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide);
  window.addEventListener('scroll', hide, { passive: true });
}
