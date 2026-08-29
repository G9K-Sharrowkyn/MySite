export const TRON_RULES = Object.freeze({
  arenaSize: 72,
  tickMs: 50,
  // The collision core is deliberately smaller than the visible light cycle.
  // This lets the fairing visually skim a wall without causing a false crash.
  bikeRadius: 0.18,
  visualBikeHalfWidth: 0.35,
  trailHalfWidth: 0.15,
  baseSpeed: 12,
  maxSpeed: 20,
  wallRideAcceleration: 1.55,
  wallRideTurnWindow: 0.9,
  wallRideAutoAcquireDistance: 0.46,
  wallRideGap: 0.02,
  wallRideReleaseDistance: 0.72,
  boostDecaySeconds: 15,
  tailGraceDistance: 1.05
});

const DIRECTIONS = [
  { x: 0, y: -1, name: 'up' },
  { x: 1, y: 0, name: 'right' },
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const normalizeDirection = (value) => {
  if (Number.isInteger(value)) return ((value % 4) + 4) % 4;
  const index = DIRECTIONS.findIndex((entry) => entry.name === String(value || '').toLowerCase());
  return index >= 0 ? index : 0;
};

export const getDirectionName = (value) => DIRECTIONS[normalizeDirection(value)].name;

export const turnDirection = (direction, turn) => {
  const delta = turn === 'left' || turn === -1 ? -1 : 1;
  return normalizeDirection(normalizeDirection(direction) + delta);
};

export const squaredDistanceToSegment = (px, py, segment) => {
  const vx = segment.x2 - segment.x1;
  const vy = segment.y2 - segment.y1;
  const wx = px - segment.x1;
  const wy = py - segment.y1;
  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared <= 0.000001) {
    return wx * wx + wy * wy;
  }
  const projection = clamp((wx * vx + wy * vy) / lengthSquared, 0, 1);
  const dx = px - (segment.x1 + projection * vx);
  const dy = py - (segment.y1 + projection * vy);
  return dx * dx + dy * dy;
};

const pointNearSegmentEnd = (x, y, segment, maxDistance) => {
  const maxDistanceSquared = maxDistance * maxDistance;
  const startDx = x - segment.x1;
  const startDy = y - segment.y1;
  const endDx = x - segment.x2;
  const endDy = y - segment.y2;
  return (
    startDx * startDx + startDy * startDy <= maxDistanceSquared ||
    endDx * endDx + endDy * endDy <= maxDistanceSquared
  );
};

const isOutsideArena = (x, y, rules = TRON_RULES) => {
  const limit = rules.arenaSize / 2 - rules.bikeRadius;
  return x <= -limit || x >= limit || y <= -limit || y >= limit;
};

export const isPointBlocked = (
  x,
  y,
  player,
  trailSegments,
  rules = TRON_RULES,
  { ignoreTail = true } = {}
) => {
  if (isOutsideArena(x, y, rules)) return true;

  const collisionDistance = rules.bikeRadius + rules.trailHalfWidth;
  const collisionDistanceSquared = collisionDistance * collisionDistance;
  for (const segment of trailSegments) {
    if (segment.id === player.currentTrailId) continue;
    if (
      ignoreTail &&
      segment.ownerId === player.socketId &&
      pointNearSegmentEnd(player.x, player.y, segment, rules.tailGraceDistance)
    ) {
      continue;
    }
    if (squaredDistanceToSegment(x, y, segment) <= collisionDistanceSquared) {
      return true;
    }
  }
  return false;
};

const shouldIgnoreSegment = (segment, player, rules) => {
  if (segment.id === player.currentTrailId) return true;
  return (
    segment.ownerId === player.socketId &&
    pointNearSegmentEnd(player.x, player.y, segment, rules.tailGraceDistance)
  );
};

const rayDistanceToBox = (x, y, vector, box) => {
  const epsilon = 0.000001;
  if (vector.x > 0 && y >= box.minY - epsilon && y <= box.maxY + epsilon) {
    if (x <= box.minX + epsilon) return Math.max(0, box.minX - x);
    if (x <= box.maxX + epsilon) return 0;
  }
  if (vector.x < 0 && y >= box.minY - epsilon && y <= box.maxY + epsilon) {
    if (x >= box.maxX - epsilon) return Math.max(0, x - box.maxX);
    if (x >= box.minX - epsilon) return 0;
  }
  if (vector.y > 0 && x >= box.minX - epsilon && x <= box.maxX + epsilon) {
    if (y <= box.minY + epsilon) return Math.max(0, box.minY - y);
    if (y <= box.maxY + epsilon) return 0;
  }
  if (vector.y < 0 && x >= box.minX - epsilon && x <= box.maxX + epsilon) {
    if (y >= box.maxY - epsilon) return Math.max(0, y - box.maxY);
    if (y >= box.minY - epsilon) return 0;
  }
  return Infinity;
};

// Returns the distance to the actual visible surface. Unlike collision checks,
// this does not expand obstacles by the bike hitbox.
export const obstacleSurfaceDistance = (
  player,
  direction,
  maxDistance,
  trailSegments,
  rules = TRON_RULES
) => {
  const vector = DIRECTIONS[normalizeDirection(direction)];
  const half = rules.arenaSize / 2;
  let nearest = vector.x > 0
    ? half - player.x
    : vector.x < 0
      ? player.x + half
      : vector.y > 0
        ? half - player.y
        : player.y + half;

  for (const segment of trailSegments) {
    if (shouldIgnoreSegment(segment, player, rules)) continue;
    const box = {
      minX: Math.min(segment.x1, segment.x2) - rules.trailHalfWidth,
      maxX: Math.max(segment.x1, segment.x2) + rules.trailHalfWidth,
      minY: Math.min(segment.y1, segment.y2) - rules.trailHalfWidth,
      maxY: Math.max(segment.y1, segment.y2) + rules.trailHalfWidth
    };
    nearest = Math.min(
      nearest,
      rayDistanceToBox(player.x, player.y, vector, box)
    );
  }

  return nearest <= maxDistance ? nearest : Infinity;
};

const beginTrailSegment = (player, trailSegments, createTrailId) => {
  const segment = {
    id: createTrailId(),
    ownerId: player.socketId,
    color: player.color,
    x1: player.x,
    y1: player.y,
    x2: player.x,
    y2: player.y
  };
  trailSegments.push(segment);
  player.currentTrailId = segment.id;
  return segment;
};

const getCurrentTrail = (player, trailSegments) =>
  trailSegments.find((segment) => segment.id === player.currentTrailId) || null;

export const applyQueuedTurn = (player, trailSegments, rules, createTrailId) => {
  const queuedTurn = Array.isArray(player.pendingTurns)
    ? player.pendingTurns.shift()
    : null;
  if (!queuedTurn && !player.pendingTurn) return false;

  const requestedTurn = queuedTurn || player.pendingTurn;
  player.pendingTurn = null;
  const oldDirection = normalizeDirection(player.direction);
  const nextDirection = turnDirection(oldDirection, requestedTurn);
  const threatDistance = obstacleSurfaceDistance(
    player,
    oldDirection,
    rules.wallRideTurnWindow,
    trailSegments,
    rules
  );

  player.direction = nextDirection;

  // After a ninety-degree rescue turn, the obstacle that was ahead is on the
  // inside of the new path. Only a genuinely close obstacle starts a wall ride.
  const insideDirection = turnDirection(
    nextDirection,
    requestedTurn === 'right' ? 'left' : 'right'
  );
  const sideDistance = obstacleSurfaceDistance(
    player,
    insideDirection,
    rules.wallRideTurnWindow,
    trailSegments,
    rules
  );
  const startsWallRide =
    threatDistance <= rules.wallRideTurnWindow &&
    sideDistance <= rules.wallRideTurnWindow;

  if (startsWallRide) {
    const desiredDistance = rules.visualBikeHalfWidth + rules.wallRideGap;
    const insideVector = DIRECTIONS[normalizeDirection(insideDirection)];
    const correction = sideDistance - desiredDistance;
    player.x += insideVector.x * correction;
    player.y += insideVector.y * correction;

    // Move the existing trail corner with the bike so the ribbon stays
    // continuous after the precision snap instead of leaving a visible gap.
    const currentTrail = getCurrentTrail(player, trailSegments);
    if (currentTrail) {
      currentTrail.x2 = player.x;
      currentTrail.y2 = player.y;
    }
    player.boostDecayRemaining = 0;
    player.boostDecayRate = 0;
  }

  beginTrailSegment(player, trailSegments, createTrailId);

  player.wallRiding = startsWallRide;
  player.wallRideSide = startsWallRide
    ? requestedTurn === 'right'
      ? 'left'
      : 'right'
    : null;
  player.wallRideTime = startsWallRide ? 0 : 0;
  return startsWallRide;
};

const movementIntersectsTrail = (player, nextX, nextY, trailSegments, rules) => {
  const dx = nextX - player.x;
  const dy = nextY - player.y;
  const distance = Math.hypot(dx, dy);
  const samples = Math.max(2, Math.ceil(distance / 0.08));
  for (let index = 1; index <= samples; index += 1) {
    const alpha = index / samples;
    if (
      isPointBlocked(
        player.x + dx * alpha,
        player.y + dy * alpha,
        player,
        trailSegments,
        rules
      )
    ) {
      return true;
    }
  }
  return false;
};

const orientation = (ax, ay, bx, by, cx, cy) =>
  (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

const movementsCross = (first, second) => {
  const o1 = orientation(first.x1, first.y1, first.x2, first.y2, second.x1, second.y1);
  const o2 = orientation(first.x1, first.y1, first.x2, first.y2, second.x2, second.y2);
  const o3 = orientation(second.x1, second.y1, second.x2, second.y2, first.x1, first.y1);
  const o4 = orientation(second.x1, second.y1, second.x2, second.y2, first.x2, first.y2);
  const boundsOverlap =
    Math.max(Math.min(first.x1, first.x2), Math.min(second.x1, second.x2)) <=
      Math.min(Math.max(first.x1, first.x2), Math.max(second.x1, second.x2)) &&
    Math.max(Math.min(first.y1, first.y2), Math.min(second.y1, second.y2)) <=
      Math.min(Math.max(first.y1, first.y2), Math.max(second.y1, second.y2));
  return boundsOverlap && o1 * o2 <= 0 && o3 * o4 <= 0;
};

const beginBoostDecay = (player, rules) => {
  const excessSpeed = Math.max(0, player.speed - rules.baseSpeed);
  if (excessSpeed <= 0) {
    player.boostDecayRemaining = 0;
    player.boostDecayRate = 0;
    return;
  }
  player.boostDecayRemaining = rules.boostDecaySeconds;
  player.boostDecayRate = excessSpeed / rules.boostDecaySeconds;
};

const updateWallRide = (player, dt, trailSegments, rules) => {
  if (!player.wallRiding || !player.wallRideSide) return;
  const sideDirection = turnDirection(player.direction, player.wallRideSide);
  const sideDistance = obstacleSurfaceDistance(
    player,
    sideDirection,
    rules.wallRideReleaseDistance,
    trailSegments,
    rules
  );
  if (sideDistance > rules.wallRideReleaseDistance) {
    player.wallRiding = false;
    player.wallRideSide = null;
    player.wallRideTime = 0;
    beginBoostDecay(player, rules);
    return;
  }

  player.wallRideTime += dt;
  player.speed = Math.min(
    rules.maxSpeed,
    player.speed + rules.wallRideAcceleration * dt
  );
  player.boostDecayRemaining = 0;
  player.boostDecayRate = 0;
};

const tryStartAutomaticWallRide = (player, trailSegments, rules) => {
  if (player.wallRiding) return false;
  const candidates = ['left', 'right']
    .map((side) => ({
      side,
      distance: obstacleSurfaceDistance(
        player,
        turnDirection(player.direction, side),
        rules.wallRideAutoAcquireDistance,
        trailSegments,
        rules
      )
    }))
    .filter(({ distance }) => (
      distance > rules.bikeRadius &&
      distance <= rules.wallRideAutoAcquireDistance
    ))
    .sort((first, second) => first.distance - second.distance);

  if (!candidates.length) return false;
  player.wallRiding = true;
  player.wallRideSide = candidates[0].side;
  player.wallRideTime = 0;
  player.boostDecayRemaining = 0;
  player.boostDecayRate = 0;
  return true;
};

const updateBoostDecay = (player, dt, rules) => {
  if (player.wallRiding || player.speed <= rules.baseSpeed) return;
  if (!(player.boostDecayRemaining > 0) || !(player.boostDecayRate > 0)) {
    beginBoostDecay(player, rules);
  }
  const elapsed = Math.min(dt, player.boostDecayRemaining);
  player.speed = Math.max(
    rules.baseSpeed,
    player.speed - player.boostDecayRate * elapsed
  );
  player.boostDecayRemaining = Math.max(0, player.boostDecayRemaining - elapsed);
  if (player.boostDecayRemaining <= 0 || player.speed <= rules.baseSpeed) {
    player.speed = rules.baseSpeed;
    player.boostDecayRemaining = 0;
    player.boostDecayRate = 0;
  }
};

export const stepSimulation = ({
  players,
  trailSegments,
  dt,
  rules = TRON_RULES,
  createTrailId
}) => {
  const alivePlayers = players.filter((player) => player.alive && player.inRound);

  for (const player of alivePlayers) {
    if (player.pendingTurn || player.pendingTurns?.length) {
      // A deliberate second turn always releases the previous wall ride before
      // the new rescue attempt is evaluated.
      if (player.wallRiding) beginBoostDecay(player, rules);
      player.wallRiding = false;
      player.wallRideSide = null;
      player.wallRideTime = 0;
      applyQueuedTurn(player, trailSegments, rules, createTrailId);
    }
    tryStartAutomaticWallRide(player, trailSegments, rules);
    updateWallRide(player, dt, trailSegments, rules);
    updateBoostDecay(player, dt, rules);
  }

  const moves = alivePlayers.map((player) => {
    const vector = DIRECTIONS[normalizeDirection(player.direction)];
    const distance = player.speed * dt;
    return {
      player,
      x1: player.x,
      y1: player.y,
      x2: player.x + vector.x * distance,
      y2: player.y + vector.y * distance
    };
  });

  const eliminated = new Set();
  for (const move of moves) {
    if (movementIntersectsTrail(move.player, move.x2, move.y2, trailSegments, rules)) {
      eliminated.add(move.player.socketId);
    }
  }

  const headCollisionDistance = rules.bikeRadius * 2;
  for (let firstIndex = 0; firstIndex < moves.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < moves.length; secondIndex += 1) {
      const first = moves[firstIndex];
      const second = moves[secondIndex];
      const headsTouch =
        Math.hypot(first.x2 - second.x2, first.y2 - second.y2) <= headCollisionDistance;
      if (headsTouch || movementsCross(first, second)) {
        eliminated.add(first.player.socketId);
        eliminated.add(second.player.socketId);
      }
    }
  }

  for (const move of moves) {
    const { player } = move;
    if (eliminated.has(player.socketId)) {
      player.alive = false;
      player.wallRiding = false;
      player.wallRideSide = null;
      player.wallRideTime = 0;
      player.boostDecayRemaining = 0;
      player.boostDecayRate = 0;
      player.crashedAt = Date.now();
      continue;
    }

    player.x = move.x2;
    player.y = move.y2;
    let currentTrail = getCurrentTrail(player, trailSegments);
    if (!currentTrail) {
      currentTrail = beginTrailSegment(player, trailSegments, createTrailId);
    }
    currentTrail.x2 = player.x;
    currentTrail.y2 = player.y;
  }

  return eliminated;
};

export const createSimulationPlayer = (data, spawn, createTrailId, trailSegments) => {
  const player = {
    ...data,
    x: spawn.x,
    y: spawn.y,
    direction: normalizeDirection(spawn.direction),
    pendingTurn: null,
    pendingTurns: [],
    speed: TRON_RULES.baseSpeed,
    wallRiding: false,
    wallRideSide: null,
    wallRideTime: 0,
    boostDecayRemaining: 0,
    boostDecayRate: 0,
    currentTrailId: null,
    crashedAt: null,
    alive: true,
    inRound: true,
    isSpectator: false
  };
  beginTrailSegment(player, trailSegments, createTrailId);
  return player;
};
