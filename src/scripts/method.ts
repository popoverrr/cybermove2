// Method steps: sticky counter + progress; the step crossing the viewport centre is active (desktop).
// Below 1024 px (docs/11-fixes-2.md §A2): a sticky strip under the header — «01 / 04», the stage label and a
// full-width progress line (scaleX); the step nearest the top third is active. Without JS / reduced motion: a list.
import { addTask } from './core/raf';
import { reduced } from './core/motion';

const mobileMQ = window.matchMedia('(max-width: 1023px)');

document.querySelectorAll<HTMLElement>('[data-method]').forEach((root) => {
  const steps = [...root.querySelectorAll<HTMLElement>('.method__step')];
  const now = root.querySelector<HTMLElement>('.method__now')!;
  const fill = root.querySelector<HTMLElement>('.method__fill')!;
  const total = String(steps.length).padStart(2, '0');
  const stage = (s: HTMLElement) => (s.querySelector('.label')?.textContent || '').split('·').pop()!.trim();

  // mobile strip (JS-only enhancement)
  let bar: HTMLElement | null = null, barNow: HTMLElement | null = null, barStage: HTMLElement | null = null, barFill: HTMLElement | null = null;
  if (!reduced()) {
    bar = document.createElement('div');
    bar.className = 'method__bar label';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = `<span class="method__bar-num"><span class="method__bar-now">01</span><span class="muted"> / ${total}</span></span><span class="method__bar-stage"></span><i class="method__bar-track"><i class="method__bar-fill"></i></i>`;
    root.querySelector('.method__steps')!.before(bar);
    barNow = bar.querySelector('.method__bar-now');
    barStage = bar.querySelector('.method__bar-stage');
    barFill = bar.querySelector('.method__bar-fill');
    root.classList.add('method--live');
  }

  let cur = -1;
  const set = (i: number) => {
    if (i === cur) return;
    cur = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const n = String(i + 1).padStart(2, '0');
    now.textContent = n;
    fill.style.transform = `scaleY(${(i + 1) / steps.length})`;
    if (barNow && barStage) {
      barNow.textContent = n;
      barStage.textContent = stage(steps[i]);
      barNow.classList.remove('is-tick'); void barNow.offsetWidth; barNow.classList.add('is-tick');
    }
  };
  let io: IntersectionObserver | null = null;
  const observe = () => {
    io?.disconnect();
    // desktop: viewport centre; mobile: the top third
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) set(steps.indexOf(e.target as HTMLElement));
    }, { rootMargin: mobileMQ.matches ? '-30% 0px -69% 0px' : '-45% 0px -54% 0px' });
    steps.forEach((s) => io!.observe(s));
  };
  observe();
  mobileMQ.addEventListener('change', observe);
  set(0);

  // progress line follows the scroll through the steps (mobile)
  if (barFill) {
    const list = root.querySelector<HTMLElement>('.method__steps')!;
    let queued = false;
    const write = () => {
      queued = false;
      const r = list.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (window.innerHeight * 0.33 - r.top) / Math.max(1, r.height - window.innerHeight * 0.33)));
      barFill!.style.transform = `scaleX(${k.toFixed(4)})`;
      return false;
    };
    window.addEventListener('scroll', () => { if (!queued && mobileMQ.matches) { queued = true; addTask({ write }); } }, { passive: true });
    addTask({ write });
  }
});
