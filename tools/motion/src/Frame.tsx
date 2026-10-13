// Common frame for all service loops: graphite field with a faint 40-unit grid, a slow scan sweep (ambient
// layer), a mono HUD in the site's block-header style and the 800×800 scene stage.
// card: 800×1000 (4:5) — HUD rows above and below the stage.
// hero: 1600×900 (16:9) — stage in the middle, two instrument columns at the sides.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, LOOP, Label, cyc, osc, p, rnd, useLoop, easeInOut } from './kit';

export type Variant = 'card' | 'hero';
export type FrameProps = { variant: Variant; index: string; code: string; readouts: string[]; overlay?: boolean };

const Grid: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const xs = Array.from({ length: Math.floor(w / 40) + 1 }, (_, i) => i * 40);
  const ys = Array.from({ length: Math.floor(h / 40) + 1 }, (_, i) => i * 40);
  return (
    <g>
      {xs.map((x) => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={h} stroke={C.grid} strokeWidth={1} />)}
      {ys.map((y) => <line key={`y${y}`} x1={0} x2={w} y1={y} y2={y} stroke={C.grid} strokeWidth={1} />)}
    </g>
  );
};

const Corners: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  const s = 18;
  const d = [
    `M${x} ${y + s}V${y}H${x + s}`,
    `M${x + w - s} ${y}H${x + w}V${y + s}`,
    `M${x + w} ${y + h - s}V${y + h}H${x + w - s}`,
    `M${x + s} ${y + h}H${x}V${y + h - s}`,
  ];
  return <g>{d.map((dd) => <path key={dd} d={dd} fill="none" stroke={C.lineStrong} strokeWidth={1.5} />)}</g>;
};

/** Loop progress as a hairline with a volt head — the "timecode" of the scene. */
const Progress: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => {
  const f = useLoop();
  const t = f / LOOP;
  return (
    <g>
      <line x1={x} x2={x + w} y1={y} y2={y} stroke={C.line} strokeWidth={1.5} />
      <line x1={x} x2={x + w * t} y1={y} y2={y} stroke={C.lineStrong} strokeWidth={1.5} />
      <rect x={x + w * t - 3} y={y - 3} width={6} height={6} fill={C.accent} />
    </g>
  );
};

const tc = (f: number) => `00:0${Math.floor(f / 30)}:${String(f % 30).padStart(2, '0')}`;

/** Instrument column for the hero variant: codes with live bars + a sparkline. */
const Readouts: React.FC<{ x: number; y: number; items: string[]; align: 'left' | 'right'; seed: number }> = ({ x, y, items, align, seed }) => {
  const f = useLoop();
  const w = 260;
  const spark = Array.from({ length: 27 }, (_, i) => {
    const v = 0.5 + 0.28 * osc(f, 1, i / 9 + seed) + 0.14 * osc(f, 2, rnd(i, seed));
    return `${i === 0 ? 'M' : 'L'}${x + (i / 26) * w} ${y + 470 - v * 90}`;
  }).join('');
  return (
    <g>
      {items.map((it, i) => {
        const v = 0.35 + 0.5 * (0.5 + 0.5 * osc(f, 1, rnd(i, seed)));
        const yy = y + i * 64;
        return (
          <g key={it}>
            <Label x={align === 'left' ? x : x + w} y={yy} anchor={align === 'left' ? 'start' : 'end'} size={14}>{it}</Label>
            <line x1={x} x2={x + w} y1={yy + 16} y2={yy + 16} stroke={C.line} strokeWidth={1.5} />
            <line x1={align === 'left' ? x : x + w} x2={align === 'left' ? x + w * v : x + w - w * v} y1={yy + 16} y2={yy + 16} stroke={C.lineStrong} strokeWidth={3} />
            <Label x={align === 'left' ? x + w : x} y={yy} anchor={align === 'left' ? 'end' : 'start'} size={14} fill={C.fg}>{String(Math.round(v * 100)).padStart(2, '0')}</Label>
          </g>
        );
      })}
      <path d={spark} fill="none" stroke={C.lineStrong} strokeWidth={2} />
      <line x1={x} x2={x + w} y1={y + 480} y2={y + 480} stroke={C.line} strokeWidth={1.5} />
    </g>
  );
};

export const Frame: React.FC<FrameProps & { children: React.ReactNode }> = ({ variant, index, code, readouts, children, overlay = false }) => {
  const f = useLoop();
  const hero = variant === 'hero';
  const W = hero ? 1600 : 800;
  const H = hero ? 900 : 1000;
  const sx = hero ? 400 : 0;
  const sy = hero ? 50 : 110;
  // scan sweep: one pass per loop, eased, very faint
  const sweep = p(f, 0, LOOP, easeInOut);
  const scanY = -60 + sweep * (H + 120);
  return (
    <AbsoluteFill style={{ backgroundColor: overlay ? 'transparent' : C.bg }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.fg} stopOpacity="0" />
            <stop offset="1" stopColor={C.fg} stopOpacity="0.035" />
          </linearGradient>
        </defs>
        {!overlay && <Grid w={W} h={H} />}
        {!overlay && <rect x={0} y={scanY - 120} width={W} height={120} fill="url(#scan)" />}
        {!overlay && <line x1={0} x2={W} y1={scanY} y2={scanY} stroke={C.fg} strokeOpacity={0.06} strokeWidth={1} />}

        {hero ? (
          <g>
            <Label x={60} y={70} size={15} fill={C.fg}>{`${index} — ${code}`}</Label>
            <Label x={1540} y={70} size={15} anchor="end">{tc(f)}</Label>
            <line x1={60} x2={1540} y1={92} y2={92} stroke={C.line} strokeWidth={1.5} />
            {!overlay && <Readouts x={60} y={200} items={readouts.slice(0, 4)} align="left" seed={1} />}
            {!overlay && <Readouts x={1280} y={200} items={readouts.slice(4, 8).length ? readouts.slice(4, 8) : readouts.slice(0, 4)} align="right" seed={2} />}
            <Progress x={60} y={840} w={1480} />
            {!overlay && <Corners x={sx + 10} y={sy + 10} w={780} h={780} />}
          </g>
        ) : (
          <g>
            <Label x={40} y={62} size={17} fill={C.fg}>{index}</Label>
            <Label x={760} y={62} size={15} anchor="end">{code}</Label>
            <line x1={40} x2={760} y1={86} y2={86} stroke={C.line} strokeWidth={1.5} />
            <Progress x={40} y={950} w={720} />
            <Label x={760} y={935} size={13} anchor="end" opacity={0.7}>{tc(f)}</Label>
          </g>
        )}
        <g transform={`translate(${sx} ${sy})`}>{children}</g>
        {/* a couple of drifting registration ticks — ambient */}
        {[0, 1, 2].map((i) => {
          const t = cyc(f, 1, i / 3);
          return <rect key={i} x={(hero ? 120 : 40) + t * (W - (hero ? 240 : 80))} y={hero ? 120 : 98} width={2} height={8} fill={C.lineStrong} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
