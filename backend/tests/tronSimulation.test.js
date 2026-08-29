import {
  TRON_RULES,
  createSimulationPlayer,
  isPointBlocked,
  obstacleSurfaceDistance,
  stepSimulation,
  turnDirection
} from '../realtime/tronSimulation.js';

const makeTrailIds = () => {
  let index = 0;
  return () => `test-${++index}`;
};

const makePlayer = (overrides = {}) => {
  const trails = [];
  const createTrailId = makeTrailIds();
  const player = createSimulationPlayer(
    {
      socketId: overrides.socketId || 'player-1',
      userId: overrides.socketId || 'player-1',
      username: 'Tester',
      color: '#00e5ff',
      wins: 0,
      joinedAt: 1,
      ...overrides
    },
    {
      x: overrides.x ?? 0,
      y: overrides.y ?? 0,
      direction: overrides.direction ?? 0
    },
    createTrailId,
    trails
  );
  return { player, trails, createTrailId };
};

describe('TRON continuous arena simulation', () => {
  test('normal movement keeps a constant speed and extends the light wall', () => {
    const { player, trails, createTrailId } = makePlayer();
    stepSimulation({ players: [player], trailSegments: trails, dt: 0.5, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.speed).toBe(TRON_RULES.baseSpeed);
    expect(player.x).toBeCloseTo(0);
    expect(player.y).toBeCloseTo(-TRON_RULES.baseSpeed * 0.5);
    expect(trails).toHaveLength(1);
    expect(trails[0].y2).toBeCloseTo(-TRON_RULES.baseSpeed * 0.5);
  });

  test('a rider that does not turn before the arena wall crashes', () => {
    const { player, trails, createTrailId } = makePlayer({ y: -35.3, direction: 0 });
    stepSimulation({ players: [player], trailSegments: trails, dt: 0.2, createTrailId });

    expect(player.alive).toBe(false);
    expect(player.wallRiding).toBe(false);
  });

  test('a last-moment turn beside a wall starts wall-riding and adds speed', () => {
    const { player, trails, createTrailId } = makePlayer({ y: -35.25, direction: 0 });
    player.pendingTurn = 'right';

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.5, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.direction).toBe(turnDirection(0, 'right'));
    expect(player.wallRiding).toBe(true);
    expect(player.wallRideSide).toBe('left');
    expect(player.speed).toBeGreaterThan(TRON_RULES.baseSpeed);
    expect(player.x).toBeGreaterThan(4);
    expect(player.y).toBeCloseTo(
      -TRON_RULES.arenaSize / 2 +
        TRON_RULES.visualBikeHalfWidth +
        TRON_RULES.wallRideGap,
      5
    );
  });

  test('turning in open space is safe but does not grant a boost', () => {
    const { player, trails, createTrailId } = makePlayer({ x: 0, y: 0, direction: 0 });
    player.pendingTurn = 'right';

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.25, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.wallRiding).toBe(false);
    expect(player.speed).toBe(TRON_RULES.baseSpeed);
  });

  test('two rapid turns are buffered and executed on consecutive simulation ticks', () => {
    const { player, trails, createTrailId } = makePlayer({ x: 0, y: 0, direction: 0 });
    player.pendingTurns.push('right', 'left');

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.05, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.direction).toBe(turnDirection(0, 'right'));
    expect(player.pendingTurns).toEqual(['left']);

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.05, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.direction).toBe(0);
    expect(player.pendingTurns).toEqual([]);
  });

  test('the same rescue mechanic works beside another player light wall', () => {
    const { player, trails, createTrailId } = makePlayer({ x: -0.85, y: 0, direction: 1 });
    trails.push({
      id: 'enemy-wall-to-ride',
      ownerId: 'player-2',
      color: '#ff4d6d',
      x1: 0,
      y1: -8,
      x2: 0,
      y2: 8
    });
    player.pendingTurn = 'right';

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.25, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.wallRiding).toBe(true);
    expect(player.wallRideSide).toBe('left');
    expect(player.speed).toBeGreaterThan(TRON_RULES.baseSpeed);
    expect(player.x).toBeCloseTo(
      -TRON_RULES.trailHalfWidth -
        TRON_RULES.visualBikeHalfWidth -
        TRON_RULES.wallRideGap,
      5
    );
  });

  test('automatically starts wall-riding while travelling closely beside a light wall', () => {
    const { player, trails, createTrailId } = makePlayer({ x: -0.55, y: 0, direction: 2 });
    trails.push({
      id: 'parallel-enemy-wall',
      ownerId: 'player-2',
      color: '#ff3b4d',
      x1: 0,
      y1: -8,
      x2: 0,
      y2: 8
    });

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.05, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.direction).toBe(2);
    expect(player.wallRiding).toBe(true);
    expect(player.wallRideSide).toBe('left');
    expect(player.speed).toBeGreaterThan(TRON_RULES.baseSpeed);
  });

  test('does not start automatic wall-riding when the parallel wall is too far away', () => {
    const { player, trails, createTrailId } = makePlayer({ x: -1, y: 0, direction: 2 });
    trails.push({
      id: 'distant-parallel-wall',
      ownerId: 'player-2',
      color: '#ff3b4d',
      x1: 0,
      y1: -8,
      x2: 0,
      y2: 8
    });

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.05, createTrailId });

    expect(player.alive).toBe(true);
    expect(player.wallRiding).toBe(false);
    expect(player.speed).toBe(TRON_RULES.baseSpeed);
  });

  test('the visible fairing may touch a trail while the smaller collision core remains safe', () => {
    const { player, trails } = makePlayer({ x: -0.6, y: 0, direction: 2 });
    trails.push({
      id: 'enemy-wall-visual-contact',
      ownerId: 'player-2',
      color: '#ff4d6d',
      x1: 0,
      y1: -5,
      x2: 0,
      y2: 5
    });

    expect(obstacleSurfaceDistance(player, 1, 1, trails)).toBeCloseTo(0.45, 5);
    expect(isPointBlocked(player.x, player.y, player, trails)).toBe(false);
    expect(isPointBlocked(-0.3, player.y, player, trails)).toBe(true);
  });

  test('wall-ride speed decays linearly back to base speed over fifteen seconds', () => {
    const { player, trails, createTrailId } = makePlayer({ direction: 1 });
    player.speed = TRON_RULES.baseSpeed + 4;
    const spaciousRules = { ...TRON_RULES, arenaSize: 1000 };

    stepSimulation({
      players: [player],
      trailSegments: trails,
      dt: spaciousRules.boostDecaySeconds,
      rules: spaciousRules,
      createTrailId
    });

    expect(player.alive).toBe(true);
    expect(player.speed).toBe(spaciousRules.baseSpeed);
    expect(player.boostDecayRemaining).toBe(0);
  });

  test('crossing another player light wall eliminates the rider', () => {
    const { player, trails, createTrailId } = makePlayer({ x: -1.1, y: 0, direction: 1 });
    trails.push({
      id: 'enemy-wall',
      ownerId: 'player-2',
      color: '#ff4d6d',
      x1: 0,
      y1: -5,
      x2: 0,
      y2: 5
    });

    stepSimulation({ players: [player], trailSegments: trails, dt: 0.2, createTrailId });

    expect(player.alive).toBe(false);
  });

  test('two riders crossing head paths in one tick are both eliminated', () => {
    const firstSetup = makePlayer({ socketId: 'first', x: -0.8, y: 0, direction: 1 });
    const secondSetup = makePlayer({ socketId: 'second', x: 0, y: -0.8, direction: 2 });
    const trails = [...firstSetup.trails, ...secondSetup.trails];
    const createTrailId = makeTrailIds();

    stepSimulation({
      players: [firstSetup.player, secondSetup.player],
      trailSegments: trails,
      dt: 0.1,
      createTrailId
    });

    expect(firstSetup.player.alive).toBe(false);
    expect(secondSetup.player.alive).toBe(false);
  });
});
