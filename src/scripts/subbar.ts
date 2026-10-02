// Local sticky strips ([data-subbar]: chips on /cases/, the method counter) and the header (docs/12-fixes-3.md §1):
// while a strip is stuck, scrolling down hides the header and the strip rises to the top of the screen;
// scrolling up brings the header back and the strip sits right under it. Threshold 8 px, transform only.
import { subscribeScroll } from './core/scroll';

// strips may be created by other modules (the method strip) — start on the next frame
requestAnimationFrame(init);

function init() {
const bars = [...document.querySelectorAll<HTMLElement>('[data-subbar]')];
const hdr = document.getElementById('hdr');
const root = document.documentElement;

if (bars.length && hdr) {
  const stuck = new Set<HTMLElement>();
  // read once per width change, never per scroll frame
  let hH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 72;
  const headerH = () => hH;
  let io: IntersectionObserver | null = null;
  const sentinels = bars.map((bar) => {
    const s = document.createElement('i');
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'display:block;height:1px;margin-bottom:-1px;pointer-events:none';
    bar.before(s);
    return s;
  });
  const owner = new Map(sentinels.map((s, i) => [s as Element, bars[i]]));
  const observe = () => {
    io?.disconnect();
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const bar = owner.get(e.target)!;
        // stuck = the sentinel scrolled above the header line while the bar's own block is still on screen
        const on = !e.isIntersecting && e.boundingClientRect.top < headerH();
        bar.classList.toggle('is-stuck', on);
        if (on) stuck.add(bar); else stuck.delete(bar);
      }
      if (!stuck.size) setAway(false);
    }, { rootMargin: `-${Math.round(headerH()) + 1}px 0px 0px 0px` });
    sentinels.forEach((s) => io!.observe(s));
  };
  observe();
  let lastW = innerWidth;
  window.addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; hH = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 72; observe(); } });

  let away = false, acc = 0;
  function setAway(v: boolean) {
    if (v === away) return;
    away = v; acc = 0;
    hdr!.classList.toggle('is-away', v);
    root.classList.toggle('hdr-away', v);
  }
  subscribeScroll((_y, dy) => {
    // a strip counts as stuck only while its block is still in view (the method strip leaves with its block)
    if (!stuck.size) { setAway(false); return; }
    const active = [...stuck].some((b) => { const r = b.parentElement!.getBoundingClientRect(); return r.bottom > headerH() + 60; });
    if (!active || root.classList.contains('menu-open')) { setAway(false); return; }
    if (Math.sign(dy) !== Math.sign(acc)) acc = 0;
    acc += dy;
    if (acc > 8) setAway(true);
    else if (acc < -8) setAway(false);
  });
}
}
