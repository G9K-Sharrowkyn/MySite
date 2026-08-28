import { randomUUID } from 'crypto';

const games = new Map();
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

export const createRoom = (req, res) => {
  const roomId = randomUUID();
  games.set(roomId, {
    players: [{ id: req.user.id, username: req.user.username }],
    deck: [],
    state: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  res.json({ roomId });
};

export const joinRoom = (req, res) => {
  const { roomId } = req.params;
  const user = req.user;
  const room = games.get(roomId);
  if (!room) {
    return res.status(404).json({ message: 'Pokój nie istnieje' });
  }
  if (room.players.some((player) => player.id === user.id)) {
    return res.json({ message: 'Już jesteś w pokoju' });
  }
  if (room.players.length >= 2) {
    return res.status(400).json({ message: 'Pokój pełny' });
  }
  room.players.push({ id: user.id, username: user.username });
  room.updatedAt = Date.now();
  return res.json({ message: 'Dołączono do pokoju' });
};

export const getRoomState = (req, res) => {
  const { roomId } = req.params;
  const room = games.get(roomId);
  if (!room) {
    return res.status(404).json({ message: 'Pokój nie istnieje' });
  }
  if (!room.players.some((player) => player.id === req.user.id)) {
    return res.status(403).json({ message: 'Brak dostępu do pokoju' });
  }
  return res.json(room);
};

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [roomId, room] of games.entries()) {
    if (room.updatedAt < cutoff) games.delete(roomId);
  }
}, 15 * 60 * 1000);
cleanupTimer.unref();
