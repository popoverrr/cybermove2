// Passive scroll listener that only flags; scroll subscribers are notified inside the shared rAF.
import { addTask } from './raf';

type Listener = (y: number, dy: number, dt: number) => void;
const listeners = new Set<Listener>();
let lastY = typeof window !== 'undefined' ? window.scrollY : 0;
let pending = false;

// scrollY is read in the read phase: read after a DOM write it would force style + layout (docs/15-stabilize.md §4)
let curY = lastY;
const task = {
  read: () => { curY = window.scrollY; },
  write: (_n: number, dt: number) => {
    const y = curY;
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
