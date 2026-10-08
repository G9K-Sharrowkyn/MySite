import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TRACK_WIDTH } from '../game/raceRules';
import { getTaris2SectionCount, TARIS2_SECTION_LENGTH } from '../game/taris2Layout';
import { TRACKS } from '../store/gameStore';
import { createTaris2Textures, disposeTaris2Textures } from './Taris2Textures';
import { createTaris2BuildingModels, createTaris2PlazaModels } from './Taris2Architecture';
import { Taris2Cityscape } from './Taris2Cityscape';

const HALL_HEIGHT = 6.3;
const HALF_WIDTH = TRACK_WIDTH / 2;
const CHUNK_SECTIONS = 6;

const SKY_VERTEX = [
  'varying vec3 vDirection;',
  'void main() {',
  '  vDirection = normalize(position);',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}',
].join('\n');
const SKY_FRAGMENT = [
  'varying vec3 vDirection;',
  'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
  'float noise(vec2 p) {',
  '  vec2 cell = floor(p), local = fract(p);',
  '  vec2 blend = local * local * (3.0 - 2.0 * local);',
  '  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),',
  '             mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x), blend.y);',
  '}',
  'void main() {',
  '  vec3 direction = normalize(vDirection);',
  '  vec2 cloudUV = vec2(atan(direction.x, -direction.z) * 1.8, direction.y * 5.0);',
  '  float cloud = noise(cloudUV * 2.6) * .68 + noise(cloudUV * 7.2) * .32;',
  '  vec3 sky = mix(vec3(.055, .09, .12), vec3(.18, .25, .29), clamp(.48 + direction.y * .85, 0.0, 1.0));',
  '  sky = mix(sky, vec3(.29, .35, .38), smoothstep(.47, .75, cloud) * .4);',
  '  gl_FragColor = vec4(sky, 1.0);',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '}',
].join('\n');

interface BoxInstance {
  position: [number, number, number];
  scale: [number, number, number];
  rotationZ?: number;
  color?: string;
}

const RIB_BOXES: BoxInstance[] = [];
const RIB_LIGHTS: BoxInstance[] = [];
const RIB_TRIM: BoxInstance[] = [];
const LAMP_HOUSINGS: BoxInstance[] = [];
const LAMP_GLOW: BoxInstance[] = [];
for (const z of [-16, -8, 0, 8, 16]) {
  for (const side of [-1, 1] as const) {
    RIB_BOXES.push(
      { position: [side * 3.47, 3.2, z], scale: [.3, 5.85, .37] },
      { position: [side * 2.84, 5.75, z], scale: [.21, 1.45, .44], rotationZ: side * .8 },
    );
    RIB_LIGHTS.push({ position: [side * 3.36, 3.26, z - .15], scale: [.055, 2, .06], color: '#9abfbe' });
    RIB_TRIM.push(
      { position: [side * 3.28, 3.25, z + .05], scale: [.045, 4.75, .27], color: '#334851' },
      { position: [side * 3.255, 5.75, z + .05], scale: [.07, .12, .52], color: '#aab7b3' },
      { position: [side * 3.255, 1.39, z + .05], scale: [.07, .1, .52], color: '#aab7b3' },
    );
    LAMP_HOUSINGS.push(
      { position: [side * 3.195, 1.02, z + .03], scale: [.22, .42, .72], color: '#26343a' },
      { position: [side * 3.055, 1.205, z + .03], scale: [.04, .055, .57], color: '#a1a9a5' },
      { position: [side * 3.055, .835, z + .03], scale: [.04, .055, .57], color: '#a1a9a5' },
      { position: [side * 3.055, 1.02, z - .27], scale: [.04, .34, .045], color: '#a1a9a5' },
      { position: [side * 3.055, 1.02, z + .33], scale: [.04, .34, .045], color: '#a1a9a5' },
      { position: [side * 3.025, .75, z - .25], scale: [.035, .035, .035], color: '#d5d6c4' },
      { position: [side * 3.025, 1.29, z + .31], scale: [.035, .035, .035], color: '#d5d6c4' },
    );
    LAMP_GLOW.push(
      { position: [side * 3.024, 1.02, z + .03], scale: [.025, .26, .46], color: '#c78b4c' },
      { position: [side * 3.004, 1.02, z - .07], scale: [.02, .32, .035], color: '#27343a' },
      { position: [side * 3.004, 1.02, z + .12], scale: [.02, .32, .035], color: '#27343a' },
    );
  }
  RIB_BOXES.push({ position: [0, 6, z], scale: [TRACK_WIDTH, .23, .44] });
  RIB_LIGHTS.push(
    { position: [0, 5.92, z - .24], scale: [2.35, .08, .08], color: '#a9d1cd' },
    { position: [0, .018, z], scale: [TRACK_WIDTH - .55, .008, .07], color: '#a1aeb0' },
  );
}

function expandBoxes(boxes: BoxInstance[], sectionCount: number) {
  return Array.from({ length: sectionCount }, (_, section) =>
    boxes.map(box => ({
      ...box,
      position: [box.position[0], box.position[1], box.position[2] - section * TARIS2_SECTION_LENGTH] as [number, number, number],
    })),
  ).flat();
}

function InstancedBoxes({ boxes, lights = false, texture }: { boxes: BoxInstance[]; lights?: boolean; texture?: THREE.Texture }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const color = new THREE.Color();
    boxes.forEach((box, index) => {
      transform.position.set(...box.position);
      transform.scale.set(...box.scale);
      transform.rotation.set(0, 0, box.rotationZ ?? 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      if (box.color) mesh.setColorAt(index, color.set(box.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  return <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]}>
    <boxGeometry args={[1, 1, 1]} />
    {lights
      ? <meshBasicMaterial color="#ffffff" toneMapped={false} />
      : <meshStandardMaterial map={texture} color={texture ? '#ffffff' : '#81949a'} emissive={texture ? '#26343b' : '#000000'} emissiveIntensity={texture ? .24 : 0} metalness={.72} roughness={.45} />}
  </instancedMesh>;
}

function RepeatedSurface({ count, stride = TARIS2_SECTION_LENGTH, position = [0, 0, 0], rotation = [0, 0, 0], children }: {
  count: number;
  stride?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new THREE.Object3D();
    const localStep = new THREE.Vector3(0, 0, -stride)
      .applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)).invert());
    for (let section = 0; section < count; section++) {
      transform.position.copy(localStep).multiplyScalar(section);
      transform.updateMatrix();
      mesh.setMatrixAt(section, transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [count, stride, rotation]);
  return <instancedMesh ref={ref} args={[undefined, undefined, count]} position={position} rotation={rotation}>
    {children}
  </instancedMesh>;
}

function Taris2Corridor({ sectionCount, textures }: { sectionCount: number; textures: ReturnType<typeof createTaris2Textures> }) {
  const boxes = useMemo(() => ({
    ribs: expandBoxes(RIB_BOXES, sectionCount),
    ribTrim: expandBoxes(RIB_TRIM, sectionCount),
    ribLights: expandBoxes(RIB_LIGHTS, sectionCount),
    lampHousings: expandBoxes(LAMP_HOUSINGS, sectionCount),
    lampGlow: expandBoxes(LAMP_GLOW, sectionCount),
  }), [sectionCount]);
  const signCount = Math.ceil(sectionCount / 3);

  return <group>
    <RepeatedSurface count={sectionCount} position={[0, -.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[TRACK_WIDTH, TARIS2_SECTION_LENGTH]} />
      <meshStandardMaterial map={textures.road} bumpMap={textures.roadBump} bumpScale={.075} metalness={.43} roughness={.73} />
    </RepeatedSurface>
    <RepeatedSurface count={sectionCount} position={[0, HALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[TRACK_WIDTH, TARIS2_SECTION_LENGTH]} />
      <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={.055} metalness={.51} roughness={.68} />
    </RepeatedSurface>

    {([-1, 1] as const).map(side => <group key={side}>
      <RepeatedSurface count={sectionCount} position={[side * (HALF_WIDTH + .05), .66, 0]}>
        <boxGeometry args={[.24, 1.32, TARIS2_SECTION_LENGTH]} />
        <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={.035} metalness={.47} roughness={.7} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * (HALF_WIDTH + .05), 5.8, 0]}>
        <boxGeometry args={[.34, 1.02, TARIS2_SECTION_LENGTH]} />
        <meshStandardMaterial map={textures.metal} bumpMap={textures.metalBump} bumpScale={.035} metalness={.53} roughness={.64} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * (HALF_WIDTH + .02), 3.23, 0]} rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[TARIS2_SECTION_LENGTH, 4.05]} />
        <meshPhysicalMaterial color="#9ecbd0" transparent opacity={.14} roughness={.07} metalness={.08} clearcoat={1} clearcoatRoughness={.06} depthWrite={false} side={THREE.DoubleSide} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * 3.08, .038, 0]}>
        <boxGeometry args={[.16, .07, TARIS2_SECTION_LENGTH]} />
        <meshStandardMaterial color="#a16d45" metalness={.54} roughness={.59} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * 3.3, .14, 0]}>
        <boxGeometry args={[.07, .07, TARIS2_SECTION_LENGTH]} />
        <meshBasicMaterial color="#9dcdd1" toneMapped={false} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * 3.46, 1.38, 0]}>
        <boxGeometry args={[.12, .13, TARIS2_SECTION_LENGTH]} />
        <meshStandardMaterial color="#ba7b4e" metalness={.62} roughness={.42} />
      </RepeatedSurface>
      <RepeatedSurface count={sectionCount} position={[side * 3.46, 5.23, 0]}>
        <boxGeometry args={[.12, .16, TARIS2_SECTION_LENGTH]} />
        <meshStandardMaterial color="#8eafb3" metalness={.7} roughness={.36} />
      </RepeatedSurface>
    </group>)}

    {[-1.75, 0, 1.75].map(x => <RepeatedSurface key={x} count={sectionCount} position={[x, .006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[.027, TARIS2_SECTION_LENGTH]} />
      <meshBasicMaterial color={x === 0 ? '#d5dbd0' : '#889ca2'} />
    </RepeatedSurface>)}

    <InstancedBoxes boxes={boxes.ribs} texture={textures.metal} />
    <InstancedBoxes boxes={boxes.ribTrim} />
    <InstancedBoxes boxes={boxes.ribLights} lights />
    <InstancedBoxes boxes={boxes.lampHousings} />
    <InstancedBoxes boxes={boxes.lampGlow} lights />

    <RepeatedSurface count={signCount} stride={TARIS2_SECTION_LENGTH * 3} position={[0, 5.18, -15.6]}>
      <boxGeometry args={[4.2, .86, .24]} />
      <meshStandardMaterial color="#182c32" metalness={.6} roughness={.48} />
    </RepeatedSurface>
    <RepeatedSurface count={signCount} stride={TARIS2_SECTION_LENGTH * 3} position={[0, 5.18, -15.46]}>
      <planeGeometry args={[4.0, .8]} />
      <meshBasicMaterial map={textures.sign} toneMapped={false} />
    </RepeatedSurface>
  </group>;
}

export function Taris2Environment({ distanceRef }: { distanceRef: React.MutableRefObject<number> }) {
  const world = useRef<THREE.Group>(null);
  const sectionCount = getTaris2SectionCount(TRACKS.taris2.length);
  const chunks = useMemo(() => Array.from({ length: Math.ceil(sectionCount / CHUNK_SECTIONS) }, (_, index) => ({
    start: index * CHUNK_SECTIONS,
    count: Math.min(CHUNK_SECTIONS, sectionCount - index * CHUNK_SECTIONS),
  })), [sectionCount]);
  const textures = useMemo(createTaris2Textures, []);
  const buildingModels = useMemo(createTaris2BuildingModels, []);
  const plazaModels = useMemo(createTaris2PlazaModels, []);
  useEffect(() => () => disposeTaris2Textures(textures), [textures]);
  useEffect(() => () => [...buildingModels, ...plazaModels].forEach(geometry => geometry.dispose()), [buildingModels, plazaModels]);

  useFrame(() => {
    if (world.current) world.current.position.z = distanceRef.current;
  });

  return <group>
    <mesh>
      <sphereGeometry args={[310, 32, 16]} />
      <shaderMaterial vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} side={THREE.BackSide} depthWrite={false} />
    </mesh>
    <group ref={world}>
      {chunks.map(chunk => <group key={chunk.start} position={[0, 0, -chunk.start * TARIS2_SECTION_LENGTH]}>
        <Taris2Corridor sectionCount={chunk.count} textures={textures} />
        <Taris2Cityscape sectionStart={chunk.start} sectionCount={chunk.count} textures={textures} buildingModels={buildingModels} plazaModels={plazaModels} />
      </group>)}
    </group>
  </group>;
}
