// Shared motion kit for the service loops: site palette (src/styles/tokens.css), the site's signature
// expo-out curve, seamless-loop helpers and small SVG primitives. Every scene is a pure function of the
// looped frame, so frame 0 and frame LOOP are identical and the video repeats without a seam.
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

export const FPS = 30;
export const LOOP = 240; // 8 s

export const C = {
  bg: '#111316', // graphite (--bg-raised, dark)
  deep: '#08090B', // space
  sunken: '#1A1D21', // asphalt
  fg: '#F2F2EF', // chalk
  muted: '#8C9199', // steel
  line: 'rgba(242,242,239,0.12)',
  lineStrong: 'rgba(242,242,239,0.28)',
  grid: 'rgba(242,242,239,0.05)',
  accent: '#C8FF2E', // volt
};

export const MONO = 'CMMono, "JetBrains Mono", Consolas, monospace';
export const DISPLAY = 'CMTight, "Inter Tight", Arial, sans-serif';

// --ease-out: cubic-bezier(0.16, 1, 0.3, 1); --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.75, 0.2);

/** Looped frame: 0…LOOP-1. */
export const useLoop = () => useCurrentFrame() % LOOP;

/** 0→1 between frames a and b (clamped, eased). */
export const p = (f: number, a: number, b: number, ease = easeOut) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });

/** Appear over [a,b], disappear over [c,d]: 0→1→0. Keeps the loop seamless when d ≤ LOOP. */
export const life = (f: number, a: number, b: number, c: number, d: number) =>
  p(f, a, b) * (1 - p(f, c, d, easeIn));

/** Periodic oscillation, k whole cycles per loop → seamless. */
export const osc = (f: number, k = 1, phase = 0) => Math.sin(((f / LOOP) * k + phase) * Math.PI * 2);

/** Linear progress through the loop (for perpetual drifts that wrap), k cycles. */
export const cyc = (f: number, k = 1, phase = 0) => (((f / LOOP) * k + phase) % 1 + 1) % 1;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic pseudo-random in [0,1). */
export const rnd = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const Label: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; opacity?: number }> = ({ x, y, children, size = 15, fill = C.muted, anchor = 'start', opacity = 1 }) => (
  <text x={x} y={y} fontFamily={MONO} fontSize={size} letterSpacing={size * 0.08} fill={fill} textAnchor={anchor} opacity={opacity}>
    {children}
  </text>
);

/** A line that draws itself from 0 to t (0…1). */
export const Draw: React.FC<{ d: string; t: number; len: number; stroke?: string; width?: number; opacity?: number; dash?: string }> = ({ d, t, len, stroke = C.lineStrong, width = 2, opacity = 1, dash }) =>
  dash ? (
    <path d={d} fill="none" stroke={stroke} strokeWidth={width} opacity={opacity * (t > 0 ? 1 : 0)} strokeDasharray={dash} strokeDashoffset={0} style={{ clipPath: undefined }} />
  ) : (
    <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - t)} opacity={opacity} />
  );

/** Window-frame chip like the site's WindowFrame: three dots + mono path. */
export const WinBar: React.FC<{ x: number; y: number; w: number; label?: string }> = ({ x, y, w, label }) => (
  <g>
    {[0, 1, 2].map((i) => (
      <circle key={i} cx={x + 18 + i * 16} cy={y + 18} r={4} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />
    ))}
    {label && <Label x={x + w / 2} y={y + 23} anchor="middle" size={13}>{label}</Label>}
    <line x1={x} x2={x + w} y1={y + 36} y2={y + 36} stroke={C.line} strokeWidth={1.5} />
  </g>
);

/** Stage-by-stage travel: every `step` frames an item moves to the next stage (move eased over 60 % of the step). */
export const interpolateStages = (age: number, step: number, stages = 4) => {
  const raw = Math.floor(age / step);
  const stage = Math.min(stages - 1, raw);
  const t = stage === 0 || raw >= stages ? 1 : p(age - stage * step, 0, step * 0.6, easeInOut);
  return { stage, t };
};
