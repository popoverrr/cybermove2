// Non-blocking FLIP swap for filtered lists (interaction #3). Items toggle the `is-off` class.
// Leaving: fade + 8px drop → removed; staying: slide from old to new position; entering: rise with a 20 ms stagger.
import { reduced } from './motion';

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MAX = 40;
let token = 0;

export async function flipSwap(items: HTMLElement[], isOn: (el: HTMLElement) => boolean): Promise<void> {
  const my = ++token;
  // finish any running swap instantly
  items.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));

  const visible = items.filter((el) => !el.classList.contains('is-off'));
  const leaving = visible.filter((el) => !isOn(el));
  const staying = visible.filter(isOn);
  const entering = items.filter((el) => el.classList.contains('is-off') && isOn(el));

  const apply = () => {
    leaving.forEach((el) => el.classList.add('is-off'));
    entering.forEach((el) => el.classList.remove('is-off'));
  };

  if (reduced()) {
    apply();
    entering.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }));
    return;
  }

  if (leaving.length) {
    await Promise.all(
      leaving.slice(0, MAX).map((el) =>
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], {
          duration: 160, easing: 'ease-in', fill: 'forwards',
        }).finished.catch(() => undefined),
      ),
    );
    if (my !== token) return;
  }

  // First (read all), then Last, Invert, Play
  const first = new Map(staying.slice(0, MAX).map((el) => [el, el.getBoundingClientRect()]));
  apply();
  leaving.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
  const moves: [HTMLElement, number, number][] = [];
  for (const [el, a] of first) {
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moves.push([el, dx, dy]);
  }
  for (const [el, dx, dy] of moves) {
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE });
  }
  entering.slice(0, MAX).forEach((el, i) => {
    el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], {
      duration: 480, delay: i * 20, easing: EASE, fill: 'backwards',
    });
  });
}
