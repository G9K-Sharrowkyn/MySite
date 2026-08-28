export interface GearDef {
  gear: number;
  minSpeed: number;
  maxSpeed: number;
  acceleration: number;
  endAcceleration: number;
}

export type ShiftQuality = 'perfect' | 'good' | 'early' | 'late' | 'none';
export type SteeringDirection = 'center' | 'left' | 'right';
export type CollisionZone = 'left' | 'center' | 'right';
export type DamagingObstacleType = 'boulder' | 'gate' | 'wall' | 'lowBarrier' | 'mine';

export interface CollisionImpact {
  obstacleType: DamagingObstacleType;
  zone: CollisionZone;
  steering: SteeringDirection;
}

export interface CollisionResolution {
  speedRetention: number;
  immobilized: boolean;
  damage: number;
  cameraShake: number;
  stunDuration: number;
}

export const GEARS: GearDef[] = [
  { gear: 0, minSpeed: 0,   maxSpeed: 0,   acceleration: 0,  endAcceleration: 0   },
  { gear: 1, minSpeed: 0,   maxSpeed: 80,  acceleration: 30, endAcceleration: 18  },
  { gear: 2, minSpeed: 70,  maxSpeed: 145, acceleration: 10, endAcceleration: 7   },
  { gear: 3, minSpeed: 130, maxSpeed: 220, acceleration: 7,  endAcceleration: 5   },
  { gear: 4, minSpeed: 205, maxSpeed: 305, acceleration: 5,  endAcceleration: 3.8 },
  { gear: 5, minSpeed: 290, maxSpeed: 400, acceleration: 4,  endAcceleration: 2.2 },
];

export const WORLD_UNITS_PER_SPEED = 0.08;
export const WORLD_SPEED_CURVE = 0.00011;
export const MAX_SPEED = 400;
export const BOOST_IMPULSE = 15;
export const BOOST_OVERDRIVE_LIMIT = 0;
export const BOOST_DURATION = 0.35;
export const FALSE_START_PENALTY_MS = 700;
export const NATURAL_ACCELERATION_PER_SECOND = 30;
export const TRACK_WIDTH = 7;
export const PLAYER_MODEL_WIDTH = TRACK_WIDTH / 6;
export const PLAYER_HALF_WIDTH = PLAYER_MODEL_WIDTH / 2;
export const FINISH_DECELERATION = 75;
export const LOW_BARRIER_CLEAR_Y = 0.75;
export const COLLISION_REACTION_DURATION = 0.55;
export type CollisionProfileType = 'boost' | 'boulder' | 'gate' | 'wall' | 'lowBarrier' | 'mine';

export const COLLISION_WINDOWS: Record<CollisionProfileType, { minZ: number; maxZ: number }> = {
  boost: { minZ: -1.6, maxZ: 1.6 },
  boulder: { minZ: -1.05, maxZ: 1.05 },
  gate: { minZ: -0.58, maxZ: 0.58 },
  wall: { minZ: -0.38, maxZ: 0.38 },
  lowBarrier: { minZ: -0.36, maxZ: 0.36 },
  mine: { minZ: -0.72, maxZ: 0.72 },
};

// Solid horizontal extents of the procedural meshes.  Decorative warning
// rings, floor projections and lights deliberately do not deal damage.
export const OBSTACLE_HALF_WIDTHS = {
  boost: 1.225,
  boulder: 1.2,
  lowBarrier: 3.075,
  mine: 0.87,
} as const;

export function getShiftProgress(speed: number, gear: number, overRevTimer = 0): number {
  const definition = GEARS[gear];
  if (!definition || gear <= 0) return 0;

  const range = definition.maxSpeed - definition.minSpeed;
  const progress = range > 0
    ? Math.max(0, Math.min(1, (speed - definition.minSpeed) / range))
    : 0;

  return overRevTimer > 0 ? 1 + overRevTimer * 0.5 : progress;
}

export function getShiftQuality(progress: number): ShiftQuality {
  if (progress < 0.8) return 'early';
  if (progress < 0.95) return 'good';
  if (progress <= 1.05) return 'perfect';
  return 'late';
}

export function canShiftGear(speed: number, gear: number): boolean {
  const definition = GEARS[gear];
  if (!definition || gear <= 0 || gear >= GEARS.length - 1) return false;

  const goodShiftSpeed = definition.minSpeed
    + (definition.maxSpeed - definition.minSpeed) * 0.8;
  return speed >= goodShiftSpeed;
}

export function getSpeedAfterShift(speed: number, quality: ShiftQuality): number {
  void quality;
  return speed;
}

export function clampContinuousSpeedIncrease(
  currentSpeed: number,
  proposedSpeed: number,
  dt: number,
  accelerationAllowed = true,
  accelerationPerSecond = NATURAL_ACCELERATION_PER_SECOND,
): number {
  if (proposedSpeed <= currentSpeed) return Math.max(0, proposedSpeed);
  if (!accelerationAllowed) return currentSpeed;
  return Math.min(
    proposedSpeed,
    currentSpeed + Math.max(0, accelerationPerSecond) * Math.max(0, dt),
  );
}

export function getShiftStallDuration(quality: ShiftQuality): number {
  if (quality === 'early') return 1.2;
  if (quality === 'late') return 0.8;
  if (quality === 'good') return 0.2;
  return 0;
}

export function getSpeedAfterBoost(speed: number, gear: number): number {
  void gear;
  return Math.min(speed + BOOST_IMPULSE, MAX_SPEED + BOOST_OVERDRIVE_LIMIT);
}

export function getGearForSpeed(speed: number): number {
  // After an impact, select the lowest gear whose upper range still contains the speed.
  const clamped = Math.max(0, speed);
  return GEARS.slice(1).find((definition) => clamped <= definition.maxSpeed)?.gear ?? 5;
}

export function getCollisionZone(localX: number, collisionHalfWidth: number): CollisionZone {
  const third = collisionHalfWidth / 3;
  if (localX < -third) return 'left';
  if (localX > third) return 'right';
  return 'center';
}

export function resolveCollision(impact: CollisionImpact): CollisionResolution {
  const isFrame = impact.obstacleType === 'gate' || impact.obstacleType === 'wall';
  let speedRetention = 0;

  if (impact.zone === 'center') {
    speedRetention = impact.steering === 'center' ? 0 : 0.5;
  } else {
    const helpfulDirection = isFrame
      ? impact.zone === 'left' ? 'right' : 'left'
      : impact.zone;

    if (impact.steering === 'center') {
      speedRetention = isFrame ? 0 : 1 / 3;
    } else {
      speedRetention = impact.steering === helpfulDirection ? 2 / 3 : 1 / 3;
    }
  }

  const damage = impact.obstacleType === 'mine'
    ? 30
    : impact.obstacleType === 'gate'
      ? 5
      : 15;
  const lostSpeed = 1 - speedRetention;

  return {
    speedRetention,
    immobilized: speedRetention === 0,
    damage,
    cameraShake: Math.min(2, 0.35 + lostSpeed * 1.45 + (impact.obstacleType === 'mine' ? 0.2 : 0)),
    stunDuration: speedRetention === 0 ? 0.28 : impact.obstacleType === 'mine' ? 0.6 : 0.38,
  };
}

export interface CollisionReactionPose {
  x: number;
  y: number;
  z: number;
  roll: number;
  pitch: number;
}

const NO_COLLISION_REACTION: CollisionReactionPose = { x: 0, y: 0, z: 0, roll: 0, pitch: 0 };

export function getCollisionReactionPose(
  remainingTime: number,
  strength: number,
  side: number,
): CollisionReactionPose {
  if (remainingTime <= 0 || strength <= 0) return NO_COLLISION_REACTION;

  const progress = 1 - Math.min(1, remainingTime / COLLISION_REACTION_DURATION);
  if (progress <= 0 || progress >= 1) return NO_COLLISION_REACTION;

  const envelope = (1 - progress) ** 2;
  const power = 0.65 + Math.min(2, strength) * 0.45;
  const longitudinalWave = Math.sin(progress * Math.PI * 4);
  const lateralWave = Math.sin(progress * Math.PI * 10 + Math.PI / 4);
  const impactSide = side < 0 ? -1 : 1;

  return {
    x: impactSide * lateralWave * envelope * power * 0.11,
    y: Math.abs(longitudinalWave) * envelope * power * 0.055,
    z: longitudinalWave * envelope * power * 0.34,
    roll: impactSide * lateralWave * envelope * power * 0.14,
    pitch: -longitudinalWave * envelope * power * 0.075,
  };
}

export function advanceSpeed(speed: number, gear: number, dt: number, _boostActive: boolean): number {
  const definition = GEARS[gear];
  if (!definition) return speed;

  if (speed < definition.maxSpeed) {
    return Math.min(
      definition.maxSpeed,
      speed + getNaturalAcceleration(speed, gear) * dt,
    );
  }

  return speed;
}

export function getNaturalAcceleration(speed: number, gear: number): number {
  const definition = GEARS[gear];
  if (!definition || gear <= 0) return 0;
  const range = Math.max(1, definition.maxSpeed - definition.minSpeed);
  const progress = Math.max(0, Math.min(1, (speed - definition.minSpeed) / range));
  return definition.acceleration
    + (definition.endAcceleration - definition.acceleration) * progress;
}

export function toWorldSpeed(speed: number): number {
  const clamped = Math.max(0, speed);
  return clamped * WORLD_UNITS_PER_SPEED + clamped * clamped * WORLD_SPEED_CURVE;
}

export function getSpeedEffectIntensity(speed: number): number {
  const normalized = Math.max(0, Math.min(1, (speed - 30) / 240));
  return Math.pow(normalized, 1.35);
}

export function getAirParticleIntensity(speed: number): number {
  const normalized = Math.max(0, Math.min(1, (speed - 100) / 170));
  return normalized * normalized * (3 - 2 * normalized);
}

export function getWorldFlowSpeed(speed: number): number {
  return toWorldSpeed(speed) * (1 + getSpeedEffectIntensity(speed));
}

export function advanceFinishSpeed(speed: number, dt: number): number {
  return Math.max(0, speed - FINISH_DECELERATION * dt);
}

export function getTrackObjectZ(objectDistance: number, travelledDistance: number): number {
  return travelledDistance - objectDistance;
}

export function claimTrackEventTrigger(triggered: Set<number>, eventIndex: number): boolean {
  if (triggered.has(eventIndex)) return false;
  triggered.add(eventIndex);
  return true;
}

export function getImpactStopDistance(
  travelledDistance: number,
  objectDistance: number,
  type: CollisionProfileType,
): number {
  return Math.min(travelledDistance, objectDistance + COLLISION_WINDOWS[type].minZ);
}

export function fitsThroughGap(playerX: number, gapX: number, gapWidth: number): boolean {
  const centerClearance = Math.max(0.1, gapWidth / 2 - PLAYER_HALF_WIDTH);
  return Math.abs(gapX - playerX) <= centerClearance;
}

export function overlapsSolidObstacle(
  playerX: number,
  obstacleX: number,
  obstacleHalfWidth: number,
): boolean {
  return Math.abs(playerX - obstacleX) <= obstacleHalfWidth + PLAYER_HALF_WIDTH;
}

export function clearsLowBarrier(playerY: number): boolean {
  return playerY >= LOW_BARRIER_CLEAR_Y;
}

export function getCollisionWindow(type: CollisionProfileType): { minZ: number; maxZ: number } {
  return COLLISION_WINDOWS[type];
}

export function getSteeringConfig(speed: number): { lateralSpeed: number; smoothing: number } {
  void speed;
  return {
    lateralSpeed: 16,
    smoothing: 12,
  };
}

// Used until a real ghost run can provide exact time-at-distance samples.
export function getReferenceTimeMs(progress: number, recordMs: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  return recordMs * Math.pow(clamped, 0.78);
}
