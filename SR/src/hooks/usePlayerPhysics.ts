import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInput } from './useInput';
import { TRACKS, useGameStore } from '../store/gameStore';
import { COLLISION_REACTION_DURATION, GEARS, advanceFinishSpeed, advanceSpeed, getImpactStopDistance, getShiftProgress, getSteeringConfig, getWorldFlowSpeed } from '../game/raceRules';
import type { CollisionImpact, SteeringDirection } from '../game/raceRules';

const GROUND_Y       = 0.3;
const GRAVITY        = 22;
const JUMP_FORCE     = 9;
const JUMP_COOLDOWN  = 0.7;
const MAX_X          = 2.6;
const STUN_DURATION  = 0.5;
const COLLISION_ESCAPE_DISTANCE = 0.4;

export interface PlayerPhysics {
  position: THREE.Vector3;
  targetX: number;
  verticalVelocity: number;
  isGrounded: boolean;
  jumpCooldown: number;
  speed: number;
  stunTimer: number;
  travelledDistance: number;
  direction: 'center' | 'left' | 'right';
  steeringInput: SteeringDirection;
  overRevTimer: number;
  collisionBlocked: boolean;
  collisionBlockX: number;
  impactTimer: number;
  impactStrength: number;
  impactSide: number;
}

export function usePlayerPhysics() {
  const input = useInput();

  const stateRef = useRef<PlayerPhysics>({
    position: new THREE.Vector3(0, GROUND_Y, 0),
    targetX: 0,
    verticalVelocity: 0,
    isGrounded: true,
    jumpCooldown: 0,
    speed: 0,
    stunTimer: 0,
    travelledDistance: 0,
    direction: 'center',
    steeringInput: 'center',
    overRevTimer: 0,
    collisionBlocked: false,
    collisionBlockX: 0,
    impactTimer: 0,
    impactStrength: 0,
    impactSide: 1,
  });

  const prevJump = useRef(false);
  const previousGear = useRef(0);
  const solidContactRef = useRef(false);

  // Reset on phase change to 'starting'
  const phase = useGameStore((s) => s.phase);
  useEffect(() => {
    if (phase === 'starting') {
      const s = stateRef.current;
      s.position.set(0, GROUND_Y, 0);
      s.targetX = 0;
      s.verticalVelocity = 0;
      s.isGrounded = true;
      s.jumpCooldown = 0;
      s.speed = 0;
      s.stunTimer = 0;
      s.travelledDistance = 0;
      s.direction = 'center';
      s.steeringInput = 'center';
      s.overRevTimer = 0;
      s.collisionBlocked = false;
      s.collisionBlockX = 0;
      s.impactTimer = 0;
      s.impactStrength = 0;
      s.impactSide = 1;
      previousGear.current = 0;
      solidContactRef.current = false;
    }
  }, [phase]);

  useFrame((_, dt) => {
    const store = useGameStore.getState();
    if (store.phase !== 'racing' && store.phase !== 'coasting') return;

    const s   = stateRef.current;
    const cdt = Math.min(dt, 0.05);
    const inp = input.current;
    s.impactTimer = Math.max(0, s.impactTimer - cdt);
    s.steeringInput = inp.left === inp.right ? 'center' : inp.left ? 'left' : 'right';

    if (store.phase === 'coasting') {
      s.speed = advanceFinishSpeed(store.speed, cdt);
      s.travelledDistance += getWorldFlowSpeed(s.speed) * cdt;
      s.verticalVelocity -= GRAVITY * cdt;
      s.position.y += s.verticalVelocity * cdt;
      if (s.position.y <= GROUND_Y) {
        s.position.y = GROUND_Y;
        s.verticalVelocity = 0;
        s.isGrounded = true;
      }
      store.updateCoasting(cdt, s.travelledDistance, s.speed);
      if (s.speed <= 0) store.completeRace();
      return;
    }

    // Tick shift quality label
    store.tickShiftQuality(cdt);

    // A hit suppresses acceleration briefly, but steering and jumping remain
    // active so the vehicle can physically clear the obstacle.
    let isStunned = false;
    if (s.stunTimer > 0) {
      s.stunTimer -= cdt;
      s.speed = store.speed; // sync from store (collision may have reduced it)
      isStunned = true;
    }

    // Steering stays active at zero speed. A fully stopped vehicle must first
    // move sideways away from the impact point before acceleration is restored.
    const { lateralSpeed: currentSteerSpeed, smoothing: currentSteerSmooth } = getSteeringConfig(s.speed);
    if (inp.left)  s.targetX -= currentSteerSpeed * cdt;
    if (inp.right) s.targetX += currentSteerSpeed * cdt;
    s.targetX = THREE.MathUtils.clamp(s.targetX, -MAX_X, MAX_X);
    s.position.x = THREE.MathUtils.lerp(s.position.x, s.targetX, currentSteerSmooth * cdt);

    const dx = s.targetX - s.position.x;
    s.direction = dx < -0.08 ? 'left' : dx > 0.08 ? 'right' : 'center';

    // Jump before resolving a solid block, otherwise a vehicle that clipped a
    // low barrier could never lift itself clear of it.
    if (s.jumpCooldown > 0) s.jumpCooldown -= cdt;
    const jumpPressed = inp.jump;
    if (jumpPressed && !prevJump.current && s.isGrounded && s.jumpCooldown <= 0) {
      s.verticalVelocity = JUMP_FORCE;
      s.isGrounded = false;
      s.jumpCooldown = JUMP_COOLDOWN;
    }
    prevJump.current = jumpPressed;

    s.verticalVelocity -= GRAVITY * cdt;
    s.position.y += s.verticalVelocity * cdt;
    if (s.position.y <= GROUND_Y) {
      s.position.y = GROUND_Y;
      s.verticalVelocity = 0;
      s.isGrounded = true;
    }

    if (s.collisionBlocked) {
      const hasEscapeInput = s.steeringInput !== 'center';
      if (!solidContactRef.current || (hasEscapeInput && Math.abs(s.position.x - s.collisionBlockX) >= COLLISION_ESCAPE_DISTANCE)) {
        s.collisionBlocked = false;
        store.setCollisionBlocked(false);
      } else {
        s.speed = 0;
        store.updateRace(cdt, s.travelledDistance, 0, getShiftProgress(0, store.currentGear), s.jumpCooldown);
        return;
      }
    }

    // ── Gear-based automatic acceleration ─────────────────────────────────────
    const gear    = store.currentGear;
    const gearDef = GEARS[gear];

    if (gear !== previousGear.current) {
      s.overRevTimer = 0;
      previousGear.current = gear;
    }

    // Sync speed from store (in case of collision/boost applied externally)
    s.speed = store.speed;

    if (s.speed < gearDef.maxSpeed) {
      s.overRevTimer = 0;
    } else if (gear > 0) {
      s.overRevTimer += cdt;
    }
    if (!isStunned && !solidContactRef.current && store.engineStallTimer <= 0) {
      s.speed = advanceSpeed(s.speed, gear, cdt, store.boostActive);
    }

    // ── Shift progress ─────────────────────────────────────────────────────────
    // Fill based on fraction (speed / maxSpeed of current gear)
    const shiftProgress = getShiftProgress(s.speed, gear, s.overRevTimer);

    // ── Distance ──────────────────────────────────────────────────────────────
    if (!solidContactRef.current) {
      s.travelledDistance += getWorldFlowSpeed(s.speed) * cdt;
    }
    const track = useGameStore.getState().selectedTrack;
    const trackDef = TRACKS[track];
    if (s.travelledDistance >= trackDef.length) {
      s.travelledDistance = trackDef.length;
      store.updateRace(cdt, s.travelledDistance, s.speed, shiftProgress, s.jumpCooldown);
      store.finishRace();
      return;
    }

    // ── Steering ──────────────────────────────────────────────────────────────
    // ── Jump ──────────────────────────────────────────────────────────────────
    // ── Sync to store ─────────────────────────────────────────────────────────
    store.updateRace(cdt, s.travelledDistance, s.speed, shiftProgress, s.jumpCooldown);
  });

  const triggerCollision = (impact: Omit<CollisionImpact, 'steering'>, obstacleDistance: number) => {
    const s = stateRef.current;
    s.travelledDistance = getImpactStopDistance(s.travelledDistance, obstacleDistance, impact.obstacleType);
    solidContactRef.current = true;
    const resolution = useGameStore.getState().registerCollision({
      ...impact,
      steering: s.steeringInput,
    });
    s.speed = useGameStore.getState().speed;
    s.stunTimer = Math.max(STUN_DURATION, resolution.stunDuration);
    s.impactTimer = COLLISION_REACTION_DURATION;
    s.impactStrength = resolution.cameraShake;
    s.impactSide = impact.zone === 'left'
      ? 1
      : impact.zone === 'right'
        ? -1
        : s.steeringInput === 'left' ? 1 : -1;
    if (resolution.immobilized) {
      s.collisionBlocked = true;
      s.collisionBlockX = s.position.x;
      s.targetX = s.position.x;
    }
  };

  const triggerBoost = () => {
    useGameStore.getState().registerBoost();
  };

  return { stateRef, solidContactRef, triggerCollision, triggerBoost };
}
