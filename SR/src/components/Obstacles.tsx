import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  claimTrackEventTrigger,
  clearsLowBarrier,
  fitsThroughGap,
  getCollisionZone,
  getCollisionWindow,
  getTrackObjectZ,
  OBSTACLE_HALF_WIDTHS,
  overlapsSolidObstacle,
  PLAYER_HALF_WIDTH,
} from '../game/raceRules';
import type { CollisionImpact } from '../game/raceRules';
import { useGameStore } from '../store/gameStore';
import type { TrackEvent } from '../store/gameStore';

const PASSED_HIDE_Z = 10;

interface ObstaclesProps {
  distanceRef: React.MutableRefObject<number>;
  playerPositionRef: React.MutableRefObject<THREE.Vector3>;
  solidContactRef: React.MutableRefObject<boolean>;
  onCollision: (impact: Omit<CollisionImpact, 'steering'>, obstacleDistance: number) => void;
  onBoost: () => void;
  eventsOverride?: TrackEvent[];
}

export function Obstacles({
  distanceRef,
  playerPositionRef,
  solidContactRef,
  onCollision,
  onBoost,
  eventsOverride,
}: ObstaclesProps) {
  const trackId = useGameStore((state) => state.selectedTrack);
  const phase = useGameStore((state) => state.phase);
  const savedEvents = useGameStore((state) => state.trackEvents[trackId]);
  const events = eventsOverride ?? savedEvents;
  const obstacleRefs = useRef<Map<number, THREE.Group>>(new Map());
  const triggered = useRef<Set<number>>(new Set());
  const previousZ = useRef<Map<number, number>>(new Map());
  const collisionCooldown = useRef(0);

  useEffect(() => {
    if (phase === 'starting') {
      triggered.current.clear();
      previousZ.current.clear();
      collisionCooldown.current = 0;
    }
  }, [phase, trackId]);

  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.05);
    const distance = distanceRef.current;
    const player = playerPositionRef.current;
    let hasSolidContact = false;

    collisionCooldown.current = Math.max(0, collisionCooldown.current - clampedDt);

    events.forEach((event, index) => {
      const obstacle = obstacleRefs.current.get(index);
      if (!obstacle) return;

      const z = getTrackObjectZ(event.distance, distance);
      const lastZ = previousZ.current.get(index) ?? z;
      previousZ.current.set(index, z);
      obstacle.position.z = z;
      obstacle.visible = z < PASSED_HIDE_Z;

      if (phase !== 'racing') return;
      const collisionWindow = getCollisionWindow(event.type);
      if (z < collisionWindow.minZ || lastZ > collisionWindow.maxZ) return;

      const contact = evaluateEventContact(event, player);
      if (event.type === 'boost') {
        if (contact.hit && claimTrackEventTrigger(triggered.current, index)) {
          onBoost();
        }
        return;
      }

      if (contact.hit === false) {
        if (event.type === 'gate' || event.type === 'wall') triggered.current.add(index);
        return;
      }

      // Damage is registered once, but the visible solid remains at its front
      // contact plane until the player has really moved outside its hitbox.
      hasSolidContact = true;
      obstacle.position.z = collisionWindow.minZ;
      previousZ.current.set(index, collisionWindow.minZ);

      if (triggered.current.has(index)) return;

      if (collisionCooldown.current > 0) return;
      claimTrackEventTrigger(triggered.current, index);
      collisionCooldown.current = event.type === 'mine' ? 1.2 : event.type === 'gate' ? 0.75 : 1;
      onCollision({ obstacleType: event.type, zone: contact.zone }, event.distance);
    });

    solidContactRef.current = phase === 'racing' && hasSolidContact;
  });

  return (
    <group>
      {events.map((event, index) => (
        <group
          key={`${trackId}-${index}`}
          ref={(node) => {
            if (node) obstacleRefs.current.set(index, node);
            else obstacleRefs.current.delete(index);
          }}
          position={[event.x, 0, -event.distance]}
        >
          <ObstacleModel event={event} seed={event.distance + index * 17} />
        </group>
      ))}
    </group>
  );
}

type EventContact = { hit: false } | { hit: true; zone: CollisionImpact['zone'] };

function evaluateEventContact(event: TrackEvent, player: THREE.Vector3): EventContact {
  const localX = player.x - event.x;

  if (event.type === 'boost') {
    return overlapsSolidObstacle(player.x, event.x, OBSTACLE_HALF_WIDTHS.boost)
      ? { hit: true, zone: 'center' }
      : { hit: false };
  }
  if (event.type === 'lowBarrier') {
    const hit = overlapsSolidObstacle(player.x, event.x, OBSTACLE_HALF_WIDTHS.lowBarrier)
      && !clearsLowBarrier(player.y);
    return hit
      ? { hit: true, zone: getCollisionZone(localX, OBSTACLE_HALF_WIDTHS.lowBarrier + PLAYER_HALF_WIDTH) }
      : { hit: false };
  }
  if (event.type === 'mine') {
    const hit = overlapsSolidObstacle(player.x, event.x, OBSTACLE_HALF_WIDTHS.mine) && player.y < 1.2;
    return hit
      ? { hit: true, zone: getCollisionZone(localX, OBSTACLE_HALF_WIDTHS.mine + PLAYER_HALF_WIDTH) }
      : { hit: false };
  }
  if (event.type === 'boulder') {
    const hit = overlapsSolidObstacle(player.x, event.x, OBSTACLE_HALF_WIDTHS.boulder) && player.y < 2;
    return hit
      ? { hit: true, zone: getCollisionZone(localX, OBSTACLE_HALF_WIDTHS.boulder + PLAYER_HALF_WIDTH) }
      : { hit: false };
  }
  if (event.type === 'gate') {
    if (fitsThroughGap(player.x, event.x, event.width ?? 2.5)) return { hit: false };
    return { hit: true, zone: player.x < event.x ? 'left' : 'right' };
  }

  const side = event.side ?? 'center';
  const gapX = side === 'left' ? -2.2 : side === 'right' ? 2.2 : 0;
  if (fitsThroughGap(player.x, gapX, 2.4)) return { hit: false };
  return { hit: true, zone: player.x < gapX ? 'left' : 'right' };
}

function ObstacleModel({ event, seed }: { event: TrackEvent; seed: number }) {
  if (event.type === 'boulder') return <RockDebris seed={seed} />;
  if (event.type === 'gate') return <ClawGate width={event.width ?? 2.5} />;
  if (event.type === 'wall') return <IndustrialBulkhead side={event.side ?? 'center'} />;
  if (event.type === 'lowBarrier') return <JumpBarrier />;
  if (event.type === 'mine') return <RepulsorMine seed={seed} />;
  return <BoostPad />;
}

function RockDebris({ seed }: { seed: number }) {
  const angle = (seed % 31) * 0.11;
  return (
    <group rotation={[0, angle, 0]}>
      <mesh position={[-0.18, 0.72, 0.04]} rotation={[0.22, 0.4, -0.12]} scale={[1.05, 0.9, 0.88]}>
        <icosahedronGeometry args={[0.86, 1]} />
        <meshStandardMaterial color="#57534f" roughness={0.96} metalness={0.04} flatShading />
      </mesh>
      <mesh position={[0.55, 0.38, -0.12]} rotation={[-0.2, 0.15, 0.5]} scale={[0.7, 0.52, 0.62]}>
        <dodecahedronGeometry args={[0.68, 0]} />
        <meshStandardMaterial color="#403e3c" roughness={1} metalness={0.02} flatShading />
      </mesh>
      <mesh position={[-0.72, 0.24, 0.25]} rotation={[0.3, -0.2, -0.25]} scale={[0.46, 0.35, 0.52]}>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial color="#69635b" roughness={0.94} metalness={0.03} flatShading />
      </mesh>
      <mesh position={[0.1, 0.62, 0.72]} rotation={[0.4, 0.1, 0.2]}>
        <boxGeometry args={[0.62, 0.12, 0.32]} />
        <meshStandardMaterial color="#252a2e" metalness={0.88} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.1, 1.34, 32]} />
        <meshBasicMaterial color="#d68a2d" transparent opacity={0.42} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ClawGate({ width }: { width: number }) {
  const gap = width / 2;
  const pylonX = gap + 0.75;
  return (
    <group>
      {[-1, 1].map((direction) => (
        <group key={direction} position={[direction * pylonX, 0, 0]}>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[0.58, 2.4, 0.78]} />
            <meshStandardMaterial color="#4d555d" metalness={0.86} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.16, 0.12]}>
            <boxGeometry args={[1.02, 0.3, 1.16]} />
            <meshStandardMaterial color="#292e33" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[-direction * 0.38, 0.86, 0]} rotation={[0, 0, direction * 0.55]}>
            <boxGeometry args={[0.24, 1.62, 0.5]} />
            <meshStandardMaterial color="#69727a" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[-direction * 0.7, 0.35, 0]} rotation={[0, 0, direction * Math.PI / 2]}>
            <coneGeometry args={[0.16, 0.72, 6]} />
            <meshStandardMaterial color="#d99a27" emissive="#754008" emissiveIntensity={0.8} metalness={0.72} />
          </mesh>
          {[0.7, 1.25, 1.8].map((y) => (
            <mesh key={y} position={[direction * -0.305, y, 0.41]}>
              <boxGeometry args={[0.08, 0.18, 0.06]} />
              <meshBasicMaterial color="#ff4a28" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.max(0.2, width - 0.2), 1.3]} />
        <meshBasicMaterial color="#52d6b5" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.72, 0]}>
        <boxGeometry args={[pylonX * 2 + 0.6, 0.16, 0.42]} />
        <meshStandardMaterial color="#333a40" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

function IndustrialBulkhead({ side }: { side: 'left' | 'right' | 'center' }) {
  const gapX = side === 'left' ? -2.2 : side === 'right' ? 2.2 : 0;
  const gapHalf = 1.2;
  const leftEdge = -3.5;
  const rightEdge = 3.5;
  const leftWidth = gapX - gapHalf - leftEdge;
  const rightWidth = rightEdge - (gapX + gapHalf);

  return (
    <group>
      {leftWidth > 0.15 && <BulkheadBlock width={leftWidth} x={leftEdge + leftWidth / 2} />}
      {rightWidth > 0.15 && <BulkheadBlock width={rightWidth} x={gapX + gapHalf + rightWidth / 2} />}
      {[-1, 1].map((direction) => (
        <group key={direction} position={[gapX + direction * gapHalf, 1.35, 0.36]}>
          <mesh>
            <boxGeometry args={[0.18, 2.7, 0.18]} />
            <meshStandardMaterial color="#d5a128" emissive="#74500b" emissiveIntensity={0.7} metalness={0.72} />
          </mesh>
          {[0.55, 1.35, 2.15].map((y) => (
            <mesh key={y} position={[0, y - 1.35, 0.11]}>
              <boxGeometry args={[0.24, 0.12, 0.08]} />
              <meshBasicMaterial color="#ff5a32" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 2.92, 0]}>
        <boxGeometry args={[7.1, 0.34, 0.72]} />
        <meshStandardMaterial color="#343b42" metalness={0.88} roughness={0.28} />
      </mesh>
      <mesh position={[gapX, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.25, 1.6]} />
        <meshBasicMaterial color="#49d8b0" transparent opacity={0.24} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BulkheadBlock({ width, x }: { width: number; x: number }) {
  return (
    <group position={[x, 1.35, 0]}>
      <mesh>
        <boxGeometry args={[width, 2.7, 0.62]} />
        <meshStandardMaterial color="#485057" metalness={0.84} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.34]}>
        <boxGeometry args={[Math.max(0.08, width - 0.22), 2.26, 0.08]} />
        <meshStandardMaterial color="#2e3439" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-0.78, 0, 0.78].map((y) => (
        <mesh key={y} position={[0, y, 0.4]}>
          <boxGeometry args={[Math.max(0.05, width - 0.36), 0.055, 0.055]} />
          <meshBasicMaterial color="#68727b" />
        </mesh>
      ))}
    </group>
  );
}

function JumpBarrier() {
  return (
    <group>
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[6.15, 0.32, 0.64]} />
        <meshStandardMaterial color="#4d555d" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-2.55, -1.7, -0.85, 0, 0.85, 1.7, 2.55].map((x, index) => (
        <mesh key={x} position={[x, 0.59, 0.345]} rotation={[0, 0, index % 2 === 0 ? 0.35 : -0.35]}>
          <boxGeometry args={[0.44, 0.14, 0.06]} />
          <meshBasicMaterial color={index % 2 === 0 ? '#e0ad2d' : '#202428'} />
        </mesh>
      ))}
      {[-2.82, 2.82].map((x) => (
        <group key={x} position={[x, 0.28, 0]}>
          <mesh>
            <boxGeometry args={[0.34, 0.56, 0.72]} />
            <meshStandardMaterial color="#30363b" metalness={0.88} roughness={0.27} />
          </mesh>
          <mesh position={[0, 0.34, 0.38]}>
            <sphereGeometry args={[0.09, 12, 8]} />
            <meshBasicMaterial color="#ff592e" />
          </mesh>
        </group>
      ))}
      {[0.9, 1.7, 2.5].map((z, index) => (
        <mesh key={z} position={[0, 0.018, -z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.5 - index * 0.45, 0.18]} />
          <meshBasicMaterial color="#e5aa27" transparent opacity={0.58 - index * 0.12} />
        </mesh>
      ))}
    </group>
  );
}

function RepulsorMine({ seed }: { seed: number }) {
  const rotation = (seed % 19) * 0.18;
  return (
    <group position={[0, 0.62, 0]} rotation={[0.12, rotation, 0.08]}>
      <mesh>
        <sphereGeometry args={[0.46, 16, 12]} />
        <meshStandardMaterial color="#252a2f" emissive="#54120d" emissiveIntensity={0.7} metalness={0.96} roughness={0.16} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.59, 0.075, 8, 24]} />
        <meshStandardMaterial color="#69737c" metalness={0.94} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.43]}>
        <circleGeometry args={[0.19, 20]} />
        <meshBasicMaterial color="#ff3b22" />
      </mesh>
      {Array.from({ length: 8 }).map((_, index) => {
        const angle = index / 8 * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.66, Math.sin(angle) * 0.66, 0]}
            rotation={[0, 0, angle - Math.PI / 2]}
          >
            <coneGeometry args={[0.075, 0.42, 5]} />
            <meshStandardMaterial color="#89939c" metalness={0.95} roughness={0.16} />
          </mesh>
        );
      })}
      <mesh position={[0, -0.59, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.72, 1.02, 28]} />
        <meshBasicMaterial color="#ff3c24" transparent opacity={0.36} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function BoostPad() {
  return (
    <group>
      <mesh position={[0, 0.025, 0]}>
        <boxGeometry args={[2.45, 0.08, 3.2]} />
        <meshStandardMaterial color="#283037" metalness={0.92} roughness={0.2} />
      </mesh>
      {[-0.76, 0, 0.76].map((x) => (
        <mesh key={x} position={[x, 0.075, 0]}>
          <boxGeometry args={[0.48, 0.045, 2.7]} />
          <meshStandardMaterial color="#d69d22" emissive="#d8820d" emissiveIntensity={2.4} metalness={0.52} roughness={0.22} />
        </mesh>
      ))}
      {[-1.12, 1.12].map((x) => (
        <mesh key={x} position={[x, 0.095, 0]}>
          <boxGeometry args={[0.07, 0.055, 3.05]} />
          <meshBasicMaterial color="#ffe17a" />
        </mesh>
      ))}
      {[0.82, 0, -0.82].map((z, index) => (
        <mesh key={z} position={[0, 0.105, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28 + index * 0.05, 0.38 + index * 0.05, 3, 1, Math.PI * 0.12, Math.PI * 0.76]} />
          <meshBasicMaterial color="#fff0a5" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
