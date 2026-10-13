// 06 · Full-cycle B2B and B2C promotion — five channel streams arc in from around the scene and spiral down
// a chrome funnel (one system); what comes out the bottom are volt deal cubes that stack into a growing
// column, while a second, steady stream of chrome leads keeps the system fed.
import React from 'react';
import * as THREE from 'three';
import { C, LOOP, easeInOut, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Instances, Plinth } from '../parts';

const N = 520;
const TOP = 3.4, NECK = 1.35;
const lathe = new THREE.LatheGeometry(
  Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    const r = 0.18 + 1.45 * Math.pow(t, 2.2);
    return new THREE.Vector2(r, NECK + t * (TOP - NECK));
  }),
  128,
);
const SOURCES = Array.from({ length: 5 }, (_, i) => {
  const a = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9;
  return new THREE.Vector3(Math.cos(a) * 4.6, 2.2 + (i % 2) * 1.1, Math.sin(a) * 2.6 - 0.6);
});

export const A06Funnel: React.FC = () => {
  const f = useLoop();
  const T = f / LOOP;
  const show = p(f, 0, 30);
  const stack = Math.floor(p(f, 30, 200) * 9); // cubes landed this loop
  const fall = p(f, 200, 236, easeInOut);
  return (
    <Stage3D cam={{ radius: 8.6, height: 3.4, target: [0, 1.9, 0], sway: 0.5, fov: 32 }}>
      <Plinth r={1.2} />
      {/* funnel */}
      <mesh geometry={lathe} scale={show}>
        <Glass thickness={0.15} ca={0.1} rough={0.12} />
      </mesh>
      <mesh geometry={lathe} scale={show * 1.005}>
        <meshStandardMaterial color={C.fg} wireframe transparent opacity={0.06} />
      </mesh>
      {[TOP, (TOP + NECK) / 2 + 0.25, NECK].map((y, i) => {
        const t = (y - NECK) / (TOP - NECK);
        const r = 0.18 + 1.45 * Math.pow(t, 2.2);
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={show}>
            <torusGeometry args={[r + 0.01, i === 2 ? 0.03 : 0.015, 16, 128]} />
            <meshStandardMaterial {...(i === 2 ? M.volt : M.chrome)} emissiveIntensity={i === 2 ? 3 : 0} />
          </mesh>
        );
      })}
      {/* channel particles: arc from a source to the rim, then spiral down to the neck */}
      <Instances count={N} f={f} fill={(i, o) => {
        const src = SOURCES[i % 5];
        const t = (T * 2 + rnd(i, 1)) % 1;
        const a0 = Math.atan2(src.z, src.x);
        let x, y, z;
        if (t < 0.45) {
          const u = t / 0.45;
          const e = u * u * (3 - 2 * u);
          const rimA = a0 + 0.4;
          const rx = Math.cos(rimA) * 1.6, rz = Math.sin(rimA) * 1.6;
          x = src.x + (rx - src.x) * e; z = src.z + (rz - src.z) * e;
          y = src.y + (TOP + 0.15 - src.y) * e + Math.sin(u * Math.PI) * 0.6;
        } else {
          const u = (t - 0.45) / 0.55;
          const h = TOP - u * (TOP - NECK);
          const r = 0.18 + 1.45 * Math.pow((h - NECK) / (TOP - NECK), 2.2) - 0.06;
          const a = a0 + 0.4 + u * Math.PI * 5;
          x = Math.cos(a) * r; z = Math.sin(a) * r; y = h;
        }
        o.position.set(x, y, z);
        const s = (0.03 + rnd(i, 2) * 0.03) * show * (t > 0.97 ? (1 - t) / 0.03 : 1);
        o.scale.set(s, s, s);
      }} color={(i) => (i % 5 === 2 ? C.accent : null)}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial {...M.chrome} />
      </Instances>
      {/* source emitters */}
      {SOURCES.map((s, i) => (
        <group key={i} position={s} scale={show}>
          <mesh rotation={[0, -Math.atan2(s.z, s.x), Math.PI / 2]}>
            <torusGeometry args={[0.16, 0.012, 12, 48]} />
            <meshStandardMaterial {...M.chrome} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={4} />
          </mesh>
        </group>
      ))}
      {/* deal cubes: one falls out of the neck every ~19 frames and stacks */}
      {Array.from({ length: 9 }, (_, k) => {
        const start = 30 + k * 19;
        const drop = p(f, start, start + 16, easeInOut);
        const landed = k < stack;
        const y = landed ? 0.2 + k * 0.13 : NECK - 0.1 - drop * (NECK - 0.3 - k * 0.13);
        const vis = (f >= start ? 1 : 0) * (1 - fall);
        return (
          <mesh key={k} position={[0, y - fall * 0.2, 0]} rotation={[0, k * 0.35 + (landed ? 0 : drop * 1.2), 0]} scale={vis}>
            <boxGeometry args={[0.26, 0.11, 0.26]} />
            <meshStandardMaterial {...(k % 3 === 2 ? M.volt : M.chrome)} emissiveIntensity={k % 3 === 2 ? 2.5 : 0} />
          </mesh>
        );
      })}
    </Stage3D>
  );
};
