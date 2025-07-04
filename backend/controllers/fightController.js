const { v4: uuidv4 } = require('uuid');

// @desc    Get all fights
// @route   GET /api/fights
// @access  Public
exports.getFights = async (req, res) => {
  const db = req.db;
  await db.read();
  res.json(db.data.fights);
};

// @desc    Create a new fight (Moderator only)
// @route   POST /api/fights
// @access  Private (Moderator)
exports.createFight = async (req, res) => {
  const { category, user1, user2, fighter1, fighter2, user1Record, user2Record, overallRecord1, overallRecord2 } = req.body;
  const db = req.db;
  await db.read();

  // Tutaj można dodać logikę sprawdzającą, czy użytkownik jest moderatorem
  // Na razie zakładamy, że każdy zalogowany użytkownik może tworzyć walki dla uproszczenia

  const newFight = {
    id: uuidv4(),
    category,
    user1,
    user2,
    fighter1,
    fighter2,
    user1Record,
    user2Record,
    overallRecord1,
    overallRecord2,
    createdAt: new Date().toISOString(),
  };

  db.data.fights.push(newFight);
  await db.write();
  res.status(201).json(newFight);
};

// @desc    Update a fight (Moderator only)
// @route   PUT /api/fights/:id
// @access  Private (Moderator)
exports.updateFight = async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;
  const db = req.db;
  await db.read();

  const index = db.data.fights.findIndex(f => f.id === id);

  if (index === -1) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  db.data.fights[index] = { ...db.data.fights[index], ...updatedData };

  // Jeśli walka ma zwycięzcę, przyznaj punkty
  if (updatedData.winnerId) {
    const winner = db.data.users.find(u => u.id === updatedData.winnerId);
    if (winner) {
      winner.points = (winner.points || 0) + 10; // Przyznaj 10 punktów za zwycięstwo
    }
  }

  await db.write();
  res.json(db.data.fights[index]);
};

// @desc    Delete a fight (Moderator only)
// @route   DELETE /api/fights/:id
// @access  Private (Moderator)
exports.deleteFight = async (req, res) => {
  const { id } = req.params;
  const db = req.db;
  await db.read();

  const initialLength = db.data.fights.length;
  db.data.fights = db.data.fights.filter(f => f.id !== id);

  if (db.data.fights.length === initialLength) {
    return res.status(404).json({ msg: 'Walka nie znaleziona' });
  }

  await db.write();
  res.json({ msg: 'Walka usunięta' });
};