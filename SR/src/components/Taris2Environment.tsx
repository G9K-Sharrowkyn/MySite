import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRACK_WIDTH } from '../game/raceRules';
import { createTaris2Textures, disposeTaris2Textures } from './Taris2Textures';
import type { Taris2Textures } from './Taris2Textures';

const LENGTH = 40;
const SEGMENTS = 7;
const HALL_HEIGHT = 6.3;
const HALF_WIDTH = TRACK_WIDTH / 2;

interface BoxInstance {
  position: [number, number, number];
  scale: [number, number, number];
  rotationZ?: number;
  color?: string;
}

const RIB_BOXES: BoxInstance[] = [];
const RIB_LIGHTS: BoxInstance[] = [];
for (const [ribIndex, z] of [-16, -8, 0, 8, 16].entries()) {
  for (const side of [-1, 1] as const) {
    RIB_BOXES.push(
      { position: [side * 3.47, 3.2, z], scale: [.3, 5.85, .37] },
      { position: [side * 2.84, 5.75, z], scale: [.21, 1.45, .44], rotationZ: side * .8 },
    );
    RIB_LIGHTS.push(
      { position: [side * 3.36, 3.26, z - .15], scale: [.055, 2, .06], color: '#9abfbe' },
      { position: [side * 3.25, 1.01, z + .03], scale: [.13, .42, .52], color: ribIndex % 2 ? '#af6c3b' : '#c9965a' },
    );
  }
  RIB_BOXES.push({ position: [0, 6, z], scale: [TRACK_WIDTH, .23, .44] });
  RIB_LIGHTS.push(
    { position: [0, 5.92, z - .24], scale: [2.35, .08, .08], color: '#a9d1cd' },
    { position: [0, .018, z], scale: [TRACK_WIDTH - .55, .008, .07], color: '#a1aeb0' },
  );
}

function InstancedBoxes({ boxes, lights = false }: { boxes: BoxInstance[]; lights?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    boxes.forEach((box, index) => {
      transform.position.set(...box.position);
      transform.scale.set(...box.scale);
      transform.rotation.set(0, 0, box.rotationZ ?? 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      if (box.color) mesh.setColorAt(index, new THREE.Color(box.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  return <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
    <boxGeometry args={[1, 1, 1]} />
    {lights
      ? <meshBasicMaterial color="#ffffff" toneMapped={false} />
      : <meshStandardMaterial color="#81949a" metalness={.72} roughness={.45} />}
  </instancedMesh>;
}

function CityTower({ side, z, index }: { side: -1 | 1; z: number; index: number }) {
  const distance = 7.5 + (index % 2) * 2.8;
  const height = 11 + (index * 7) % 6;
  const depth = 4.8 + (index % 2) * 1.4;
  return <group position={[side * distance, 0, z]}>
    <mesh position={[0, height / 2 - 1.7, 0]}>
      <boxGeometry args={[1.8, height, depth]} />
      <meshStandardMaterial color={index % 2 ? '#26343b' : '#35444b'} metalness={0.56} roughness={0.78} />
    </mesh>
    <mesh position={[-side * 0.94, height - 2.1, 0]}>
      <boxGeometry args={[0.09, 1.3, depth * 0.8]} />
      <meshStandardMaterial color="#315767" emissive="#167f9a" emissiveIntensity={1.25} />
    </mesh>
    {[2.2, 4.1, 6.0, 7.9].map((y, lightIndex) => <mesh key={y} position={[-side * 0.96, y, 0]}>
      <boxGeometry args={[0.04, 0.13, depth * (lightIndex % 2 ? .62 : .78)]} />
      <meshBasicMaterial color={lightIndex % 3 ? '#b99369' : '#75b2bd'} toneMapped={false} />
    </mesh>)}
    <mesh position={[0, height + 0.1, 0]}>
      <boxGeometry args={[2.3, 0.45, depth + 0.5]} />
      <meshStandardMaterial color="#19272e" metalness={0.7} roughness={0.54} />
    </mesh>
  </group>;
}

function Taris2Segment({ index, textures, city }: { index: number; textures: Taris2Textures; city: THREE.Texture }) {
  return <group>
    {/* The window openings are real gaps between the lower sill, roof beam and piers. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
      <planeGeometry args={[TRACK_WIDTH, LENGTH]} />
      <meshStandardMaterial map={textures.road} bumpMap={textures.roadBump} bumpScale={0.075} metalness={0.43} roughness={0.73} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, HALL_HEIGHT, 0]}>
      <planeGeometry args={[TRACK_WIDTH, LENGTH]} />
      <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={0.055} metalness={0.51} roughness={0.68} />
    </mesh>

    {([-1, 1] as const).map(side => <group key={side}>
      <mesh position={[side * (HALF_WIDTH + .05), .66, 0]}>
        <boxGeometry args={[.24, 1.32, LENGTH]} />
        <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={.035} metalness={.47} roughness={.7} />
      </mesh>
      <mesh position={[side * (HALF_WIDTH + .05), 5.8, 0]}>
        <boxGeometry args={[.34, 1.02, LENGTH]} />
        <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={.035} metalness={.53} roughness={.64} />
      </mesh>

      {/* Translucent panes reveal the exterior geometry and city backdrop. */}
      <mesh position={[side * (HALF_WIDTH + .02), 3.23, 0]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[LENGTH, 4.05]} />
        <meshPhysicalMaterial color="#9ecbd0" transparent opacity={.14} roughness={.07} metalness={.08} clearcoat={1} clearcoatRoughness={.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[side * 16, 5.3, 0]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[LENGTH, 17]} />
        <meshBasicMaterial map={city} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {[-11, 11].map((z, towerIndex) => <CityTower key={z} side={side} z={z} index={index * 2 + towerIndex + (side + 1) * 3} />)}

      <mesh position={[side * 3.08, .038, 0]}>
        <boxGeometry args={[.16, .07, LENGTH]} />
        <meshStandardMaterial color="#a16d45" metalness={.54} roughness={.59} />
      </mesh>
      <mesh position={[side * 3.3, .14, 0]}>
        <boxGeometry args={[.07, .07, LENGTH]} />
        <meshBasicMaterial color="#9dcdd1" toneMapped={false} />
      </mesh>
      <mesh position={[side * 3.46, 1.38, 0]}>
        <boxGeometry args={[.12, .13, LENGTH]} />
        <meshStandardMaterial color="#ba7b4e" metalness={.62} roughness={.42} />
      </mesh>
      <mesh position={[side * 3.46, 5.23, 0]}>
        <boxGeometry args={[.12, .16, LENGTH]} />
        <meshStandardMaterial color="#8eafb3" metalness={.7} roughness={.36} />
      </mesh>
    </group>)}

    {[-1.75, 0, 1.75].map(x => <mesh key={x} position={[x, .006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[.027, LENGTH]} />
      <meshBasicMaterial color={x === 0 ? '#d5dbd0' : '#889ca2'} />
    </mesh>)}

    <InstancedBoxes boxes={RIB_BOXES} />
    <InstancedBoxes boxes={RIB_LIGHTS} lights />

    {index % 3 === 0 && <group position={[0, 5.18, -15.6]}>
      <mesh>
        <boxGeometry args={[4.2, .86, .24]} />
        <meshStandardMaterial color="#182c32" metalness={.6} roughness={.48} />
      </mesh>
      <mesh position={[0, 0, .14]}>
        <planeGeometry args={[4.0, .8]} />
        <meshBasicMaterial map={textures.sign} toneMapped={false} />
      </mesh>
    </group>}
  </group>;
}

export function Taris2Environment({ distanceRef }: { distanceRef: React.MutableRefObject<number> }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const textures = useMemo(createTaris2Textures, []);
  const city = useMemo(() => {
    const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}taris2-city.webp`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, []);
  useEffect(() => () => disposeTaris2Textures(textures), [textures]);
  useEffect(() => () => city.dispose(), [city]);

  useFrame(() => {
    const total = SEGMENTS * LENGTH;
    refs.current.forEach((segment, index) => {
      if (!segment) return;
      const wrapped = ((-index * LENGTH + distanceRef.current - LENGTH) % total + total) % total;
      segment.position.z = wrapped + LENGTH - total;
    });
  });

  return <group>
    {Array.from({ length: SEGMENTS }, (_, index) => <group key={index} ref={node => { refs.current[index] = node; }} position={[0, 0, -index * LENGTH]}>
      <Taris2Segment index={index} textures={textures} city={city} />
    </group>)}
  </group>;
}
