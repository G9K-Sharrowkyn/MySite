const games = {}; // w pamięci: { roomId: { players: [...], deck: [...], state: {...} } }

export const createRoom = (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8);
  games[roomId] = { players: [], deck: [], state: {} };
  res.json({ roomId });
};

export const joinRoom = (req, res) => {
  const { roomId } = req.params;
  const user = req.user;
  if (!games[roomId]) {
    return res.status(404).json({ message: 'Pokój nie istnieje' });
  }
  if (games[roomId].players.length >= 2) {
    return res.status(400).json({ message: 'Pokój pełny' });
  }
  games[roomId].players.push({ id: user.id, username: user.username });
  res.json({ message: 'Dołączono do pokoju' });
};

export const getRoomState = (req, res) => {
  const { roomId } = req.params;
  if (!games[roomId]) {
    return res.status(404).json({ message: 'Pokój nie istnieje' });
  }
  res.json(games[roomId]);
};
