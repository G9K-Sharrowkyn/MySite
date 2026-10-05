import { useLoader, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo } from 'react'
import {
  EquirectangularReflectionMapping,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { environmentAsset, industrialTextureAsset, toonAsset } from '../game/assetPaths'
import { arenaBlocks, type ArenaBlock, WORLD_LIMIT } from '../game/map'

const blockColors = {
  wall: '#6d756f',
  crate: '#6d5032',
  container: '#394e50',
}

const importedBlocks: Partial<Record<string, { file: string; sourceSize: [number, number, number] }>> = {
  'mid-a': { file: 'container-long.gltf', sourceSize: [4.36, 2.13, 2.09] },
  'mid-b': { file: 'container-long.gltf', sourceSize: [4.36, 2.13, 2.09] },
  'south-crate-a': { file: 'crate.gltf', sourceSize: [0.79, 0.79, 0.79] },
  'south-crate-b': { file: 'cardboard-boxes.gltf', sourceSize: [0.98, 0.51, 0.73] },
  'east-crate-a': { file: 'exploding-barrel.gltf', sourceSize: [0.78, 1.02, 0.78] },
  'east-crate-b': { file: 'traffic-cone.gltf', sourceSize: [0.67, 0.64, 0.67] },
  'west-container': { file: 'trash-container.gltf', sourceSize: [2.44, 2.03, 1.3] },
  'north-pallet': { file: 'pallet.gltf', sourceSize: [1.7, 0.19, 1.46] },
}

function BoundaryWall({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow userData={{ blocksShot: true }}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#535b55" roughness={0.9} metalness={0.08} />
    </mesh>
  )
}

function WarehouseEnvironment() {
  const { scene } = useThree()
  const environment = useLoader(RGBELoader, environmentAsset('empty-warehouse-01-1k.hdr'))

  useEffect(() => {
    const previousEnvironment = scene.environment
    const previousIntensity = scene.environmentIntensity
    environment.mapping = EquirectangularReflectionMapping
    scene.environment = environment
    scene.environmentIntensity = 0.72
    return () => {
      scene.environment = previousEnvironment
      scene.environmentIntensity = previousIntensity
    }
  }, [environment, scene])

  return null
}

function TexturedFloor() {
  const [diffuse, normal, roughness] = useLoader(TextureLoader, [
    industrialTextureAsset('concrete-floor-diffuse.jpg'),
    industrialTextureAsset('concrete-floor-normal.jpg'),
    industrialTextureAsset('concrete-floor-roughness.jpg'),
  ])

  useMemo(() => {
    diffuse.colorSpace = SRGBColorSpace
    for (const texture of [diffuse, normal, roughness]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(12, 12)
      texture.needsUpdate = true
    }
  }, [diffuse, normal, roughness])

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ blocksShot: true }}>
      <planeGeometry args={[WORLD_LIMIT * 2, WORLD_LIMIT * 2]} />
      <meshStandardMaterial
        map={diffuse}
        normalMap={normal}
        roughnessMap={roughness}
        roughness={0.94}
        metalness={0.02}
      />
    </mesh>
  )
}

function ProceduralFloor() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow userData={{ blocksShot: true }}>
      <planeGeometry args={[WORLD_LIMIT * 2, WORLD_LIMIT * 2]} />
      <meshStandardMaterial color="#7b8174" roughness={1} />
    </mesh>
  )
}

function TexturedBoundaryWalls() {
  const [diffuse, normal, roughness, metalness] = useLoader(TextureLoader, [
    industrialTextureAsset('metal-plate-diffuse.jpg'),
    industrialTextureAsset('metal-plate-normal.jpg'),
    industrialTextureAsset('metal-plate-roughness.jpg'),
    industrialTextureAsset('metal-plate-metalness.jpg'),
  ])

  useMemo(() => {
    diffuse.colorSpace = SRGBColorSpace
    for (const texture of [diffuse, normal, roughness, metalness]) {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(8, 2)
      texture.needsUpdate = true
    }
  }, [diffuse, metalness, normal, roughness])

  const walls: { position: [number, number, number]; size: [number, number, number] }[] = [
    { position: [0, 2.5, -WORLD_LIMIT], size: [WORLD_LIMIT * 2 + 2, 5, 1] },
    { position: [0, 2.5, WORLD_LIMIT], size: [WORLD_LIMIT * 2 + 2, 5, 1] },
    { position: [-WORLD_LIMIT, 2.5, 0], size: [1, 5, WORLD_LIMIT * 2] },
    { position: [WORLD_LIMIT, 2.5, 0], size: [1, 5, WORLD_LIMIT * 2] },
  ]

  return walls.map(({ position, size }) => (
    <mesh key={position.join(':')} position={position} castShadow receiveShadow userData={{ blocksShot: true }}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        map={diffuse}
        normalMap={normal}
        roughnessMap={roughness}
        metalnessMap={metalness}
        roughness={0.72}
        metalness={0.55}
      />
    </mesh>
  ))
}

function ProceduralBlock({ block }: { block: ArenaBlock }) {
  return (
    <mesh position={block.position} castShadow receiveShadow userData={{ blocksShot: true }}>
      <boxGeometry args={block.size} />
      <meshStandardMaterial
        color={blockColors[block.kind]}
        roughness={block.kind === 'container' ? 0.65 : 0.92}
        metalness={block.kind === 'container' ? 0.35 : 0.03}
      />
    </mesh>
  )
}

function ImportedBlock({ block }: { block: ArenaBlock }) {
  const config = importedBlocks[block.id]!
  const gltf = useLoader(GLTFLoader, toonAsset(config.file))
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      object.userData = { ...object.userData, blocksShot: true }
    })
    return clone
  }, [gltf.scene])
  const scale: [number, number, number] = [
    block.size[0] / config.sourceSize[0],
    block.size[1] / config.sourceSize[1],
    block.size[2] / config.sourceSize[2],
  ]

  return (
    <group>
      <primitive
        object={model}
        position={[block.position[0], 0, block.position[2]]}
        scale={scale}
      />
      <mesh position={block.position} userData={{ blocksShot: true }}>
        <boxGeometry args={block.size} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  )
}

export function Arena() {
  return (
    <>
      <Suspense fallback={null}><WarehouseEnvironment /></Suspense>
      <color attach="background" args={['#7d8988']} />
      <fog attach="fog" args={['#7d8988', 26, 62]} />
      <ambientLight intensity={0.42} color="#d9e6dc" />
      <directionalLight
        castShadow
        color="#fff4d6"
        intensity={1.65}
        position={[12, 22, 9]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight args={['#c6e2e0', '#303a31', 0.65]} />

      <Suspense fallback={<ProceduralFloor />}><TexturedFloor /></Suspense>

      <Suspense fallback={(
        <>
          <BoundaryWall position={[0, 2.5, -WORLD_LIMIT]} size={[WORLD_LIMIT * 2 + 2, 5, 1]} />
          <BoundaryWall position={[0, 2.5, WORLD_LIMIT]} size={[WORLD_LIMIT * 2 + 2, 5, 1]} />
          <BoundaryWall position={[-WORLD_LIMIT, 2.5, 0]} size={[1, 5, WORLD_LIMIT * 2]} />
          <BoundaryWall position={[WORLD_LIMIT, 2.5, 0]} size={[1, 5, WORLD_LIMIT * 2]} />
        </>
      )}>
        <TexturedBoundaryWalls />
      </Suspense>

      {arenaBlocks.map((block) => importedBlocks[block.id]
        ? (
          <Suspense key={block.id} fallback={<ProceduralBlock block={block} />}>
            <ImportedBlock block={block} />
          </Suspense>
        )
        : <ProceduralBlock key={block.id} block={block} />)}

      {[-18, -6, 6, 18].map((x) => (
        <mesh key={x} position={[x, 3.3, -23.35]}>
          <boxGeometry args={[0.35, 0.35, 0.12]} />
          <meshStandardMaterial emissive="#e2a83d" emissiveIntensity={2} color="#f4ca69" />
          <pointLight color="#ffc45a" intensity={18} distance={7} />
        </mesh>
      ))}
    </>
  )
}
