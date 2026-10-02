// Blocks below the fold use content-visibility: auto (docs/15-stabilize.md §4). Their first layout (text shaping)
// would otherwise land in the middle of a scroll as one long task; lay them out once while the browser is idle —
// afterwards they are skipped again whenever off-screen, and re-entry only paints.
const blocks = [...document.querySelectorAll<HTMLElement>('.rbrands, .rsvc, .rins')];
const idle = (f: () => void) => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (f: () => void, o: object) => void }).requestIdleCallback(f, { timeout: 2500 }) : setTimeout(f, 300));
function warm(i: number) {
  const el = blocks[i];
  if (!el) return;
  el.style.contentVisibility = 'visible';
  void el.offsetHeight; // one block per idle slot
  requestAnimationFrame(() => { el.style.contentVisibility = ''; idle(() => warm(i + 1)); });
}
if (blocks.length) {
  const go = () => idle(() => warm(0));
  if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}
