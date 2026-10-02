// Website cards: the long screenshot glides down and back inside its window (CSS animation of transform).
// The travel distance is measured once per image load / width change; the animation runs only on screen.
import { reduced } from './core/motion';

const seen = new WeakSet<Element>();
const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-on', e.isIntersecting)), { rootMargin: '50px' });

function setup(wrap: HTMLElement) {
  if (seen.has(wrap)) return;
  seen.add(wrap);
  const img = wrap.querySelector('img');
  if (!img || reduced()) return;
  const measure = () => {
    const travel = img.offsetHeight - wrap.clientHeight;
    if (travel > 20) { wrap.style.setProperty('--travel', `${-travel}px`); wrap.style.setProperty('--dur', `${Math.max(14, travel / 60)}s`); wrap.classList.add('is-scroll'); }
  };
  if (img.complete && img.naturalHeight) measure(); else img.addEventListener('load', measure, { once: true });
  io.observe(wrap);
}
const scan = () => document.querySelectorAll<HTMLElement>('[data-site-shot]').forEach(setup);
scan();
// cards cloned into the home ribbon later (filter / loop copies)
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
