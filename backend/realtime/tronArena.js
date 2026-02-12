import jwt from 'jsonwebtoken';

const GRID_SIZE = 48;
const MAX_PLAYERS = 8;
const TICK_MS = 70;
const ROUND_COUNTDOWN_MS = 2500;
const ROUND_END_DELAY_MS = 3000;
const DEFAULT_ROOM_ID = 'public';

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left'
};

const COLOR_PALETTE = [
  '#00e5ff',
  '#ff4d6d',
  '#ffd166',
  '#8ac926',
  '#c77dff',
  '#ff9f1c',
  '#4cc9f0',
  '#f72585'
];

const clampRoomId = (value) => {
  const raw = String(value || DEFAULT_ROOM_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return raw || DEFAULT_ROOM_ID;
};

const clampUsername = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  return raw.slice(0, 32);
};

const cellKey = (x, y) => `${x}:${y}`;

const parseCellKey = (value) => {
  const [x, y] = String(value || '')
    .split(':')
    .map((part) => Number(part));
  return { x, y };
};

const inBounds = (x, y) => x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;

const getSocketAuthUser = (socket) => {
  const token = socket.handshake?.auth?.token;
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload?.user?.id || payload?.userId || payload?.id || null;
    const role = payload?.user?.role || payload?.role || 'user';
    const username = payload?.user?.username || payload?.username || '';
    if (!id) return null;
    return { id, role, username };
  } catch (_error) {
    return null;
  }
};

const buildSpawnPoints = () => {
  const edge = GRID_SIZE - 5;
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: 4, y: 4, dir: 'right' },
    { x: edge, y: edge, dir: 'left' },
    { x: edge, y: 4, dir: 'down' },
    { x: 4, y: edge, dir: 'up' },
    { x: mid, y: 4, dir: 'down' },
    { x: mid, y: edge, dir: 'up' },
    { x: 4, y: mid, dir: 'right' },
    { x: edge, y: mid, dir: 'left' }
  ];
};

const createRoom = (id) => ({
  id,
  phase: 'waiting', // waiting | countdown | running | finished
  round: 0,
  winnerSocketId: null,
  countdownEndsAt: null,
  players: new Map(),
  trails: new Set(),
  tickInterval: null,
  countdownTimeout: null,
  finishTimeout: null
});

const clearRoundTimers = (room) => {
  if (room.tickInterval) {
    clearInterval(room.tickInterval);
    room.tickInterval = null;
  }
  if (room.countdownTimeout) {
    clearTimeout(room.countdownTimeout);
    room.countdownTimeout = null;
  }
  if (room.finishTimeout) {
    clearTimeout(room.finishTimeout);
    room.finishTimeout = null;
  }
};

const serializeRoom = (room) => {
  const players = Array.from(room.players.values())
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((player) => ({
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      color: player.color,
      x: player.x,
      y: player.y,
      dir: player.dir,
      alive: player.alive,
      spectator: Boolean(player.isSpectator),
      wins: player.wins
    }));

  const winner = room.winnerSocketId
    ? players.find((player) => player.socketId === room.winnerSocketId) || null
    : null;

  return {
    roomId: room.id,
    gridSize: GRID_SIZE,
    tickMs: TICK_MS,
    phase: room.phase,
    round: room.round,
    countdownEndsAt: room.countdownEndsAt,
    winner,
    players,
    trails: Array.from(room.trails, parseCellKey)
  };
};

const emitRoomState = (namespace, room, socket = null) => {
  const payload = serializeRoom(room);
  if (socket) {
    socket.emit('tron:state', payload);
    return;
  }
  namespace.to(room.id).emit('tron:state', payload);
};

const getRoundPlayers = (room) =>
  Array.from(room.players.values()).filter((player) => player.inRound);

const getAlivePlayers = (room) =>
  getRoundPlayers(room).filter((player) => player.alive);

const assignRoundSpawns = (room) => {
  const spawns = buildSpawnPoints();
  const players = Array.from(room.players.values()).sort(
    (a, b) => a.joinedAt - b.joinedAt
  );

  room.trails.clear();

  players.forEach((player, index) => {
    if (index >= MAX_PLAYERS) {
      player.inRound = false;
      player.alive = false;
      player.x = null;
      player.y = null;
      player.dir = 'up';
      player.pendingDir = null;
      player.isSpectator = true;
      return;
    }

    const spawn = spawns[index % spawns.length];
    player.inRound = true;
    player.alive = true;
    player.x = spawn.x;
    player.y = spawn.y;
    player.dir = spawn.dir;
    player.pendingDir = null;
    player.isSpectator = false;
    room.trails.add(cellKey(spawn.x, spawn.y));
  });
};

const beginWaitingPhase = (namespace, room) => {
  clearRoundTimers(room);
  room.phase = 'waiting';
  room.countdownEndsAt = null;
  room.winnerSocketId = null;
  room.trails.clear();
  for (const player of room.players.values()) {
    player.inRound = false;
    player.alive = false;
    player.x = null;
    player.y = null;
    player.pendingDir = null;
    player.isSpectator = false;
  }
  emitRoomState(namespace, room);
};

const finishRound = (namespace, room) => {
  if (room.phase !== 'running') return;

  clearRoundTimers(room);
  room.phase = 'finished';

  const survivors = getAlivePlayers(room);
  const winner = survivors.length === 1 ? survivors[0] : null;
  if (winner) {
    winner.wins += 1;
    room.winnerSocketId = winner.socketId;
  } else {
    room.winnerSocketId = null;
  }

  emitRoomState(namespace, room);

  room.finishTimeout = setTimeout(() => {
    room.finishTimeout = null;
    if (room.players.size >= 1) {
      startRoundCountdown(namespace, room);
      return;
    }
    beginWaitingPhase(namespace, room);
  }, ROUND_END_DELAY_MS);
};

const tickRoom = (namespace, room) => {
  if (room.phase !== 'running') return;

  const alivePlayers = getAlivePlayers(room);
  const roundPlayersCount = getRoundPlayers(room).length;
  const shouldFinish =
    (roundPlayersCount > 1 && alivePlayers.length <= 1) ||
    (roundPlayersCount <= 1 && alivePlayers.length === 0);
  if (shouldFinish) {
    finishRound(namespace, room);
    return;
  }

  const plannedMoves = [];
  for (const player of alivePlayers) {
    const nextDirection = player.pendingDir;
    if (
      nextDirection &&
      DIRECTIONS[nextDirection] &&
      OPPOSITE_DIRECTION[player.dir] !== nextDirection
    ) {
      player.dir = nextDirection;
    }
    player.pendingDir = null;

    const vector = DIRECTIONS[player.dir] || DIRECTIONS.up;
    const nextX = player.x + vector.x;
    const nextY = player.y + vector.y;

    plannedMoves.push({
      player,
      nextX,
      nextY,
      nextKey: cellKey(nextX, nextY)
    });
  }

  const eliminated = new Set();

  for (const move of plannedMoves) {
    if (!inBounds(move.nextX, move.nextY)) {
      eliminated.add(move.player.socketId);
      continue;
    }
    if (room.trails.has(move.nextKey)) {
      eliminated.add(move.player.socketId);
    }
  }

  const nextCellCounts = new Map();
  for (const move of plannedMoves) {
    const count = nextCellCounts.get(move.nextKey) || 0;
    nextCellCounts.set(move.nextKey, count + 1);
  }

  for (const move of plannedMoves) {
    if ((nextCellCounts.get(move.nextKey) || 0) > 1) {
      eliminated.add(move.player.socketId);
    }
  }

  for (const move of plannedMoves) {
    if (eliminated.has(move.player.socketId)) {
      move.player.alive = false;
      continue;
    }
    move.player.x = move.nextX;
    move.player.y = move.nextY;
    room.trails.add(move.nextKey);
  }

  emitRoomState(namespace, room);

  const remainingAlive = getAlivePlayers(room).length;
  const shouldFinishAfterTick =
    (roundPlayersCount > 1 && remainingAlive <= 1) ||
    (roundPlayersCount <= 1 && remainingAlive === 0);
  if (shouldFinishAfterTick) {
    finishRound(namespace, room);
  }
};

const startRunningRound = (namespace, room) => {
  room.phase = 'running';
  room.countdownEndsAt = null;
  room.winnerSocketId = null;
  emitRoomState(namespace, room);

  room.tickInterval = setInterval(() => {
    tickRoom(namespace, room);
  }, TICK_MS);
};

const startRoundCountdown = (namespace, room) => {
  clearRoundTimers(room);
  room.phase = 'countdown';
  room.round += 1;
  room.winnerSocketId = null;
  room.countdownEndsAt = Date.now() + ROUND_COUNTDOWN_MS;
  assignRoundSpawns(room);
  emitRoomState(namespace, room);

  room.countdownTimeout = setTimeout(() => {
    room.countdownTimeout = null;
    if (room.players.size < 1) {
      beginWaitingPhase(namespace, room);
      return;
    }
    startRunningRound(namespace, room);
  }, ROUND_COUNTDOWN_MS);
};

const maybeStartRound = (namespace, room) => {
  if (room.phase !== 'waiting') return;
  if (room.players.size < 1) return;
  startRoundCountdown(namespace, room);
};

const choosePlayerColor = (room) => {
  const used = new Set(Array.from(room.players.values()).map((player) => player.color));
  const free = COLOR_PALETTE.find((color) => !used.has(color));
  return free || COLOR_PALETTE[room.players.size % COLOR_PALETTE.length];
};

const leaveRoom = (namespace, rooms, socket, roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const removed = room.players.get(socket.id);
  if (!removed) return;

  const removedWasAlive = removed.alive && removed.inRound;
  room.players.delete(socket.id);
  socket.leave(room.id);

  if (!room.players.size) {
    clearRoundTimers(room);
    rooms.delete(room.id);
    return;
  }

  if (room.phase === 'countdown' && room.players.size < 1) {
    beginWaitingPhase(namespace, room);
    return;
  }

  if (room.phase === 'running' && removedWasAlive && getAlivePlayers(room).length <= 1) {
    finishRound(namespace, room);
    return;
  }

  emitRoomState(namespace, room);
  maybeStartRound(namespace, room);
};

export const initTronNamespace = (io) => {
  const namespace = io.of('/tron');
  const rooms = new Map();

  namespace.on('connection', (socket) => {
    const authUser = getSocketAuthUser(socket);
    socket.data.tronRoomId = null;

    socket.on('tron:join', (payload = {}) => {
      const roomId = clampRoomId(payload.roomId);
      const requestedName = clampUsername(payload.username);
      const username =
        requestedName || clampUsername(authUser?.username) || `Guest-${socket.id.slice(0, 5)}`;

      if (socket.data.tronRoomId) {
        leaveRoom(namespace, rooms, socket, socket.data.tronRoomId);
        socket.data.tronRoomId = null;
      }

      let room = rooms.get(roomId);
      if (!room) {
        room = createRoom(roomId);
        rooms.set(roomId, room);
      }

      if (room.players.size >= MAX_PLAYERS) {
        socket.emit('tron:error', { message: 'Pokoj jest pelny (max 8 graczy).' });
        return;
      }

      room.players.set(socket.id, {
        socketId: socket.id,
        userId: authUser?.id || `guest:${socket.id}`,
        username,
        color: choosePlayerColor(room),
        x: null,
        y: null,
        dir: 'up',
        pendingDir: null,
        alive: false,
        inRound: false,
        isSpectator: false,
        wins: 0,
        joinedAt: Date.now()
      });

      socket.data.tronRoomId = roomId;
      socket.join(roomId);
      emitRoomState(namespace, room);
      maybeStartRound(namespace, room);
    });

    socket.on('tron:turn', (payload = {}) => {
      const roomId = socket.data.tronRoomId;
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'running') return;
      const player = room.players.get(socket.id);
      if (!player || !player.alive || !player.inRound) return;

      const direction = String(payload.direction || '').toLowerCase();
      if (!DIRECTIONS[direction]) return;
      if (OPPOSITE_DIRECTION[player.dir] === direction) return;
      player.pendingDir = direction;
    });

    socket.on('tron:leave', () => {
      const roomId = socket.data.tronRoomId;
      if (!roomId) return;
      leaveRoom(namespace, rooms, socket, roomId);
      socket.data.tronRoomId = null;
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.tronRoomId;
      if (!roomId) return;
      leaveRoom(namespace, rooms, socket, roomId);
      socket.data.tronRoomId = null;
    });
  });

  return namespace;
};
