// Contact panel (docs/14-rework.md §11): opened by the floating button and by every link to /contact/ (with
// ?service=<id> preselected). Closes by ×, swipe down, Esc and a tap on the backdrop; focus returns to the opener;
// the page underneath does not scroll. On /contact/ itself links are not intercepted.
const panel = document.getElementById('cpanel');
const backdrop = document.querySelector<HTMLElement>('.cpanel-backdrop');
const root = document.documentElement;

if (panel && backdrop) {
  const isContactPage = /\/contact\/$/.test(location.pathname);
  const select = panel.querySelector<HTMLSelectElement>('select[name="service"]');
  let opener: HTMLElement | null = null;
  let open = false;

  const focusables = () => [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea')].filter((el) => !el.closest('.cform__hp'));
  function show(service: string | null, from: HTMLElement | null) {
    if (open) return;
    open = true; opener = from;
    if (select) select.value = service && [...select.options].some((o) => o.value === service) ? service : '';
    panel!.hidden = false; backdrop!.hidden = false;
    void panel!.offsetWidth;
    root.classList.add('panel-open');
    panel!.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
  }
  function hide() {
    if (!open) return;
    open = false;
    root.classList.remove('panel-open');
    document.removeEventListener('keydown', onKey);
    panel!.style.transform = '';
    setTimeout(() => { if (!open) { panel!.hidden = true; backdrop!.hidden = true; } }, 420);
    opener?.focus({ preventScroll: true });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); hide(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables();
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }

  // every link to /contact/ (and data-panel-open) opens the panel
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href], [data-panel-open]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (panel.contains(a)) return;
    let u: URL | null = null;
    try { u = new URL(a.getAttribute('href') || '', location.href); } catch { /* not a URL */ }
    const toContact = a.hasAttribute('data-panel-open') || (u && u.origin === location.origin && /\/contact\/$/.test(u.pathname));
    if (!toContact || (isContactPage && !a.hasAttribute('data-panel-open'))) return;
    e.preventDefault();
    show(a.dataset.service || u?.searchParams.get('service') || null, a);
  });
  panel.querySelectorAll('[data-panel-close]').forEach((b) => b.addEventListener('click', hide));
  backdrop.addEventListener('click', hide);

  // swipe down on the grip / title bar closes the sheet (phones)
  let y0 = 0, dy = 0, dragging = false;
  const grip = panel.querySelectorAll<HTMLElement>('[data-panel-grip], .cpanel__bar');
  grip.forEach((g) => {
    g.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; dragging = true; panel.style.transition = 'none'; }, { passive: true });
    g.addEventListener('touchmove', (e) => { if (!dragging) return; dy = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = `translateY(${dy}px)`; }, { passive: true });
    g.addEventListener('touchend', () => {
      dragging = false; panel.style.transition = '';
      if (dy > 90) hide(); else panel.style.transform = '';
    });
  });
}
