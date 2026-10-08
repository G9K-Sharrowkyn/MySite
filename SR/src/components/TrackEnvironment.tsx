import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRACKS } from '../store/gameStore';
import type { TrackId } from '../store/gameStore';
import { getTrackObjectZ } from '../game/raceRules';
import { buildOpenWorldScenery } from '../game/sceneryDesign';
import type { CliffRole, OpenWorldTrackId } from '../game/sceneryDesign';
import { Tunnel } from './Tunnel';
import { Taris2Environment } from './Taris2Environment';

interface EnvironmentProps {
  trackId: TrackId;
  distanceRef: React.MutableRefObject<number>;
}

interface RepeatedSegmentsProps {
  distanceRef: React.MutableRefObject<number>;
  count?: number;
  length?: number;
  speedScale?: number;
  children: (index: number, length: number) => ReactNode;
}

function RepeatedSegments({
  distanceRef,
  count = 10,
  length = 40,
  speedScale = 1,
  children,
}: RepeatedSegmentsProps) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const positions = useMemo(
    () => Array.from({ length: count }, (_, index) => -index * length),
    [count, length],
  );

  useFrame(() => {
    const distance = distanceRef.current * speedScale;
    const total = count * length;
    refs.current.forEach((segment, index) => {
      if (!segment) return;
      const wrapped = ((positions[index] + distance - length) % total + total) % total;
      segment.position.z = wrapped + length - total;
    });
  });

  return (
    <group>
      {positions.map((z, index) => (
        <group
          key={index}
          ref={(node) => { refs.current[index] = node; }}
          position={[0, 0, z]}
        >
          {children(index, length)}
        </group>
      ))}
    </group>
  );
}

function noise(seed: number): number {
  const value = Math.sin(seed * 91.173 + 17.731) * 43758.5453;
  return value - Math.floor(value);
}

function createTerrainTexture(base: string, grain: string, streak: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for procedural terrain textures.');

  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 520; index += 1) {
    const x = noise(seed + index * 3) * canvas.width;
    const y = noise(seed + index * 3 + 1) * canvas.height;
    const radius = 0.25 + noise(seed + index * 3 + 2) * 1.4;
    context.globalAlpha = 0.08 + noise(seed + index * 5) * 0.18;
    context.fillStyle = grain;
    context.fillRect(x, y, radius * 2.4, radius);
  }
  context.globalAlpha = 0.16;
  context.strokeStyle = streak;
  context.lineWidth = 1;
  for (let line = 0; line < 7; line += 1) {
    const y = 10 + line * 18 + noise(seed + line * 11) * 8;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(32, y - 5, 92, y + 6, 128, y - 2);
    context.stroke();
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function useTerrainTexture(
  base: string,
  grain: string,
  streak: string,
  seed: number,
  repeatX = 56,
  repeatY = 14,
): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const generated = createTerrainTexture(base, grain, streak, seed);
    generated.repeat.set(repeatX, repeatY);
    return generated;
  }, [base, grain, streak, seed, repeatX, repeatY]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function CloudBanks({
  distanceRef,
  color,
  darkColor,
}: {
  distanceRef: React.MutableRefObject<number>;
  color: string;
  darkColor: string;
}) {
  return (
    <RepeatedSegments distanceRef={distanceRef} count={6} length={75} speedScale={0.035}>
      {(index, length) => (
        <group>
          {[0, 1].map((cloudIndex) => {
            const seed = index * 19 + cloudIndex * 7;
            const side = (index + cloudIndex) % 2 === 0 ? -1 : 1;
            return (
              <group
                key={cloudIndex}
                position={[
                  side * (9 + noise(seed) * 24),
                  60 + noise(seed + 1) * 18,
                  -length / 2 + noise(seed + 2) * length,
                ]}
                scale={[2.6 + noise(seed + 3) * 2.8, 0.75, 1.4 + noise(seed + 4) * 1.8]}
              >
                {[-0.8, 0, 0.8].map((x, puffIndex) => (
                  <mesh key={x} position={[x, puffIndex === 1 ? 0.3 : 0, 0]}>
                    <sphereGeometry args={[1, 12, 7]} />
                    <meshBasicMaterial
                      color={puffIndex === 2 ? darkColor : color}
                      transparent
                      opacity={0.72}
                      depthWrite={false}
                      fog={false}
                    />
                  </mesh>
                ))}
              </group>
            );
          })}
        </group>
      )}
    </RepeatedSegments>
  );
}

export function EnvironmentAtmosphere({ trackId }: { trackId: TrackId }) {
  const accent = TRACKS[trackId].color;

  if (trackId === 'taris2') {
    return <>
      <color attach="background" args={['#23333d']} />
      <fog attach="fog" args={['#23333d', 185, 305]} />
      <ambientLight intensity={1.12} color="#b0c5c6" />
      <hemisphereLight args={['#b8d2d8', '#273238', 1.15]} />
      <directionalLight position={[-6, 11, -12]} intensity={2.2} color="#c5d6d3" />
      <pointLight position={[0, 4, 2]} intensity={1.5} color={accent} />
    </>;
  }

  if (trackId === 'tatooine') {
    return (
      <>
        <color attach="background" args={['#6fb9e8']} />
        <fog attach="fog" args={['#a9cddd', 210, 520]} />
        <ambientLight intensity={0.8} color="#ffe0a0" />
        <hemisphereLight args={['#ccecff', '#70401f', 1.35]} />
        <directionalLight position={[-8, 12, 5]} intensity={4.2} color="#fff0bd" />
        <pointLight position={[0, 2, -12]} intensity={1.1} color={accent} />
      </>
    );
  }

  if (trackId === 'manaan') {
    return (
      <>
        <color attach="background" args={['#0a4055']} />
        <fog attach="fog" args={['#0a4055', 105, 285]} />
        <ambientLight intensity={0.72} color="#69d8e4" />
        <hemisphereLight args={['#8cebf0', '#082636', 1.1]} />
        <directionalLight position={[4, 10, 2]} intensity={2.1} color="#a8f5ed" />
        <pointLight position={[0, 3, -10]} intensity={2.8} color={accent} />
        <pointLight position={[0, 1, 3]} intensity={1.5} color="#45d9ff" />
      </>
    );
  }

  if (trackId === 'korriban') {
    return (
      <>
        <color attach="background" args={['#7892aa']} />
        <fog attach="fog" args={['#9b7b6c', 205, 520]} />
        <ambientLight intensity={0.62} color="#b75b39" />
        <hemisphereLight args={['#ef9a58', '#220809', 0.92]} />
        <directionalLight position={[-6, 11, 4]} intensity={3.2} color="#ffb15e" />
        <pointLight position={[0, 2, -8]} intensity={2.2} color="#ff2a16" />
      </>
    );
  }

  return (
    <>
      <color attach="background" args={['#42474c']} />
      <fog attach="fog" args={['#42474c', 260, 400]} />
      <ambientLight intensity={0.82} />
      <hemisphereLight args={['#d9e0e6', '#4a4d4f', 0.9]} />
      <pointLight position={[0, 3, 2]} intensity={3.1} color={accent} />
      <pointLight position={[-3, 0, -10]} intensity={1.8} color="#7b2fff" />
      <pointLight position={[3, 0, -10]} intensity={1.8} color="#7b2fff" />
    </>
  );
}

export function TrackEnvironment({ trackId, distanceRef }: EnvironmentProps) {
  if (trackId === 'taris2') return <Taris2Environment distanceRef={distanceRef} />;
  if (trackId === 'tatooine') return <TatooineEnvironment distanceRef={distanceRef} />;
  if (trackId === 'manaan') return <ManaanEnvironment distanceRef={distanceRef} />;
  if (trackId === 'korriban') return <KorribanEnvironment distanceRef={distanceRef} />;
  return <Tunnel distanceRef={distanceRef} />;
}

function OpenWorldLandmarks({
  trackId,
  distanceRef,
}: {
  trackId: OpenWorldTrackId;
  distanceRef: React.MutableRefObject<number>;
}) {
  const mountainRefs = useRef<Array<THREE.Group | null>>([]);
  const cliffRefs = useRef<Array<THREE.Group | null>>([]);
  const rockWallRefs = useRef<Array<THREE.Group | null>>([]);
  const duneFieldRefs = useRef<Array<THREE.Group | null>>([]);
  const trackLength = TRACKS[trackId].length;
  const { mountains, cliffs, cliffChunkLength, rockWalls, duneFields } = useMemo(
    () => buildOpenWorldScenery(trackId, trackLength),
    [trackId, trackLength],
  );

  useFrame(() => {
    const travelled = distanceRef.current;
    mountains.forEach((station, stationIndex) => {
      const group = mountainRefs.current[stationIndex];
      if (!group) return;
      const z = getTrackObjectZ(station.distance, travelled);
      group.position.z = z;
      group.visible = z > -430 && z < 35;
    });
    cliffs.forEach((station, stationIndex) => {
      const group = cliffRefs.current[stationIndex];
      if (!group) return;
      const z = getTrackObjectZ(station.distance, travelled);
      group.position.z = z;
      group.visible = z > -560 && z < cliffChunkLength;
    });
    rockWalls.forEach((station, stationIndex) => {
      const group = rockWallRefs.current[stationIndex];
      if (!group) return;
      const z = getTrackObjectZ(station.distance, travelled);
      group.position.z = z;
      group.visible = z > -520 && z < station.length * 0.7;
    });
    duneFields.forEach((station, stationIndex) => {
      const group = duneFieldRefs.current[stationIndex];
      if (!group) return;
      const z = getTrackObjectZ(station.distance, travelled);
      group.position.z = z;
      group.visible = z > -470 && z < station.depth;
    });
  });

  return (
    <group>
      {mountains.map((station, stationIndex) => (
        <group
          key={`mountain-${stationIndex}`}
          ref={(node) => { mountainRefs.current[stationIndex] = node; }}
          position={[
            station.side * station.lateralDistance,
            -0.4,
            -station.distance,
          ]}
          rotation={[0, station.rotation, 0]}
          scale={station.scale}
        >
          <MountainShape variant={station.variant} trackId={trackId} />
        </group>
      ))}
      {cliffs.map((station, stationIndex) => (
        <group
          key={`cliff-${stationIndex}`}
          ref={(node) => { cliffRefs.current[stationIndex] = node; }}
          position={[
            station.side * station.lateralDistance,
            0,
            -station.distance,
          ]}
          rotation={[0, station.rotation, 0]}
        >
          <CliffChunk
            trackId={trackId}
            height={station.height}
            width={station.width}
            length={cliffChunkLength + 10}
            side={station.side}
            index={stationIndex}
            role={station.role}
          />
        </group>
      ))}
      {rockWalls.map((station, stationIndex) => (
        <group
          key={`rock-wall-${stationIndex}`}
          ref={(node) => { rockWallRefs.current[stationIndex] = node; }}
          position={[station.side * station.lateralDistance, 0, -station.distance]}
          rotation={[0, station.rotation, 0]}
        >
          <BackgroundRockWall
            trackId={trackId}
            height={station.height}
            length={station.length}
            side={station.side}
            index={stationIndex}
          />
        </group>
      ))}
      {duneFields.map((station, stationIndex) => (
        <group
          key={`dune-field-${stationIndex}`}
          ref={(node) => { duneFieldRefs.current[stationIndex] = node; }}
          position={[station.side * station.lateralDistance, 0, -station.distance]}
          rotation={[0, station.rotation, 0]}
        >
          <DuneField
            width={station.width}
            depth={station.depth}
            height={station.height}
            side={station.side}
            index={stationIndex}
          />
        </group>
      ))}
    </group>
  );
}

function MountainMaterial({ trackId, shade = 0 }: { trackId: OpenWorldTrackId; shade?: number }) {
  const colors = trackId === 'tatooine'
    ? ['#9b5835', '#b66b3e', '#7f462e']
    : ['#71312c', '#8a3f33', '#542826'];
  return <meshStandardMaterial color={colors[shade % colors.length]} roughness={1} flatShading />;
}

function MountainShape({ variant, trackId }: { variant: number; trackId: OpenWorldTrackId }) {
  const themeScale = trackId === 'korriban' ? 1.12 : 1;

  if (variant === 0) {
    return (
      <group scale={themeScale}>
        <mesh position={[0, 3.6, 0]} scale={[5.8, 3.8, 4.6]}>
          <icosahedronGeometry args={[1, 1]} />
          <MountainMaterial trackId={trackId} />
        </mesh>
        <mesh position={[2.4, 6.1, -0.7]} scale={[2.7, 3.2, 2.5]} rotation={[0.08, 0, -0.12]}>
          <icosahedronGeometry args={[1, 0]} />
          <MountainMaterial trackId={trackId} shade={1} />
        </mesh>
      </group>
    );
  }

  if (variant === 1) {
    return (
      <group scale={themeScale * 0.92}>
        <mesh position={[0, 3.1, 0]} scale={[3.7, 1, 3.2]}>
          <cylinderGeometry args={[1.25, 2.2, 6.2, 7]} />
          <MountainMaterial trackId={trackId} shade={2} />
        </mesh>
        <mesh position={[0.3, 6.4, -0.2]} scale={[3.1, 0.58, 2.6]}>
          <cylinderGeometry args={[1.12, 1.35, 2.2, 7]} />
          <MountainMaterial trackId={trackId} shade={1} />
        </mesh>
      </group>
    );
  }

  if (variant === 2) return (
    <group scale={themeScale * 1.08}>
      {[
        { x: -2.7, y: 3.4, z: 0.5, sx: 2.8, sy: 4.3, sz: 2.4 },
        { x: 0, y: 5.1, z: -0.4, sx: 3.4, sy: 6.1, sz: 2.9 },
        { x: 3, y: 2.8, z: 0.8, sx: 3.1, sy: 3.5, sz: 2.5 },
      ].map((peak, index) => (
        <mesh key={peak.x} position={[peak.x, peak.y, peak.z]} scale={[peak.sx, peak.sy, peak.sz]} rotation={[0, index * 0.35, (index - 1) * 0.08]}>
          <coneGeometry args={[1, 2, 6]} />
          <MountainMaterial trackId={trackId} shade={index} />
        </mesh>
      ))}
    </group>
  );

  if (variant === 3) {
    return (
      <group scale={themeScale}>
        {[
          { x: -7.6, y: 2.5, z: 1.1, sx: 4.1, sy: 2.8, sz: 4.7 },
          { x: -2.2, y: 4.2, z: -0.8, sx: 5.4, sy: 4.6, sz: 5.1 },
          { x: 4.2, y: 3.1, z: 0.7, sx: 5.6, sy: 3.4, sz: 4.4 },
          { x: 8.7, y: 1.9, z: -1.2, sx: 3.1, sy: 2.2, sz: 3.8 },
        ].map((mass, index) => (
          <mesh key={mass.x} position={[mass.x, mass.y, mass.z]} scale={[mass.sx, mass.sy, mass.sz]} rotation={[0, index * 0.29, (index - 1.5) * 0.045]}>
            <dodecahedronGeometry args={[1, 0]} />
            <MountainMaterial trackId={trackId} shade={index % 3} />
          </mesh>
        ))}
      </group>
    );
  }

  if (variant === 4) {
    return (
      <group scale={themeScale}>
        <mesh position={[-4.7, 3.8, 0]} scale={[2.6, 4.3, 3.5]} rotation={[0.08, 0.12, -0.08]}>
          <dodecahedronGeometry args={[1, 0]} />
          <MountainMaterial trackId={trackId} shade={2} />
        </mesh>
        <mesh position={[4.8, 3.4, 0.2]} scale={[2.5, 3.9, 3.2]} rotation={[-0.05, -0.08, 0.1]}>
          <dodecahedronGeometry args={[1, 0]} />
          <MountainMaterial trackId={trackId} />
        </mesh>
        <mesh position={[0, 7.1, 0]} scale={[7.4, 1.55, 3.1]} rotation={[0, 0.04, 0.02]}>
          <dodecahedronGeometry args={[1, 0]} />
          <MountainMaterial trackId={trackId} shade={1} />
        </mesh>
      </group>
    );
  }

  return (
    <group scale={themeScale}>
      {[
        { x: -3.7, y: 4.8, z: 0.8, sx: 2.4, sy: 5.6, sz: 2.6, tilt: -0.14 },
        { x: 0.1, y: 7, z: -0.7, sx: 2.8, sy: 8, sz: 3.1, tilt: 0.04 },
        { x: 3.8, y: 4.1, z: 1, sx: 2.3, sy: 4.8, sz: 2.5, tilt: 0.16 },
      ].map((spire, index) => (
        <mesh key={spire.x} position={[spire.x, spire.y, spire.z]} scale={[spire.sx, spire.sy, spire.sz]} rotation={[0, index * 0.42, spire.tilt]}>
          <coneGeometry args={[1, 2, 5]} />
          <MountainMaterial trackId={trackId} shade={index} />
        </mesh>
      ))}
    </group>
  );
}

function CliffChunk({
  trackId,
  height,
  width,
  length,
  side,
  index,
  role,
}: {
  trackId: OpenWorldTrackId;
  height: number;
  width: number;
  length: number;
  side: number;
  index: number;
  role: CliffRole;
}) {
  const isBackdrop = role === 'backdrop';
  return (
    <group>
      {[-0.42, -0.21, 0, 0.21, 0.42].map((offset, columnIndex) => {
        const columnHeight = height * (0.76 + noise(index * 23 + columnIndex) * 0.38);
        return (
          <mesh
            key={offset}
            position={[
              -side * width * (0.05 + noise(index * 13 + columnIndex) * 0.08),
              columnHeight / 2 - 0.35,
              length * offset,
            ]}
            scale={[
              width * (0.58 + noise(index * 19 + columnIndex) * 0.16),
              columnHeight,
              length * (0.125 + noise(index * 29 + columnIndex) * 0.025),
            ]}
            rotation={[0, (noise(index * 37 + columnIndex) - 0.5) * 0.18, 0]}
          >
            <cylinderGeometry args={[0.82, 1.06, 1, 7]} />
            <MountainMaterial trackId={trackId} shade={(index + columnIndex + (isBackdrop ? 2 : 1)) % 3} />
          </mesh>
        );
      })}
    </group>
  );
}

function BackgroundRockWall({
  trackId,
  height,
  length,
  side,
  index,
}: {
  trackId: OpenWorldTrackId;
  height: number;
  length: number;
  side: number;
  index: number;
}) {
  return (
    <group>
      {Array.from({ length: 9 }, (_, segmentIndex) => {
        const z = -length * 0.46 + segmentIndex * (length * 0.92 / 8);
        const seed = segmentIndex + index * 19;
        const columnHeight = height * (0.76 + noise(seed + 1) * 0.42);
        return (
          <mesh
            key={segmentIndex}
            position={[-side * (0.4 + noise(seed) * 1.1), columnHeight / 2 - 0.35, z]}
            scale={[5.4 + noise(seed + 2) * 2.2, columnHeight, length * (0.08 + noise(seed + 3) * 0.015)]}
            rotation={[0, (noise(seed + 5) - 0.5) * 0.16, 0]}
          >
            <cylinderGeometry args={[0.8, 1.08, 1, 7]} />
            <MountainMaterial trackId={trackId} shade={(segmentIndex + index) % 3} />
          </mesh>
        );
      })}
    </group>
  );
}

function DuneField({
  width,
  depth,
  height,
  side,
  index,
}: {
  width: number;
  depth: number;
  height: number;
  side: number;
  index: number;
}) {
  return (
    <group>
      {Array.from({ length: 6 }, (_, duneIndex) => {
        const seed = index * 31 + duneIndex * 7;
        const x = side * ((noise(seed) - 0.5) * width * 0.26);
        const z = (noise(seed + 1) - 0.5) * depth * 0.72;
        const duneWidth = width * (0.2 + noise(seed + 2) * 0.14);
        return (
          <mesh
            key={duneIndex}
            position={[x, -0.03, z]}
            scale={[duneWidth, height * (0.55 + noise(seed + 3) * 0.6), depth * (0.13 + noise(seed + 4) * 0.09)]}
            rotation={[0, (noise(seed + 5) - 0.5) * 0.6, 0]}
          >
            <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={duneIndex % 2 === 0 ? '#d89b50' : '#e3ad62'} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function TatooineEnvironment({ distanceRef }: Omit<EnvironmentProps, 'trackId'>) {
  const sandTexture = useTerrainTexture('#c9823f', '#f0bd70', '#9e562d', 41);

  return (
    <group>
      <mesh position={[45, 37, -620]}>
        <circleGeometry args={[28, 64]} />
        <meshBasicMaterial color="#fff0b0" fog={false} />
      </mesh>
      <CloudBanks distanceRef={distanceRef} color="#fffaf0" darkColor="#cad8dc" />
      <RepeatedSegments distanceRef={distanceRef} count={16}>
        {(index, length) => <TatooineSegment index={index} length={length} terrainTexture={sandTexture} />}
      </RepeatedSegments>
      <OpenWorldLandmarks trackId="tatooine" distanceRef={distanceRef} />
    </group>
  );
}

function TatooineSegment({
  index,
  length,
  terrainTexture,
}: {
  index: number;
  length: number;
  terrainTexture: THREE.Texture;
}) {
  const section = index % 4;
  const rockCount = section === 0 ? 5 : section === 2 ? 2 : 0;

  return (
    <group>
      <mesh position={[0, -0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[560, length + 0.4]} />
        <meshStandardMaterial map={terrainTexture} color="#ffffff" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.2, length]} />
        <meshStandardMaterial color="#c99059" roughness={0.96} metalness={0.02} />
      </mesh>
      {[-3.42, 3.42].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]}>
          <boxGeometry args={[0.07, 0.04, length]} />
          <meshStandardMaterial color="#efd17f" emissive="#9a5c20" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {[-15, -5, 5, 15].map((z, markerIndex) => {
        const side = (index + markerIndex) % 2 === 0 ? -1 : 1;
        return (
          <group key={z} position={[side * 3.72, 0, z + (noise(index * 9 + markerIndex) - 0.5) * 2.4]}>
            <mesh position={[0, 0.48, 0]}>
              <boxGeometry args={[0.11, 0.96, 0.11]} />
              <meshStandardMaterial color="#55483a" metalness={0.72} roughness={0.42} />
            </mesh>
            <mesh position={[0, 0.91, 0]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshBasicMaterial color={markerIndex % 2 === 0 ? '#ffb52b' : '#65e5ff'} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: rockCount }, (_, rockIndex) => {
        const side = (index * 3 + rockIndex) % 4 === 0 ? -1 : 1;
        const seed = index * 17 + rockIndex * 5 + (side > 0 ? 3 : 0);
        const radius = 0.45 + noise(seed) * 0.75;
        const x = side * (5.7 + noise(seed + 1) * 13.5);
        const z = -17 + rockIndex * (34 / Math.max(1, rockCount - 1)) + noise(seed + 2) * 4;
        return (
          <mesh
            key={`${side}-${rockIndex}`}
            position={[x, radius * 0.48 - 0.03, z]}
            rotation={[noise(seed + 4), noise(seed + 5) * Math.PI, noise(seed + 6) * 0.35]}
            scale={[1.45, 0.75, 1]}
          >
            <icosahedronGeometry args={[radius, 1]} />
            <meshStandardMaterial color={rockIndex % 2 === 0 ? '#81502f' : '#9a6034'} roughness={1} flatShading />
          </mesh>
        );
      })}
      {section === 1 && (
        <group position={[index % 2 === 0 ? -8.5 : 8.5, 0, 3]}>
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 2.1, 8]} />
            <meshStandardMaterial color="#716457" metalness={0.62} roughness={0.5} />
          </mesh>
          <mesh position={[0, 2.05, 0]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[1.25, 0.08, 0.08]} />
            <meshStandardMaterial color="#8d8173" metalness={0.66} roughness={0.46} />
          </mesh>
          <mesh position={[0.5, 1.78, 0]}>
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshBasicMaterial color="#75dbff" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function ManaanEnvironment({ distanceRef }: Omit<EnvironmentProps, 'trackId'>) {
  const seabedTexture = useTerrainTexture('#123c46', '#2b6970', '#071f2c', 83, 42, 12);

  return (
    <RepeatedSegments distanceRef={distanceRef}>
      {(index, length) => <ManaanSegment index={index} length={length} terrainTexture={seabedTexture} />}
    </RepeatedSegments>
  );
}

function ManaanSegment({
  index,
  length,
  terrainTexture,
}: {
  index: number;
  length: number;
  terrainTexture: THREE.Texture;
}) {
  const section = index % 4;

  return (
    <group>
      <mesh position={[0, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, length + 0.4]} />
        <meshStandardMaterial map={terrainTexture} color="#ffffff" roughness={0.94} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, length]} />
        <meshStandardMaterial color="#445b62" metalness={0.72} roughness={0.4} />
      </mesh>
      {[-3.5, 3.5].map((x) => (
        <mesh key={`glass-${x}`} position={[x, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[length, 6]} />
          <meshPhysicalMaterial color="#65dce8" transparent opacity={0.17} roughness={0.08} metalness={0.05} transmission={0.18} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, length]} />
        <meshPhysicalMaterial color="#4cc8d8" transparent opacity={0.13} roughness={0.08} transmission={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {[-15, -5, 5, 15].map((z, ribIndex) => (
        <group key={z} position={[0, 0, z]}>
          {[-3.42, 3.42].map((x) => (
            <mesh key={x} position={[x, 3, 0]}>
              <boxGeometry args={[0.16, 6, 0.32]} />
              <meshStandardMaterial color="#6b858b" metalness={0.88} roughness={0.24} />
            </mesh>
          ))}
          <mesh position={[0, 5.9, 0]}>
            <boxGeometry args={[7, 0.2, 0.32]} />
            <meshStandardMaterial color="#6b858b" metalness={0.88} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6.7, 0.06]} />
            <meshBasicMaterial color={ribIndex % 2 === 0 ? '#75f2ec' : '#3da9d8'} />
          </mesh>
        </group>
      ))}
      {[-3.26, 3.26].map((x) => (
        <mesh key={`rail-${x}`} position={[x, 0.38, 0]}>
          <boxGeometry args={[0.09, 0.09, length]} />
          <meshStandardMaterial color="#63dfe5" emissive="#168ca5" emissiveIntensity={1.6} />
        </mesh>
      ))}
      {(section === 0 || section === 3) && [-1, 1].flatMap((side) => Array.from({ length: section === 0 ? 2 : 1 }, (_, rockIndex) => {
        const seed = index * 13 + rockIndex * 7 + side;
        const radius = 0.7 + noise(seed) * 1.15;
        return (
          <mesh
            key={`sea-rock-${side}-${rockIndex}`}
            position={[side * (6.5 + noise(seed + 1) * 5), radius * 0.35 - 0.12, -10 + rockIndex * 20 + noise(seed + 2) * 5]}
            scale={[1.4, 0.72, 1.1]}
            rotation={[0, noise(seed + 3) * Math.PI, 0]}
          >
            <dodecahedronGeometry args={[radius, 0]} />
            <meshStandardMaterial color="#315b58" roughness={0.94} flatShading />
          </mesh>
        );
      }))}
      {Array.from({ length: section === 3 ? 10 : 4 }, (_, bubbleIndex) => {
        const seed = index * 29 + bubbleIndex;
        const side = bubbleIndex % 2 === 0 ? -1 : 1;
        return (
          <mesh
            key={`bubble-${bubbleIndex}`}
            position={[side * (4 + noise(seed) * 6), 0.7 + noise(seed + 1) * 5.2, -18 + noise(seed + 2) * 36]}
          >
            <sphereGeometry args={[0.035 + noise(seed + 3) * 0.09, 8, 6]} />
            <meshBasicMaterial color="#b9fbff" transparent opacity={0.52} />
          </mesh>
        );
      })}
      {section === 1 && [-1, 1].map((side) => (
        <group key={side} position={[side * (6.3 + index % 2), 0, side * 7]}>
          {[0, 0.45, 0.9, 1.35].map((height, coralIndex) => (
            <mesh key={height} position={[(coralIndex - 1.5) * 0.38, height + 0.3, 0]} rotation={[0, 0, (coralIndex - 1.5) * 0.24]}>
              <coneGeometry args={[0.16, 1.2 + coralIndex * 0.28, 7]} />
              <meshStandardMaterial color={coralIndex % 2 ? '#d26687' : '#8678c9'} roughness={0.88} />
            </mesh>
          ))}
        </group>
      ))}
      {section === 2 && [-1, 1].map((side) => (
        <group key={`ruin-${side}`} position={[side * 7.4, 0, side * -5]} rotation={[0, side * 0.12, 0]}>
          {[-1.05, 0, 1.05].map((z, ruinIndex) => (
            <mesh key={z} position={[0, 1.1 + ruinIndex * 0.16, z]} rotation={[0, 0, side * (ruinIndex - 1) * 0.06]}>
              <cylinderGeometry args={[0.28, 0.4, 2.2 + ruinIndex * 0.32, 8]} />
              <meshStandardMaterial color="#617a78" metalness={0.3} roughness={0.82} />
            </mesh>
          ))}
          <mesh position={[0, 2.35, 0]}>
            <boxGeometry args={[0.55, 0.3, 3.3]} />
            <meshStandardMaterial color="#526c6c" metalness={0.28} roughness={0.86} />
          </mesh>
        </group>
      ))}
      {section === 3 && [-1, 1].flatMap((side) => [0, 1, 2].map((plantIndex) => (
        <group key={`kelp-${side}-${plantIndex}`} position={[side * (5.8 + plantIndex * 1.1), 0, -10 + plantIndex * 9]}>
          {[0, 1, 2].map((leafIndex) => (
            <mesh key={leafIndex} position={[leafIndex * side * 0.13, 0.65 + leafIndex * 0.55, 0]} rotation={[0, 0, side * (0.12 + leafIndex * 0.08)]}>
              <capsuleGeometry args={[0.08, 1.05, 4, 7]} />
              <meshStandardMaterial color={leafIndex % 2 ? '#3f9c7c' : '#55b693'} roughness={0.82} />
            </mesh>
          ))}
        </group>
      )))}
    </group>
  );
}

function KorribanEnvironment({ distanceRef }: Omit<EnvironmentProps, 'trackId'>) {
  const wastelandTexture = useTerrainTexture('#632c25', '#a55a3c', '#32191a', 127);

  return (
    <group>
      <mesh position={[-9, 8, -120]}>
        <circleGeometry args={[4.1, 40]} />
        <meshBasicMaterial color="#d84b2e" fog={false} />
      </mesh>
      <CloudBanks distanceRef={distanceRef} color="#d8d1cb" darkColor="#7d6d69" />
      <RepeatedSegments distanceRef={distanceRef}>
        {(index, length) => <KorribanSegment index={index} length={length} terrainTexture={wastelandTexture} />}
      </RepeatedSegments>
      <OpenWorldLandmarks trackId="korriban" distanceRef={distanceRef} />
    </group>
  );
}

function KorribanSegment({
  index,
  length,
  terrainTexture,
}: {
  index: number;
  length: number;
  terrainTexture: THREE.Texture;
}) {
  const section = index % 4;
  const cliffCount = section === 0 ? 3 : section === 3 ? 2 : 0;

  return (
    <group>
      <mesh position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[180, length + 0.4]} />
        <meshStandardMaterial map={terrainTexture} color="#ffffff" roughness={1} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.15, length]} />
        <meshStandardMaterial color="#3d3432" metalness={0.25} roughness={0.87} />
      </mesh>
      {[-3.45, 3.45].map((x) => (
        <mesh key={`edge-${x}`} position={[x, 0.045, 0]}>
          <boxGeometry args={[0.1, 0.05, length]} />
          <meshStandardMaterial color="#bb6339" emissive="#6f1c11" emissiveIntensity={0.7} />
        </mesh>
      ))}
      {Array.from({ length: cliffCount }, (_, rockIndex) => {
        const side = (index + rockIndex * 2) % 3 === 0 ? -1 : 1;
        const seed = index * 23 + rockIndex * 7 + side;
        const height = 2.8 + noise(seed) * 4.2;
        const x = side * (6.2 + noise(seed + 1) * 15);
        const z = -16 + rockIndex * (32 / Math.max(1, cliffCount - 1)) + noise(seed + 2) * 4;
        return (
          <mesh
            key={`cliff-${side}-${rockIndex}`}
            position={[x, height * 0.43 - 0.08, z]}
            scale={[1.5 + noise(seed + 4), height / 2, 1.25 + noise(seed + 5)]}
            rotation={[0, noise(seed + 3) * Math.PI, noise(seed + 6) * 0.12]}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={rockIndex % 2 ? '#783227' : '#8c3b2b'} roughness={1} flatShading />
          </mesh>
        );
      })}
      {(section === 0 ? [-14, 0, 14] : section === 1 ? [-10, 10] : [0]).map((z, markerIndex) => {
        const side = (index + markerIndex) % 2 === 0 ? -1 : 1;
        return (
          <group key={`obelisk-${z}`} position={[side * (3.8 + noise(index * 11 + markerIndex) * 1.4), 0, z + (noise(index * 13 + markerIndex) - 0.5) * 3]}>
            <mesh position={[0, 0.78, 0]} rotation={[0, 0, side * -0.08]}>
              <coneGeometry args={[0.22, 1.55, 4]} />
              <meshStandardMaterial color="#282325" metalness={0.62} roughness={0.42} />
            </mesh>
            <mesh position={[0, 1.12, 0.17]}>
              <circleGeometry args={[0.08, 12]} />
              <meshBasicMaterial color={markerIndex % 2 === 0 ? '#ff321d' : '#f39a38'} />
            </mesh>
          </group>
        );
      })}
      {section === 2 && (
        <group position={[0, 0, 4]}>
          {[-4.8, 4.8].map((x) => (
            <mesh key={x} position={[x, 2.25, 0]} rotation={[0, 0, x < 0 ? -0.035 : 0.035]}>
              <boxGeometry args={[0.72, 4.5, 1.1]} />
              <meshStandardMaterial color="#5a3430" roughness={0.92} />
            </mesh>
          ))}
          <mesh position={[0, 4.45, 0]}>
            <boxGeometry args={[10.3, 0.58, 1.05]} />
            <meshStandardMaterial color="#5a3430" roughness={0.92} />
          </mesh>
          <mesh position={[0, 4.45, 0.56]}>
            <boxGeometry args={[3.2, 0.08, 0.08]} />
            <meshBasicMaterial color="#d02718" />
          </mesh>
        </group>
      )}
      {Array.from({ length: section === 1 || section === 3 ? 7 : 2 }, (_, crackIndex) => {
        const seed = index * 31 + crackIndex;
        return (
          <mesh
            key={`crack-${crackIndex}`}
            position={[-2.8 + noise(seed) * 5.6, 0.028, -18 + noise(seed + 1) * 36]}
            rotation={[-Math.PI / 2, 0, noise(seed + 2) * Math.PI]}
          >
            <planeGeometry args={[0.025, 0.8 + noise(seed + 3) * 1.6]} />
            <meshBasicMaterial color="#171314" />
          </mesh>
        );
      })}
      {section === 1 && (() => {
        const side = index % 2 === 0 ? -1 : 1;
        return (
        <group position={[side * (7.2 + noise(index * 19) * 4), 0, side * 6]} rotation={[0, side * (0.2 + noise(index * 7) * 0.35), 0]}>
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.5, 0.72, 2.5, 6]} />
            <meshStandardMaterial color="#47312f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.75, 0]} rotation={[0, 0, side * 0.12]}>
            <octahedronGeometry args={[0.72, 0]} />
            <meshStandardMaterial color="#5b3934" roughness={0.92} flatShading />
          </mesh>
        </group>
        );
      })()}
    </group>
  );
}
