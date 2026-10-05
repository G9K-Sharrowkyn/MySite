import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three'
import { gameAudio } from '../game/audio'
import {
  BULLET_GRAVITY,
  clearProjectileQueue,
  drainProjectileQueue,
  segmentSphereHitDistance,
  type ProjectileLaunch,
} from '../game/projectiles'
import { type WeaponId, weaponDefinitions, weaponOrder } from '../game/weapons'
import { useGameStore } from '../store/gameStore'

type ActiveProjectile = ProjectileLaunch & {
  position: Vector3
  velocity: Vector3
  distance: number
  mesh: Mesh
  impacted: boolean
  linger: number
}

const tracerAxis = new Vector3(0, 1, 0)
const segmentDirection = new Vector3()
const segmentEnd = new Vector3()
const visualStart = new Vector3()
const visualMidpoint = new Vector3()
const tracerRotation = new Quaternion()

function placeTracer(projectile: ActiveProjectile, from: Vector3, to: Vector3) {
  const weapon = weaponDefinitions[projectile.weaponId]
  segmentDirection.subVectors(to, from)
  const segmentLength = segmentDirection.length()
  if (segmentLength <= 0.0001) return
  segmentDirection.divideScalar(segmentLength)
  const visibleLength = Math.min(segmentLength, weapon.tracerLength)
  visualStart.copy(to).addScaledVector(segmentDirection, -visibleLength)
  visualMidpoint.addVectors(visualStart, to).multiplyScalar(0.5)
  projectile.mesh.position.copy(visualMidpoint)
  tracerRotation.setFromUnitVectors(tracerAxis, segmentDirection)
  projectile.mesh.quaternion.copy(tracerRotation)
  projectile.mesh.scale.set(weapon.tracerWidth, visibleLength, weapon.tracerWidth)
}

export function ProjectileSystem() {
  const group = useRef<Group>(null)
  const active = useRef<ActiveProjectile[]>([])
  const raycaster = useRef(new Raycaster())
  const lastRound = useRef(useGameStore.getState().roundId)
  const { camera, scene } = useThree()
  const geometry = useMemo(() => new CylinderGeometry(1, 1, 1, 6), [])
  const materials = useMemo(() => Object.fromEntries(weaponOrder.map((weaponId) => {
    const material = new MeshBasicMaterial({
      color: weaponDefinitions[weaponId].tracerColor,
      transparent: true,
      opacity: 0.94,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    material.toneMapped = false
    return [weaponId, material]
  })) as Record<WeaponId, MeshBasicMaterial>, [])
  const enemyMaterial = useMemo(() => {
    const material = new MeshBasicMaterial({
      color: '#ff6b3d',
      transparent: true,
      opacity: 0.98,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    material.toneMapped = false
    return material
  }, [])

  const clearActive = () => {
    if (group.current) {
      for (const projectile of active.current) group.current.remove(projectile.mesh)
    }
    active.current = []
    clearProjectileQueue()
  }

  useEffect(() => () => {
    clearActive()
    geometry.dispose()
    for (const material of Object.values(materials)) material.dispose()
    enemyMaterial.dispose()
  }, [enemyMaterial, geometry, materials])

  useFrame((_, delta) => {
    if (!group.current) return
    const state = useGameStore.getState()
    if (state.phase !== 'playing' || state.roundId !== lastRound.current) {
      clearActive()
      lastRound.current = state.roundId
      if (state.phase !== 'playing') return
    }

    for (const launch of drainProjectileQueue()) {
      const weapon = weaponDefinitions[launch.weaponId]
      const mesh = new Mesh(
        geometry,
        launch.owner === 'enemy' ? enemyMaterial : materials[launch.weaponId],
      )
      mesh.frustumCulled = false
      mesh.renderOrder = 2
      mesh.visible = false
      mesh.raycast = () => undefined
      group.current.add(mesh)
      active.current.push({
        ...launch,
        position: launch.origin.clone(),
        velocity: launch.direction.clone().multiplyScalar(weapon.muzzleVelocity),
        distance: 0,
        mesh,
        impacted: false,
        linger: 0,
      })
    }

    const survivors: ActiveProjectile[] = []
    const damageByTarget = new Map<string, { id: number; damage: number; headshot: boolean }>()

    for (const projectile of active.current) {
      if (projectile.impacted) {
        projectile.linger -= delta
        if (projectile.linger > 0) survivors.push(projectile)
        else group.current.remove(projectile.mesh)
        continue
      }

      const weapon = weaponDefinitions[projectile.weaponId]
      const previous = projectile.position.clone()
      projectile.velocity.y -= BULLET_GRAVITY * delta
      segmentEnd.copy(projectile.velocity).multiplyScalar(delta).add(previous)
      segmentDirection.subVectors(segmentEnd, previous)
      const stepDistance = segmentDirection.length()
      if (stepDistance <= 0.0001) {
        survivors.push(projectile)
        continue
      }

      segmentDirection.divideScalar(stepDistance)
      raycaster.current.set(previous, segmentDirection)
      raycaster.current.camera = camera
      raycaster.current.near = 0
      raycaster.current.far = stepDistance
      const hit = raycaster.current.intersectObjects(scene.children, true).find((intersection) => {
        const data = intersection.object.userData
        return projectile.owner === 'player'
          ? data.botId !== undefined || data.blocksShot === true
          : data.blocksShot === true
      })
      const playerHitDistance = projectile.owner === 'enemy'
        ? segmentSphereHitDistance(previous, segmentEnd, camera.position, 0.38)
        : null
      const hitsPlayer = playerHitDistance !== null && (!hit || playerHitDistance < hit.distance)
      const end = hitsPlayer
        ? previous.clone().addScaledVector(segmentDirection, playerHitDistance)
        : hit?.point ?? segmentEnd
      placeTracer(projectile, previous, end)
      projectile.mesh.visible = true
      projectile.position.copy(end)
      projectile.distance += hitsPlayer ? playerHitDistance : hit?.distance ?? stepDistance

      if (hitsPlayer) {
        projectile.impacted = true
        projectile.linger = 0.045
        useGameStore.getState().damagePlayer(projectile.damage ?? 0)
        survivors.push(projectile)
      } else if (hit) {
        projectile.impacted = true
        projectile.linger = 0.045
        const botId = hit.object.userData.botId
        if (botId !== undefined) {
          const id = botId as number
          const headshot = hit.object.userData.hitPart === 'head'
          const key = `${projectile.shotId}:${id}`
          const previousDamage = damageByTarget.get(key) ?? { id, damage: 0, headshot: false }
          damageByTarget.set(key, {
            id,
            damage: previousDamage.damage + (headshot ? weapon.headDamage : weapon.damage),
            headshot: previousDamage.headshot || headshot,
          })
        }
        survivors.push(projectile)
      } else if (projectile.distance < weapon.maxRange) {
        survivors.push(projectile)
      } else {
        group.current.remove(projectile.mesh)
      }
    }

    active.current = survivors
    for (const hit of damageByTarget.values()) {
      useGameStore.getState().hitBot(hit.id, hit.damage, hit.headshot)
    }
    if (damageByTarget.size > 0) gameAudio.hit()
  })

  return <group ref={group} />
}
