import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  AnimationMixer,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { toonAsset } from '../game/assetPaths'
import { gameAudio } from '../game/audio'
import { findArenaMove, hasClearPath } from '../game/map'
import { queueProjectile } from '../game/projectiles'
import { useGameStore } from '../store/gameStore'

const hiddenWeaponNames = [
  'GrenadeLauncher', 'Knife_1', 'Knife_2', 'Pistol', 'Revolver', 'Revolver_Small',
  'RocketLauncher', 'ShortCannon', 'Shotgun', 'Shovel', 'SMG', 'Sniper', 'Sniper_2',
]

let enemyShotSerial = 0

export function Bot({ id }: { id: number }) {
  const bot = useGameStore((state) => state.bots[id])
  const phase = useGameStore((state) => state.phase)
  const pointerLocked = useGameStore((state) => state.pointerLocked)
  const roundId = useGameStore((state) => state.roundId)
  const gltf = useLoader(GLTFLoader, toonAsset('enemy.gltf'))
  const { model, muzzleAnchor, muzzleFlash } = useMemo(() => {
    const enemy = cloneSkeleton(gltf.scene)
    for (const name of hiddenWeaponNames) {
      enemy.getObjectByName(name)?.traverse((object) => {
        object.visible = false
        object.layers.set(2)
      })
    }
    enemy.traverse((object) => {
      if (!(object instanceof Mesh) || object.layers.mask !== 1) return
      object.castShadow = true
      object.receiveShadow = true
      object.userData = {
        ...object.userData,
        botId: id,
        hitPart: object.name.toLowerCase().includes('head') ? 'head' : 'body',
      }
    })
    const anchor = new Group()
    anchor.name = 'EnemyMuzzle'
    anchor.position.set(2.48, 0.584, 0)
    const flash = new Mesh(
      new ConeGeometry(0.13, 0.42, 7, 1, true),
      new MeshBasicMaterial({
        color: '#ffad42',
        transparent: true,
        opacity: 0.96,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    flash.position.x = 0.18
    flash.rotation.z = -Math.PI / 2
    flash.visible = false
    flash.frustumCulled = false
    anchor.add(flash)
    enemy.getObjectByName('AK')?.add(anchor)
    return { model: enemy, muzzleAnchor: anchor, muzzleFlash: flash }
  }, [gltf.scene, id])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const group = useRef<Group>(null)
  const nextShot = useRef(1.2 + id * 0.27)
  const activeAnimation = useRef('')
  const lastHealth = useRef(bot.health)
  const hitReactionLeft = useRef(0)
  const muzzleFlashUntil = useRef(0)
  const { camera } = useThree()
  const position = useRef(new Vector3(bot.spawn[0], 0, bot.spawn[1]))

  const playAnimation = (name: string) => {
    if (activeAnimation.current === name) return
    const clip = gltf.animations.find((animation) => animation.name === name)
    if (!clip) return
    const previous = activeAnimation.current
      ? mixer.clipAction(gltf.animations.find((animation) => animation.name === activeAnimation.current)!)
      : null
    previous?.fadeOut(0.14)
    mixer.clipAction(clip).reset().fadeIn(0.14).play()
    activeAnimation.current = name
  }

  useEffect(() => {
    position.current.set(bot.spawn[0], 0, bot.spawn[1])
    nextShot.current = 1 + id * 0.23
    lastHealth.current = bot.health
    hitReactionLeft.current = 0
    playAnimation('Idle_Shoot')
    return () => {
      mixer.stopAllAction()
    }
  }, [bot.spawn, id, mixer, roundId])

  useEffect(() => () => {
    muzzleFlash.geometry.dispose()
    ;(muzzleFlash.material as MeshBasicMaterial).dispose()
  }, [muzzleFlash])

  useFrame((state, delta) => {
    if (!group.current) return
    muzzleFlash.visible = state.clock.elapsedTime < muzzleFlashUntil.current
    if (!bot.alive || phase !== 'playing' || !pointerLocked) return
    const player = camera.position
    const current = position.current
    const dx = player.x - current.x
    const dz = player.z - current.z
    const distance = Math.hypot(dx, dz)
    const directionX = distance > 0 ? dx / distance : 0
    const directionZ = distance > 0 ? dz / distance : 0
    const strafe = Math.sin(state.clock.elapsedTime * 1.35 + id * 1.9) * 0.52
    let moving = false

    if (distance > 7 && distance < 27) {
      const move = findArenaMove(
        { x: current.x, z: current.z },
        {
          x: directionX - directionZ * strafe,
          z: directionZ + directionX * strafe,
        },
        2.55 * delta,
        0.48,
        id % 2 === 0 ? 1 : -1,
      )
      current.set(move.x, 0, move.z)
      moving = move.moved
    }

    if (bot.health < lastHealth.current) {
      hitReactionLeft.current = 0.28
      playAnimation('HitReact')
    }
    lastHealth.current = bot.health
    hitReactionLeft.current = Math.max(0, hitReactionLeft.current - delta)
    if (hitReactionLeft.current === 0) playAnimation(moving ? 'Run_Shoot' : 'Idle_Shoot')
    mixer.update(delta)

    group.current.position.copy(current)
    group.current.rotation.y = Math.atan2(dx, dz)

    nextShot.current -= delta
    if (
      nextShot.current <= 0 &&
      distance < 22 &&
      hasClearPath({ x: current.x, z: current.z }, { x: player.x, z: player.z })
    ) {
      const damage = 5 + (id % 3)
      const origin = muzzleAnchor.getWorldPosition(new Vector3())
      const target = player.clone()
      target.y -= 0.18
      queueProjectile({
        shotId: --enemyShotSerial,
        weaponId: 'rifle',
        owner: 'enemy',
        damage,
        origin,
        direction: target.sub(origin).normalize(),
      })
      gameAudio.enemyShot()
      const flashScale = 0.82 + Math.random() * 0.36
      muzzleFlash.scale.set(flashScale, flashScale, flashScale)
      muzzleFlash.rotation.x = Math.random() * Math.PI * 2
      muzzleFlashUntil.current = state.clock.elapsedTime + 0.06
      nextShot.current = 1.05 + id * 0.1
    }
  })

  if (!bot.alive) return null

  return (
    <group ref={group} position={[bot.spawn[0], 0, bot.spawn[1]]}>
      <primitive object={model} scale={0.82} rotation-y={Math.PI} />
      <mesh position={[0, 2.14, 0]} rotation-y={Math.PI}>
        <planeGeometry args={[0.85 * (bot.health / 100), 0.075]} />
        <meshBasicMaterial color={bot.health > 45 ? '#c9e36c' : '#e65b45'} depthTest={false} />
      </mesh>
    </group>
  )
}
