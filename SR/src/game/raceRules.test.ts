import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOST_DURATION,
  COLLISION_REACTION_DURATION,
  GEARS,
  advanceSpeed,
  advanceFinishSpeed,
  canShiftGear,
  claimTrackEventTrigger,
  clampContinuousSpeedIncrease,
  clearsLowBarrier,
  fitsThroughGap,
  getAirParticleIntensity,
  getCollisionWindow,
  getCollisionReactionPose,
  getCollisionZone,
  getGearForSpeed,
  getImpactStopDistance,
  getNaturalAcceleration,
  getWorldFlowSpeed,
  getSpeedEffectIntensity,
  getTrackObjectZ,
  getReferenceTimeMs,
  getShiftStallDuration,
  getSteeringConfig,
  getShiftProgress,
  getShiftQuality,
  getSpeedAfterBoost,
  getSpeedAfterShift,
  OBSTACLE_HALF_WIDTHS,
  PLAYER_MODEL_WIDTH,
  TRACK_WIDTH,
  overlapsSolidObstacle,
  resolveCollision,
  toWorldSpeed,
} from './raceRules.ts';
import { TRACKS, sanitizeTrackEvents, useGameStore } from '../store/gameStore.ts';

test('gear changes never lower speed but mistimed shifts stall acceleration', () => {
  assert.equal(getSpeedAfterShift(120, 'early'), 120);
  assert.equal(getSpeedAfterShift(120, 'good'), 120);
  assert.equal(getSpeedAfterShift(120, 'late'), 120);
  assert.equal(getShiftStallDuration('perfect'), 0);
  assert.ok(getShiftStallDuration('early') > getShiftStallDuration('late'));
});

test('frame updates cannot turn stored over-rev time into a speed jump', () => {
  assert.equal(clampContinuousSpeedIncrease(145, 280, 0.05), 146.5);
  assert.equal(clampContinuousSpeedIncrease(145, 280, 0.05, false), 145);
  assert.equal(clampContinuousSpeedIncrease(145, 120, 0.05), 120);

  useGameStore.setState({
    phase: 'racing',
    currentGear: 2,
    speed: 145,
    shiftProgress: 1.8,
    engineStallTimer: 0,
    collisionBlocked: false,
  });
  useGameStore.getState().engageGear();
  assert.equal(useGameStore.getState().currentGear, 3);
  assert.equal(useGameStore.getState().speed, 145);

  useGameStore.getState().updateRace(0.05, 100, 280, 0, 0);
  assert.equal(useGameStore.getState().speed, 145);

  useGameStore.setState({ engineStallTimer: 0 });
  useGameStore.getState().updateRace(0.05, 101, 280, 0, 0);
  assert.ok(Math.abs(useGameStore.getState().speed - 145.33333333333334) < 0.0001);
});

test('shift windows classify their boundary values consistently', () => {
  assert.equal(getShiftQuality(0.79), 'early');
  assert.equal(getShiftQuality(0.8), 'good');
  assert.equal(getShiftQuality(0.95), 'perfect');
  assert.equal(getShiftQuality(1.05), 'perfect');
  assert.equal(getShiftQuality(1.051), 'late');
});

test('shift progress never becomes negative when a gear is engaged too early', () => {
  assert.equal(getShiftProgress(12, 3), 0);
});

test('boost adds one impulse independently of the active gear limiter', () => {
  assert.equal(getSpeedAfterBoost(999, 3), 400);
  assert.equal(getSpeedAfterBoost(120, 3), 135);
  assert.equal(getSpeedAfterBoost(140, 2), 155);
});

test('one boost-pad event can grant its impulse only once', () => {
  const triggered = new Set<number>();
  useGameStore.setState({ phase: 'racing', currentGear: 2, speed: 80, boostActive: false, boostTimer: 0 });

  for (let contactFrame = 0; contactFrame < 12; contactFrame += 1) {
    if (claimTrackEventTrigger(triggered, 17)) useGameStore.getState().registerBoost();
  }

  assert.equal(useGameStore.getState().speed, 95);
  assert.equal(claimTrackEventTrigger(triggered, 17), false);
  assert.equal(claimTrackEventTrigger(triggered, 18), true);
  assert.deepEqual([...triggered], [17, 18]);
});

test('natural acceleration is strongest at launch and declines in later gears', () => {
  assert.ok(Math.abs(advanceSpeed(10, 1, 1, false) - 38.5) < 0.0001);
  assert.ok(Math.abs(advanceSpeed(150, 3, 1, false) - 156.55555555555554) < 0.0001);
  assert.equal(advanceSpeed(150, 3, 1, true), advanceSpeed(150, 3, 1, false));
  assert.equal(advanceSpeed(215, 3, 10, false), 220);
  assert.equal(advanceSpeed(400, 5, 10, false), 400);
  assert.ok(getNaturalAcceleration(10, 1) > getNaturalAcceleration(310, 5) * 7);
  assert.ok(getShiftProgress(216, 3) >= 0.95);
});

test('pace reference reaches the record at the finish and accounts for acceleration', () => {
  const record = 50_000;
  assert.equal(getReferenceTimeMs(0, record), 0);
  assert.equal(getReferenceTimeMs(1, record), record);
  assert.ok(getReferenceTimeMs(0.5, record) > record * 0.5);
});

test('all moving world elements share the same base conversion', () => {
  assert.ok(Math.abs(toWorldSpeed(270) - 29.619) < 0.05);
  assert.ok(toWorldSpeed(270) / toWorldSpeed(20) > 17);
});

test('air particles stay hidden through 100 km/h and then grow rapidly', () => {
  assert.equal(getAirParticleIntensity(0), 0);
  assert.equal(getAirParticleIntensity(50), 0);
  assert.equal(getAirParticleIntensity(100), 0);
  assert.ok(getAirParticleIntensity(150) > 0.15);
  assert.ok(getAirParticleIntensity(200) > 0.6);
  assert.equal(getAirParticleIntensity(270), 1);
});

test('world flow is strong at 400 km/h and shared by every track element', () => {
  const ribSpacing = 8;
  const maxRibsPerSecond = getWorldFlowSpeed(400) / ribSpacing;
  const lowRibsPerSecond = getWorldFlowSpeed(50) / ribSpacing;
  assert.ok(maxRibsPerSecond > 12);
  assert.ok(lowRibsPerSecond < 0.6);
  assert.ok(maxRibsPerSecond / lowRibsPerSecond > 15);
});

test('gap checks include the visible width of the vehicle', () => {
  assert.equal(fitsThroughGap(0, 0, 2.4), true);
  assert.equal(fitsThroughGap(0.8, 0, 2.4), false);
  assert.equal(fitsThroughGap(0.16, 0, 1.5), true);
  assert.equal(fitsThroughGap(0.18, 0, 1.5), false);
});

test('solid obstacle checks exclude decorative effects and include the vehicle hull', () => {
  assert.equal(overlapsSolidObstacle(1.44, 0, OBSTACLE_HALF_WIDTHS.mine), true);
  assert.equal(overlapsSolidObstacle(1.46, 0, OBSTACLE_HALF_WIDTHS.mine), false);
  assert.equal(overlapsSolidObstacle(1.78, 0, OBSTACLE_HALF_WIDTHS.boulder), true);
  assert.equal(overlapsSolidObstacle(1.8, 0, OBSTACLE_HALF_WIDTHS.boulder), false);
});

test('the swoop hull occupies exactly one sixth of the track width', () => {
  assert.ok(Math.abs(PLAYER_MODEL_WIDTH / TRACK_WIDTH - 1 / 6) < Number.EPSILON);
});

test('a small but clear lift is enough to pass over the jump barrier', () => {
  assert.equal(clearsLowBarrier(0.3), false);
  assert.equal(clearsLowBarrier(0.74), false);
  assert.equal(clearsLowBarrier(0.75), true);
  assert.equal(clearsLowBarrier(1.4), true);
});

test('each obstacle uses a front-to-back window matching its solid model', () => {
  assert.deepEqual(getCollisionWindow('boost'), { minZ: -1.6, maxZ: 1.6 });
  assert.deepEqual(getCollisionWindow('boulder'), { minZ: -1.05, maxZ: 1.05 });
  assert.deepEqual(getCollisionWindow('gate'), { minZ: -0.58, maxZ: 0.58 });
  assert.deepEqual(getCollisionWindow('wall'), { minZ: -0.38, maxZ: 0.38 });
  assert.deepEqual(getCollisionWindow('lowBarrier'), { minZ: -0.36, maxZ: 0.36 });
  assert.deepEqual(getCollisionWindow('mine'), { minZ: -0.72, maxZ: 0.72 });
  assert.ok(getCollisionWindow('gate').maxZ < getCollisionWindow('boulder').maxZ);
});

test('a swept collision is clamped to the obstacle front instead of passing through it', () => {
  assert.equal(getImpactStopDistance(105, 100, 'boulder'), 98.95);
  assert.equal(getImpactStopDistance(105, 100, 'gate'), 99.42);
  assert.equal(getImpactStopDistance(105, 100, 'lowBarrier'), 99.64);
  assert.equal(getImpactStopDistance(95, 100, 'wall'), 95);
});

test('collision reaction kicks backward, rebounds, and settles within half a second', () => {
  const atImpact = getCollisionReactionPose(COLLISION_REACTION_DURATION, 2, 1);
  const backwardKick = getCollisionReactionPose(COLLISION_REACTION_DURATION * 0.875, 2, 1);
  const forwardRebound = getCollisionReactionPose(COLLISION_REACTION_DURATION * 0.625, 2, 1);
  const settled = getCollisionReactionPose(0, 2, 1);
  const oppositeSide = getCollisionReactionPose(COLLISION_REACTION_DURATION * 0.875, 2, -1);

  assert.deepEqual(atImpact, { x: 0, y: 0, z: 0, roll: 0, pitch: 0 });
  assert.ok(backwardKick.z > 0.2);
  assert.ok(forwardRebound.z < 0);
  assert.equal(Math.sign(backwardKick.x), -Math.sign(oppositeSide.x));
  assert.equal(Math.sign(backwardKick.roll), -Math.sign(oppositeSide.roll));
  assert.deepEqual(settled, { x: 0, y: 0, z: 0, roll: 0, pitch: 0 });
});

test('fast steering is available at every vehicle speed', () => {
  const low = getSteeringConfig(0);
  const maximum = getSteeringConfig(400);
  assert.deepEqual(low, maximum);
  assert.ok(5.2 / low.lateralSpeed < 0.35);
  assert.ok(5.2 / maximum.lateralSpeed < 0.35);
  assert.ok(low.smoothing >= 12);
});

test('finish coasting reduces speed to a complete stop', () => {
  let speed = 400;
  for (let frame = 0; frame < 400; frame += 1) {
    const nextSpeed = advanceFinishSpeed(speed, 1 / 60);
    assert.ok(nextSpeed <= speed);
    speed = nextSpeed;
  }
  assert.equal(speed, 0);
  assert.equal(getSpeedEffectIntensity(speed), 0);
});

test('track objects exist at fixed world distances from the beginning', () => {
  assert.equal(getTrackObjectZ(280, 0), -280);
  assert.equal(getTrackObjectZ(280, 100), -180);
  assert.equal(getTrackObjectZ(280, 280), 0);
});

test('later tracks repeat the handcrafted Taris grammar with progressively tighter gaps', () => {
  assert.deepEqual(
    Object.values(TRACKS).map((track) => track.length),
    [2650, 4200, 5100, 6000],
  );

  const layouts = useGameStore.getState().trackEvents;
  assert.deepEqual(Object.values(layouts).map((events) => events.length), [73, 121, 152, 183]);
  const taris = layouts.taris;
  const expectedStats = {
    taris: [6, 35, 74],
    tatooine: [5, 34, 73],
    manaan: [4, 33, 72],
    korriban: [3, 32, 71],
  } as const;

  for (const track of Object.values(TRACKS)) {
    const events = layouts[track.id];
    const gaps = events.slice(1).map((event, index) => event.distance - events[index].distance);
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const [minimum, median, maximum] = expectedStats[track.id];
    assert.equal(Math.min(...gaps), minimum);
    assert.equal(sortedGaps[Math.floor(sortedGaps.length / 2)], median);
    assert.equal(Math.max(...gaps), maximum);
    assert.ok(events.at(-1)!.distance < track.length);

    events.forEach((event, index) => {
      const source = taris[index % taris.length];
      assert.equal(event.type, source.type);
      assert.equal(Math.abs(event.x), Math.abs(source.x));
      assert.equal(event.width, source.width);
    });
  }
});

function simulateCleanRun(
  track: (typeof TRACKS)[keyof typeof TRACKS],
  collectBoosts: boolean,
  trace?: {
    shifts: Array<{ gear: number; time: number }>;
    events: Array<{ type: string; time: number }>;
  },
): number {
  const boosts = track.events.filter((event) => event.type === 'boost').map((event) => event.distance);
  const events = track.events;
  const dt = 1 / 240;
  let time = 0;
  let distance = 0;
  let speed = 10;
  let gear = 1;
  let overRev = 0;
  let boostTimer = 0;
  let boostIndex = 0;
  let eventIndex = 0;

  while (distance < track.length && time < 240) {
    const maximum = GEARS[gear].maxSpeed;
    overRev = speed >= maximum ? overRev + dt : 0;
    speed = advanceSpeed(speed, gear, dt, boostTimer > 0);

    const shiftThreshold = collectBoosts ? 0.95 : 0.82;
    if (gear < 5 && getShiftProgress(speed, gear, overRev) >= shiftThreshold) {
      speed = getSpeedAfterShift(speed, collectBoosts ? 'perfect' : 'good');
      gear += 1;
      overRev = 0;
      trace?.shifts.push({ gear, time });
    }

    distance += getWorldFlowSpeed(speed) * dt;
    while (eventIndex < events.length && distance >= events[eventIndex].distance) {
      trace?.events.push({ type: events[eventIndex].type, time });
      eventIndex += 1;
    }
    if (collectBoosts) {
      while (boostIndex < boosts.length && distance >= boosts[boostIndex]) {
        speed = getSpeedAfterBoost(speed, gear);
        boostTimer = BOOST_DURATION;
        boostIndex += 1;
      }
    }
    boostTimer = Math.max(0, boostTimer - dt);
    time += dt;
  }

  return time;
}

test('records require boost pads and remain reachable with a clean racing line', () => {
  for (const track of Object.values(TRACKS)) {
    const authoredTrack = { ...track, events: useGameStore.getState().trackEvents[track.id] };
    const boostedTime = simulateCleanRun(authoredTrack, true);
    const unboostedTime = simulateCleanRun(authoredTrack, false);
    assert.ok(boostedTime * 1000 <= track.record);
    assert.ok(unboostedTime * 1000 > track.record);
    assert.ok(unboostedTime - boostedTime > 6);
  }
});

test('an idealized clean Taris run stays just ahead of the user-calibrated time', () => {
  const track = { ...TRACKS.taris, events: useGameStore.getState().trackEvents.taris };
  const trace = {
    shifts: [] as Array<{ gear: number; time: number }>,
    events: [] as Array<{ type: string; time: number }>,
  };
  const finishTime = simulateCleanRun(track, true, trace);

  assert.ok(Math.abs(finishTime - 42.08) < 0.15);
  assert.deepEqual(
    trace.shifts.map(({ gear }) => gear),
    [2, 3, 4, 5],
  );
  for (const [actual, target] of trace.shifts.map(({ time }) => time).map((time, index) => [time, [3, 7, 13, 21][index]])) {
    assert.ok(Math.abs(actual - target) < 0.25);
  }

  const openingTargets = [
    [true, 3], [false, 4], [true, 6], [true, 7],
    [false, 8], [true, 9], [false, 10],
  ] as const;
  openingTargets.forEach(([isBoost, target], index) => {
    assert.equal(trace.events[index].type === 'boost', isBoost);
    assert.ok(Math.abs(trace.events[index].time - target) < 0.12);
  });
});

test('clicking during countdown records a false start without skipping the countdown', () => {
  useGameStore.setState({ phase: 'countdown', falseStart: false, currentGear: 0, speed: 0 });
  useGameStore.getState().engageGear();
  const state = useGameStore.getState();
  assert.equal(state.phase, 'countdown');
  assert.equal(state.falseStart, true);
  assert.equal(state.currentGear, 0);
});

test('collision zones divide the complete hitbox into equal thirds', () => {
  assert.equal(getCollisionZone(-1, 1.5), 'left');
  assert.equal(getCollisionZone(-0.5, 1.5), 'center');
  assert.equal(getCollisionZone(0, 1.5), 'center');
  assert.equal(getCollisionZone(0.5, 1.5), 'center');
  assert.equal(getCollisionZone(1, 1.5), 'right');
});

test('rock-like obstacles reward steering away from their center', () => {
  assert.equal(resolveCollision({ obstacleType: 'boulder', zone: 'left', steering: 'left' }).speedRetention, 2 / 3);
  assert.equal(resolveCollision({ obstacleType: 'boulder', zone: 'left', steering: 'center' }).speedRetention, 1 / 3);
  assert.equal(resolveCollision({ obstacleType: 'boulder', zone: 'right', steering: 'right' }).speedRetention, 2 / 3);
  assert.equal(resolveCollision({ obstacleType: 'boulder', zone: 'center', steering: 'left' }).speedRetention, 0.5);
  const directHit = resolveCollision({ obstacleType: 'boulder', zone: 'center', steering: 'center' });
  assert.equal(directHit.speedRetention, 0);
  assert.equal(directHit.immobilized, true);
});

test('gate and wall impacts reward steering toward the opening', () => {
  assert.equal(resolveCollision({ obstacleType: 'gate', zone: 'left', steering: 'right' }).speedRetention, 2 / 3);
  assert.equal(resolveCollision({ obstacleType: 'gate', zone: 'left', steering: 'left' }).speedRetention, 1 / 3);
  assert.equal(resolveCollision({ obstacleType: 'gate', zone: 'right', steering: 'left' }).speedRetention, 2 / 3);
  assert.equal(resolveCollision({ obstacleType: 'wall', zone: 'right', steering: 'right' }).speedRetention, 1 / 3);
  assert.equal(resolveCollision({ obstacleType: 'wall', zone: 'right', steering: 'center' }).speedRetention, 0);
});

test('collision speed loss automatically selects the matching lower gear', () => {
  assert.equal(getGearForSpeed(0), 1);
  assert.equal(getGearForSpeed(60), 1);
  assert.equal(getGearForSpeed(80), 1);
  assert.equal(getGearForSpeed(81), 2);
  assert.equal(getGearForSpeed(145), 2);
  assert.equal(getGearForSpeed(146), 3);
  assert.equal(getGearForSpeed(221), 4);
  assert.equal(getGearForSpeed(306), 5);

  useGameStore.setState({ phase: 'racing', currentGear: 4, speed: 180, damage: 0, collisions: 0 });
  useGameStore.getState().registerCollision({ obstacleType: 'boulder', zone: 'left', steering: 'center' });
  const reduced = useGameStore.getState();
  assert.equal(reduced.speed, 60);
  assert.equal(reduced.currentGear, 1);
  assert.equal(reduced.collisions, 1);
  assert.equal(reduced.collisionBlocked, false);

  useGameStore.setState({ phase: 'racing', currentGear: 5, speed: 360, damage: 0, collisions: 0 });
  useGameStore.getState().registerCollision({ obstacleType: 'gate', zone: 'left', steering: 'center' });
  const stopped = useGameStore.getState();
  assert.equal(stopped.speed, 0);
  assert.equal(stopped.currentGear, 1);
  assert.equal(stopped.collisionBlocked, true);
});

test('moderator layouts are validated, saved, and can be restored', () => {
  const canonicalCount = useGameStore.getState().trackEvents.taris.length;
  assert.equal(sanitizeTrackEvents('invalid', TRACKS.taris.length), null);
  assert.equal(useGameStore.getState().saveTrackEvents('taris', [
    { distance: 125.4, type: 'boost', x: 1.2 },
    { distance: 80, type: 'boulder', x: -1.4 },
  ]), true);

  const edited = useGameStore.getState().trackEvents.taris;
  assert.deepEqual(edited.map((event) => event.distance), [80, 125]);
  useGameStore.getState().resetTrackEvents('taris');
  assert.equal(useGameStore.getState().trackEvents.taris.length, canonicalCount);
});

test('false start penalty is carried into the measured race time', () => {
  const signalTime = performance.now();
  useGameStore.setState({
    phase: 'starting',
    falseStart: true,
    countdownStartTime: signalTime,
    currentGear: 0,
    speed: 0,
  });

  useGameStore.getState().engageGear();
  const state = useGameStore.getState();
  assert.equal(state.phase, 'racing');
  assert.equal(state.shiftQuality, 'early');
  assert.ok(performance.now() - state.startTime >= 690);
});

test('a shift is accepted only after reaching the good-speed window', () => {
  assert.equal(canShiftGear(63.99, 1), false);
  assert.equal(canShiftGear(64, 1), true);
  assert.equal(canShiftGear(129.99, 2), false);
  assert.equal(canShiftGear(130, 2), true);
  assert.equal(canShiftGear(400, 5), false);

  useGameStore.setState({
    phase: 'racing',
    currentGear: 1,
    speed: 10,
    shiftProgress: 0,
  });

  for (let click = 0; click < 4; click += 1) {
    useGameStore.getState().engageGear();
  }

  const rejected = useGameStore.getState();
  assert.equal(rejected.currentGear, 1);
  assert.equal(rejected.speed, 10);
  assert.equal(rejected.shiftQuality, 'early');
  assert.equal(rejected.engineStallTimer, 1.2);
});

test('collision-lowered gears cannot be restored by repeated clicks', () => {
  useGameStore.setState({
    phase: 'racing',
    currentGear: 5,
    speed: 300,
    shiftProgress: 1,
    damage: 0,
    collisions: 0,
  });

  useGameStore.getState().registerCollision({ obstacleType: 'boulder', zone: 'left', steering: 'center' });
  assert.equal(useGameStore.getState().speed, 100);
  assert.equal(useGameStore.getState().currentGear, 2);

  for (let click = 0; click < 3; click += 1) {
    useGameStore.getState().engageGear();
  }

  const rejected = useGameStore.getState();
  assert.equal(rejected.currentGear, 2);
  assert.equal(rejected.speed, 100);

  useGameStore.setState({ speed: 130, shiftProgress: getShiftProgress(130, 2), engineStallTimer: 0 });
  useGameStore.getState().engageGear();
  assert.equal(useGameStore.getState().currentGear, 3);

  useGameStore.getState().engageGear();
  assert.equal(useGameStore.getState().currentGear, 3);
});

test('a completed run is submitted only once', () => {
  useGameStore.setState({
    phase: 'finished',
    damage: 0,
    raceTime: 42,
    collisions: 0,
    leaderboard: [],
    scoreSubmitted: false,
  });

  useGameStore.getState().submitScore();
  useGameStore.getState().submitScore();

  const state = useGameStore.getState();
  assert.equal(state.leaderboard.length, 1);
  assert.equal(state.scoreSubmitted, true);
});

test('crossing the finish enters coasting before the final results screen', () => {
  useGameStore.setState({ phase: 'racing', speed: 180, boostActive: true, boostTimer: 0.5 });
  useGameStore.getState().finishRace();
  assert.equal(useGameStore.getState().phase, 'coasting');
  assert.equal(useGameStore.getState().speed, 180);
  assert.equal(useGameStore.getState().boostActive, false);

  useGameStore.getState().completeRace();
  assert.equal(useGameStore.getState().phase, 'finished');
  assert.equal(useGameStore.getState().speed, 0);
});
