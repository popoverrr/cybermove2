// Service motion loops: play only while on screen, start from the poster frame (5 s) so poster → video has no
// jump, phones get the 4:5 cut of hero loops. Reduced motion or Save-Data → posters only.
import { reduced } from './core/motion';

const POSTER_T = 5; // poster = frame 150 of the 8 s loop
const phone = window.matchMedia('(max-width: 599px)').matches;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

const boxes = document.querySelectorAll<HTMLElement>('[data-smotion]:not([data-ready])');
boxes.forEach((box) => {
  box.dataset.ready = '';
  const img = box.querySelector<HTMLImageElement>('.smotion__poster')!;
  const v = box.querySelector<HTMLVideoElement>('.smotion__video')!;
  if (phone && v.dataset.srcTall) {
    v.dataset.src = v.dataset.srcTall;
    if (img.dataset.tall) { img.src = img.dataset.tall; box.classList.add('is-tall'); }
  }
});

if (!reduced() && !saveData && 'IntersectionObserver' in window) {
  const play = (v: HTMLVideoElement) => {
    if (!v.src) {
      v.src = v.dataset.src!;
      v.addEventListener('loadedmetadata', () => { v.currentTime = POSTER_T; }, { once: true });
      v.addEventListener('playing', () => v.closest('[data-smotion]')!.classList.add('is-playing'), { once: true });
    }
    v.play().catch(() => {});
  };
  const onScreen = new Set<HTMLVideoElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = (e.target as HTMLElement).querySelector<HTMLVideoElement>('.smotion__video')!;
      if (e.isIntersecting) { onScreen.add(v); if (!document.hidden) play(v); }
      else { onScreen.delete(v); v.pause(); }
    }
  }, { threshold: 0.3 });
  boxes.forEach((b) => io.observe(b));
  // background tab: pause everything; back: resume what is on screen
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.querySelectorAll<HTMLVideoElement>('.smotion__video').forEach((v) => v.pause());
    else onScreen.forEach(play);
  });
}
