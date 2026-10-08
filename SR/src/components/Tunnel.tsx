import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRACKS, useGameStore } from '../store/gameStore';
import { getWorldFlowSpeed, TRACK_WIDTH } from '../game/raceRules';
import { createTarisSurfaceTextures, disposeTarisSurfaceTextures } from './TarisSurfaceTextures';
import type { TarisSurfaceTextures } from './TarisSurfaceTextures';

const SEGMENT_COUNT  = 10;
const SEGMENT_LENGTH = 40;
const TUNNEL_WIDTH   = TRACK_WIDTH;
const TUNNEL_HEIGHT  = 6;

export function Tunnel({ distanceRef }: { distanceRef: React.MutableRefObject<number> }) {
  const segmentRefs = useRef<(THREE.Group | null)[]>([]);
  const trackId = useGameStore((s) => s.selectedTrack);
  const accent = TRACKS[trackId].color;
  const textures = useMemo(createTarisSurfaceTextures, []);
  useEffect(() => () => disposeTarisSurfaceTextures(textures), [textures]);

  const positions = useMemo(() => {
    return Array.from({ length: SEGMENT_COUNT }, (_, i) => -i * SEGMENT_LENGTH);
  }, []);

  useFrame(() => {
    const distance = distanceRef.current;
    const total = SEGMENT_COUNT * SEGMENT_LENGTH;

    segmentRefs.current.forEach((seg, index) => {
      if (!seg) return;
      const initialZ = positions[index];
      const wrapped = ((initialZ + distance - SEGMENT_LENGTH) % total + total) % total;
      seg.position.z = wrapped + SEGMENT_LENGTH - total;
    });
  });

  return (
    <group>
      {positions.map((z, i) => (
        <group key={i} ref={(el) => { segmentRefs.current[i] = el; }} position={[0, 0, z]}>
          <TunnelSegment accent={accent} variant={i % 4} textures={textures} />
        </group>
      ))}
    </group>
  );
}

const TUNNEL_PALETTES = [
  { floor: '#60666c', ceiling: '#596067', wall: '#6a7178', rib: '#8a9299', secondary: '#7b2fff' },
  { floor: '#424b52', ceiling: '#303940', wall: '#48545d', rib: '#77858e', secondary: '#ff7b32' },
  { floor: '#747b80', ceiling: '#6f787d', wall: '#818a8e', rib: '#b6c0c4', secondary: '#65ddff' },
  { floor: '#50575c', ceiling: '#3c464d', wall: '#566169', rib: '#6e7b83', secondary: '#39d8c2' },
];

function TunnelSegment({ accent, variant, textures }: { accent: string; variant: number; textures: TarisSurfaceTextures }) {
  const palette = TUNNEL_PALETTES[variant];
  const ribCount = [5, 4, 6, 3][variant];

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, SEGMENT_LENGTH]} />
        <meshStandardMaterial map={textures.floor} color="#ffffff" metalness={0.48} roughness={0.72} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, TUNNEL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TUNNEL_WIDTH, SEGMENT_LENGTH]} />
        <meshStandardMaterial map={textures.ceiling} color="#ffffff" metalness={0.48} roughness={0.7} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SEGMENT_LENGTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial
          map={textures.wall}
          color="#ffffff"
          metalness={0.42}
          roughness={0.68}
        />
      </mesh>
      {/* Right wall */}
      <mesh position={[TUNNEL_WIDTH / 2, TUNNEL_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[SEGMENT_LENGTH, TUNNEL_HEIGHT]} />
        <meshStandardMaterial
          map={textures.wall}
          color="#ffffff"
          metalness={0.42}
          roughness={0.68}
        />
      </mesh>

      {/* Structural ribs for speed sensation */}
      {Array.from({ length: ribCount }).map((_, i) => (
        <group key={`rib-${i}`} position={[0, 0, (i - (ribCount - 1) / 2) * (SEGMENT_LENGTH / ribCount)]}>
           <mesh position={[-TUNNEL_WIDTH / 2 + 0.1, TUNNEL_HEIGHT / 2, 0]}>
             <boxGeometry args={[0.2, TUNNEL_HEIGHT, 0.4]} />
             <meshStandardMaterial color={palette.rib} metalness={0.76} roughness={0.4} />
           </mesh>
           <mesh position={[TUNNEL_WIDTH / 2 - 0.1, TUNNEL_HEIGHT / 2, 0]}>
             <boxGeometry args={[0.2, TUNNEL_HEIGHT, 0.4]} />
             <meshStandardMaterial color={palette.rib} metalness={0.76} roughness={0.4} />
           </mesh>
           <mesh position={[0, TUNNEL_HEIGHT - 0.1, 0]}>
             <boxGeometry args={[TUNNEL_WIDTH, 0.2, 0.4]} />
             <meshStandardMaterial color={palette.rib} metalness={0.76} roughness={0.4} />
           </mesh>
           {([-1, 1] as const).map(side => <group key={`brace-${side}`}>
             <mesh position={[side * 2.84, 5.23, 0]} rotation={[0, 0, side * 0.72]}>
               <boxGeometry args={[0.17, 1.8, 0.48]} />
               <meshStandardMaterial color="#9dabb0" metalness={0.68} roughness={0.43} />
             </mesh>
             <mesh position={[side * 3.44, 3.72, 0]}>
               <boxGeometry args={[0.1, 0.36, 1.5]} />
               <meshStandardMaterial color="#c18a55" emissive="#7d3c16" emissiveIntensity={0.65} />
             </mesh>
           </group>)}
           <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
             <planeGeometry args={[TUNNEL_WIDTH - 0.35, 0.055]} />
             <meshBasicMaterial color="#c0c7cd" />
           </mesh>
           <mesh position={[-3.38, 3.05, 0]}>
             <boxGeometry args={[0.08, 0.72, 1.9]} />
             <meshStandardMaterial color="#5b1f10" emissive="#c74418" emissiveIntensity={1.2} />
           </mesh>
           {([-1, 1] as const).map(side => <mesh key={`shoulder-${side}`} position={[side * 3.1, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
             <planeGeometry args={[0.5, 0.62]} />
             <meshBasicMaterial color={variant % 2 === 0 ? '#c58e4e' : '#e4c4a0'} />
           </mesh>)}
           <mesh position={[3.38, 3.05, 0]}>
             <boxGeometry args={[0.08, 0.72, 1.9]} />
             <meshStandardMaterial color="#5b1f10" emissive="#c74418" emissiveIntensity={1.2} />
           </mesh>
           <mesh position={[-1.7, TUNNEL_HEIGHT - 0.18, 0]}>
             <boxGeometry args={[1.4, 0.06, 0.46]} />
             <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.6} />
           </mesh>
           <mesh position={[1.7, TUNNEL_HEIGHT - 0.18, 0]}>
             <boxGeometry args={[1.4, 0.06, 0.46]} />
             <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.6} />
           </mesh>
        </group>
      ))}
      {[-2.15, 0, 2.15].map((x) => (
        <mesh key={`floor-guide-${x}`} position={[x, 0.025, 0]}>
          <boxGeometry args={[0.045, 0.025, SEGMENT_LENGTH]} />
          <meshStandardMaterial color="#a4acb3" emissive="#3b444a" emissiveIntensity={0.45} />
        </mesh>
      ))}
      {([-1, 1] as const).map(side => <group key={`raceway-${side}`}>
        <mesh position={[side * 3.03, 0.04, 0]}>
          <boxGeometry args={[0.13, 0.055, SEGMENT_LENGTH]} />
          <meshStandardMaterial color="#b37640" metalness={0.42} roughness={0.55} />
        </mesh>
        <mesh position={[side * 3.34, 4.95, 0]}>
          <boxGeometry args={[0.15, 0.18, SEGMENT_LENGTH]} />
          <meshStandardMaterial color="#758d98" metalness={0.7} roughness={0.34} />
        </mesh>
      </group>)}
      <mesh position={[-3.32, 1.35, 0]}>
        <boxGeometry args={[0.12, 0.12, SEGMENT_LENGTH]} />
        <meshStandardMaterial color="#a0a8af" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[3.32, 1.35, 0]}>
        <boxGeometry args={[0.12, 0.12, SEGMENT_LENGTH]} />
        <meshStandardMaterial color="#a0a8af" metalness={0.82} roughness={0.32} />
      </mesh>
      {/* Left neon strip */}
      <mesh position={[-TUNNEL_WIDTH / 2 + 0.05, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.08, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.2} />
      </mesh>
      {/* Right neon strip */}
      <mesh position={[TUNNEL_WIDTH / 2 - 0.05, 0.3, 0]}>
        <boxGeometry args={[0.08, 0.08, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.2} />
      </mesh>
      {/* Top left strip */}
      <mesh position={[-TUNNEL_WIDTH / 2 + 0.05, TUNNEL_HEIGHT - 0.3, 0]}>
        <boxGeometry args={[0.06, 0.06, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={palette.secondary} emissive={palette.secondary} emissiveIntensity={2} />
      </mesh>
      {/* Top right strip */}
      <mesh position={[TUNNEL_WIDTH / 2 - 0.05, TUNNEL_HEIGHT - 0.3, 0]}>
        <boxGeometry args={[0.06, 0.06, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={palette.secondary} emissive={palette.secondary} emissiveIntensity={2} />
      </mesh>
      {(variant === 1 || variant === 3) && ([-1, 1] as const).flatMap((side) => [-13, 0, 13].map((z, panelIndex) => (
        <group key={`wall-screen-${side}-${z}`} position={[side * (TUNNEL_WIDTH / 2 - 0.018), 3.1, z]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <mesh>
            <planeGeometry args={[8.4, 3.15]} />
            <meshStandardMaterial color="#8197a0" metalness={0.72} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.012]}>
            <planeGeometry args={[7.65, 2.55]} />
            <meshBasicMaterial map={textures.skyline} color={panelIndex % 2 === 0 ? '#b3ddec' : '#e0c0a3'} toneMapped={false} />
          </mesh>
          <mesh position={[0, -1.36, 0.025]}>
            <boxGeometry args={[7.85, 0.08, 0.04]} />
            <meshBasicMaterial color={panelIndex % 2 === 0 ? '#69d8e3' : '#e2aa70'} />
          </mesh>
          {[-2.4, 0, 2.4].map(x => <mesh key={x} position={[x, 0, 0.03]}>
            <boxGeometry args={[0.11, 2.65, 0.06]} />
            <meshStandardMaterial color="#849da6" metalness={0.8} roughness={0.3} />
          </mesh>)}
        </group>
      )))}
      {variant === 2 && [-1.8, 0, 1.8].map((x) => (
        <mesh key={`ceiling-light-${x}`} position={[x, TUNNEL_HEIGHT - 0.12, 0]}>
          <boxGeometry args={[0.48, 0.05, SEGMENT_LENGTH * 0.86]} />
          <meshStandardMaterial color="#dffaff" emissive="#8deaff" emissiveIntensity={2.8} />
        </mesh>
      ))}
      {variant === 3 && [-2.35, 2.35].map((x) => (
        <mesh key={`pipe-${x}`} position={[x, TUNNEL_HEIGHT - 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.17, SEGMENT_LENGTH, 10]} />
          <meshStandardMaterial color="#76868b" metalness={0.85} roughness={0.34} />
        </mesh>
      ))}
    </group>
  );
}

export function TrackFloor({ speedRef }: { speedRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const offsetRef = useRef(0);

  useFrame((_, dt) => {
    const speed = speedRef.current;
    offsetRef.current += getWorldFlowSpeed(speed) * Math.min(dt, 0.05) * 0.02;
    if (offsetRef.current > 1) offsetRef.current -= 1;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat.map) {
        mat.map.offset.set(0, offsetRef.current);
        mat.map.needsUpdate = true;
      }
    }
  });

  return null; // Tunnel handles the floor geometry
}
