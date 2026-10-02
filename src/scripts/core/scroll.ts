// Passive scroll listener that only flags; scroll subscribers are notified inside the shared rAF.
import { addTask } from './raf';

type Listener = (y: number, dy: number, dt: number) => void;
const listeners = new Set<Listener>();
let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
let pending = false;

const task = {
  read: () => { /* reading scrollY is cheap and layout-free */ },
  write: (_n: number, dt: number) => {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    for (const l of listeners) l(y, dy, dt);
    pending = false;
    return false;
  },
};

function onScroll() {
  if (pending) return;
  pending = true;
  addTask(task);
}

export function subscribeScroll(l: Listener): () => void {
  if (!listeners.size) window.addEventListener('scroll', onScroll, { passive: true });
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (!listeners.size) window.removeEventListener('scroll', onScroll);
  };
}

export const scrollY = () => lastY;
