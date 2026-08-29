import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { recordTronWin } from '../services/tronLeaderboard.js';
import {
  TRON_RULES,
  createSimulationPlayer,
  getDirectionName,
  normalizeDirection,
  stepSimulation
} from './tronSimulation.js';

const MAX_PLAYERS = 8;
const ROUND_COUNTDOWN_MS = 2800;
const ROUND_END_DELAY_MS = 3500;
const MAX_TURN_QUEUE = 3;
const MIN_PASSWORD_LENGTH = 4;

const COLOR_PALETTE = [
  '#00e5ff', '#ff7a00', '#ffd84a', '#ff3b4d', '#58f56b'
];

export const clampPlayerColor = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return COLOR_PALETTE.includes(normalized) ? normalized : null;
};

const clampRoomId = (value) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

const clampRoomName = (value) => {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  return normalized.slice(0, 36);
};

const clampPassword = (value) => String(value || '').slice(0, 72);

const createRoomId = (name) => {
  const slug = clampRoomName(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 22) || 'arena';
  return `${slug}-${randomUUID().slice(0, 6)}`;
};

const clampUsername = (value) => {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  return raw ? raw.slice(0, 32) : '';
};

const getSocketAuthUser = (socket) => {
  const token = socket.handshake?.auth?.token;
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload?.user?.id || payload?.userId || payload?.id || null;
    const role = payload?.user?.role || payload?.role || 'user';
    const username = payload?.user?.username || payload?.username || '';
    return id ? { id, role, username } : null;
  } catch (_error) {
    return null;
  }
};

const buildSpawnPoints = () => {
  const edge = TRON_RULES.arenaSize / 2 - 7;
  const lane = 10;
  return [
    { x: -edge, y: -edge, direction: 1 },
    { x: edge, y: edge, direction: 3 },
    { x: edge, y: -edge, direction: 2 },
    { x: -edge, y: edge, direction: 0 },
    { x: -lane, y: -edge, direction: 2 },
    { x: lane, y: edge, direction: 0 },
    { x: -edge, y: lane, direction: 1 },
    { x: edge, y: -lane, direction: 3 }
  ];
};

const createRoom = (id, options = {}) => ({
  id,
  name: options.name || id,
  visibility: options.visibility === 'private' ? 'private' : 'public',
  passwordHash: options.passwordHash || null,
  hidden: Boolean(options.hidden),
  hostSocketId: options.hostSocketId || null,
  createdAt: new Date().toISOString(),
  phase: 'waiting',
  round: 0,
  winnerSocketId: null,
  countdownEndsAt: null,
  players: new Map(),
  trailSegments: [],
  nextTrailId: 1,
  tickInterval: null,
  countdownTimeout: null,
  finishTimeout: null
});

const createTrailId = (room) => () => `${room.round}-${room.nextTrailId++}`;

const clearRoundTimers = (room) => {
  if (room.tickInterval) clearInterval(room.tickInterval);
  if (room.countdownTimeout) clearTimeout(room.countdownTimeout);
  if (room.finishTimeout) clearTimeout(room.finishTimeout);
  room.tickInterval = null;
  room.countdownTimeout = null;
  room.finishTimeout = null;
};

const serializePlayer = (player) => ({
  socketId: player.socketId,
  userId: player.userId,
  username: player.username,
  color: player.color,
  x: player.x,
  y: player.y,
  dir: getDirectionName(player.direction),
  direction: player.direction,
  alive: player.alive,
  spectator: Boolean(player.isSpectator),
  wins: player.wins,
  speed: Number(player.speed || TRON_RULES.baseSpeed),
  speedPercent: Math.max(0, Math.min(100, Math.round(
    ((Number(player.speed || TRON_RULES.baseSpeed) - TRON_RULES.baseSpeed) /
      (TRON_RULES.maxSpeed - TRON_RULES.baseSpeed)) * 100
  ))),
  wallRiding: Boolean(player.wallRiding),
  wallRideSide: player.wallRideSide,
  wallRideTime: Number(player.wallRideTime || 0),
  boostDecayRemaining: Number(player.boostDecayRemaining || 0),
  crashedAt: player.crashedAt || null
});

const serializeRoom = (room) => {
  const players = Array.from(room.players.values())
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map(serializePlayer);
  return {
    roomId: room.id,
    arenaSize: TRON_RULES.arenaSize,
    gridSize: TRON_RULES.arenaSize,
    tickMs: TRON_RULES.tickMs,
    baseSpeed: TRON_RULES.baseSpeed,
    maxSpeed: TRON_RULES.maxSpeed,
    phase: room.phase,
    round: room.round,
    countdownEndsAt: room.countdownEndsAt,
    winner: room.winnerSocketId
      ? players.find((player) => player.socketId === room.winnerSocketId) || null
      : null,
    players,
    trails: room.trailSegments
  };
};

const serializeLobbyRoom = (room) => ({
  roomId: room.id,
  name: room.name,
  isPrivate: room.visibility === 'private',
  phase: room.phase,
  round: room.round,
  playerCount: room.players.size,
  maxPlayers: MAX_PLAYERS,
  createdAt: room.createdAt,
  hostName: room.players.get(room.hostSocketId)?.username || null
});

const serializeLobby = (rooms) => ({
  rooms: [...rooms.values()]
    .filter((room) => !room.hidden && room.players.size > 0)
    .sort((left, right) => (
      right.players.size - left.players.size ||
      String(right.createdAt).localeCompare(String(left.createdAt))
    ))
    .map(serializeLobbyRoom),
  updatedAt: new Date().toISOString()
});

const emitLobbyState = (namespace, rooms, socket = null) => {
  const payload = serializeLobby(rooms);
  if (socket) socket.emit('tron:lobby', payload);
  else namespace.emit('tron:lobby', payload);
};

const emitRoomState = (namespace, room, socket = null) => {
  const payload = serializeRoom(room);
  if (socket) socket.emit('tron:state', payload);
  else namespace.to(room.id).emit('tron:state', payload);
};

const getRoundPlayers = (room) => Array.from(room.players.values()).filter((player) => player.inRound);
const getAlivePlayers = (room) => getRoundPlayers(room).filter((player) => player.alive);

const assignRoundSpawns = (room) => {
  const spawns = buildSpawnPoints();
  const existingPlayers = Array.from(room.players.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  room.trailSegments = [];
  room.nextTrailId = 1;
  existingPlayers.forEach((existing, index) => {
    if (index >= MAX_PLAYERS) {
      Object.assign(existing, {
        inRound: false, alive: false, x: null, y: null, isSpectator: true,
        pendingTurn: null, pendingTurns: [], wallRiding: false, boostDecayRemaining: 0,
        boostDecayRate: 0
      });
      return;
    }
    const player = createSimulationPlayer(
      existing, spawns[index], createTrailId(room), room.trailSegments
    );
    player.lastTurnAt = 0;
    room.players.set(existing.socketId, player);
  });
};

const beginWaitingPhase = (namespace, room) => {
  clearRoundTimers(room);
  room.phase = 'waiting';
  room.countdownEndsAt = null;
  room.winnerSocketId = null;
  room.trailSegments = [];
  for (const player of room.players.values()) {
    Object.assign(player, {
      inRound: false, alive: false, x: null, y: null, pendingTurn: null, pendingTurns: [],
      wallRiding: false, wallRideSide: null, wallRideTime: 0,
      boostDecayRemaining: 0, boostDecayRate: 0, isSpectator: false
    });
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
    void recordTronWin({
      userId: winner.userId,
      nickname: winner.username,
      roomId: room.id,
      round: room.round
    }).then(({ recorded, monthKey }) => {
      if (recorded) namespace.emit('tron:leaderboard-updated', { monthKey });
    }).catch((error) => {
      console.error('Could not record TRON victory:', error);
    });
  } else room.winnerSocketId = null;
  emitRoomState(namespace, room);
  room.finishTimeout = setTimeout(() => {
    room.finishTimeout = null;
    if (room.players.size >= 1) startRoundCountdown(namespace, room);
    else beginWaitingPhase(namespace, room);
  }, ROUND_END_DELAY_MS);
};

const shouldFinishRound = (room) => {
  const roundPlayers = getRoundPlayers(room);
  const alive = roundPlayers.filter((player) => player.alive);
  return roundPlayers.length > 1 ? alive.length <= 1 : alive.length === 0;
};

const tickRoom = (namespace, room) => {
  if (room.phase !== 'running') return;
  if (shouldFinishRound(room)) {
    finishRound(namespace, room);
    return;
  }
  stepSimulation({
    players: getRoundPlayers(room),
    trailSegments: room.trailSegments,
    dt: TRON_RULES.tickMs / 1000,
    rules: TRON_RULES,
    createTrailId: createTrailId(room)
  });
  emitRoomState(namespace, room);
  if (shouldFinishRound(room)) finishRound(namespace, room);
};

const startRunningRound = (namespace, room) => {
  room.phase = 'running';
  room.countdownEndsAt = null;
  room.winnerSocketId = null;
  emitRoomState(namespace, room);
  room.tickInterval = setInterval(() => tickRoom(namespace, room), TRON_RULES.tickMs);
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
    if (room.players.size < 1) beginWaitingPhase(namespace, room);
    else startRunningRound(namespace, room);
  }, ROUND_COUNTDOWN_MS);
};

const maybeStartRound = (namespace, room) => {
  if (room.phase === 'waiting' && room.players.size >= 1) startRoundCountdown(namespace, room);
};

const choosePlayerColor = (room) => {
  const used = new Set(Array.from(room.players.values()).map((player) => player.color));
  return COLOR_PALETTE.find((color) => !used.has(color)) ||
    COLOR_PALETTE[room.players.size % COLOR_PALETTE.length];
};

const leaveRoom = (namespace, rooms, socket, roomId) => {
  const room = rooms.get(roomId);
  if (!room || !room.players.has(socket.id)) return;
  const removed = room.players.get(socket.id);
  const removedWasAlive = removed.alive && removed.inRound;
  room.players.delete(socket.id);
  socket.leave(room.id);
  if (!room.players.size) {
    clearRoundTimers(room);
    rooms.delete(room.id);
    emitLobbyState(namespace, rooms);
    return;
  }
  if (room.hostSocketId === socket.id) {
    room.hostSocketId = room.players.keys().next().value || null;
  }
  if (room.phase === 'running' && removedWasAlive && shouldFinishRound(room)) {
    finishRound(namespace, room);
    emitLobbyState(namespace, rooms);
    return;
  }
  emitRoomState(namespace, room);
  maybeStartRound(namespace, room);
  emitLobbyState(namespace, rooms);
};

const absoluteDirectionToTurn = (currentDirection, requestedDirection) => {
  const current = normalizeDirection(currentDirection);
  const requested = normalizeDirection(requestedDirection);
  if (requested === (current + 1) % 4) return 'right';
  if (requested === (current + 3) % 4) return 'left';
  return null;
};

export const initTronNamespace = (io) => {
  const namespace = io.of('/tron');
  const rooms = new Map();
  const lobbyInterval = setInterval(() => emitLobbyState(namespace, rooms), 1000);
  lobbyInterval.unref?.();

  namespace.on('connection', (socket) => {
    const authUser = getSocketAuthUser(socket);
    socket.data.tronRoomId = null;

    const enterRoom = (room, payload = {}) => {
      const requestedName = clampUsername(payload.username);
      const username = requestedName || clampUsername(authUser?.username) || `Guest-${socket.id.slice(0, 5)}`;
      if (socket.data.tronRoomId) {
        leaveRoom(namespace, rooms, socket, socket.data.tronRoomId);
        socket.data.tronRoomId = null;
      }
      if (room.players.size >= MAX_PLAYERS) {
        socket.emit('tron:error', { code: 'ROOM_FULL', message: 'Pokój jest pełny (maksymalnie 8 graczy).' });
        return false;
      }
      room.players.set(socket.id, {
        socketId: socket.id,
        userId: authUser?.id || `guest:${socket.id}`,
        username,
        color: clampPlayerColor(payload.color) || choosePlayerColor(room),
        x: null, y: null, direction: 0, pendingTurn: null, pendingTurns: [],
        alive: false, inRound: false,
        isSpectator: room.phase === 'running' || room.phase === 'finished',
        speed: TRON_RULES.baseSpeed, wallRiding: false, wallRideSide: null,
        wallRideTime: 0, boostDecayRemaining: 0, boostDecayRate: 0,
        currentTrailId: null, crashedAt: null,
        wins: 0, lastTurnAt: 0, joinedAt: Date.now()
      });
      socket.data.tronRoomId = room.id;
      socket.join(room.id);
      // Players who arrive during the pre-round countdown still enter that
      // round. Reassigning untouched spawn points is safe until movement starts.
      if (room.phase === 'countdown') assignRoundSpawns(room);
      emitRoomState(namespace, room);
      maybeStartRound(namespace, room);
      emitLobbyState(namespace, rooms);
      return true;
    };

    emitLobbyState(namespace, rooms, socket);

    socket.on('tron:list', () => emitLobbyState(namespace, rooms, socket));

    socket.on('tron:create', async (payload = {}) => {
      try {
        const isSolo = payload.mode === 'solo';
        const visibility = isSolo || payload.visibility === 'private' ? 'private' : 'public';
        const name = isSolo ? 'Trening solo' : clampRoomName(payload.name);
        const password = clampPassword(payload.password);
        if (!isSolo && name.length < 3) {
          socket.emit('tron:error', { code: 'ROOM_NAME', message: 'Nazwa pokoju musi mieć co najmniej 3 znaki.' });
          return;
        }
        if (!isSolo && visibility === 'private' && password.length < MIN_PASSWORD_LENGTH) {
          socket.emit('tron:error', {
            code: 'ROOM_PASSWORD',
            message: `Hasło prywatnego pokoju musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaki.`
          });
          return;
        }
        const roomId = createRoomId(name);
        const passwordHash = visibility === 'private' && !isSolo
          ? await bcrypt.hash(password, 10)
          : null;
        const room = createRoom(roomId, {
          name,
          visibility,
          passwordHash,
          hidden: isSolo,
          hostSocketId: socket.id
        });
        rooms.set(roomId, room);
        socket.emit('tron:created', { roomId });
        enterRoom(room, payload);
      } catch (error) {
        console.error('Could not create TRON room:', error);
        socket.emit('tron:error', { code: 'ROOM_CREATE', message: 'Nie udało się utworzyć pokoju.' });
      }
    });

    socket.on('tron:join', async (payload = {}) => {
      try {
        const roomId = clampRoomId(payload.roomId);
        const room = rooms.get(roomId);
        if (!room || room.hidden) {
          socket.emit('tron:error', { code: 'ROOM_NOT_FOUND', message: 'Ten pokój już nie istnieje.' });
          return;
        }
        if (room.visibility === 'private') {
          const password = clampPassword(payload.password);
          const accepted = room.passwordHash && await bcrypt.compare(password, room.passwordHash);
          if (!accepted) {
            socket.emit('tron:error', { code: 'BAD_PASSWORD', message: 'Nieprawidłowe hasło do pokoju.' });
            return;
          }
        }
        enterRoom(room, payload);
      } catch (error) {
        console.error('Could not join TRON room:', error);
        socket.emit('tron:error', { code: 'ROOM_JOIN', message: 'Nie udało się dołączyć do pokoju.' });
      }
    });

    socket.on('tron:turn', (payload = {}) => {
      const room = rooms.get(socket.data.tronRoomId);
      if (!room || room.phase !== 'running') return;
      const player = room.players.get(socket.id);
      if (!player?.alive || !player.inRound) return;
      let turn = String(payload.turn || '').toLowerCase();
      if (turn !== 'left' && turn !== 'right') {
        const requested = String(payload.direction || '').toLowerCase();
        if (!['up', 'right', 'down', 'left'].includes(requested)) return;
        turn = absoluteDirectionToTurn(player.direction, requested);
      }
      if (turn !== 'left' && turn !== 'right') return;
      if (!Array.isArray(player.pendingTurns)) player.pendingTurns = [];
      if (player.pendingTurns.length >= MAX_TURN_QUEUE) return;
      player.pendingTurns.push(turn);
      player.lastTurnAt = Date.now();
    });

    socket.on('tron:leave', () => {
      if (!socket.data.tronRoomId) return;
      leaveRoom(namespace, rooms, socket, socket.data.tronRoomId);
      socket.data.tronRoomId = null;
      emitLobbyState(namespace, rooms, socket);
    });
    socket.on('disconnect', () => {
      if (!socket.data.tronRoomId) return;
      leaveRoom(namespace, rooms, socket, socket.data.tronRoomId);
      socket.data.tronRoomId = null;
    });
  });
  return namespace;
};
