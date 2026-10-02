// Damped spring integrator (semi-implicit Euler, sub-stepped for stability).
export interface Spring { x: number; v: number; target: number }
export const spring = (x = 0): Spring => ({ x, v: 0, target: x });

export function stepSpring(s: Spring, dtMs: number, stiffness = 170, damping = 18, mass = 1): boolean {
  let t = Math.min(dtMs, 64) / 1000;
  const h = 1 / 240;
  while (t > 0) {
    const d = Math.min(h, t);
    const a = (-stiffness * (s.x - s.target) - damping * s.v) / mass;
    s.v += a * d;
    s.x += s.v * d;
    t -= d;
  }
  const settled = Math.abs(s.v) < 0.01 && Math.abs(s.x - s.target) < 0.01;
  if (settled) { s.x = s.target; s.v = 0; }
  return !settled;
}
