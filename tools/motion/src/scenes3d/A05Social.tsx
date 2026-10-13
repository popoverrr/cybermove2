// 05 · SMM, offline and social campaigns — a tall glass phone stands on the plinth; a feed of post tiles
// streams up through it; chrome and volt hearts rise and spin off it; behind, an outdoor billboard flips its
// creative; reach rings ripple across the floor from both.
import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { C, LOOP, cyc, easeInOut, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Plinth, heartGeometry } from '../parts';

const PH = 2.5, PW = 1.22;

export const A05Social: React.FC = () => {
  const f = useLoop();
  const T = f / LOOP;
  const show = p(f, 0, 30);
  return (
    <Stage3D cam={{ radius: 8.0, height: 2.7, target: [0, 1.7, -0.4], sway: 0.5, fov: 32 }}>
      <Plinth r={1.25} />
      {/* phone */}
      <group position={[0, 1.42, 0]} scale={show}>
        <RoundedBox args={[PW, PH, 0.12]} radius={0.12} smoothness={6}>
          <Glass thickness={0.4} ca={0.12} />
        </RoundedBox>
        <RoundedBox args={[PW + 0.04, PH + 0.04, 0.08]} radius={0.13} smoothness={6} position={[0, 0, -0.03]}>
          <meshStandardMaterial {...M.chrome} />
        </RoundedBox>
        <mesh position={[0, PH / 2 - 0.12, 0.07]}>
          <capsuleGeometry args={[0.04, 0.22, 8, 16]} />
          <meshStandardMaterial color="#000" />
        </mesh>
        {/* feed tiles scroll up; fade at the edges */}
        {Array.from({ length: 6 }, (_, i) => {
          const t = cyc(f, 2, i / 6);
          const y = -PH / 2 - 0.3 + t * (PH + 0.6);
          const vis = Math.max(0, Math.min(1, (PH / 2 - Math.abs(y)) / 0.35));
          const hot = i % 3 === 1;
          return (
            <group key={i} position={[0, y, 0.075]} scale={[1, vis, 1]}>
              <mesh>
                <boxGeometry args={[PW - 0.2, 0.62, 0.01]} />
                <meshStandardMaterial color={hot ? '#3a3e44' : '#24272b'} metalness={0.7} roughness={0.25} emissive={hot ? '#1a1c1f' : '#000'} />
              </mesh>
              <mesh position={[-0.2, -0.22, 0.01]}>
                <boxGeometry args={[0.5, 0.035, 0.005]} />
                <meshStandardMaterial {...M.chrome} />
              </mesh>
              <mesh position={[0.36, 0.2, 0.012]}>
                <boxGeometry args={[0.1, 0.1, 0.01]} />
                <meshStandardMaterial {...(hot ? M.volt : M.steel)} emissiveIntensity={hot ? 3 : 0} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* rising hearts */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = cyc(f, 1, rnd(i, 1));
        const ang = rnd(i, 2) * Math.PI * 2;
        const rr = 0.9 + rnd(i, 3) * 0.9;
        const volt = i % 3 === 0;
        return (
          <mesh key={i} geometry={heartGeometry} position={[Math.cos(ang + t * 2) * rr, 0.8 + t * 3.4, Math.sin(ang + t * 2) * rr * 0.7 + 0.4]}
            rotation={[0.2, T * Math.PI * 2 * (i % 2 ? 1 : -1) + i, 0.15 * Math.sin(t * 6)]}
            scale={(0.18 + rnd(i, 4) * 0.14) * Math.sin(t * Math.PI) * show}>
            <meshStandardMaterial {...(volt ? M.volt : M.chrome)} emissiveIntensity={volt ? 2.4 : 0} />
          </mesh>
        );
      })}

      {/* billboard (OOH) */}
      <group position={[-2.6, 0, -2.4]} rotation={[0, 0.55, 0]} scale={show}>
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 2.6, 16]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        <mesh position={[0, 2.85, -0.05]}>
          <boxGeometry args={[2.7, 1.45, 0.1]} />
          <meshStandardMaterial {...M.graphite} />
        </mesh>
        {/* three-sided prism slats (trivision) flip the creative */}
        {Array.from({ length: 12 }, (_, k) => (
          <mesh key={k} position={[-1.25 + k * 0.2272 + 0.1136, 2.85, 0.04]} rotation={[0, (p(f, 20 + k * 2, 52 + k * 2, easeInOut) + p(f, 100 + k * 2, 132 + k * 2, easeInOut) + p(f, 180 + k * 2, 212 + k * 2, easeInOut)) * ((Math.PI * 2) / 3) + Math.PI / 6, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 1.32, 3]} />
            <meshStandardMaterial color={k % 4 === 0 ? '#2a2d31' : '#8c9199'} metalness={0.95} roughness={0.18} flatShading />
          </mesh>
        ))}
        <mesh position={[0.95, 3.35, 0.16]}>
          <boxGeometry args={[0.32, 0.32, 0.02]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={2 + osc(f, 4)} />
        </mesh>
        <spotLight position={[0, 4.2, 1.2]} angle={0.6} penumbra={0.8} intensity={4} color={C.fg} target-position={[0, 2.8, 0]} />
      </group>

      {/* reach rings */}
      {[0, 1, 2, 3].map((k) => {
        const t = cyc(f, 2, k / 4);
        return (
          <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} scale={1.3 + t * 4.5}>
            <ringGeometry args={[0.99, 1, 160]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={2} transparent opacity={(1 - t) * 0.35 * show} />
          </mesh>
        );
      })}
    </Stage3D>
  );
};
