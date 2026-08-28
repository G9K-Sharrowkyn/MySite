import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, TRACKS } from '../store/gameStore';
import { Obstacles } from './Obstacles';
import { Player, ExhaustParticles, CameraController, FinishLine, SpeedLines } from './Player';
import { EnvironmentAtmosphere, TrackEnvironment } from './TrackEnvironment';
import { usePlayerPhysics } from '../hooks/usePlayerPhysics';
import type { PlayerPhysics } from '../hooks/usePlayerPhysics';

// ─── Ref Sync (runs every frame inside Canvas) ────────────────────────────────
function RefSync({
  speedRef,
  distRef,
  posRef,
  physRef,
}: {
  speedRef: React.MutableRefObject<number>;
  distRef: React.MutableRefObject<number>;
  posRef: React.MutableRefObject<THREE.Vector3>;
  physRef: React.MutableRefObject<PlayerPhysics>;
}) {
  useFrame(() => {
    speedRef.current = physRef.current.speed;
    distRef.current  = physRef.current.travelledDistance;
    posRef.current.copy(physRef.current.position);
  });
  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene() {
  const trackId = useGameStore((s) => s.selectedTrack);
  const track   = TRACKS[trackId];
  const { stateRef, solidContactRef, triggerCollision, triggerBoost } = usePlayerPhysics();

  const speedRef     = useRef(0);
  const distanceRef  = useRef(0);
  const playerPosRef = useRef(new THREE.Vector3());

  return (
    <>
      <EnvironmentAtmosphere trackId={trackId} />

      <RefSync
        speedRef={speedRef}
        distRef={distanceRef}
        posRef={playerPosRef}
        physRef={stateRef}
      />

      <TrackEnvironment trackId={trackId} distanceRef={distanceRef} />
      <SpeedLines speedRef={speedRef} distanceRef={distanceRef} />
      <Player physicsRef={stateRef} />
      <ExhaustParticles physicsRef={stateRef} />
      <CameraController physicsRef={stateRef} />
      <FinishLine distanceRef={distanceRef} trackLength={track.length} />
      <Obstacles
        distanceRef={distanceRef}
        playerPositionRef={playerPosRef}
        solidContactRef={solidContactRef}
        onCollision={triggerCollision}
        onBoost={triggerBoost}
      />
    </>
  );
}

// ─── GameScene ────────────────────────────────────────────────────────────────
export function GameScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
      <Canvas
        camera={{ position: [0, 2.5, 6], fov: 68, near: 0.1, far: 650 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 1.5]}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
