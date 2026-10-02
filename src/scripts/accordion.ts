// Accordions: native <details> is the no-JS base; JS adds the grid-rows animation,
// one-open-at-a-time (always for data-accordion="single", on mobile for all) and #hash deep links.
const mobile = window.matchMedia('(max-width: 767px)');

document.querySelectorAll<HTMLElement>('[data-accordion]').forEach((acc) => {
  const items = [...acc.querySelectorAll<HTMLDetailsElement>('details.acc__item')];
  const single = acc.dataset.accordion === 'single';

  function close(d: HTMLDetailsElement) {
    if (!d.classList.contains('is-open')) return;
    d.classList.remove('is-open');
    d.querySelector('summary')!.setAttribute('aria-expanded', 'false');
    const body = d.querySelector('.acc__body');
    const done = () => { if (!d.classList.contains('is-open')) d.open = false; };
    if (body && getComputedStyle(body).transitionDuration !== '0s') setTimeout(done, 420); else done();
  }
  function toggle(d: HTMLDetailsElement, open: boolean) {
    if (!open) { close(d); return; }
    if (single || mobile.matches) items.forEach((o) => o !== d && close(o));
    d.open = true;
    d.querySelector('summary')!.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('is-open')));
  }

  for (const d of items) {
    const summary = d.querySelector('summary')!;
    summary.setAttribute('aria-expanded', String(d.open));
    if (d.open) d.classList.add('is-open');
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      toggle(d, !d.classList.contains('is-open'));
    });
  }

  const openHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id ? items.find((d) => d.id === id) : undefined;
    if (!target) return;
    toggle(target, true);
    setTimeout(() => target.scrollIntoView({ block: 'start' }), 80);
  };
  openHash();
  window.addEventListener('hashchange', openHash);
});
