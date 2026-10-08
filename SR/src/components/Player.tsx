import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import type { PlayerPhysics } from '../hooks/usePlayerPhysics';
import { SwoopBodyDetails } from './SwoopBodyDetails';
import {
  getAirParticleIntensity,
  getCollisionReactionPose,
  getSpeedEffectIntensity,
  getTrackObjectZ,
} from '../game/raceRules';

// ─── Procedural 3D player vehicle ────────────────────────────────────────────
type VehicleFxRefs = React.MutableRefObject<Array<THREE.Group | null>>;
type VehicleLightRefs = React.MutableRefObject<Array<THREE.PointLight | null>>;

function EnginePod({
  side,
  index,
  flameRefs,
  lightRefs,
}: {
  side: -1 | 1;
  index: number;
  flameRefs: VehicleFxRefs;
  lightRefs: VehicleLightRefs;
}) {
  return (
    <group position={[side * 0.4, 0, 0.05]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.145, 0.18, 1.5, 12, 1]} />
        <meshStandardMaterial color="#b9572d" metalness={0.78} roughness={0.34} flatShading />
      </mesh>
      <mesh position={[0, 0, -0.92]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.145, 0.52, 8]} />
        <meshStandardMaterial color="#cf6736" metalness={0.72} roughness={0.38} flatShading />
      </mesh>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.185, 0.185, 0.28, 12]} />
        <meshStandardMaterial color="#626b70" metalness={0.9} roughness={0.24} />
      </mesh>
      <mesh position={[side * 0.09, 0.13, -0.1]} rotation={[0, -side * 0.05, -side * 0.16]}>
        <boxGeometry args={[0.19, 0.04, 0.95]} />
        <meshStandardMaterial color="#c35e32" metalness={0.68} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0, 0.82]}>
        <torusGeometry args={[0.145, 0.045, 8, 16]} />
        <meshStandardMaterial color="#1d2227" metalness={0.98} roughness={0.13} />
      </mesh>
      <mesh position={[0, 0, 0.828]}>
        <circleGeometry args={[0.115, 18]} />
        <meshStandardMaterial color="#ffb22e" emissive="#ff6a08" emissiveIntensity={4.2} toneMapped={false} />
      </mesh>
      <group ref={(node) => { flameRefs.current[index] = node; }} position={[0, 0, 0.84]}>
        <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.13, 0.6, 10]} />
          <meshBasicMaterial color="#21bfff" transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.055, 0.38, 8]} />
          <meshBasicMaterial color="#eaffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <pointLight
        ref={(node) => { lightRefs.current[index] = node; }}
        position={[0, 0.02, 0.93]}
        color="#ff8a18"
        intensity={1.8}
        distance={3.2}
      />
    </group>
  );
}

function SwoopVehicle({ flameRefs, lightRefs }: { flameRefs: VehicleFxRefs; lightRefs: VehicleLightRefs }) {
  return (
    <group>
      <SwoopBodyDetails />
      <mesh scale={[0.23, 0.18, 1.02]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#aeb5b5" metalness={0.76} roughness={0.3} flatShading />
      </mesh>
      <mesh position={[0, 0, -1.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.21, 0.46, 8]} />
        <meshStandardMaterial color="#c55e31" metalness={0.7} roughness={0.38} flatShading />
      </mesh>
      <mesh position={[0, 0.17, -0.35]} scale={[0.17, 0.1, 0.36]}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshStandardMaterial color="#172631" emissive="#071723" emissiveIntensity={0.55} metalness={0.64} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0.1, 0.16]}>
        <boxGeometry args={[0.58, 0.065, 0.18]} />
        <meshStandardMaterial color="#9f4d2b" metalness={0.72} roughness={0.36} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <EnginePod side={side} index={side === -1 ? 0 : 1} flameRefs={flameRefs} lightRefs={lightRefs} />
        </group>
      ))}
      <mesh position={[0, 0.03, 0.91]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#3a4144" metalness={0.88} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.08, 0.97]}>
        <boxGeometry args={[0.21, 0.07, 0.035]} />
        <meshStandardMaterial color="#ff2818" emissive="#ff1208" emissiveIntensity={4.2} metalness={0.38} roughness={0.16} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.19, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.36, 20]} />
        <meshBasicMaterial color="#2ad7ff" transparent opacity={0.13} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight position={[0, -0.1, 0.2]} color="#22cfff" intensity={0.65} distance={2.2} />
    </group>
  );
}

export function Player({ physicsRef }: { physicsRef: React.MutableRefObject<PlayerPhysics> }) {
  const vehicleRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const flameRefs = useRef<Array<THREE.Group | null>>([]);
  const engineLightRefs = useRef<Array<THREE.PointLight | null>>([]);

  useFrame((frame) => {
    const store = useGameStore.getState();
    const phase = store.phase;
    if (!vehicleRef.current) return;
    if (phase !== 'racing' && phase !== 'coasting' && phase !== 'starting') return;

    const phys = physicsRef.current;
    const reaction = getCollisionReactionPose(phys.impactTimer, phys.impactStrength, phys.impactSide);
    const hover = Math.sin(frame.clock.elapsedTime * 5.4) * 0.018;
    vehicleRef.current.position.set(
      phys.position.x + reaction.x,
      phys.position.y + 0.45 + hover + reaction.y,
      phys.position.z + reaction.z,
    );
    if (shadowRef.current) {
      const height = Math.max(0, phys.position.y - GROUND_Y);
      shadowRef.current.position.x = phys.position.x + reaction.x * 0.55;
      shadowRef.current.position.z = 0.15 + reaction.z;
      shadowRef.current.scale.set(1.08 + height * 0.1, 0.72 + height * 0.08, 1);
      const shadowMaterial = shadowRef.current.material as THREE.MeshBasicMaterial;
      shadowMaterial.opacity = Math.max(0.05, 0.3 - height * 0.07);
    }

    const dx = phys.targetX - phys.position.x;
    vehicleRef.current.rotation.z = THREE.MathUtils.lerp(
      vehicleRef.current.rotation.z,
      -dx * 0.1 + reaction.roll,
      phys.impactTimer > 0 ? 0.48 : 0.2,
    );
    vehicleRef.current.rotation.x = THREE.MathUtils.lerp(
      vehicleRef.current.rotation.x,
      reaction.pitch,
      phys.impactTimer > 0 ? 0.48 : 0.2,
    );
    vehicleRef.current.rotation.y = THREE.MathUtils.lerp(
      vehicleRef.current.rotation.y,
      dx * 0.035,
      0.16,
    );

    const speedPower = Math.min(1, phys.speed / 400);
    const boostPower = store.boostActive ? 0.42 : 0;
    flameRefs.current.forEach((flame, index) => {
      if (!flame) return;
      const flicker = Math.sin(frame.clock.elapsedTime * (31 + index * 4)) * 0.07;
      const length = 0.35 + speedPower * 1.15 + boostPower + flicker;
      flame.scale.set(0.88 + speedPower * 0.18, 0.88 + speedPower * 0.18, Math.max(0.25, length));
      flame.visible = phase !== 'starting' || frame.clock.elapsedTime % 0.22 < 0.15;
    });
    engineLightRefs.current.forEach((light, index) => {
      if (!light) return;
      light.intensity = 1.4 + speedPower * 4.2 + boostPower * 3
        + Math.sin(frame.clock.elapsedTime * (27 + index * 3)) * 0.25;
    });
  });

  return (
    <>
      <mesh ref={shadowRef} position={[0, 0.025, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.56, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={vehicleRef} position={[0, GROUND_Y + 0.45, 0]}>
        <SwoopVehicle flameRefs={flameRefs} lightRefs={engineLightRefs} />
      </group>
    </>
  );
}

const GROUND_Y = 0.3;

// ─── Exhaust Particles ────────────────────────────────────────────────────────
export function ExhaustParticles({ physicsRef }: { physicsRef: React.MutableRefObject<PlayerPhysics> }) {
  const COUNT   = 100;
  const posArr  = useRef(new Float32Array(COUNT * 3));
  const velArr  = useRef(new Float32Array(COUNT * 3));
  const lifeArr = useRef(new Float32Array(COUNT));
  const attrRef = useRef<THREE.BufferAttribute | null>(null);
  const materialRef = useRef<THREE.PointsMaterial | null>(null);
  const previousDistance = useRef(0);

  useEffect(() => {
    lifeArr.current.fill(0);
    for (let i = 0; i < COUNT; i++) posArr.current[i * 3 + 1] = -100;
  }, []);

  useFrame((_, dt) => {
    const phase = useGameStore.getState().phase;
    const phys = physicsRef.current;
    const cdt  = Math.min(dt, 0.05);
    const worldAdvance = phys.travelledDistance >= previousDistance.current
      ? phys.travelledDistance - previousDistance.current
      : 0;
    previousDistance.current = phys.travelledDistance;
    const emitting = (phase === 'racing' || phase === 'coasting') && phys.speed > 8;
    const activeCount = Math.floor(COUNT * Math.min(1, 0.12 + phys.speed / 300));

    for (let i = 0; i < COUNT; i++) {
      if (lifeArr.current[i] <= 0) {
        if (!emitting || i >= activeCount) {
          posArr.current[i*3+1] = -100;
          continue;
        }
        const engineSide = i % 2 === 0 ? -1 : 1;
        posArr.current[i*3]   = phys.position.x + engineSide * 0.4 + (Math.random() - 0.5) * 0.06;
        posArr.current[i*3+1] = phys.position.y + 0.45 + (Math.random() - 0.5) * 0.05;
        posArr.current[i*3+2] = phys.position.z + 0.91;
        velArr.current[i*3]   = (Math.random() - 0.5) * 0.4;
        velArr.current[i*3+1] = (Math.random() - 0.5) * 0.2;
        velArr.current[i*3+2] = 0;
        lifeArr.current[i]    = 0.25 + Math.random() * 0.35;
      } else {
        posArr.current[i*3]   += velArr.current[i*3]   * cdt;
        posArr.current[i*3+1] += velArr.current[i*3+1] * cdt;
        posArr.current[i*3+2] += worldAdvance;
        lifeArr.current[i]    -= cdt;
      }
    }
    if (attrRef.current) {
      attrRef.current.set(posArr.current);
      attrRef.current.needsUpdate = true;
    }
    if (materialRef.current) {
      materialRef.current.opacity = emitting ? Math.min(0.78, 0.18 + phys.speed / 450) : 0;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute ref={attrRef} attach="attributes-position" args={[posArr.current, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={materialRef} size={0.07} color="#00d4ff" transparent opacity={0} depthWrite={false} />
    </points>
  );
}

// ─── Camera Controller ────────────────────────────────────────────────────────
export function CameraController({ physicsRef }: { physicsRef: React.MutableRefObject<PlayerPhysics> }) {
  const { camera } = useThree();
  const shakeRef   = useRef(0);
  const fovRef     = useRef(75);

  useFrame((frame, dt) => {
    const store = useGameStore.getState();
    const cdt   = Math.min(dt, 0.05);

    // Camera shake
    if (store.cameraShake > 0) {
      shakeRef.current = store.cameraShake;
      store.setCameraShake(Math.max(0, store.cameraShake - cdt * 3));
    }
    shakeRef.current = Math.max(0, shakeRef.current - cdt * 4);
    const shake = shakeRef.current;
    const rx = shake > 0 ? (Math.random() - 0.5) * shake * 0.3 : 0;
    const ry = shake > 0 ? (Math.random() - 0.5) * shake * 0.2 : 0;

    // FOV boost on boost active
    const speedIntensity = getSpeedEffectIntensity(store.speed);
    const targetFov = 67 + speedIntensity * 15 + (store.boostActive ? 5 : 0);
    fovRef.current = THREE.MathUtils.lerp(fovRef.current, targetFov, 3 * cdt);
    (camera as THREE.PerspectiveCamera).fov = fovRef.current;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    const phys    = physicsRef.current;
    const reaction = getCollisionReactionPose(phys.impactTimer, phys.impactStrength, phys.impactSide);
    const velocityJitter = speedIntensity * 0.022;
    const targetX = phys.position.x * 0.15 + rx + Math.sin(frame.clock.elapsedTime * 47) * velocityJitter;
    const targetY = 2.5 + phys.position.y * 0.2 + ry + Math.sin(frame.clock.elapsedTime * 61) * velocityJitter;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 4 * cdt);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 4 * cdt);
    camera.position.z = 6 + Math.abs(reaction.z) * 0.28;
    camera.lookAt(phys.position.x * 0.05, phys.position.y * 0.05 + 0.5, -15);
    camera.rotation.z += reaction.roll * 0.12;
  });

  return null;
}

// ─── Finish Line ──────────────────────────────────────────────────────────────
export function FinishLine({
  distanceRef,
  trackLength,
}: {
  distanceRef: React.MutableRefObject<number>;
  trackLength: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const dist = distanceRef.current;
    const remaining = trackLength - dist;
    groupRef.current.position.z = getTrackObjectZ(trackLength, dist);
    groupRef.current.visible = remaining < 180;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[7, 0.35, 0.35]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={5} />
      </mesh>
      <mesh position={[-3.5, 1.5, 0]}>
        <boxGeometry args={[0.35, 3.5, 0.35]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
      </mesh>
      <mesh position={[3.5, 1.5, 0]}>
        <boxGeometry args={[0.35, 3.5, 0.35]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

// ─── Speed Lines ──────────────────────────────────────────────────────────────
export function SpeedLines({
  speedRef,
  distanceRef,
}: {
  speedRef: React.MutableRefObject<number>;
  distanceRef: React.MutableRefObject<number>;
}) {
  const COUNT   = 72;
  const posArr  = useRef(new Float32Array(COUNT * 6));
  const baseZArr = useRef(new Float32Array(COUNT));
  const attrRef = useRef<THREE.BufferAttribute | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.LineBasicMaterial | null>(null);

  useEffect(() => {
    for (let i = 0; i < COUNT; i++) {
      const x = (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 6;
      const z = -(Math.random() * 80 + 10);
      baseZArr.current[i] = z;
      posArr.current[i*6]   = x; posArr.current[i*6+1] = y; posArr.current[i*6+2] = z;
      posArr.current[i*6+3] = x; posArr.current[i*6+4] = y; posArr.current[i*6+5] = z + 4;
    }
    geometryRef.current?.setDrawRange(0, 0);
  }, []);

  useFrame(() => {
    const speed = speedRef.current;
    const intensity = getAirParticleIntensity(speed);
    const activeLines = Math.floor(COUNT * intensity);
    const distance = distanceRef.current;
    const stretch = 0.6 + intensity * 5.5;
    const loopLength = 125;
    const frontLimit = 5;

    for (let i = 0; i < COUNT; i++) {
      const wrapped = ((baseZArr.current[i] + distance - frontLimit) % loopLength + loopLength) % loopLength;
      const z = wrapped + frontLimit - loopLength;
      posArr.current[i*6+2] = z;
      posArr.current[i*6+5] = z + stretch;
    }
    if (attrRef.current) { attrRef.current.set(posArr.current); attrRef.current.needsUpdate = true; }
    if (geometryRef.current) geometryRef.current.setDrawRange(0, activeLines * 2);
    if (materialRef.current) materialRef.current.opacity = intensity > 0 ? 0.08 + intensity * 0.28 : 0;
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute ref={attrRef} attach="attributes-position" args={[posArr.current, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={materialRef} color="#b9ecff" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}
