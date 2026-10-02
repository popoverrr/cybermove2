/** Calls `enter`/`leave` as the element enters/leaves the viewport. Returns a disconnect fn. */
export function watchInView(
  el: Element,
  enter: () => void,
  leave?: () => void,
  opts: IntersectionObserverInit = { rootMargin: '0px' },
): () => void {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? enter : leave)?.();
  }, opts);
  io.observe(el);
  return () => io.disconnect();
}

/** Fires once when the element is at least `threshold` visible. */
export function onceInView(el: Element, cb: () => void, threshold = 0.2) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); cb(); }
  }, { threshold });
  io.observe(el);
}

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let id = 0;
  return (...a: Parameters<T>) => { clearTimeout(id); id = window.setTimeout(() => fn(...a), ms); };
}
