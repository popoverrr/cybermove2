// One shared requestAnimationFrame loop. Runs only while at least one task is registered.
// Every frame: all `read` phases first (layout reads), then all `write` phases (DOM writes).
export interface Task {
  read?: (now: number, dt: number) => void;
  /** return false to unregister */
  write?: (now: number, dt: number) => boolean | void;
}

const tasks = new Set<Task>();
let frame = 0;
let last = 0;

function loop(now: number) {
  const dt = last ? Math.min(now - last, 64) : 16.67;
  last = now;
  for (const t of tasks) t.read?.(now, dt);
  for (const t of tasks) if (t.write && t.write(now, dt) === false) tasks.delete(t);
  if (tasks.size) frame = requestAnimationFrame(loop);
  else { frame = 0; last = 0; }
}

export function addTask(task: Task): () => void {
  tasks.add(task);
  if (!frame) frame = requestAnimationFrame(loop);
  return () => { tasks.delete(task); };
}

/** Run a write once on the next frame (deduplicated by key). */
const once = new Map<string, () => void>();
export function nextFrame(key: string, fn: () => void) {
  if (once.has(key)) { once.set(key, fn); return; }
  once.set(key, fn);
  addTask({ write: () => { const f = once.get(key); once.delete(key); f?.(); return false; } });
}
