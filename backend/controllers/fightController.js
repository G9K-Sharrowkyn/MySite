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

  const existingFight = db.data.fights[index];
  db.data.fights[index] = { ...existingFight, ...updatedData };

  const participantIds = [existingFight.user1, existingFight.user2];

  // Jeśli walka ma zwycięzcę lub zaktualizowano wynik, zaktualizuj statystyki
  if (updatedData.winnerId || updatedData.result) {
    const users = participantIds
      .map(id => db.data.users.find(u => u.id === id))
      .filter(Boolean);

    const updateDerivedStats = user => {
      user.stats = user.stats || {};
      user.stats.totalFights =
        (user.stats.fightsWon || 0) +
        (user.stats.fightsLost || 0) +
        (user.stats.fightsDrawn || 0) +
        (user.stats.fightsNoContest || 0);
      user.stats.winRate =
        user.stats.totalFights > 0
          ? (user.stats.fightsWon || 0) / user.stats.totalFights
          : 0;
    };

    if (updatedData.winnerId) {
      const winner = users.find(u => u.id === updatedData.winnerId);
      const loser = users.find(u => u.id !== updatedData.winnerId);

      if (winner) {
        winner.points = (winner.points || 0) + 10; // Przyznaj 10 punktów za zwycięstwo
        winner.stats = winner.stats || {};
        winner.stats.fightsWon = (winner.stats.fightsWon || 0) + 1;
        updateDerivedStats(winner);
      }

      if (loser) {
        loser.stats = loser.stats || {};
        loser.stats.fightsLost = (loser.stats.fightsLost || 0) + 1;
        updateDerivedStats(loser);
      }
    } else if (updatedData.result === 'draw') {
      users.forEach(user => {
        user.stats = user.stats || {};
        user.stats.fightsDrawn = (user.stats.fightsDrawn || 0) + 1;
        updateDerivedStats(user);
      });
    } else if (
      updatedData.result === 'noContest' ||
      updatedData.result === 'no-contest'
    ) {
      users.forEach(user => {
        user.stats = user.stats || {};
        user.stats.fightsNoContest = (user.stats.fightsNoContest || 0) + 1;
        updateDerivedStats(user);
      });
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