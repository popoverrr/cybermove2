// Interaction #6a — magnetic buttons. Fast critically-damped follow (lerp 0.35/frame, frame-rate corrected).
import { addTask } from './core/raf';
import { finePointer, reduced, lerpK } from './core/motion';

interface M { el: HTMLElement; inner: HTMLElement | null; r: DOMRect | null; x: number; y: number; tx: number; ty: number }

if (finePointer() && !reduced()) {
  const items: M[] = [...document.querySelectorAll<HTMLElement>('[data-magnetic]')].map((el) => ({
    el, inner: el.querySelector<HTMLElement>('.btn__in'), r: null, x: 0, y: 0, tx: 0, ty: 0,
  }));
  const byEl = new Map(items.map((m) => [m.el, m]));
  const visible = new Set<M>();
  let px = -1e4, py = -1e4;
  let dirty = true;
  let running = false;

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const m = byEl.get(e.target as HTMLElement)!;
      if (e.isIntersecting) visible.add(m); else { visible.delete(m); m.tx = m.ty = 0; }
    }
    dirty = true;
  });
  items.forEach((m) => io.observe(m.el));

  const invalidate = () => { dirty = true; };
  window.addEventListener('scroll', invalidate, { passive: true });
  window.addEventListener('resize', invalidate);

  const task = {
    read: () => {
      if (!dirty) return;
      for (const m of visible) {
        const r = m.el.getBoundingClientRect();
        m.r = new DOMRect(r.left - m.x, r.top - m.y, r.width, r.height); // remove our own offset
      }
      dirty = false;
    },
    write: (_n: number, dt: number) => {
      const k = lerpK(0.35, dt);
      let active = false;
      for (const m of items) {
        if (m.r && visible.has(m)) {
          const dx = px - (m.r.left + m.r.width / 2);
          const dy = py - (m.r.top + m.r.height / 2);
          const inside = Math.hypot(dx, dy) < 1.4 * (m.r.width / 2);
          const lim = (v: number) => Math.max(-10, Math.min(10, v));
          m.tx = inside ? lim(dx * 0.3) : 0;
          m.ty = inside ? lim(dy * 0.3) : 0;
        }
        m.x += (m.tx - m.x) * k;
        m.y += (m.ty - m.y) * k;
        if (Math.abs(m.x - m.tx) < 0.05 && Math.abs(m.y - m.ty) < 0.05) { m.x = m.tx; m.y = m.ty; } else active = true;
        if (m.tx || m.ty) active = true;
        const on = m.x !== 0 || m.y !== 0;
        m.el.style.translate = on ? `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px` : '';
        if (m.inner) m.inner.style.translate = on ? `${(m.x * 0.4).toFixed(2)}px ${(m.y * 0.4).toFixed(2)}px` : '';
      }
      running = active;
      return active;
    },
  };

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    if (!running) { running = true; addTask(task); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { px = py = -1e4; });
}
