# CYBERMOVE — service motion loops

Remotion + three.js. Ten 8-second seamless 3D loops for the «Услуги» ribbon and the service pages.

- Scenes: `src/scenes3d/A01…A10` (registry `src/scenes3d/index.ts`), shared studio `src/Stage3D.tsx`, parts `src/parts.tsx`, HUD overlay `src/Frame.tsx`.
- Every animation is a pure function of the looped frame (`src/kit.tsx`), so frame 0 = frame 240.
- `npm run dev` — Remotion Studio. `npm run render` — all cards (1080×1350) + heroes (1920×1080) → `out/video/` → `../../public/motion/`;
  `-- --posters` — WebP posters; `-- --sheet <id>` — contact sheet; `npm run mobile` — 720×900 phone cuts.
- WebGL renders with `--gl=angle`; the first frame of a session is a warm-up (post-processing not ready), so videos are rendered from frames 1…240.
