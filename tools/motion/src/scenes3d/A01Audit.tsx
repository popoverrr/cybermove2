// 01 · Audit, finance, legal — a helix of thick glass ledger sheets turns slowly; a volt laser plane reads it
// top to bottom. Clean sheets get a chrome tick; two leak points flare volt and slide out of the helix.
// A chrome seal ring locks around the stack when the check is complete, then everything settles back.
import React from 'react';
import { MeshTransmissionMaterial, RoundedBox } from '@react-three/drei';
import { C, easeInOut, lerp, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';

const N = 11;
const FLAG = [3, 7];
const GAP = 0.27;
const BASE = 0.55;

const Sheet: React.FC<{ i: number; f: number; scanY: number }> = ({ i, f, scanY }) => {
  const y0 = BASE + (N - 1 - i) * GAP;
  const passed = scanY < y0;
  const flagged = FLAG.includes(i);
  const hitAt = 48 + (i / N) * 104;
  const hit = flagged ? p(f, hitAt, hitAt + 26) * (1 - p(f, 196, 226, easeInOut)) : 0;
  const appear = p(f, i * 2.5, 30 + i * 2.5);
  const vis = appear * (1 - p(f, 206 + (N - i), 236, easeInOut));
  const twist = (i / N) * 1.25 + 0.22 * osc(f, 1) + 0.6 * (1 - appear);
  const out = 1.15 * hit;
  return (
    <group rotation={[0, twist, 0]}>
      <group position={[out, y0 + 0.02 * osc(f, 2, i / N) + (1 - vis) * 0.8, 0]} rotation={[0, 0, -0.05 * hit]} scale={[vis, vis, vis]}>
        <RoundedBox args={[2.5, 0.11, 1.55]} radius={0.04} smoothness={5}>
          <MeshTransmissionMaterial
            samples={6}
            resolution={512}
            thickness={0.35}
            roughness={0.06}
            transmission={1}
            ior={1.45}
            chromaticAberration={0.08}
            anisotropy={0.2}
            distortion={0.05}
            distortionScale={0.3}
            temporalDistortion={0}
            clearcoat={1}
            attenuationDistance={1.4}
            attenuationColor={flagged && hit > 0.05 ? C.accent : '#c9ccd0'}
            color={flagged && hit > 0.05 ? '#e9ffb0' : '#ffffff'}
            backside
          />
        </RoundedBox>
        {/* engraved rows */}
        {Array.from({ length: 4 }, (_, k) => {
          const w = 0.5 + rnd(i * 7 + k, 2) * 1.2;
          const leak = flagged && k === 1 && hit > 0.3;
          return (
            <mesh key={k} position={[-1.05 + w / 2, 0.062, -0.5 + k * 0.3]}>
              <boxGeometry args={[w, 0.008, 0.045]} />
              <meshStandardMaterial {...(leak ? M.volt : M.chrome)} />
            </mesh>
          );
        })}
        {/* status cube on the edge */}
        <mesh position={[1.08, 0.08, 0.6]}>
          <boxGeometry args={[0.13, 0.05, 0.13]} />
          <meshStandardMaterial {...(flagged && hit > 0.05 ? M.volt : passed ? M.chrome : M.graphite)} />
        </mesh>
      </group>
    </group>
  );
};

export const A01Audit: React.FC = () => {
  const f = useLoop();
  const scan = p(f, 46, 152, easeInOut);
  const top = BASE + (N - 1) * GAP + 0.3;
  const scanY = lerp(top, BASE - 0.25, scan);
  const scanOn = p(f, 38, 52) * (1 - p(f, 150, 168));
  const seal = p(f, 150, 196) * (1 - p(f, 206, 236, easeInOut));
  const midY = BASE + ((N - 1) * GAP) / 2;
  return (
    <Stage3D cam={{ radius: 7.6, height: 2.6, target: [0, 1.75, 0], sway: 0.5, fov: 30 }}>
      {Array.from({ length: N }, (_, i) => <Sheet key={i} i={i} f={f} scanY={scanY} />)}

      {/* laser plane: razor line + faint sheet of light */}
      <group position={[0, scanY, 0]} scale={[scanOn, 1, scanOn]}>
        <mesh>
          <cylinderGeometry args={[2.05, 2.05, 0.006, 96, 1, true]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2.05, 96]} />
          <meshBasicMaterial color={C.accent} transparent opacity={0.06} depthWrite={false} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} position={[Math.cos(f * 0.09 + k * 1.57) * 2.05, 0, Math.sin(f * 0.09 + k * 1.57) * 2.05]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={10} />
          </mesh>
        ))}
      </group>

      {/* seal belt: descends onto the stack and locks */}
      <group position={[0, lerp(top + 1.2, midY, seal), 0]} rotation={[Math.PI / 2, 0, f * 0.004 + (1 - seal) * 1.2]} scale={0.85 + 0.15 * seal}>
        <mesh>
          <torusGeometry args={[1.95, 0.03, 24, 160]} />
          <meshStandardMaterial {...M.chrome} transparent opacity={seal} />
        </mesh>
        {Array.from({ length: 60 }, (_, k) => (
          <mesh key={k} position={[Math.cos((k / 60) * Math.PI * 2) * 2.06, Math.sin((k / 60) * Math.PI * 2) * 2.06, 0]} rotation={[0, 0, (k / 60) * Math.PI * 2]} scale={seal}>
            <boxGeometry args={[k % 5 === 0 ? 0.14 : 0.06, 0.012, 0.012]} />
            <meshStandardMaterial {...(k % 15 === 0 ? M.volt : M.chrome)} />
          </mesh>
        ))}
      </group>

      {/* chrome plinth */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[1.9, 2.0, 0.12, 96]} />
        <meshStandardMaterial {...M.graphite} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.86, 1.9, 96]} />
        <meshStandardMaterial {...M.volt} emissiveIntensity={0.7} />
      </mesh>
    </Stage3D>
  );
};
