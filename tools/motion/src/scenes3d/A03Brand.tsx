// 03 · Brand marketing — touchpoints float around the plinth: phone, poster, card, billboard, pack, cup.
// They start blank graphite; a volt identity wave rolls out from the centre and as it passes, every surface
// receives the same chrome mark and volt edge — one brand speaking everywhere. Then it ebbs away.
import React from 'react';
import { RoundedBox } from '@react-three/drei';
import { C, easeInOut, osc, p, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Plinth } from '../parts';

type Obj = { kind: 'slab' | 'cyl'; size: [number, number, number]; pos: [number, number, number]; rot: number };
const OBJS: Obj[] = [
  { kind: 'slab', size: [0.78, 1.55, 0.08], pos: [0, 1.25, 0.2], rot: 0 },       // phone (centre)
  { kind: 'slab', size: [1.2, 1.7, 0.05], pos: [-2.1, 1.6, -0.9], rot: 0.5 },    // poster
  { kind: 'slab', size: [2.4, 1.0, 0.06], pos: [1.6, 2.9, -1.8], rot: -0.35 },   // billboard
  { kind: 'slab', size: [0.9, 0.55, 0.03], pos: [1.9, 1.2, 0.9], rot: -0.7 },    // business card
  { kind: 'cyl', size: [0.32, 0.8, 0.32], pos: [-1.3, 0.55, 1.2], rot: 0.3 },     // cup
  { kind: 'slab', size: [0.9, 1.1, 0.5], pos: [2.4, 0.7, -0.4], rot: -0.4 },     // pack
  { kind: 'slab', size: [1.0, 1.3, 0.04], pos: [-2.5, 3.1, -2.2], rot: 0.6 },    // story
];

const Mark: React.FC<{ t: number; s: number; z: number }> = ({ t, s, z }) => (
  <group position={[0, 0.05, z]} scale={s * (0.6 + 0.4 * t)}>
    <mesh>
      <torusGeometry args={[0.2, 0.026, 16, 64]} />
      <meshStandardMaterial {...M.chrome} transparent opacity={t} />
    </mesh>
    <mesh position={[0.2, 0.17, 0]} scale={t}>
      <boxGeometry args={[0.07, 0.07, 0.03]} />
      <meshStandardMaterial {...M.volt} emissiveIntensity={4} />
    </mesh>
  </group>
);

export const A03Brand: React.FC = () => {
  const f = useLoop();
  const wave = p(f, 40, 150, easeInOut); // radius of the identity wave 0→1
  const ebb = p(f, 192, 232, easeInOut);
  const R = wave * 4.6;
  return (
    <Stage3D cam={{ radius: 8.4, height: 3.2, target: [0, 1.6, -0.3], sway: 0.6, fov: 32 }}>
      <Plinth r={1.4} rim={0.6 + 2 * p(f, 36, 50) * (1 - p(f, 60, 90))} />
      {/* the wave on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={0.001 + R}>
        <ringGeometry args={[0.985, 1, 160]} />
        <meshStandardMaterial {...M.volt} emissiveIntensity={3} transparent opacity={(1 - wave) * 0.9 + 0.05} />
      </mesh>
      {OBJS.map((o, i) => {
        const d = Math.hypot(o.pos[0], o.pos[2], (o.pos[1] - 1.2) * 0.6);
        const hitF = 40 + (Math.min(d, 4.6) / 4.6) * 110;
        const branded = p(f, hitF - 4, hitF + 22) * (1 - ebb);
        const flash = p(f, hitF - 4, hitF + 4) * (1 - p(f, hitF + 4, hitF + 30));
        const appear = p(f, i * 4, 30 + i * 4) * (1 - p(f, 214, 238, easeInOut));
        const bob = 0.06 * osc(f, 1, i / OBJS.length);
        const front = o.kind === 'cyl' ? o.size[0] + 0.01 : o.size[2] / 2 + 0.01;
        const ms = Math.min(o.size[0], o.size[1]) * 1.1;
        return (
          <group key={i} position={[o.pos[0], o.pos[1] + bob + (1 - appear) * -0.6, o.pos[2]]} rotation={[0, o.rot + 0.12 * osc(f, 1, i / 3), 0]} scale={0.001 + appear}>
            {o.kind === 'slab' ? (
              <RoundedBox args={o.size} radius={Math.min(0.06, o.size[2] / 2 - 0.001)} smoothness={4}>
                <meshPhysicalMaterial color={branded > 0.5 ? '#2a2d31' : '#17191c'} metalness={0.92} roughness={0.2 - 0.12 * branded} clearcoat={1} clearcoatRoughness={0.05} />
              </RoundedBox>
            ) : (
              <mesh>
                <cylinderGeometry args={[o.size[0], o.size[0] * 0.82, o.size[1], 64]} />
                <meshPhysicalMaterial color="#24272b" metalness={0.92} roughness={0.14} clearcoat={1} />
              </mesh>
            )}
            {/* volt edge line along the bottom when branded */}
            <mesh position={[0, -o.size[1] / 2 + 0.06, front + 0.002]} scale={[branded, 1, 1]}>
              <boxGeometry args={[o.kind === 'cyl' ? 0.3 : o.size[0] * 0.8, 0.012, 0.004]} />
              <meshStandardMaterial {...M.volt} emissiveIntensity={3} />
            </mesh>
            {/* placeholder lines → typeset lines */}
            {o.kind === 'slab' && [0, 1, 2].map((k) => (
              <mesh key={k} position={[-o.size[0] * 0.4 + (o.size[0] * 0.8 * [0.8, 0.55, 0.35][k]) / 2, -o.size[1] * 0.18 - k * o.size[1] * 0.08, front]}>
                <boxGeometry args={[o.size[0] * 0.8 * [0.8, 0.55, 0.35][k], o.size[1] * 0.025, 0.004]} />
                <meshStandardMaterial {...(branded > 0.5 ? M.chrome : M.graphite)} />
              </mesh>
            ))}
            <Mark t={branded} s={ms} z={o.kind === 'cyl' ? o.size[0] - 0.02 : front} />
            {/* flash shell as the wave passes */}
            {flash > 0.01 && (
              <mesh scale={1 + 0.15 * (1 - flash)}>
                <boxGeometry args={[o.kind === 'cyl' ? o.size[0] * 2 : o.size[0], o.size[1], o.kind === 'cyl' ? o.size[0] * 2 : o.size[2]]} />
                <meshBasicMaterial color={C.accent} wireframe transparent opacity={flash * 0.7} />
              </mesh>
            )}
          </group>
        );
      })}
    </Stage3D>
  );
};
