// 08 · Building a sales department — a structure assembles: a head node above, three manager nodes joined by
// chrome conduits. Leads stream in, the head routes them round-robin to the managers, and behind each manager
// a glass KPI column fills with volt as deals close. Structure first, then flow, then numbers.
import React from 'react';
import * as THREE from 'three';
import { C, LOOP, easeInOut, osc, p, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Plinth } from '../parts';

const HEAD = new THREE.Vector3(0, 3.1, 0);
const MGR = [new THREE.Vector3(-1.7, 1.45, 0.4), new THREE.Vector3(0, 1.3, 0.9), new THREE.Vector3(1.7, 1.45, 0.4)];
const ENTRY = new THREE.Vector3(-4.2, 3.4, -1.2);
const conduit = (a: THREE.Vector3, b: THREE.Vector3, bend = 0.6) =>
  new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, bend, 0)), b);
const IN = conduit(ENTRY, HEAD, 0.8);
const DOWN = MGR.map((m) => conduit(HEAD, m, 0.3));
const tubes = [IN, ...DOWN].map((c) => new THREE.TubeGeometry(c, 80, 0.02, 10, false));

const LEADS = 12;

export const A08Sales: React.FC = () => {
  const f = useLoop();
  const T = f / LOOP;
  const build = p(f, 0, 50, easeInOut) * (1 - p(f, 214, 238, easeInOut));
  const kpi = (i: number) => p(f, 70 + i * 12, 190 + i * 6) * (1 - p(f, 206, 232, easeInOut));
  return (
    <Stage3D cam={{ radius: 8.4, height: 3.3, target: [0, 1.9, 0], sway: 0.5, fov: 32 }}>
      <Plinth r={2.2} />
      {/* conduits */}
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} scale={[1, 1, 1]} visible={build > 0.02}>
          <meshStandardMaterial {...M.chrome} transparent opacity={build} />
        </mesh>
      ))}
      {/* head node */}
      <group position={HEAD} scale={build}>
        <mesh>
          <sphereGeometry args={[0.34, 64, 64]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, T * Math.PI * 2]}>
          <torusGeometry args={[0.52, 0.012, 12, 96]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={2.5} />
        </mesh>
      </group>
      {/* managers + KPI columns */}
      {MGR.map((m, i) => (
        <group key={i}>
          <group position={m} scale={build}>
            <mesh>
              <sphereGeometry args={[0.24, 48, 48]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
            {/* script cue lines flicker beside the manager */}
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[0.42, 0.12 - k * 0.1, 0]} scale={[0.4 + 0.6 * Math.max(0, osc(f, 4, i * 0.3 + k * 0.1)), 1, 1]}>
                <boxGeometry args={[0.3, 0.018, 0.005]} />
                <meshStandardMaterial {...M.steel} />
              </mesh>
            ))}
          </group>
          <group position={[m.x, 0.12, m.z - 1.0]} scale={[1, build, 1]}>
            <mesh position={[0, 1.0, 0]}>
              <boxGeometry args={[0.36, 2.0, 0.36]} />
              <Glass thickness={0.25} ca={0.06} />
            </mesh>
            <mesh position={[0, (2.0 * kpi(i)) / 2, 0]} scale={[1, Math.max(0.001, kpi(i)), 1]}>
              <boxGeometry args={[0.3, 2.0, 0.3]} />
              <meshStandardMaterial {...M.volt} emissiveIntensity={1.4} transparent opacity={0.85} />
            </mesh>
            <mesh position={[0, 2.0 * kpi(i) + 0.01, 0]}>
              <boxGeometry args={[0.38, 0.012, 0.38]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
          </group>
        </group>
      ))}
      {/* leads: in through the entry conduit, then round-robin to a manager */}
      {Array.from({ length: LEADS }, (_, k) => {
        const t = (T * 2 + k / LEADS) % 1; // seamless (2 cycles)
        const to = DOWN[k % 3];
        const pt = t < 0.5 ? IN.getPoint(t / 0.5) : to.getPoint((t - 0.5) / 0.5);
        const s = Math.min(1, t / 0.08, (1 - t) / 0.08) * build;
        const hot = k % 4 === 0;
        return (
          <mesh key={k} position={pt} scale={s}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <meshStandardMaterial {...(hot ? M.volt : M.chrome)} emissiveIntensity={hot ? 4 : 0} />
          </mesh>
        );
      })}
      <pointLight position={[0, 3.1, 0.8]} intensity={3} distance={4} color={C.fg} />
    </Stage3D>
  );
};
