// Method steps: sticky counter + progress; the step crossing the viewport centre is active.
document.querySelectorAll<HTMLElement>('[data-method]').forEach((root) => {
  const steps = [...root.querySelectorAll<HTMLElement>('.method__step')];
  const now = root.querySelector<HTMLElement>('.method__now')!;
  const fill = root.querySelector<HTMLElement>('.method__fill')!;
  const set = (i: number) => {
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    now.textContent = String(i + 1).padStart(2, '0');
    fill.style.transform = `scaleY(${(i + 1) / steps.length})`;
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) set(steps.indexOf(e.target as HTMLElement));
  }, { rootMargin: '-45% 0px -54% 0px' });
  steps.forEach((s) => io.observe(s));
  set(0);
});
