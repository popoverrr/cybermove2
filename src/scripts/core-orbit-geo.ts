// Geometry of the CORE schema, shared by the build (static SVG) and the runtime (rotation).
// Orbits are circles seen at ~65° tilt → ellipses with ry = r · K. Labels stay horizontal and are
// placed on the outer side of their dot; overlapping labels are pushed apart vertically.
export const W = 640;
export const H = 520;
export const CX = W / 2;
export const CY = H / 2;
export const K = 0.44; // cos(~64°)
export const R_CORE = 150;
export const R_MID = 212;
export const R_SYS = 272;
export const LEAD = 14; // leader length, viewBox units

export interface GeoNode { label: string; ring: 'core' | 'system'; angle: number; index?: string }
export interface Placed {
  x: number; y: number; depth: number; // depth 0 (far, top) … 1 (near, bottom)
  lx: number; ly: number; // leader end = text anchor point
  anchor: 'start' | 'middle' | 'end';
  tx: number; ty: number; // text position (after collision push)
  ty0: number; // text y before the push (the leader end follows the push)
}

const rad = (d: number) => (d * Math.PI) / 180;

export function point(r: number, deg: number) {
  const a = rad(deg);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) * K, depth: (Math.sin(a) + 1) / 2 };
}

/** Text width estimate for the monospace label font (0.6em advance + letter-spacing). */
export const textWidth = (s: string, fs: number) => s.length * fs * 0.68;

/**
 * Places all nodes for given ring rotations. `visible` says which labels take part in collision
 * avoidance (hidden labels — e.g. on small screens — are ignored).
 */
export function layout(
  nodes: GeoNode[], rotCore: number, rotSys: number, fs: number, visible: (n: GeoNode) => boolean = () => true,
): Placed[] {
  const out = nodes.map((n): Placed => {
    const p = point(n.ring === 'core' ? R_CORE : R_SYS, n.angle + (n.ring === 'core' ? rotCore : rotSys));
    const dx = p.x - CX, dy = (p.y - CY) / K;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    // mostly-vertical positions (top/bottom of the ellipse) get a vertical leader and centred text
    const vertical = Math.abs(ux) < 0.42;
    const lx = p.x + (vertical ? 0 : Math.sign(ux) * LEAD);
    const ly = p.y + (vertical ? Math.sign(uy || 1) * LEAD : 0);
    const anchor = vertical ? 'middle' : ux > 0 ? 'start' : 'end';
    const tx = lx + (vertical ? 0 : Math.sign(ux) * 4);
    const ty = vertical ? (uy > 0 ? ly + fs * 0.95 : ly - fs * 0.35) : ly + fs * 0.34;
    return { x: p.x, y: p.y, depth: p.depth, lx, ly, anchor, tx, ty, ty0: ty };
  });
  // collision pass: boxes of visible labels (+ the core disc) never overlap
  const text = (n: GeoNode) => (n.index ? `${n.index} ${n.label}` : n.label);
  const box = (i: number) => {
    const p = out[i], w = textWidth(text(nodes[i]), fs);
    const x0 = p.anchor === 'start' ? p.tx : p.anchor === 'end' ? p.tx - w : p.tx - w / 2;
    return { x0, x1: x0 + w, y0: p.ty - fs * 0.8, y1: p.ty + fs * 0.25 };
  };
  const idx = nodes.map((_, i) => i).filter((i) => visible(nodes[i]));
  const coreBox = { x0: CX - 46, x1: CX + 46, y0: CY - 46, y1: CY + 46 };
  for (let pass = 0; pass < 4; pass++) {
    idx.sort((a, b) => out[a].ty - out[b].ty);
    for (let a = 0; a < idx.length; a++) {
      const A = box(idx[a]);
      for (const B of [coreBox]) {
        if (A.x0 < B.x1 && A.x1 > B.x0 && A.y0 < B.y1 && A.y1 > B.y0) {
          const up = out[idx[a]].ty < CY;
          out[idx[a]].ty += up ? B.y0 - A.y1 - 2 : B.y1 - A.y0 + 2;
        }
      }
      for (let b = a + 1; b < idx.length; b++) {
        const P = box(idx[a]), Q = box(idx[b]);
        if (P.x0 < Q.x1 + 6 && P.x1 + 6 > Q.x0 && P.y0 < Q.y1 + 2 && P.y1 + 2 > Q.y0) {
          const push = (P.y1 + 2 - Q.y0) / 2 + 0.5;
          out[idx[a]].ty -= push;
          out[idx[b]].ty += push;
        }
      }
    }
  }
  return out;
}

export function ellipsePath(r: number) {
  return `M ${CX - r} ${CY} a ${r} ${r * K} 0 1 0 ${2 * r} 0 a ${r} ${r * K} 0 1 0 ${-2 * r} 0`;
}
