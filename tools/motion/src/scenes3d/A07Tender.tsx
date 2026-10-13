// 07 · Tender consulting — a field of tender documents lies on the floor; a scanning beam sweeps it and
// lights the matching lots; one lifts, turns to camera, glass layers of the application assemble onto it,
// a chrome stamp presses a volt seal, and the finished bid rises out of frame.
import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { C, easeIn, easeInOut, lerp, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Plinth } from '../parts';

const COLS = 9, ROWS = 6;
const PICK = 22; // the lot we bid on
const MATCH = [5, 13, 22, 31, 40];

export const A07Tender: React.FC = () => {
  const f = useLoop();
  const show = p(f, 0, 26) * (1 - p(f, 220, 239));
  const sweep = p(f, 14, 80, easeInOut); // beam crosses the field
  const lift = p(f, 78, 112, easeInOut);
  const layers = [p(f, 108, 128), p(f, 118, 138), p(f, 128, 148)];
  const stamp = p(f, 148, 162, easeIn) * (1 - p(f, 164, 180));
  const sealed = p(f, 160, 166);
  const away = p(f, 190, 230, easeIn);
  const beamX = lerp(-4.4, 4.4, sweep);
  const px = (i: number) => -3.6 + (i % COLS) * 0.9;
  const pz = (i: number) => -2.6 + Math.floor(i / COLS) * 0.75;
  return (
    <Stage3D cam={{ radius: 6.4, height: 3.2, target: [0, 1.25, 0.2], sway: 0.45, fov: 34 }}>
      {/* document field */}
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        if (i === PICK) return null;
        const lit = MATCH.includes(i) && beamX > px(i) ? 1 : 0;
        return (
          <group key={i} position={[px(i), 0.03 + 0.02 * osc(f, 1, rnd(i, 1)), pz(i)]} rotation={[0, (rnd(i, 2) - 0.5) * 0.12, 0]} scale={show}>
            <mesh>
              <boxGeometry args={[0.62, 0.025, 0.5]} />
              <meshStandardMaterial {...M.graphite} />
            </mesh>
            <mesh position={[-0.08, 0.016, -0.12]}>
              <boxGeometry args={[0.36, 0.004, 0.035]} />
              <meshStandardMaterial {...(lit ? M.chrome : M.steel)} />
            </mesh>
            <mesh position={[0.22, 0.018, 0.16]}>
              <boxGeometry args={[0.08, 0.01, 0.08]} />
              <meshStandardMaterial {...(lit ? M.volt : M.graphite)} emissiveIntensity={lit ? 2.5 : 0} />
            </mesh>
          </group>
        );
      })}
      {/* scanning beam: a thin light blade */}
      <group position={[beamX, 0, 0]} scale={[1, 1, sweep > 0 && sweep < 1 ? 1 : 0]}>
        <mesh position={[0, 0.6, -0.6]}>
          <boxGeometry args={[0.012, 1.2, 5.2]} />
          <meshBasicMaterial color={C.accent} transparent opacity={0.025} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.05, -0.6]}>
          <boxGeometry args={[0.02, 0.02, 5.2]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={7} />
        </mesh>
      </group>

      <Plinth r={0.9} rim={0.4 + 2 * sealed * (1 - away)} />

      {/* the chosen lot → application */}
      <group
        position={[lerp(px(PICK), 0, lift), lerp(0.03, 1.55, lift) + away * 4.2, lerp(pz(PICK), 0.3, lift)]}
        rotation={[lerp(-Math.PI / 2, -0.12, lift) + 0.04 * osc(f, 1), lerp(0, -0.25, lift) + 0.1 * osc(f, 1, 0.3), 0]}
        scale={show}>
        <RoundedBox args={[1.1, 1.5, 0.04]} radius={0.015} smoothness={4} rotation={[0, 0, 0]}>
          <meshStandardMaterial {...M.graphite} />
        </RoundedBox>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} position={[-0.1, 0.5 - k * 0.16, 0.025]}>
            <boxGeometry args={[0.72 - (k % 2) * 0.2, 0.03, 0.004]} />
            <meshStandardMaterial {...M.chrome} />
          </mesh>
        ))}
        {layers.map((t, k) => (
          <group key={k} position={[0.05 * (k + 1), -0.05 * (k + 1), 0.06 + k * 0.06 + (1 - t) * 1.2]} scale={t}>
            <RoundedBox args={[1.1, 1.5, 0.03]} radius={0.015} smoothness={4}>
              <Glass thickness={0.1} ca={0.06} />
            </RoundedBox>
            <mesh position={[0.4, 0.6, 0.02]}>
              <boxGeometry args={[0.1, 0.1, 0.005]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
          </group>
        ))}
        {/* seal imprint */}
        <group position={[0.3, -0.45, 0.28]} scale={sealed}>
          <mesh>
            <torusGeometry args={[0.16, 0.018, 16, 64]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={1.6} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.12, 48]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={0.5} />
          </mesh>
        </group>
        {/* stamp */}
        <group position={[0.3, -0.45, 0.3 + 1.1 * (1 - stamp)]} rotation={[Math.PI / 2, 0, 0]} scale={layers[2] * (1 - away)}>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.17, 0.19, 0.12, 48]} />
            <meshStandardMaterial {...M.chrome} />
          </mesh>
          <mesh position={[0, -0.36, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.4, 24]} />
            <meshStandardMaterial {...M.chrome} />
          </mesh>
          <mesh position={[0, -0.6, 0]}>
            <sphereGeometry args={[0.11, 32, 32]} />
            <meshStandardMaterial {...M.graphite} />
          </mesh>
        </group>
      </group>
      {/* deadline track */}
      <group position={[0, 0.02, 2.3]} scale={show}>
        <mesh>
          <boxGeometry args={[6, 0.01, 0.01]} />
          <meshStandardMaterial {...M.steel} />
        </mesh>
        {Array.from({ length: 13 }, (_, k) => (
          <mesh key={k} position={[-3 + k * 0.5, 0.03, 0]}>
            <boxGeometry args={[0.01, k === 12 ? 0.2 : 0.06, 0.01]} />
            <meshStandardMaterial {...(k === 12 ? M.volt : M.steel)} emissiveIntensity={k === 12 ? 3 : 0} />
          </mesh>
        ))}
        <mesh position={[-3 + 6 * p(f, 10, 170, easeInOut) * 0.95, 0.06, 0]}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      </group>
    </Stage3D>
  );
};
