// 04 · CRM, automation, telephony, AI — a chrome rail loops around an AI core. Glass deal cards ride it
// through four gates (NEW → CALL → DEAL → PAID); each gate flares as a card passes, data pulses run from the
// core to the gates, and a ring of voice bars around the core speaks while a card is at CALL.
import React from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { C, LOOP, osc, p, rnd, useLoop } from '../kit';
import { M, Stage3D } from '../Stage3D';
import { Glass, Instances, Plinth } from '../parts';

const R = 2.35;
const CARDS = 5;
const GATES = [0.08, 0.33, 0.58, 0.83];
const curve = new THREE.CatmullRomCurve3(
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * R, 1.25 + 0.35 * Math.sin(a * 2), Math.sin(a) * R * 0.8);
  }),
  true,
  'catmullrom',
  0.5,
);
const tube = new THREE.TubeGeometry(curve, 400, 0.022, 12, true);

export const A04Systems: React.FC = () => {
  const f = useLoop();
  const T = f / LOOP;
  const show = p(f, 0, 30);
  // cards move one full lap per loop, evenly spaced; they ease into each gate (stop-and-go)
  const pos = (k: number) => {
    const u = (T + k / CARDS) % 1;
    const seg = 1 / 4;
    const i = Math.floor(u / seg);
    const local = (u - i * seg) / seg;
    const eased = 0.5 - 0.5 * Math.cos(Math.min(1, local / 0.75) * Math.PI);
    return (GATES[i] + eased * seg) % 1;
  };
  const near = (g: number) => Math.max(0, ...Array.from({ length: CARDS }, (_, k) => {
    const d = Math.abs(((pos(k) - g + 1.5) % 1) - 0.5);
    return 1 - Math.min(1, d / 0.025);
  }));
  const calling = near(GATES[1]);
  return (
    <Stage3D cam={{ radius: 7.4, height: 4.8, target: [0, 1.2, 0], sway: 0.5, fov: 32 }}>
      <Plinth r={1.3} />
      {/* rail */}
      <mesh geometry={tube}>
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      {/* gates */}
      {GATES.map((g, i) => {
        const pt = curve.getPointAt(g);
        const tan = curve.getTangentAt(g);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
        const lit = near(g);
        return (
          <group key={i} position={pt} quaternion={q}>
            <mesh>
              <torusGeometry args={[0.42, 0.02, 16, 96]} />
              <meshStandardMaterial {...(lit > 0.35 ? M.volt : M.chrome)} emissiveIntensity={2.5 * lit} />
            </mesh>
            {Array.from({ length: 16 }, (_, k) => (
              <mesh key={k} position={[Math.cos((k / 16) * Math.PI * 2) * 0.5, Math.sin((k / 16) * Math.PI * 2) * 0.5, 0]} rotation={[0, 0, (k / 16) * Math.PI * 2]}>
                <boxGeometry args={[0.06, 0.01, 0.01]} />
                <meshStandardMaterial {...M.steel} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* deal cards */}
      {Array.from({ length: CARDS }, (_, k) => {
        const u = pos(k);
        const pt = curve.getPointAt(u);
        const tan = curve.getTangentAt(u);
        const yaw = Math.atan2(tan.x, tan.z);
        const paid = u > GATES[3] - 0.01 || u < GATES[0] - 0.02;
        return (
          <group key={k} position={[pt.x, pt.y + 0.22, pt.z]} rotation={[0, yaw + Math.PI / 2, 0]} scale={show}>
            <RoundedBox args={[0.78, 0.48, 0.06]} radius={0.025} smoothness={4}>
              <Glass thickness={0.2} ca={0.1} />
            </RoundedBox>
            <mesh position={[-0.12, 0.08, 0.03]}>
              <boxGeometry args={[0.3, 0.03, 0.005]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
            <mesh position={[-0.16, 0.0, 0.03]}>
              <boxGeometry args={[0.22, 0.02, 0.005]} />
              <meshStandardMaterial {...M.steel} />
            </mesh>
            <mesh position={[0.22, -0.11, 0.03]}>
              <boxGeometry args={[0.07, 0.07, 0.01]} />
              <meshStandardMaterial {...(paid ? M.volt : M.graphite)} emissiveIntensity={paid ? 4 : 0} />
            </mesh>
          </group>
        );
      })}
      {/* AI core */}
      <group position={[0, 1.55, 0]} scale={show}>
        <mesh rotation={[T * Math.PI * 2, T * Math.PI * 4, 0]}>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={C.fg} wireframe />
        </mesh>
        <mesh rotation={[0, -T * Math.PI * 2, T * Math.PI * 2]}>
          <octahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial {...M.chrome} flatShading />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.16 + 0.02 * osc(f, 8), 32, 32]} />
          <meshStandardMaterial {...M.volt} emissiveIntensity={3} />
        </mesh>
        {/* voice ring: bars around the core */}
        <Instances count={72} f={f} fill={(i, o) => {
          const a = (i / 72) * Math.PI * 2;
          const amp = 0.04 + calling * (0.1 + 0.32 * Math.abs(Math.sin(i * 0.9 + f * 0.6)) * rnd(i + Math.floor(f / 2), 3));
          o.position.set(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95);
          o.rotation.set(0, -a, 0);
          o.scale.set(0.022, amp, 0.022);
        }}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial {...M.chrome} />
        </Instances>
      </group>
      {/* data pulses core → gates */}
      {GATES.map((g, i) => {
        const pt = curve.getPointAt(g);
        const t = (T * 4 + i * 0.25) % 1;
        const a = new THREE.Vector3(0, 1.55, 0).lerp(pt, t);
        return (
          <group key={`p${i}`}>
            <mesh position={new THREE.Vector3(0, 1.55, 0).lerp(pt, 0.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pt.clone().sub(new THREE.Vector3(0, 1.55, 0)).normalize())}>
              <cylinderGeometry args={[0.004, 0.004, pt.distanceTo(new THREE.Vector3(0, 1.55, 0)), 6]} />
              <meshStandardMaterial color={C.muted} transparent opacity={0.5} />
            </mesh>
            <mesh position={a}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial {...M.volt} emissiveIntensity={6} />
            </mesh>
          </group>
        );
      })}
    </Stage3D>
  );
};
