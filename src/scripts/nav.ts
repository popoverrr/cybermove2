// Interaction #2 — morphing nav capsule. States live in header[data-state]: top (A) → capsule (B) ⇄ expanded (C); menu open (D) = .is-open.
import { subscribeScroll } from './core/scroll';
import { desktopMQ, finePointerMQ, reduced } from './core/motion';
import { debounce } from './core/observe';

type State = 'top' | 'capsule' | 'expanded';

const hdr = document.getElementById('hdr');
if (hdr) initNav(hdr);

function initNav(hdr: HTMLElement) {
  const q = <T extends HTMLElement>(s: string) => hdr.querySelector<T>(s)!;
  const brand = q('.hdr__brand');
  const menuBtn = q<HTMLButtonElement>('.hdr__menu');
  const cap = q('.hdr__cap');
  const progress = q('.hdr__progress');
  const labelBox = q('.hdr__label');
  const panel = q('.menu');
  const backdrop = q('.menu-backdrop');
  const root = document.documentElement;

  let state: State = 'top';
  let vw = 0, vh = 0, docH = 0;
  let lastInteract = 0;
  let hovering = false;
  let prog = 0;
  let open = false;

  const canExpand = () => desktopMQ.matches && finePointerMQ.matches;
  const capW = (s: State) => {
    if (!desktopMQ.matches) return vw - 32;
    return Math.min(s === 'expanded' ? 880 : 560, vw - 32);
  };

  /* Read geometry once per resize (never per scroll). */
  function measure() {
    vw = root.clientWidth;
    vh = window.innerHeight;
    docH = root.scrollHeight;
    const barLeft = (brand.offsetParent as HTMLElement | null)?.offsetLeft ?? 0;
    const brandLeft = barLeft + brand.offsetLeft;
    const menuLeft = barLeft + menuBtn.offsetLeft;
    const menuW = menuBtn.offsetWidth;
    const set = (k: string, v: number) => hdr.style.setProperty(k, `${Math.round(v)}px`);
    for (const s of ['capsule', 'expanded'] as State[]) {
      const w = capW(s);
      const left = (vw - w) / 2;
      const key = s === 'capsule' ? 'b' : 'c';
      set(`--cap-w-${key}`, w);
      set(`--brand-dx-${key}`, left + 14 - brandLeft);
      set(`--menu-dx-${key}`, left + w - 6 - menuW - menuLeft);
    }
    writeProgress();
  }

  function writeProgress() {
    const w = capW(state);
    const left = (vw - w) / 2;
    const s = vw ? (left + prog * w) / vw : 0;
    progress.style.transform = `scaleX(${s.toFixed(4)})`;
  }

  function setState(s: State) {
    if (s === state) return;
    state = s;
    hdr.dataset.state = s;
    writeProgress();
  }

  subscribeScroll((y, dy) => {
    const max = Math.max(1, docH - vh);
    prog = Math.min(1, Math.max(0, y / max));
    if (!open) {
      const now = performance.now();
      if (y <= 80) setState('top');
      else if (state === 'top') setState('capsule');
      else if (dy < -2 && canExpand()) { setState('expanded'); lastInteract = now; }
      else if (dy > 2 && state === 'expanded' && !hovering && now - lastInteract > 1500) setState('capsule');
    }
    writeProgress();
  });

  hdr.addEventListener('pointerenter', () => {
    hovering = true;
    if (state === 'capsule' && canExpand()) setState('expanded');
  });
  hdr.addEventListener('pointerleave', () => { hovering = false; lastInteract = performance.now(); });
  hdr.addEventListener('focusin', () => { if (state === 'capsule' && canExpand()) setState('expanded'); });

  /* Theme + section label: a thin observation line at capsule height. */
  let io: IntersectionObserver | null = null;
  let currentLabel = '';
  function observeBlocks() {
    io?.disconnect();
    const line = 38;
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        hdr.dataset.theme = el.dataset.theme || 'dark';
        setLabel(el.dataset.label || '');
      }
    }, { rootMargin: `-${line}px 0px -${Math.max(0, vh - line - 1)}px 0px` });
    document.querySelectorAll('[data-label]').forEach((b) => io!.observe(b));
  }

  function setLabel(text: string) {
    if (text === currentLabel) return;
    currentLabel = text;
    const old = labelBox.querySelector<HTMLElement>('.hdr__label-in:not(.is-out)');
    if (!old || reduced() || state === 'top') {
      labelBox.querySelectorAll('.is-out').forEach((n) => n.remove());
      if (old) old.textContent = text;
      return;
    }
    const nu = document.createElement('span');
    nu.className = 'hdr__label-in is-in';
    nu.textContent = text;
    old.classList.add('is-out');
    old.addEventListener('animationend', () => old.remove(), { once: true });
    labelBox.append(nu);
    nu.addEventListener('animationend', () => nu.classList.remove('is-in'), { once: true });
  }

  /* D — menu panel */
  const focusables = () => [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
  function openMenu() {
    if (open) return;
    open = true;
    panel.hidden = false;
    backdrop.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.querySelector('.hdr__menu-text')!.textContent = menuBtn.dataset.closeLabel || '';
    root.classList.add('menu-open');
    void panel.offsetWidth; // commit hidden→visible before transitioning
    hdr.classList.add('is-open');
    const first = panel.querySelector<HTMLElement>('.menu__links a');
    first?.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
  }
  function closeMenu(restoreFocus = true) {
    if (!open) return;
    open = false;
    hdr.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.querySelector('.hdr__menu-text')!.textContent = menuBtn.dataset.openLabel || '';
    root.classList.remove('menu-open');
    document.removeEventListener('keydown', onKey);
    const done = () => { if (!open) { panel.hidden = true; backdrop.hidden = true; } };
    if (reduced()) done(); else setTimeout(done, 420);
    if (restoreFocus) menuBtn.focus({ preventScroll: true });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const items = [menuBtn, ...focusables()];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
    else if (i === -1) { e.preventDefault(); items[0].focus(); }
  }
  menuBtn.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  hdr.querySelectorAll('[data-menu-close]').forEach((b) => b.addEventListener('click', () => closeMenu()));
  panel.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) closeMenu(false); });
  cap.addEventListener('click', () => { if (!desktopMQ.matches && state !== 'top') openMenu(); });
  document.addEventListener('pointerdown', (e) => {
    if (open && !panel.contains(e.target as Node) && !menuBtn.contains(e.target as Node)) closeMenu(false);
  });

  const onResize = debounce(() => { measure(); observeBlocks(); if (!desktopMQ.matches && state === 'expanded') setState('capsule'); }, 150);
  window.addEventListener('resize', onResize);
  new ResizeObserver(debounce(() => { docH = root.scrollHeight; }, 200)).observe(document.body);

  measure();
  observeBlocks();
  if (window.scrollY > 80) setState('capsule');
  requestAnimationFrame(() => hdr.classList.add('is-ready'));
}
