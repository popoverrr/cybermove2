// Interaction #1 (outgoing side + tab strip). The incoming `pagereveal` side is in Base.astro's boot script.
const ss = (() => { try { return window.sessionStorage; } catch { return null; } })();
const TABS = 'cm-tabs';
interface Tab { href: string; label: string }

const main = document.getElementById('main');
const here = location.pathname;

/* ── Tab strip: the last 3 visited pages (desktop only, via CSS) ── */
function renderTabs() {
  const strip = document.querySelector<HTMLElement>('.hdr__tabs');
  if (!strip || !main || !ss) return;
  let tabs: Tab[] = [];
  try { tabs = JSON.parse(ss.getItem(TABS) || '[]'); } catch { /* ignore */ }
  tabs = tabs.filter((t) => t && t.href !== here);
  const recent = tabs.slice(-3);
  if (recent.length) {
    const frag = document.createDocumentFragment();
    for (const t of recent) {
      const a = document.createElement('a');
      a.href = t.href;
      a.className = 'hdr__tab';
      a.dataset.tab = '';
      a.textContent = t.label;
      frag.append(a);
    }
    strip.replaceChildren(frag);
    strip.hidden = false;
  }
  const label = (main.dataset.path || '').replace(/^cybermove\s*\/\s*/i, '') || 'cybermove';
  tabs.push({ href: here, label });
  ss.setItem(TABS, JSON.stringify(tabs.slice(-4)));
}
renderTabs();

/* ── Direction + shared window element ── */
document.addEventListener('click', (e) => {
  if (!ss || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a');
  if (!a || a.target === '_blank' || a.origin !== location.origin) return;
  ss.setItem('cm-dir', a.hasAttribute('data-tab') ? 'back' : 'forward');
  const win = a.closest<HTMLElement>('[data-win]');
  if (win) {
    const r = win.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    ss.setItem('cm-win', JSON.stringify({
      t: Math.round(r.top), l: Math.round(r.left),
      r: Math.round(vw - r.right), b: Math.round(vh - r.bottom),
      slug: win.dataset.win,
    }));
  } else {
    ss.removeItem('cm-win');
  }
}, { capture: true });

interface PageSwapEvent extends Event {
  viewTransition: ViewTransition & { types: Set<string> } | null;
  activation: { navigationType: string } | null;
}

window.addEventListener('pageswap', (ev) => {
  const e = ev as PageSwapEvent;
  if (!e.viewTransition) return;
  if (e.activation?.navigationType === 'traverse') ss?.setItem('cm-dir', 'back');
  const dir = ss?.getItem('cm-dir') === 'back' ? 'back' : 'forward';
  e.viewTransition.types.add(dir);
  const raw = ss?.getItem('cm-win');
  if (raw) {
    try {
      const { slug } = JSON.parse(raw);
      const bar = document.querySelector<HTMLElement>(`[data-win="${slug}"] .win__bar`);
      if (bar) { bar.style.viewTransitionName = 'win-bar'; e.viewTransition.types.add('win'); }
    } catch { /* ignore */ }
  }
});

// Back/forward cache: clear stale transition names when a page is restored.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) document.querySelectorAll<HTMLElement>('.win__bar').forEach((b) => (b.style.viewTransitionName = ''));
});
