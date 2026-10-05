export type MovementMode = 'standing' | 'walking' | 'running' | 'sprinting'

export const CROSSHAIR_RADIUS_PX = 13
export const SINGLE_SHOT_JITTER_PERCENT = 1
export const HIP_FIRE_PENALTY = 50

export const movementPenalty: Record<MovementMode, number> = {
  standing: 0,
  walking: 5,
  running: 30,
  sprinting: 60,
}

export function resolveMovementMode({
  moving,
  walking,
  sprinting,
}: {
  moving: boolean
  walking: boolean
  sprinting: boolean
}): MovementMode {
  if (!moving) return 'standing'
  if (sprinting) return 'sprinting'
  if (walking) return 'walking'
  return 'running'
}

export function seriesPenalty(shotInSeries: number, isSeries: boolean) {
  if (!isSeries) return 0
  if (shotInSeries <= 2) return 7
  if (shotInSeries <= 3) return 14
  if (shotInSeries <= 5) return 30
  if (shotInSeries <= 10) return 44
  return 58
}

export function accuracySpreadPercent({
  aiming,
  movement,
  shotInSeries,
  isSeries,
  mousePenalty,
}: {
  aiming: boolean
  movement: MovementMode
  shotInSeries: number
  isSeries: boolean
  mousePenalty: number
}) {
  const penalty =
    (aiming ? 0 : HIP_FIRE_PENALTY) +
    movementPenalty[movement] +
    seriesPenalty(shotInSeries, isSeries) +
    Math.max(0, mousePenalty)

  return Math.min(100, SINGLE_SHOT_JITTER_PERCENT + penalty)
}
