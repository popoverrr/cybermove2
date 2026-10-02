// Pause CSS marquees while off-screen.
document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((m) => {
  new IntersectionObserver(([e]) => m.classList.toggle('is-paused', !e.isIntersecting)).observe(m);
});
