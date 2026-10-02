// Interaction #5 — line-by-line heading reveals, fade-rise for small text, count-up numbers.
import { reduced } from './core/motion';
import { debounce } from './core/observe';
import { addTask } from './core/raf';

/* Split a plain-text heading into visual lines (grouped by offsetTop), each wrapped for a masked rise. */
function split(el: HTMLElement) {
  const text = (el.dataset.text ??= (el.textContent || '').trim().replace(/[ \t\r\n]+/g, ' ')); // keep non-breaking spaces
  const words = text.split(' ');
  el.textContent = '';
  // A heading made of several short sentences gets one sentence per line.
  const ends = (i: number) => i < words.length - 1 && /[.!?]$/.test(words[i]) && /^[A-ZА-ЯЁ«"“—]/.test(words[i + 1]);
  // each sentence is measured as its own balanced block, so no sentence ends in a lonely word
  let block = document.createElement('span');
  block.style.cssText = 'display:block;text-wrap:balance';
  el.append(block);
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    block.append(s);
    if (ends(i)) {
      block = document.createElement('span');
      block.style.cssText = 'display:block;text-wrap:balance';
      el.append(block);
    } else if (i < words.length - 1) block.append(' ');
    return s;
  });
  const lines: string[][] = [];
  let top = -Infinity;
  for (let i = 0; i < spans.length; i++) {
    const t = spans[i].offsetTop;
    if (t > top + 2 || (i > 0 && ends(i - 1))) { lines.push([]); top = t; }
    lines[lines.length - 1].push(words[i]);
  }
  el.textContent = '';
  lines.forEach((ws, i) => {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line__in';
    inner.style.setProperty('--li', String(i));
    inner.textContent = ws.join(' ');
    line.append(inner);
    el.append(line);
    if (i < lines.length - 1) el.append(' ');
  });
  el.dataset.w = String(el.clientWidth);
}

function countUp(el: HTMLElement) {
  const to = parseFloat(el.dataset.count || '0');
  const pad = el.dataset.pad ? parseInt(el.dataset.pad, 10) : 0;
  const fmt = (v: number) => String(Math.round(v)).padStart(pad, '0');
  if (reduced()) { el.textContent = fmt(to); return; }
  const start = performance.now();
  addTask({
    write: (now) => {
      const p = Math.min(1, (now - start) / 900);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      return p < 1;
    },
  });
}

// The first block (above the fold) animates in with CSS only, so LCP never waits for JS or fonts.
const inHero = (el: Element) => !!el.closest('.block--first');
const splitEls = [...document.querySelectorAll<HTMLElement>('[data-split]')].filter((el) => !inHero(el));
const items = [...document.querySelectorAll<HTMLElement>('.reveal')].filter((el) => !inHero(el));
document.querySelectorAll<HTMLElement>('.block--first .reveal').forEach((el) => {
  el.classList.add('is-in');
  el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
});

function reveal(el: HTMLElement) {
  el.classList.add('is-in');
  if (el.matches('[data-count]')) countUp(el);
  el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
}

if (reduced()) {
  items.forEach(reveal);
} else {
  let splitDone = false;
  const pending: HTMLElement[] = [];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      // Elements taller than the viewport never reach the ratio — reveal them as soon as they enter.
      const tall = e.boundingClientRect.height > window.innerHeight * 0.8;
      if (!e.isIntersecting || (!tall && e.intersectionRatio < 0.2)) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      if (!splitDone && el.hasAttribute('data-split')) pending.push(el); // wait for the line split
      else reveal(el);
    }
  }, { threshold: [0, 0.2] });

  // Observe right away (a fast scroll must never leave content hidden); split headings into lines
  // once webfonts are ready so line breaks are final. A heading revealed before that simply shows.
  const doSplit = () => {
    if (splitDone) return;
    splitDone = true;
    splitEls.forEach(split);
    // reveal queued headings on the next frame so the rise transition actually runs
    requestAnimationFrame(() => requestAnimationFrame(() => pending.splice(0).forEach(reveal)));
  };
  if (document.fonts?.status === 'loaded') doSplit();
  else {
    (document.fonts?.ready ?? Promise.resolve()).then(doSplit, doSplit);
    setTimeout(doSplit, 1200);
  }
  items.forEach((el) => io.observe(el));

  window.addEventListener('resize', debounce(() => {
    splitEls.forEach((el) => { if (String(el.clientWidth) !== el.dataset.w) split(el); });
  }, 150));
}
