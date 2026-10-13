// Shared 3D parts for the service loops: the signature plinth every scene stands on, a glass preset,
// an instanced-mesh helper driven by the current frame, and a few custom geometries.
import React from 'react';
import * as THREE from 'three';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { C } from './kit';
import { M } from './Stage3D';

/** Graphite disc with a volt rim — the same "stage" under every service. */
export const Plinth: React.FC<{ r?: number; rim?: number }> = ({ r = 2, rim = 0.7 }) => (
  <group>
    <mesh position={[0, 0.06, 0]}>
      <cylinderGeometry args={[r * 0.95, r, 0.12, 128]} />
      <meshStandardMaterial {...M.graphite} />
    </mesh>
    <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r * 0.93, r * 0.95, 128]} />
      <meshStandardMaterial {...M.volt} emissiveIntensity={rim} />
    </mesh>
    <mesh position={[0, 0.126, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r * 0.55, r * 0.555, 128]} />
      <meshStandardMaterial {...M.chrome} />
    </mesh>
  </group>
);

export const Glass: React.FC<{ tint?: string; thickness?: number; ca?: number; rough?: number }> = ({ tint = '#c9ccd0', thickness = 0.35, ca = 0.08, rough = 0.06 }) => (
  <MeshTransmissionMaterial samples={6} resolution={512} thickness={thickness} roughness={rough} transmission={1} ior={1.45}
    chromaticAberration={ca} anisotropy={0.2} distortion={0.04} distortionScale={0.3} temporalDistortion={0} clearcoat={1}
    attenuationDistance={1.4} attenuationColor={tint} color="#ffffff" backside />
);

/** Instanced mesh whose matrices are recomputed for the current frame. `fill(i, o)` sets position/rotation/scale on the dummy. */
export const Instances: React.FC<{
  count: number; f: number; fill: (i: number, o: THREE.Object3D) => void; children: React.ReactNode; color?: (i: number) => string | null;
}> = ({ count, f, fill, children, color }) => {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const dummy = React.useMemo(() => new THREE.Object3D(), []);
  React.useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      fill(i, dummy);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (color) { const c = color(i); if (c) m.setColorAt(i, new THREE.Color(c)); }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  void f;
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>{children}</instancedMesh>;
};

export const heartGeometry = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.12, -0.55, 0.18);
  s.bezierCurveTo(-0.55, 0.45, -0.22, 0.6, 0, 0.36);
  s.bezierCurveTo(0.22, 0.6, 0.55, 0.45, 0.55, 0.18);
  s.bezierCurveTo(0.55, -0.12, 0.15, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6, curveSegments: 24 });
  g.center();
  return g;
})();

export const ACCENT = C.accent;
