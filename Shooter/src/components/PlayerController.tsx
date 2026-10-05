import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import {
  AdditiveBlending,
  Box3,
  Euler,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  SpriteMaterial,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  accuracySpreadPercent,
  CROSSHAIR_RADIUS_PX,
  resolveMovementMode,
} from '../game/accuracy'
import {
  effectTextureAsset,
  fpsTemplateAsset,
  realisticWeaponAsset,
  toonAsset,
} from '../game/assetPaths'
import { gameAudio } from '../game/audio'
import { collidesWithArena } from '../game/map'
import { ballisticDrop, queueProjectile } from '../game/projectiles'
import { getWeaponSpread, type WeaponId, weaponDefinitions } from '../game/weapons'
import { useGameStore } from '../store/gameStore'

const up = new Vector3(0, 1, 0)
const aimTransitionDuration = 0.25
const shotgunPattern: [number, number][] = [
  [0, 0], [-0.7, -0.35], [0.65, -0.42], [-0.42, 0.62],
  [0.46, 0.68], [-0.95, 0.28], [0.95, 0.2], [0.08, -0.92],
]

const weaponHome: Record<WeaponId, [number, number, number]> = {
  pistol: [0.3, -0.34, -1.08],
  rifle: [0.34, -0.25, -0.46],
  shotgun: [0.48, -0.4, -1.45],
}

const weaponAimHome: Record<WeaponId, [number, number, number]> = {
  pistol: [0, -0.13, -0.88],
  rifle: [0.003, -0.107, -0.43],
  shotgun: [0, -0.12, -1.08],
}

const weaponHipRotation: Record<WeaponId, [number, number, number]> = {
  pistol: [0, 0.035, 0],
  rifle: [0, 0.12, 0],
  shotgun: [0, 0.045, 0],
}

function Hands({ long = false }: { long?: boolean }) {
  return (
    <>
      <mesh
        position={[0.03, -0.2, 0.16]}
        rotation={[0.12, 0, -0.03]}
        raycast={() => undefined}
      >
        <capsuleGeometry args={[0.065, 0.22, 4, 8]} />
        <meshStandardMaterial color="#ae8064" roughness={0.92} />
      </mesh>
      {long && (
        <mesh
          position={[0.04, -0.11, -0.05]}
          rotation={[Math.PI / 2, 0, 0.08]}
          raycast={() => undefined}
        >
          <capsuleGeometry args={[0.065, 0.22, 4, 8]} />
          <meshStandardMaterial color="#b4876a" roughness={0.92} />
        </mesh>
      )}
    </>
  )
}

function EmbeddedWeaponModel({
  file,
  scale,
  rotation = [0, 0, 0],
}: {
  file: string
  scale: number
  rotation?: [number, number, number]
}) {
  const gltf = useLoader(GLTFLoader, realisticWeaponAsset(file))
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (!('isMesh' in object) || !object.isMesh) return
      object.castShadow = false
      object.frustumCulled = false
      object.renderOrder = 1000
      object.raycast = () => undefined
      if ('material' in object) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        const cloned = materials.map((material) => {
          const next = material.clone()
          next.transparent = false
          next.opacity = 1
          next.depthTest = true
          next.depthWrite = true
          return next
        })
        object.material = Array.isArray(object.material) ? cloned : cloned[0]
      }
    })
    return clone
  }, [gltf.scene])

  return (
    <primitive
      object={model}
      rotation={rotation}
      scale={scale}
    />
  )
}

function ToonWeaponModel({
  file,
  scale,
  rotation = [0, 0, 0],
}: {
  file: string
  scale: number
  rotation?: [number, number, number]
}) {
  const gltf = useLoader(GLTFLoader, toonAsset(file))
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = false
      object.frustumCulled = false
      object.renderOrder = 1000
      object.raycast = () => undefined
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const cloned = materials.map((material) => {
        const next = material.clone()
        next.transparent = false
        next.opacity = 1
        next.depthTest = true
        next.depthWrite = true
        return next
      })
      object.material = Array.isArray(object.material) ? cloned : cloned[0]
    })
    return clone
  }, [gltf.scene])

  return <primitive object={model} rotation={rotation} scale={scale} />
}

function splitRifleMagazine(model: Group) {
  const source = model.getObjectByName('Magazine')
  if (!(source instanceof Mesh) || !source.geometry.index) return

  const position = source.geometry.attributes.position
  const bodyIndices: number[] = []
  const magazineIndices: number[] = []
  const index = source.geometry.index

  // This downloaded M4 is exported as one mesh. Its magazine is nevertheless
  // a separate connected island of triangles, so isolate the whole island
  // instead of cutting the mesh with a loose coordinate threshold.
  const parents = Array.from({ length: position.count }, (_, vertex) => vertex)
  const find = (vertex: number): number => {
    let root = vertex
    while (parents[root] !== root) root = parents[root]
    while (parents[vertex] !== vertex) {
      const next = parents[vertex]
      parents[vertex] = root
      vertex = next
    }
    return root
  }
  const union = (left: number, right: number) => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
  }

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset)
    const b = index.getX(offset + 1)
    const c = index.getX(offset + 2)
    union(a, b)
    union(a, c)
  }

  const componentBounds = new Map<number, Box3>()
  const vertexPosition = new Vector3()
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const root = find(vertex)
    const bounds = componentBounds.get(root) ?? new Box3()
    bounds.expandByPoint(vertexPosition.fromBufferAttribute(position, vertex))
    componentBounds.set(root, bounds)
  }
  const magazineRoots = new Set(
    [...componentBounds.entries()]
      .filter(([, bounds]) => (
        bounds.min.y < -0.2
        && bounds.min.z > -0.02
        && bounds.max.z < 0.22
      ))
      .map(([root]) => root),
  )
  const sightOccluderRoots = new Set(
    [...componentBounds.entries()]
      .filter(([, bounds]) => (
        bounds.min.x > -0.04
        && bounds.max.x < 0.035
        && bounds.min.y > 0.06
        && bounds.max.y < 0.19
        && bounds.min.z > 0.5
        && bounds.max.z < 0.53
      ))
      .map(([root]) => root),
  )

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset)
    const b = index.getX(offset + 1)
    const c = index.getX(offset + 2)
    if (sightOccluderRoots.has(find(a))) continue
    const target = magazineRoots.has(find(a))
      ? magazineIndices
      : bodyIndices
    target.push(a, b, c)
  }

  if (magazineIndices.length === 0) return
  const bodyGeometry = source.geometry.clone()
  bodyGeometry.setIndex(bodyIndices)
  bodyGeometry.computeBoundingSphere()
  const magazineGeometry = source.geometry.clone()
  magazineGeometry.setIndex(magazineIndices)
  magazineGeometry.computeBoundingSphere()

  const splitRoot = new Group()
  splitRoot.name = 'RifleSplitRoot'
  splitRoot.position.copy(source.position)
  splitRoot.quaternion.copy(source.quaternion)
  splitRoot.scale.copy(source.scale)

  const body = new Mesh(bodyGeometry, source.material)
  body.name = 'RifleBody'
  body.frustumCulled = false
  body.renderOrder = 1000
  const magazineRoot = new Group()
  magazineRoot.name = 'ViewmodelMagazine'
  const magazine = new Mesh(magazineGeometry, source.material)
  magazine.name = 'RifleMagazineMesh'
  magazine.frustumCulled = false
  magazine.renderOrder = 1000
  magazineRoot.add(magazine)
  splitRoot.add(body, magazineRoot)
  source.parent?.add(splitRoot)
  source.parent?.remove(source)
}

function PbrWeaponModel({
  file,
  texturePrefix,
  scale,
  rotation = [0, 0, 0],
}: {
  file: string
  texturePrefix: string
  scale: number
  rotation?: [number, number, number]
}) {
  const gltf = useLoader(GLTFLoader, realisticWeaponAsset(file))
  const [baseColor, normal, roughness, metallic] = useLoader(TextureLoader, [
    realisticWeaponAsset(`${texturePrefix}-basecolor.webp`),
    realisticWeaponAsset(`${texturePrefix}-normal.webp`),
    realisticWeaponAsset(`${texturePrefix}-roughness.webp`),
    realisticWeaponAsset(`${texturePrefix}-metallic.webp`),
  ])
  const model = useMemo(() => {
    baseColor.colorSpace = SRGBColorSpace
    for (const texture of [baseColor, normal, roughness, metallic]) {
      texture.flipY = false
      texture.needsUpdate = true
    }
    const material = new MeshStandardMaterial({
      map: baseColor,
      normalMap: normal,
      roughnessMap: roughness,
      metalnessMap: metallic,
      roughness: 0.78,
      metalness: 0.72,
      depthTest: true,
      depthWrite: true,
    })
    const clone = gltf.scene.clone(true)
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = false
      object.frustumCulled = false
      object.renderOrder = 1000
      object.raycast = () => undefined
      object.material = material
    })
    if (file === 'm4a1.glb') splitRifleMagazine(clone)
    return clone
  }, [baseColor, file, gltf.scene, metallic, normal, roughness])

  return <primitive object={model} rotation={rotation} scale={scale} />
}

function WeaponFallback() {
  return (
    <mesh rotation-y={-Math.PI / 2} raycast={() => undefined}>
      <boxGeometry args={[0.75, 0.18, 0.16]} />
      <meshStandardMaterial color="#283330" metalness={0.7} roughness={0.3} depthTest={false} />
    </mesh>
  )
}

function PistolModel() {
  return (
    <>
      <EmbeddedWeaponModel file="pistol.glb" scale={3.15} />
      <Hands />
    </>
  )
}

function RifleModel() {
  return (
    <>
      <PbrWeaponModel file="m4a1.glb" texturePrefix="m4a1" scale={1.15} />
      <Hands long />
    </>
  )
}

function ShotgunModel() {
  return (
    <>
      <ToonWeaponModel file="shotgun.gltf" scale={0.58} rotation={[0, -Math.PI / 2, 0]} />
      <Hands long />
    </>
  )
}

function Weapon({ muzzle }: { muzzle: RefObject<Group | null> }) {
  const selectedWeapon = useGameStore((state) => state.selectedWeapon)
  const weaponSerial = useGameStore((state) => state.weaponSerial)
  const aiming = useGameStore((state) => state.aiming)
  const group = useRef<Group>(null)
  const { camera, scene } = useThree()
  const lastShot = useRef(0)
  const lastWeapon = useRef(weaponSerial)
  const flashUntil = useRef(0)
  const flashStartedAt = useRef(0)
  const flashMaterial = useRef<SpriteMaterial>(null)
  const aimBlend = useRef(0)
  const reloadProgress = useRef(0)
  const wasReloading = useRef(false)
  const rifleReloadSource = useLoader(
    FBXLoader,
    fpsTemplateAsset('assault-rifle-reload.fbx'),
  )
  const rifleMagazineAnimation = useMemo(() => {
    const clip = rifleReloadSource.animations[0]
    const positionTrack = clip?.tracks.find((track) => track.name === 'Magazine.position')
    const quaternionTrack = clip?.tracks.find((track) => track.name === 'Magazine.quaternion')
    if (!clip || !positionTrack || !quaternionTrack) return null
    const position = positionTrack.InterpolantFactoryMethodLinear()
    const quaternion = quaternionTrack.InterpolantFactoryMethodLinear()
    return {
      duration: clip.duration,
      position,
      quaternion,
      restPosition: Array.from(position.evaluate(0)) as number[],
      inverseRestQuaternion: new Quaternion().fromArray(quaternion.evaluate(0)).invert(),
    }
  }, [rifleReloadSource.animations])
  const flashAtlasSource = useLoader(
    TextureLoader,
    effectTextureAsset('muzzle-flash-cgheven-5x5.webp'),
  )
  const flashAtlas = useMemo(() => {
    const texture = flashAtlasSource.clone()
    texture.colorSpace = SRGBColorSpace
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.repeat.set(1 / 5, 1 / 5)
    texture.offset.set(0, 4 / 5)
    texture.needsUpdate = true
    return texture
  }, [flashAtlasSource])

  useEffect(() => () => flashAtlas.dispose(), [flashAtlas])

  useEffect(() => {
    const weapon = group.current
    if (!weapon) return
    const originalParent = camera.parent
    if (!originalParent) scene.add(camera)
    camera.add(weapon)
    return () => {
      camera.remove(weapon)
      if (!originalParent) scene.remove(camera)
    }
  }, [camera, scene])

  useFrame((state, delta) => {
    if (!group.current || !muzzle.current) return
    const game = useGameStore.getState()
    aimBlend.current = MathUtils.clamp(
      aimBlend.current + (aiming ? 1 : -1) * delta / aimTransitionDuration,
      0,
      1,
    )
    const blend = MathUtils.smootherstep(aimBlend.current, 0, 1)
    const hipHome = weaponHome[selectedWeapon]
    const aimedHome = weaponAimHome[selectedWeapon]
    const homeX = MathUtils.lerp(hipHome[0], aimedHome[0], blend)
    const homeY = MathUtils.lerp(hipHome[1], aimedHome[1], blend)
    const homeZ = MathUtils.lerp(hipHome[2], aimedHome[2], blend)
    if (game.reloading && !wasReloading.current) reloadProgress.current = 0
    if (game.reloading) {
      reloadProgress.current += delta / (weaponDefinitions[selectedWeapon].reloadTime / 1000)
    } else if (wasReloading.current) {
      reloadProgress.current = 1
    }
    wasReloading.current = game.reloading
    const reloadEnvelope = game.reloading
      ? Math.sin(Math.PI * MathUtils.clamp(reloadProgress.current, 0, 1))
      : 0
    const reloadT = MathUtils.clamp(reloadProgress.current, 0, 1)
    const hipRotation = weaponHipRotation[selectedWeapon]
    const rotationX = MathUtils.lerp(hipRotation[0], 0, blend) + reloadEnvelope * 0.04
    const rotationY = MathUtils.lerp(hipRotation[1], 0, blend) - reloadEnvelope * 0.05
    const rotationZ = MathUtils.lerp(hipRotation[2], 0, blend) + reloadEnvelope * 0.14
    const magazine = group.current.getObjectByName('ViewmodelMagazine')
    if (magazine) {
      if (game.reloading && selectedWeapon === 'rifle' && rifleMagazineAnimation) {
        const animationTime = reloadT * rifleMagazineAnimation.duration
        const position = rifleMagazineAnimation.position.evaluate(animationTime)
        const quaternion = rifleMagazineAnimation.quaternion.evaluate(animationTime)
        magazine.position.set(
          (position[0] - rifleMagazineAnimation.restPosition[0]) * 0.018,
          (position[1] - rifleMagazineAnimation.restPosition[1]) * 0.022,
          (position[2] - rifleMagazineAnimation.restPosition[2]) * 0.01,
        )
        magazine.quaternion.set(
          quaternion[0],
          quaternion[1],
          quaternion[2],
          quaternion[3],
        ).premultiply(rifleMagazineAnimation.inverseRestQuaternion)
        magazine.visible = true
      } else {
        magazine.position.set(0, 0, 0)
        magazine.quaternion.identity()
        magazine.visible = true
      }
    }
    if (game.shotSerial !== lastShot.current) {
      lastShot.current = game.shotSerial
      const recoilDistance = selectedWeapon === 'shotgun' ? 0.3 : 0.2
      const recoilRotation = selectedWeapon === 'shotgun' ? 0.14 : 0.08
      group.current.position.z = homeZ + recoilDistance * (aiming ? 0.55 : 1)
      group.current.rotation.x = recoilRotation * (aiming ? 0.65 : 1)
      const flashScale = 0.82 + Math.random() * 0.42
      muzzle.current.scale.set(flashScale, flashScale, flashScale)
      if (flashMaterial.current) flashMaterial.current.rotation = (Math.random() - 0.5) * 0.45
      flashStartedAt.current = state.clock.elapsedTime
      flashUntil.current = state.clock.elapsedTime + 0.105
    }
    if (weaponSerial !== lastWeapon.current) {
      lastWeapon.current = weaponSerial
      group.current.position.y = -0.8
      group.current.rotation.z = 0.28
    }
    group.current.position.x = MathUtils.damp(group.current.position.x, homeX + reloadEnvelope * 0.02, 28, delta)
    group.current.position.y = MathUtils.damp(group.current.position.y, homeY - reloadEnvelope * 0.035, 28, delta)
    group.current.position.z = MathUtils.damp(group.current.position.z, homeZ + reloadEnvelope * 0.02, 28, delta)
    group.current.rotation.x = MathUtils.damp(group.current.rotation.x, rotationX, 17, delta)
    group.current.rotation.y = MathUtils.damp(group.current.rotation.y, rotationY, 17, delta)
    group.current.rotation.z = MathUtils.damp(group.current.rotation.z, rotationZ, 13, delta)
    const flashVisible = state.clock.elapsedTime < flashUntil.current
    if (flashVisible) {
      const progress = MathUtils.clamp(
        (state.clock.elapsedTime - flashStartedAt.current) / 0.105,
        0,
        0.999,
      )
      const frame = Math.min(24, Math.floor(progress * 25))
      flashAtlas.offset.set((frame % 5) / 5, (4 - Math.floor(frame / 5)) / 5)
    }
    muzzle.current.visible = flashVisible
  })

  const muzzleZ = selectedWeapon === 'pistol' ? -0.3 : selectedWeapon === 'rifle' ? -0.62 : -0.56
  return (
    <group
      ref={group}
      position={weaponHome[selectedWeapon]}
      rotation={weaponHipRotation[selectedWeapon]}
      scale={1.08}
    >
      <Suspense fallback={<WeaponFallback />}>
        {selectedWeapon === 'pistol' && <PistolModel />}
        {selectedWeapon === 'rifle' && <RifleModel />}
        {selectedWeapon === 'shotgun' && <ShotgunModel />}
      </Suspense>
      <group ref={muzzle} visible={false} position={[0, 0.055, muzzleZ]}>
        <sprite
          position={[0, 0, 0]}
          scale={selectedWeapon === 'shotgun' ? [0.58, 0.58, 1] : [0.44, 0.44, 1]}
          renderOrder={1200}
          raycast={() => undefined}
        >
          <spriteMaterial
            ref={flashMaterial}
            map={flashAtlas}
            color="#fff4d1"
            transparent
            opacity={1}
            alphaTest={0.015}
            blending={AdditiveBlending}
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        <pointLight color="#ff9b38" intensity={6} distance={3.2} decay={2} />
      </group>
    </group>
  )
}

export function PlayerController() {
  const { camera, gl, scene } = useThree()
  const roundId = useGameStore((state) => state.roundId)
  const keys = useRef(new Set<string>())
  const yaw = useRef(0)
  const pitch = useRef(0)
  const velocityY = useRef(0)
  const grounded = useRef(true)
  const fireReadyAt = useRef(0)
  const raycaster = useRef(new Raycaster())
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'))
  const cameraAimBlend = useRef(0)
  const muzzle = useRef<Group>(null)
  const aimMousePenalty = useRef(0)
  const lastAimMouseMove = useRef(0)

  useEffect(() => {
    camera.position.set(0, 1.7, 18)
    if (camera instanceof PerspectiveCamera) {
      camera.fov = 72
      camera.updateProjectionMatrix()
    }
    cameraAimBlend.current = 0
    yaw.current = 0
    pitch.current = 0
  }, [camera, roundId])

  useEffect(() => {
    const canvas = gl.domElement
    let automaticTimer: number | undefined
    let seriesDecisionTimer: number | undefined
    let triggerHeld = false
    let burstShot = 0
    let lastManualShotAt = Number.NEGATIVE_INFINITY
    let manualBurstShot = 0

    const stopAutomaticFire = () => {
      if (automaticTimer !== undefined) window.clearInterval(automaticTimer)
      automaticTimer = undefined
    }
    const stopFiring = () => {
      triggerHeld = false
      stopAutomaticFire()
      if (seriesDecisionTimer !== undefined) window.clearTimeout(seriesDecisionTimer)
      seriesDecisionTimer = undefined
    }
    const onPointerLock = () => {
      const locked = document.pointerLockElement === canvas
      useGameStore.getState().setPointerLocked(locked)
      if (!locked) stopFiring()
    }
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas || useGameStore.getState().phase !== 'playing') return
      const state = useGameStore.getState()
      const sensitivity = state.aiming ? 0.0015 : 0.0021
      yaw.current -= event.movementX * sensitivity
      pitch.current = MathUtils.clamp(pitch.current - event.movementY * sensitivity, -1.45, 1.45)
      if (state.aiming) {
        const now = performance.now()
        const elapsed = Math.max(8, now - lastAimMouseMove.current)
        const pixelsPerSecond = Math.hypot(event.movementX, event.movementY) / elapsed * 1000
        const penalty = MathUtils.clamp((pixelsPerSecond - 30) / 18, 0, 50)
        aimMousePenalty.current = Math.max(aimMousePenalty.current * 0.65, penalty)
        lastAimMouseMove.current = now
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      keys.current.add(event.code)
      const weaponByKey: Partial<Record<string, WeaponId>> = {
        Digit1: 'pistol', Digit2: 'rifle', Digit3: 'shotgun',
      }
      const weaponId = weaponByKey[event.code]
      if (weaponId) {
        stopFiring()
        const state = useGameStore.getState()
        if (state.selectedWeapon !== weaponId) {
          state.selectWeapon(weaponId)
          gameAudio.equip(weaponId)
        }
      }
      if (event.code === 'AltLeft' || event.code === 'AltRight') event.preventDefault()
      if (event.code === 'KeyR') {
        const state = useGameStore.getState()
        const weapon = weaponDefinitions[state.selectedWeapon]
        if (
          state.phase === 'playing' && !state.reloading &&
          state.magazines[state.selectedWeapon] < weapon.magazineSize &&
          state.reserves[state.selectedWeapon] > 0
        ) {
          state.reload()
          gameAudio.reload(state.selectedWeapon)
        }
      }
      if (event.code === 'Space' && grounded.current) {
        velocityY.current = 5.1
        grounded.current = false
      }
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code)

    const shoot = (shotInSeries = 1, isSeries = false) => {
      if (document.pointerLockElement !== canvas) return
      const now = performance.now()
      if (now < fireReadyAt.current) return
      const store = useGameStore.getState()
      const weapon = weaponDefinitions[store.selectedWeapon]
      if (!store.fire()) {
        fireReadyAt.current = now + 260
        gameAudio.empty()
        stopFiring()
        return
      }
      fireReadyAt.current = now + weapon.fireDelay
      gameAudio.shot(store.selectedWeapon)

      const shotNumber = useGameStore.getState().shotSerial
      const moving = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((code) => keys.current.has(code))
      const movement = resolveMovementMode({
        moving,
        walking: keys.current.has('AltLeft') || keys.current.has('AltRight'),
        sprinting: keys.current.has('ShiftLeft') || keys.current.has('ShiftRight'),
      })
      const mouseAge = now - lastAimMouseMove.current
      const mousePenalty = store.aiming
        ? aimMousePenalty.current * Math.exp(-mouseAge / 140)
        : 0
      const spreadPercent = accuracySpreadPercent({
        aiming: store.aiming,
        movement,
        shotInSeries,
        isSeries,
        mousePenalty,
      })
      const spreadRadiusPx = CROSSHAIR_RADIUS_PX * spreadPercent / 100
      const randomAngle = Math.random() * Math.PI * 2
      const randomRadius = Math.sqrt(Math.random()) * spreadRadiusPx
      const accuracyOffset = new Vector2(
        Math.cos(randomAngle) * randomRadius * 2 / Math.max(1, canvas.clientWidth),
        Math.sin(randomAngle) * randomRadius * 2 / Math.max(1, canvas.clientHeight),
      )
      const intrinsicSpread = getWeaponSpread(weapon, store.aiming)
      const pattern: [number, number][] = weapon.pellets > 1
        ? shotgunPattern.slice(0, weapon.pellets)
        : [[0, 0]]

      for (const [offsetX, offsetY] of pattern) {
        const aim = new Vector2(
          accuracyOffset.x + offsetX * intrinsicSpread,
          accuracyOffset.y + offsetY * intrinsicSpread,
        )
        raycaster.current.setFromCamera(aim, camera)
        const origin = muzzle.current?.getWorldPosition(new Vector3())
          ?? camera.position.clone()
        const aimHit = raycaster.current.intersectObjects(scene.children, true).find((intersection) => {
          const data = intersection.object.userData
          return data.botId !== undefined || data.blocksShot === true
        })
        const target = aimHit?.point.clone()
          ?? raycaster.current.ray.at(weapon.maxRange, new Vector3())
        target.y += ballisticDrop(origin.distanceTo(target), weapon.muzzleVelocity)
        queueProjectile({
          shotId: shotNumber,
          weaponId: store.selectedWeapon,
          owner: 'player',
          origin,
          direction: target.sub(origin).normalize(),
        })
      }
    }

    const onMouseDown = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return
      if (event.button === 2) {
        event.preventDefault()
        aimMousePenalty.current = 0
        lastAimMouseMove.current = performance.now()
        useGameStore.getState().setAiming(true)
        return
      }
      if (event.button !== 0 || triggerHeld) return
      triggerHeld = true
      const weapon = weaponDefinitions[useGameStore.getState().selectedWeapon]
      if (weapon.automatic) {
        burstShot = 0
        seriesDecisionTimer = window.setTimeout(() => {
          seriesDecisionTimer = undefined
          if (!triggerHeld) return
          burstShot = 1
          shoot(burstShot, true)
          automaticTimer = window.setInterval(() => {
            if (!triggerHeld) return
            burstShot += 1
            shoot(burstShot, true)
          }, weapon.fireDelay)
        }, 90)
      } else {
        const now = performance.now()
        const isSeries = now - lastManualShotAt < 320
        manualBurstShot = isSeries ? manualBurstShot + 1 : 1
        lastManualShotAt = now
        shoot(manualBurstShot, isSeries)
      }
    }
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        const fireSingle = triggerHeld && seriesDecisionTimer !== undefined
        if (seriesDecisionTimer !== undefined) window.clearTimeout(seriesDecisionTimer)
        seriesDecisionTimer = undefined
        triggerHeld = false
        stopAutomaticFire()
        if (fireSingle) shoot(1, false)
      }
      if (event.button === 2) {
        aimMousePenalty.current = 0
        useGameStore.getState().setAiming(false)
      }
    }
    const onContextMenu = (event: MouseEvent) => event.preventDefault()

    document.addEventListener('pointerlockchange', onPointerLock)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      stopFiring()
      document.removeEventListener('pointerlockchange', onPointerLock)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, gl, scene])

  useFrame((_, delta) => {
    const game = useGameStore.getState()
    euler.current.set(pitch.current, yaw.current, 0)
    camera.quaternion.setFromEuler(euler.current)
    if (camera instanceof PerspectiveCamera) {
      cameraAimBlend.current = MathUtils.clamp(
        cameraAimBlend.current + (game.aiming ? 1 : -1) * delta / aimTransitionDuration,
        0,
        1,
      )
      const blend = MathUtils.smootherstep(cameraAimBlend.current, 0, 1)
      const nextFov = MathUtils.lerp(72, 56, blend)
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov
        camera.updateProjectionMatrix()
      }
    }
    if (game.phase !== 'playing' || !game.pointerLocked) return
    game.tick(Math.min(delta, 0.05))

    const forwardInput = Number(keys.current.has('KeyW')) - Number(keys.current.has('KeyS'))
    const sideInput = Number(keys.current.has('KeyD')) - Number(keys.current.has('KeyA'))
    const length = Math.hypot(forwardInput, sideInput) || 1
    const forward = new Vector3(0, 0, -1).applyAxisAngle(up, yaw.current)
    const right = new Vector3(1, 0, 0).applyAxisAngle(up, yaw.current)
    const sprinting = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')
    const walking = keys.current.has('AltLeft') || keys.current.has('AltRight')
    const movementSpeed = sprinting ? 7.4 : walking ? 2.8 : 5.25
    const move = forward.multiplyScalar(forwardInput / length)
      .add(right.multiplyScalar(sideInput / length))
      .multiplyScalar(movementSpeed * delta)

    if (!collidesWithArena(camera.position.x + move.x, camera.position.z)) camera.position.x += move.x
    if (!collidesWithArena(camera.position.x, camera.position.z + move.z)) camera.position.z += move.z

    velocityY.current -= 13.5 * delta
    camera.position.y += velocityY.current * delta
    if (camera.position.y <= 1.7) {
      camera.position.y = 1.7
      velocityY.current = 0
      grounded.current = true
    }
  })

  return <Weapon muzzle={muzzle} />
}
