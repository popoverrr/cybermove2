// 09 · HR consulting: hiring and team development — a grid of candidate capsules stands on the floor; a scan
// ring passes over it and picks the right people; they turn chrome, rise and fly into a team formation on the
// plinth; then rings of light climb each member — development, level by level.
import React from 'react';
import { C, easeInOut, lerp, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Instances, Plinth } from '../parts';

const COLS = 12, ROWS = 7;
const N = COLS * ROWS;
const CHOSEN = [9, 22, 30, 41, 53, 66, 75];
const SLOT = [[0, 0.95], [-0.62, 0.55], [0.62, 0.55], [-1.05, -0.1], [0, -0.1], [1.05, -0.1], [0, -0.75]].map(([x, z]) => [x * 1.05, z * 1.05]);

const gx = (i: number) => -4.4 + (i % COLS) * 0.8;
const gz = (i: number) => -3.6 + Math.floor(i / COLS) * 0.62;

export const A09Hr: React.FC = () => {
  const f = useLoop();
  const show = p(f, 0, 26) * (1 - p(f, 222, 239));
  const scanR = lerp(0, 6.5, p(f, 16, 80, easeInOut));
  const scanOn = p(f, 14, 20) * (1 - p(f, 76, 90));
  const ox = 0.6, oz = -1.6; // scan origin
  return (
    <Stage3D cam={{ radius: 8.0, height: 4.4, target: [0, 0.9, -0.6], sway: 0.45, fov: 34 }}>
      <Plinth r={1.6} />
      {/* the crowd (not chosen) */}
      <Instances count={N} f={f} fill={(i, o) => {
        if (CHOSEN.includes(i)) { o.scale.set(0, 0, 0); return; }
        const h = 0.9 + rnd(i, 1) * 0.35;
        o.position.set(gx(i) + 0.05 * osc(f, 1, rnd(i, 2)), h / 2, gz(i));
        o.scale.set(show, show * h, show);
      }}>
        <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
        <meshStandardMaterial color="#1c1f23" metalness={0.7} roughness={0.35} />
      </Instances>
      {/* scan ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ox, 0.02, oz]} scale={0.001 + scanR}>
        <ringGeometry args={[0.985, 1, 160]} />
        <meshStandardMaterial {...M.volt} emissiveIntensity={4} transparent opacity={scanOn} />
      </mesh>
      {/* the chosen: highlighted → rise → fly to formation → grow */}
      {CHOSEN.map((i, k) => {
        const d = Math.hypot(gx(i) - ox, gz(i) - oz);
        const hitF = 16 + (d / 6.5) * 64;
        const hit = p(f, hitF, hitF + 10);
        const fly = p(f, 92 + k * 5, 132 + k * 5, easeInOut);
        const [sx, sz] = SLOT[k];
        const x = lerp(gx(i), sx, fly), z = lerp(gz(i), sz, fly);
        const y = 0.6 + Math.sin(fly * Math.PI) * 1.4 + fly * 0.13;
        const grow = [0, 1, 2].map((l) => p(f, 140 + k * 4 + l * 14, 156 + k * 4 + l * 14) * (1 - p(f, 206, 230)));
        return (
          <group key={i} position={[x, y, z]} scale={show}>
            <mesh>
              <capsuleGeometry args={[0.13, 0.7, 8, 16]} />
              <meshStandardMaterial {...(hit > 0.5 ? M.chrome : { color: '#1c1f23', metalness: 0.7, roughness: 0.35 })} />
            </mesh>
            <mesh position={[0, 0.62, 0]} scale={hit}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshStandardMaterial {...M.volt} emissiveIntensity={4} />
            </mesh>
            {grow.map((g, l) => (
              <mesh key={l} position={[0, -0.4 + g * (0.25 + l * 0.3), 0]} rotation={[Math.PI / 2, 0, 0]} scale={g > 0.01 ? 1 : 0}>
                <torusGeometry args={[0.24 + l * 0.02, 0.008, 8, 64]} />
                <meshStandardMaterial {...(l === 2 ? M.volt : M.chrome)} emissiveIntensity={l === 2 ? 3 : 0} transparent opacity={g} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* team links once in formation */}
      {SLOT.map(([x, z], k) => {
        const t = p(f, 150 + k * 3, 170 + k * 3) * (1 - p(f, 206, 226));
        const [x2, z2] = SLOT[(k + 1) % SLOT.length];
        const len = Math.hypot(x2 - x, z2 - z);
        return (
          <mesh key={`l${k}`} position={[(x + x2) / 2, 0.75, (z + z2) / 2]} rotation={[0, -Math.atan2(z2 - z, x2 - x), 0]} scale={[t, 1, 1]}>
            <boxGeometry args={[len, 0.008, 0.008]} />
            <meshStandardMaterial color={C.fg} transparent opacity={0.5} />
          </mesh>
        );
      })}
    </Stage3D>
  );
};
