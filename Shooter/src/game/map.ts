export type ArenaBlock = {
  id: string
  position: [number, number, number]
  size: [number, number, number]
  kind: 'wall' | 'crate' | 'container'
}

export const WORLD_LIMIT = 24
export const PLAYER_RADIUS = 0.55

export const arenaBlocks: ArenaBlock[] = [
  { id: 'long-left', position: [-10, 1.8, -6], size: [1.2, 3.6, 15], kind: 'wall' },
  { id: 'long-right', position: [10, 1.8, 7], size: [1.2, 3.6, 14], kind: 'wall' },
  { id: 'mid-a', position: [-3.5, 1.35, 2], size: [5, 2.7, 1.2], kind: 'container' },
  { id: 'mid-b', position: [3.5, 1.35, -4], size: [5, 2.7, 1.2], kind: 'container' },
  { id: 'north-cover', position: [0, 1.1, -14], size: [7, 2.2, 1], kind: 'wall' },
  { id: 'south-crate-a', position: [-7, 0.8, 13], size: [1.6, 1.6, 1.6], kind: 'crate' },
  { id: 'south-crate-b', position: [-4.7, 0.4, 14], size: [1.5, 0.8, 1.1], kind: 'crate' },
  { id: 'east-crate-a', position: [16, 0.8, -3], size: [1.2, 1.6, 1.2], kind: 'crate' },
  { id: 'east-crate-b', position: [17.7, 0.425, -1.6], size: [0.9, 0.85, 0.9], kind: 'crate' },
  { id: 'west-container', position: [-17, 1.15, 5], size: [2.8, 2.3, 1.5], kind: 'container' },
  { id: 'north-pallet', position: [15, 0.15, -16], size: [2.1, 0.3, 1.8], kind: 'crate' },
]

export const botSpawns: [number, number][] = [
  [-17, -16],
  [16, -15],
  [18, 9],
  [-16, 15],
  [1, -19],
]

export function collidesWithArena(x: number, z: number, radius = PLAYER_RADIUS) {
  if (
    x - radius < -WORLD_LIMIT + 0.8 ||
    x + radius > WORLD_LIMIT - 0.8 ||
    z - radius < -WORLD_LIMIT + 0.8 ||
    z + radius > WORLD_LIMIT - 0.8
  ) return true

  return arenaBlocks.some(({ position, size }) => {
    const halfX = size[0] / 2 + radius
    const halfZ = size[2] / 2 + radius
    return Math.abs(x - position[0]) < halfX && Math.abs(z - position[2]) < halfZ
  })
}

export function findArenaMove(
  start: { x: number; z: number },
  desired: { x: number; z: number },
  distance: number,
  radius = 0.48,
  preferredTurn = 1,
) {
  const desiredLength = Math.hypot(desired.x, desired.z)
  if (desiredLength < 0.00001 || distance <= 0) {
    return { x: start.x, z: start.z, moved: false }
  }

  const baseX = desired.x / desiredLength
  const baseZ = desired.z / desiredLength
  const turn = preferredTurn >= 0 ? 1 : -1
  const candidateAngles = [
    0,
    0.48 * turn,
    -0.48 * turn,
    0.95 * turn,
    -0.95 * turn,
    Math.PI / 2 * turn,
  ]

  for (const angle of candidateAngles) {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const directionX = baseX * cosine - baseZ * sine
    const directionZ = baseX * sine + baseZ * cosine
    const x = start.x + directionX * distance
    const z = start.z + directionZ * distance
    if (!collidesWithArena(x, z, radius)) return { x, z, moved: true }
  }

  return { x: start.x, z: start.z, moved: false }
}

function segmentHitsBlock(
  start: { x: number; z: number },
  end: { x: number; z: number },
  block: ArenaBlock,
) {
  const minX = block.position[0] - block.size[0] / 2
  const maxX = block.position[0] + block.size[0] / 2
  const minZ = block.position[2] - block.size[2] / 2
  const maxZ = block.position[2] + block.size[2] / 2
  const dx = end.x - start.x
  const dz = end.z - start.z
  let low = 0
  let high = 1

  for (const [origin, delta, min, max] of [
    [start.x, dx, minX, maxX],
    [start.z, dz, minZ, maxZ],
  ] as const) {
    if (Math.abs(delta) < 0.00001) {
      if (origin < min || origin > max) return false
      continue
    }
    const first = (min - origin) / delta
    const second = (max - origin) / delta
    low = Math.max(low, Math.min(first, second))
    high = Math.min(high, Math.max(first, second))
    if (low > high) return false
  }
  return high > 0.04 && low < 0.96
}

export function hasClearPath(start: { x: number; z: number }, end: { x: number; z: number }) {
  return !arenaBlocks.some((block) => segmentHitsBlock(start, end, block))
}
