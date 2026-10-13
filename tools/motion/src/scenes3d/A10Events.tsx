// 10 · Business and industry events — a stage with a chrome truss and an LED wall; two light beams sweep the
// hall; the audience fills in row by row from the entrance; the wall plays a programme; at the peak the
// beams cross centre stage — then the hall empties back into silence.
import React from 'react';
import { C, LOOP, easeInOut, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Instances } from '../parts';

const ROWS = 9, PER = 22;
const N = ROWS * PER;

const Beam: React.FC<{ x: number; yaw: number; pitch: number; roll: number; on: number }> = ({ x, yaw, pitch, roll, on }) => (
  <group position={[x, 4.2, -3.2]} rotation={[pitch - 0.35, yaw, roll]}>
    <mesh position={[0, -2.6, 0]}>
      <coneGeometry args={[0.9, 5.2, 48, 1, true]} />
      <meshBasicMaterial color={C.fg} transparent opacity={0.07 * on} depthWrite={false} side={2} blending={2} />
    </mesh>
    <mesh>
      <cylinderGeometry args={[0.14, 0.18, 0.3, 24]} />
      <meshStandardMaterial {...M.chrome} />
    </mesh>
    <mesh position={[0, -0.16, 0]}>
      <circleGeometry args={[0.13, 24]} />
      <meshStandardMaterial color={C.fg} emissive={C.fg} emissiveIntensity={4 * on} toneMapped={false} />
    </mesh>
    <spotLight position={[0, 0, 0]} angle={0.3} penumbra={0.6} intensity={40 * on} color={C.fg} distance={9} target-position={[0, -5, 0]} />
  </group>
);

export const A10Events: React.FC = () => {
  const f = useLoop();
  const T = f / LOOP;
  const fill = p(f, 10, 130, easeInOut);
  const leave = p(f, 196, 236, easeInOut);
  const lights = p(f, 20, 50) * (1 - p(f, 214, 236));
  const cross = p(f, 130, 160, easeInOut) * (1 - p(f, 180, 205, easeInOut));
  return (
    <Stage3D cam={{ radius: 7.6, height: 2.6, target: [0, 1.6, -1.4], sway: 0.4, fov: 36 }} bloom={0.9}>
      {/* stage platform */}
      <mesh position={[0, 0.2, -2.8]}>
        <boxGeometry args={[6.4, 0.4, 2.0]} />
        <meshStandardMaterial {...M.graphite} />
      </mesh>
      <mesh position={[0, 0.405, -1.8]}>
        <boxGeometry args={[6.4, 0.01, 0.02]} />
        <meshStandardMaterial {...M.volt} emissiveIntensity={1.2 * lights + 0.2} />
      </mesh>
      {/* truss */}
      {[-3.1, 3.1].map((x) => (
        <mesh key={x} position={[x, 2.2, -3.4]}>
          <boxGeometry args={[0.12, 4.4, 0.12]} />
          <meshStandardMaterial {...M.chrome} wireframe={false} />
        </mesh>
      ))}
      <mesh position={[0, 4.4, -3.4]}>
        <boxGeometry args={[6.32, 0.12, 0.12]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      {/* LED wall: pixel grid plays a programme */}
      <Instances count={28 * 12} f={f} fill={(i, o) => {
        const cx = i % 28, cy = Math.floor(i / 28);
        o.position.set(-2.7 + cx * 0.2, 1.1 + cy * 0.24, -3.55);
        const wave = 0.5 + 0.5 * Math.sin(cx * 0.45 - T * Math.PI * 8 + cy * 0.3);
        const bar = cy < 2 + 8 * (0.5 + 0.5 * Math.sin(cx * 0.7 + T * Math.PI * 4));
        const on = lights * (bar ? 0.9 : 0.12 + 0.2 * wave);
        o.scale.set(0.15, 0.17 * Math.max(0.05, on), 0.02);
      }} color={(i) => ((i % 28) % 9 === 4 ? C.accent : null)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={C.muted} emissive={C.fg} emissiveIntensity={0.55} toneMapped={false} />
      </Instances>
      {/* audience */}
      <Instances count={N} f={f} fill={(i, o) => {
        const row = Math.floor(i / PER), col = i % PER;
        const order = (ROWS - 1 - row) / ROWS + rnd(i, 1) * 0.25;
        const here = Math.min(fill * 1.25 - order * 0.9, 1) > 0 ? 1 : 0;
        const gone = leave * 1.25 - (1 - order) * 0.9 > 0 ? 1 : 0;
        const s = here * (1 - gone);
        const x = -3.6 + col * 0.34 + (row % 2) * 0.17;
        const z = -1.2 + row * 0.45;
        const nod = 0.02 * osc(f, 4, rnd(i, 3)) * cross;
        o.position.set(x, 0.24 + nod + (row * 0.06), z);
        o.scale.set(s, s, s);
      }}>
        <capsuleGeometry args={[0.09, 0.24, 6, 12]} />
        <meshStandardMaterial color="#2a2d31" metalness={0.8} roughness={0.3} />
      </Instances>
      {/* beams: sweep the hall (2 cycles per loop), cross centre stage at the peak */}
      <Beam x={-2.6} yaw={0.3 * osc(f, 1)} pitch={0} roll={(0.15 + 0.35 * osc(f, 2)) * (1 - cross) + 0.55 * cross} on={lights} />
      <Beam x={2.6} yaw={-0.3 * osc(f, 1, 0.5)} pitch={0} roll={-((0.15 + 0.35 * osc(f, 2, 0.5)) * (1 - cross) + 0.55 * cross)} on={lights} />
    </Stage3D>
  );
};
