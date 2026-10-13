// Cinematic 3D studio shared by all service loops: space-black void with fog, a glossy reflective floor,
// studio light strips (chrome reflections; one volt strip), a slowly orbiting camera (seamless: whole cycles
// per loop) and post: bloom on emissive volt, light chromatic aberration, vignette, film grain.
// Everything is driven by useCurrentFrame() (no useFrame in our code) so renders are deterministic.
import React from 'react';
import * as THREE from 'three';
import { ThreeCanvas } from '@remotion/three';
import { useVideoConfig } from 'remotion';
import { MeshReflectorMaterial, PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, ToneMapping, DepthOfField } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { C, LOOP, useLoop } from './kit';

const NOFX = false;
export type Cam = { radius: number; height: number; target?: [number, number, number]; sway?: number; fov?: number; dolly?: number };

const CameraRig: React.FC<Cam> = ({ radius, height, target = [0, 0.6, 0], sway = 0.32, fov = 32, dolly = 0.06 }) => {
  const f = useLoop();
  const { width, height: h } = useVideoConfig();
  const aspect = width / h;
  // portrait frames need to step back to keep the scene's width
  const r = radius * (aspect < 1 ? 1.32 : 1) * (1 + dolly * Math.sin((f / LOOP) * Math.PI * 2));
  const a = sway * Math.sin((f / LOOP) * Math.PI * 2) + 0.18 * Math.sin((f / LOOP) * Math.PI * 4);
  const pos: [number, number, number] = [Math.sin(a) * r, height + 0.25 * Math.sin((f / LOOP) * Math.PI * 2 + 1), Math.cos(a) * r];
  const ref = React.useRef<THREE.PerspectiveCamera>(null);
  React.useLayoutEffect(() => {
    ref.current?.lookAt(...target);
  });
  return <PerspectiveCamera ref={ref} makeDefault position={pos} fov={aspect < 1 ? fov * 1.12 : fov} near={0.1} far={80} />;
};

// Studio light strips baked once into a PMREM environment (synchronous → deterministic chrome reflections).
const Studio: React.FC = () => {
  const { gl, scene } = useThree();
  React.useMemo(() => {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#0b0c0e');
    // soft studio dome: dim graphite walls so chrome never reads as pure black
    const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#1e2023'), side: THREE.BackSide }));
    env.add(dome);
    const strip = (w: number, h: number, color: string, intensity: number, pos: [number, number, number], rot: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    strip(16, 2.2, C.fg, 8, [0, 7, -5], [Math.PI / 2.6, 0, 0]);
    strip(16, 1.2, C.fg, 3, [0, 6, 6], [-Math.PI / 2.6, 0, 0]);
    strip(10, 0.6, C.fg, 6, [-8, 2.5, 1], [0, Math.PI / 2, 0]);
    strip(10, 0.4, C.fg, 6, [8, 3.5, 0], [0, -Math.PI / 2, 0]);
    strip(8, 0.25, C.accent, 2.5, [0, 1.4, 9], [0, Math.PI, 0]);
    strip(3, 3, C.fg, 1.5, [3, 9, 3], [Math.PI / 2, 0, 0]);
    strip(30, 6, '#202226', 1, [0, -2, -10], [0, 0, 0]);
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(env, 0.02);
    scene.environment = rt.texture;
    pm.dispose();
  }, [gl, scene]);
  return null;
};

export const Floor: React.FC<{ y?: number }> = ({ y = 0 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
    <planeGeometry args={[60, 60]} />
    <MeshReflectorMaterial resolution={1024} blur={[300, 80]} mixBlur={0.9} mixStrength={6} roughness={0.9} depthScale={1.2}
      minDepthThreshold={0.3} maxDepthThreshold={1.6} color="#040405" metalness={0.8} mirror={0.75} />
  </mesh>
);

/** Dust motes drifting through the light — the ambient layer that gives the air depth. Seamless: whole cycles. */
export const Dust: React.FC<{ count?: number; spread?: [number, number, number]; center?: [number, number, number] }> = ({ count = 260, spread = [9, 5, 7], center = [0, 2.2, 0] }) => {
  const f = useLoop();
  const geo = React.useMemo(() => new THREE.BufferGeometry(), []);
  const pos = React.useMemo(() => new Float32Array(count * 3), [count]);
  for (let k = 0; k < count; k++) {
    const r = (n: number) => { const x = Math.sin(k * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
    const t = ((f / LOOP) + r(4)) % 1;
    pos[k * 3] = center[0] + (r(1) - 0.5) * spread[0] + 0.25 * Math.sin((f / LOOP) * Math.PI * 2 + r(5) * 6);
    pos[k * 3 + 1] = center[1] + (t - 0.5) * spread[1];
    pos[k * 3 + 2] = center[2] + (r(3) - 0.5) * spread[2] + 0.25 * Math.cos((f / LOOP) * Math.PI * 2 + r(6) * 6);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3));
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.016} color={C.fg} transparent opacity={0.4} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

export type StageProps = { cam: Cam; children: React.ReactNode; floor?: boolean; bloom?: number; focus?: number; bokeh?: number; dust?: boolean };

export const Stage3D: React.FC<StageProps> = ({ cam, children, floor = true, bloom = 0.85, focus, bokeh = 1.2, dust = true }) => {
  const { width, height } = useVideoConfig();
  // focus on the subject: the camera's distance to its target (portrait frames step back ×1.32)
  const tgt = cam.target ?? [0, 0.6, 0];
  const dist = Math.hypot(cam.radius * (width / height < 1 ? 1.32 : 1), cam.height - tgt[1]);
  const fd = focus ?? dist;
  return (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NoToneMapping }}>
      <color attach="background" args={[C.deep]} />
      <fog attach="fog" args={[C.deep, 10, 24]} />
      <CameraRig {...cam} />
      <ambientLight intensity={0.08} />
      <directionalLight position={[4, 8, 5]} intensity={1.2} color={C.fg} />
      <spotLight position={[-4, 10, -3]} angle={0.45} penumbra={1} intensity={120} color={C.fg} />
      <pointLight position={[0, 1.2, 4]} intensity={6} distance={9} color={C.accent} />
      <Studio />
      {floor && <Floor />}
      {dust && <Dust />}
      {children}
      {NOFX ? null : (
        <EffectComposer multisampling={8} frameBufferType={THREE.HalfFloatType}>
          <DepthOfField worldFocusDistance={fd} worldFocusRange={7} bokehScale={bokeh} />
          <Bloom intensity={bloom} luminanceThreshold={0.92} luminanceSmoothing={0.12} mipmapBlur radius={0.55} levels={6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.3} darkness={0.7} />
        </EffectComposer>
      )}
    </ThreeCanvas>
  );
};

/** Materials used across scenes. */
export const M = {
  chrome: { color: '#e4e6e7', metalness: 1, roughness: 0.08 },
  steel: { color: '#8C9199', metalness: 0.9, roughness: 0.28 },
  graphite: { color: '#121417', metalness: 0.8, roughness: 0.32 },
  volt: { color: C.accent, emissive: C.accent, emissiveIntensity: 3, toneMapped: false },
};
