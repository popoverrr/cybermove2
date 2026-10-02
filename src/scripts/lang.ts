// Language switch keeps the reading position (scroll ratio) across the two static pages.
const KEY = 'cm-lang-ratio';
const ss = (() => { try { return window.sessionStorage; } catch { return null; } })();
const root = document.documentElement;

document.addEventListener('click', (e) => {
  const a = (e.target as Element).closest?.('[data-lang-switch]');
  if (!a || !ss) return;
  const max = root.scrollHeight - window.innerHeight;
  ss.setItem(KEY, String(max > 0 ? window.scrollY / max : 0));
});

const saved = ss?.getItem(KEY);
if (ss && saved != null) {
  ss.removeItem(KEY);
  const ratio = parseFloat(saved);
  if (ratio > 0) {
    const restore = () => window.scrollTo({ top: ratio * (root.scrollHeight - window.innerHeight), behavior: 'instant' as ScrollBehavior });
    restore();
    document.fonts?.ready.then(restore);
  }
}
