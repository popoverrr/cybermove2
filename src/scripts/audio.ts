// Background music (docs/10-fixes.md §6). The header button exists only when public/audio/ambient.mp3 is in the build.
// Starts on load where the browser allows it, otherwise on the first pointerdown/keydown/touchend.
// The visitor's choice is kept in localStorage; the position survives page loads via sessionStorage.
import { addTask } from './core/raf';

const btn = document.querySelector<HTMLButtonElement>('[data-music]');
if (btn) {
  const OFF = 'cm-music-off', POS = 'cm-music-pos', VOL = 0.25;
  const store = (s: () => Storage, k: string, v?: string | null) => {
    try { if (v === undefined) return s().getItem(k); if (v === null) s().removeItem(k); else s().setItem(k, v); } catch { /* blocked storage */ }
    return null;
  };
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;
  let wanted = store(() => localStorage, OFF) !== '1';
  let playing = false;
  let fade = 0; // token: a newer fade cancels the older one

  const render = () => {
    btn.setAttribute('aria-pressed', String(playing));
    btn.setAttribute('aria-label', playing ? btn.dataset.off! : btn.dataset.on!);
    btn.classList.toggle('is-playing', playing);
  };
  const ramp = (to: number, ms: number, done?: () => void) => {
    const id = ++fade, from = audio.volume, t0 = performance.now();
    addTask({ write: (now) => {
      if (id !== fade) return false;
      const k = Math.min(1, (now - t0) / ms);
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * k));
      if (k >= 1) { done?.(); return false; }
      return true;
    } });
  };
  const ensureSrc = () => {
    if (audio.src) return;
    audio.src = btn.dataset.src!;
    const pos = parseFloat(store(() => sessionStorage, POS) || '0');
    if (pos > 0) audio.addEventListener('loadedmetadata', () => { audio.currentTime = pos % (audio.duration || Infinity); }, { once: true });
  };
  const gestures = ['pointerdown', 'keydown', 'touchend'] as const;
  const onGesture = (e: Event) => {
    if (btn.contains(e.target as Node)) return; // the button handles itself
    gestures.forEach((g) => document.removeEventListener(g, onGesture, true));
    if (wanted && !playing) start();
  };
  const armGestures = () => gestures.forEach((g) => document.addEventListener(g, onGesture, { capture: true, once: true }));

  function start() {
    ensureSrc();
    audio.play().then(() => { playing = true; render(); ramp(VOL, 1500); }, () => { playing = false; render(); armGestures(); });
  }
  function stop(remember: boolean) {
    playing = false; render();
    ramp(0, 400, () => audio.pause());
    if (remember) store(() => localStorage, OFF, '1');
  }

  btn.addEventListener('click', () => {
    if (playing) { wanted = false; stop(true); }
    else { wanted = true; store(() => localStorage, OFF, null); start(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (playing) { audio.pause(); playing = false; render(); } }
    else if (wanted && audio.src) start();
  });
  const save = () => { if (audio.src && !audio.paused) store(() => sessionStorage, POS, String(audio.currentTime)); else if (!wanted) store(() => sessionStorage, POS, null); };
  window.addEventListener('pagehide', save);

  render();
  if (wanted) {
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }
}
