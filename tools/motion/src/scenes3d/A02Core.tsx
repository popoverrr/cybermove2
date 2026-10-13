// 02 · Brand core, growth consulting — a cloud of chrome fragments (scattered meanings) is pulled into three
// gyroscope orbits around a glass core with a volt heart; the rings lock into alignment, then loosen back.
import React from 'react';
import * as THREE from 'three';
import { C, easeInOut, lerp, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Instances, Plinth } from '../parts';

const N = 420;
const CY = 2.1;

export const A02Core: React.FC = () => {
  const f = useLoop();
  const g = p(f, 24, 120, easeInOut) * (1 - p(f, 196, 238, easeInOut)); // gather
  const core = p(f, 70, 130) * (1 - p(f, 200, 232));
  const lock = p(f, 120, 170, easeInOut) * (1 - p(f, 196, 226, easeInOut)); // rings align
  const T = (f / 240) * Math.PI * 2;
  const rings = [
    { r: 1.25, tilt: [0.35, 0, 0.6], spin: 2 },
    { r: 1.65, tilt: [1.2, 0.4, -0.3], spin: -1 },
    { r: 2.05, tilt: [-0.5, 0.9, 0.2], spin: 1 },
  ];
  return (
    <Stage3D cam={{ radius: 8.2, height: 2.9, target: [0, CY - 0.1, 0], sway: 0.55, fov: 30 }} bloom={1.2}>
      <Plinth r={2.1} />
      {/* fragments: chaos cloud ↔ orbit rings */}
      <Instances count={N} f={f} fill={(i, o) => {
        const ring = rings[i % 3];
        const a = (i / N) * Math.PI * 2 * 3 + T * ring.spin;
        const tilt = ring.tilt.map((t) => t * (1 - lock));
        const v = new THREE.Vector3(Math.cos(a) * ring.r, 0, Math.sin(a) * ring.r);
        const e = new THREE.Euler(tilt[0], tilt[1] + T * 0.2, tilt[2]);
        v.applyEuler(e);
        const cx = (rnd(i, 1) - 0.5) * 9 + 0.5 * Math.sin(T + rnd(i, 7) * 6);
        const cy = CY + (rnd(i, 2) - 0.5) * 5 + 0.4 * Math.cos(T + rnd(i, 8) * 6);
        const cz = (rnd(i, 3) - 0.5) * 7;
        o.position.set(lerp(cx, v.x, g), lerp(cy, CY + v.y, g), lerp(cz, v.z, g));
        o.rotation.set(T * (1 + Math.floor(rnd(i, 4) * 3)) + rnd(i, 5) * 6, T * 2 + rnd(i, 6) * 6, 0);
        const s = 0.035 + rnd(i, 9) * 0.05;
        o.scale.set(s, s, s * (1 + 2 * g));
      }} color={(i) => (i % 37 === 0 ? C.accent : null)}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...M.chrome} />
      </Instances>

      {/* gyroscope rings */}
      {rings.map((r, k) => (
        <group key={k} position={[0, CY, 0]} rotation={[r.tilt[0] * (1 - lock), r.tilt[1] * (1 - lock) + T * 0.2, r.tilt[2] * (1 - lock)]} scale={0.7 + 0.3 * g}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r.r, 0.018, 16, 200]} />
            <meshStandardMaterial {...M.chrome} transparent opacity={g} />
          </mesh>
          <mesh position={[Math.cos(T * r.spin * 1.5) * r.r, 0, Math.sin(T * r.spin * 1.5) * r.r]} scale={g}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial {...M.volt} emissiveIntensity={2.2} />
          </mesh>
        </group>
      ))}

      {/* glass core with a volt heart */}
      <group position={[0, CY, 0]} scale={0.001 + core}>
        <mesh>
          <icosahedronGeometry args={[0.72, 12]} />
          <Glass thickness={0.6} ca={0.3} tint="#d9dcdf" />
        </mesh>
        <mesh rotation={[T, T * 2, 0]}>
          <icosahedronGeometry args={[0.3 + 0.03 * osc(f, 4), 1]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={1.4 + 0.8 * lock} />
        </mesh>
        <mesh rotation={[T * -1, T, 0.4]}>
          <icosahedronGeometry args={[0.46, 1]} />
          <meshStandardMaterial color={C.fg} wireframe transparent opacity={0.35} />
        </mesh>
      </group>
      {/* light column when locked */}
      <mesh position={[0, CY / 2 + 0.1, 0]} scale={[1, lock, 1]}>
        <cylinderGeometry args={[0.012, 0.012, CY, 8]} />
        <meshStandardMaterial {...M.volt} emissiveIntensity={5} />
      </mesh>
    </Stage3D>
  );
};
