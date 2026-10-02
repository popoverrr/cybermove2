const mq = (q: string) => window.matchMedia(q);
export const reducedMQ = mq('(prefers-reduced-motion: reduce)');
export const finePointerMQ = mq('(hover: hover) and (pointer: fine)');
export const desktopMQ = mq('(min-width: 1100px)');
export const reduced = () => reducedMQ.matches;
export const finePointer = () => finePointerMQ.matches;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** Frame-rate-corrected lerp factor. */
export const lerpK = (k: number, dt: number) => 1 - Math.pow(1 - k, dt / 16.67);
