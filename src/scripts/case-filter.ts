// Chips (docs/15-stabilize.md §2).
import { subscribeScroll } from './core/scroll';
import { reduced } from './core/motion';

/* home: filter the ribbon */
document.querySelectorAll<HTMLElement>('[data-gchips="filter"]').forEach((box) => {
  const chips = [...box.querySelectorAll<HTMLElement>('.gchip')];
  const row = document.getElementById(box.dataset.target!);
  chips.forEach((c) => {
    c.addEventListener('pointerdown', () => { c.classList.remove('is-flash'); void c.offsetWidth; c.classList.add('is-flash'); });
    c.addEventListener('click', () => {
      if (c.classList.contains('is-on')) return;
      chips.forEach((x) => { const on = x === c; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
      row?.dispatchEvent(new CustomEvent('crow:filter', { detail: { sector: c.dataset.sector } }));
    });
  });
});

/* /cases/: in-place chips + a one-line bar with scrollspy */
const nav = document.querySelector<HTMLElement>('[data-gchips="nav"]');
const bar = document.querySelector<HTMLElement>('[data-cbar]');
if (nav && bar) {
  const row = bar.querySelector<HTMLElement>('.cbar__row')!;
  const chips = [...row.querySelectorAll<HTMLElement>('.gchip')];
  const heads = chips.map((c) => document.getElementById(c.dataset.sector!)?.querySelector<HTMLElement>('h2')).filter(Boolean) as HTMLElement[];
  const root = document.documentElement;
  const hdr = document.getElementById('hdr');
  let hH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76;
  const BAR = 52;

  // the bar shows once the in-place chips have scrolled away
  new IntersectionObserver(([e]) => {
    const show = !e.isIntersecting && e.boundingClientRect.top < 0;
    bar.classList.toggle('is-on', show);
    bar.setAttribute('aria-hidden', String(!show));
    chips.forEach((c) => c.setAttribute('tabindex', show ? '0' : '-1'));
    if (!show) setAway(false);
  }, { rootMargin: `-${hH}px 0px 0px 0px` }).observe(nav);

  // exactly one active chip; while the page scrolls to a clicked section the highlight jumps straight to it
  let active = -1, lockUntil = 0, userScrollUntil = 0;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    chips.forEach((c, k) => c.classList.toggle('is-on', k === i));
    if (performance.now() < userScrollUntil) return;
    const c = chips[i];
    const pad = parseFloat(getComputedStyle(row).paddingLeft) || 16;
    row.scrollTo({ left: Math.max(0, c.offsetLeft - pad), behavior: reduced() ? 'auto' : 'smooth' });
  };
  const passed = heads.map(() => false);
  const line = () => hH + BAR + 8;
  const io = new IntersectionObserver((es) => {
    for (const e of es) passed[heads.indexOf(e.target as HTMLElement)] = e.boundingClientRect.top < line();
    if (performance.now() < lockUntil) return;
    let i = 0;
    passed.forEach((p, k) => { if (p) i = k; });
    setActive(i);
  }, { rootMargin: `-${line()}px 0px 0px 0px`, threshold: [0, 1] });
  heads.forEach((h) => io.observe(h));
  setActive(0);

  // the user swiping the bar: no auto-scroll of the bar for a moment
  row.addEventListener('touchstart', () => { userScrollUntil = performance.now() + 1500; }, { passive: true });
  row.addEventListener('wheel', () => { userScrollUntil = performance.now() + 1500; }, { passive: true });
  [...chips, ...nav.querySelectorAll<HTMLElement>('.gchip')].forEach((c) => c.addEventListener('click', () => {
    const i = chips.findIndex((x) => x.dataset.sector === c.dataset.sector);
    lockUntil = performance.now() + 900;
    userScrollUntil = 0;
    setActive(i);
  }));

  // header goes away on scroll down while the bar is shown, comes back on scroll up (threshold 8 px)
  let away = false, acc = 0;
  function setAway(v: boolean) { if (v === away) return; away = v; acc = 0; hdr?.classList.toggle('is-away', v); root.classList.toggle('hdr-away', v); }
  subscribeScroll((_y, dy) => {
    if (!bar.classList.contains('is-on') || root.classList.contains('menu-open')) { setAway(false); return; }
    if (Math.sign(dy) !== Math.sign(acc)) acc = 0;
    acc += dy;
    if (acc > 8) setAway(true); else if (acc < -8) setAway(false);
  });
  window.addEventListener('resize', () => { hH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76; });

  // old links: /cases/?sector=<id>
  const id = new URL(location.href).searchParams.get('sector');
  const sec = id && document.getElementById(id);
  if (sec) requestAnimationFrame(() => sec.scrollIntoView());
}
