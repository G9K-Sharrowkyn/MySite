import { Vector3 } from 'three'
import type { WeaponId } from './weapons'

export const BULLET_GRAVITY = 9.81

export type ProjectileLaunch = {
  shotId: number
  weaponId: WeaponId
  owner: 'player' | 'enemy'
  damage?: number
  origin: Vector3
  direction: Vector3
}

const pendingProjectiles: ProjectileLaunch[] = []

export function queueProjectile(launch: ProjectileLaunch) {
  pendingProjectiles.push({
    ...launch,
    origin: launch.origin.clone(),
    direction: launch.direction.clone().normalize(),
  })
}

export function drainProjectileQueue() {
  return pendingProjectiles.splice(0)
}

export function clearProjectileQueue() {
  pendingProjectiles.length = 0
}

export function ballisticDrop(distance: number, muzzleVelocity: number) {
  const flightTime = distance / muzzleVelocity
  return 0.5 * BULLET_GRAVITY * flightTime * flightTime
}

export function segmentSphereHitDistance(
  start: Vector3,
  end: Vector3,
  center: Vector3,
  radius: number,
) {
  const segment = end.clone().sub(start)
  const length = segment.length()
  if (length < 0.00001) return null

  const direction = segment.divideScalar(length)
  const toCenter = center.clone().sub(start)
  const projection = Math.min(length, Math.max(0, toCenter.dot(direction)))
  const closest = start.clone().addScaledVector(direction, projection)
  const distanceSquared = closest.distanceToSquared(center)
  const radiusSquared = radius * radius
  if (distanceSquared > radiusSquared) return null

  const halfChord = Math.sqrt(Math.max(0, radiusSquared - distanceSquared))
  return Math.min(length, Math.max(0, projection - halfChord))
}
