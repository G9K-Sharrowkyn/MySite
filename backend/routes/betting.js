import express from 'express';
import auth from '../middleware/auth.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { readDb, updateDb } from '../services/jsonDb.js';
import { v4 as uuidv4 } from 'uuid';
import { applyDailyBonus } from '../utils/coinBonus.js';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const findFightById = (db, fightId) =>
  (db.fights || []).find((entry) => entry.id === fightId);

const ensureCoinAccount = (user) => {
  if (!user) return;
  user.coins = user.coins || {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastBonusDate: new Date().toISOString()
  };
  if (typeof user.virtualCoins !== 'number') {
    user.virtualCoins = user.coins.balance || 0;
  }
};

const adjustCoins = (db, user, delta, type, description) => {
  ensureCoinAccount(user);
  user.coins.balance = (user.coins.balance || 0) + delta;
  user.virtualCoins = user.coins.balance;

  if (delta > 0) {
    user.coins.totalEarned = (user.coins.totalEarned || 0) + delta;
  } else if (delta < 0) {
    user.coins.totalSpent = (user.coins.totalSpent || 0) + Math.abs(delta);
  }

  db.coinTransactions = Array.isArray(db.coinTransactions) ? db.coinTransactions : [];
  db.coinTransactions.push({
    id: uuidv4(),
    userId: resolveUserId(user),
    amount: delta,
    type,
    description,
    balance: user.coins.balance,
    createdAt: new Date().toISOString()
  });
};

const getBettingWindow = (fight) => {
  const now = new Date();
  const closeTime = fight?.endDate
    ? new Date(fight.endDate)
    : fight?.timer?.endTime
    ? new Date(fight.timer.endTime)
    : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return {
    openTime: fight?.betting?.bettingWindow?.openTime || now.toISOString(),
    closeTime: closeTime.toISOString(),
    active: now < closeTime,
    locked: false
  };
};

const getFightBettingTotals = (db, fightId) => {
  const bets = (db.bets || []).filter((bet) => bet.fightId === fightId);
  const totalBetsA = bets.filter((bet) => ['A', 'teamA', 'team1'].includes(bet.prediction)).length;
  const totalBetsB = bets.filter((bet) => ['B', 'teamB', 'team2'].includes(bet.prediction)).length;
  const totalAmount = bets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
  return { totalBetsA, totalBetsB, totalAmount };
};

const buildBettingFight = (db, fight) => {
  const bettingWindow = getBettingWindow(fight);
  const totals = getFightBettingTotals(db, fight.id);
  const oddsA = fight?.betting?.oddsA || 2.0;
  const oddsB = fight?.betting?.oddsB || 2.0;

  return {
    ...fight,
    _id: fight.id,
    betting: {
      enabled: true,
      oddsA,
      oddsB,
      bettingWindow,
      totalBetsA: totals.totalBetsA,
      totalBetsB: totals.totalBetsB
    },
    votesA: fight.votesA || 0,
    votesB: fight.votesB || 0
  };
};

const buildAvailableFight = (db, fight) => {
  const totals = getFightBettingTotals(db, fight.id);
  const teamAName = fight.fighter1 || fight.teamA?.[0]?.characterName || fight.teamA?.[0]?.name || '';
  const teamBName = fight.fighter2 || fight.teamB?.[0]?.characterName || fight.teamB?.[0]?.name || '';
  const teamAFighters = (fight.teamA || []).map((fighter) => ({
    id: fighter.characterId || fighter.id,
    name: fighter.characterName || fighter.name || '',
    image: fighter.characterImage || fighter.image || ''
  }));
  const teamBFighters = (fight.teamB || []).map((fighter) => ({
    id: fighter.characterId || fighter.id,
    name: fighter.characterName || fighter.name || '',
    image: fighter.characterImage || fighter.image || ''
  }));

  return {
    id: fight.id,
    title: fight.title,
    team1: {
      name: teamAName || 'Team A',
      fighters: teamAFighters,
      record: fight.teamARecord || '0-0'
    },
    team2: {
      name: teamBName || 'Team B',
      fighters: teamBFighters,
      record: fight.teamBRecord || '0-0'
    },
    totalBets: {
      team1: totals.totalBetsA,
      team2: totals.totalBetsB
    },
    totalPool: totals.totalAmount,
    bettingEndTime: getBettingWindow(fight).closeTime
  };
};

// GET /api/betting/fights
router.get('/fights', auth, async (_req, res) => {
  try {
    const db = await readDb();
    const fights = (db.fights || [])
      .filter((fight) => fight.status === 'active')
      .map((fight) => buildBettingFight(db, fight));

    res.json({ success: true, fights, count: fights.length });
  } catch (error) {
    console.error('Error fetching betting fights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/available-fights
router.get('/available-fights', async (_req, res) => {
  try {
    const db = await readDb();
    const fights = (db.fights || [])
      .filter((fight) => fight.status === 'active')
      .map((fight) => buildAvailableFight(db, fight));
    res.json(fights);
  } catch (error) {
    console.error('Error fetching available fights:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/fight/:fightId
router.get('/fight/:fightId', auth, async (req, res) => {
  try {
    const db = await readDb();
    const fight = findFightById(db, req.params.fightId);
    if (!fight) {
      return res.status(404).json({ error: 'Fight not found' });
    }

    const totals = getFightBettingTotals(db, fight.id);
    const userBet = (db.bets || []).find(
      (bet) => bet.fightId === fight.id && bet.userId === req.user.id && bet.status === 'pending'
    );

    res.json({
      success: true,
      fight: buildBettingFight(db, fight),
      stats: {
        totalBetsA: totals.totalBetsA,
        totalBetsB: totals.totalBetsB,
        totalAmount: totals.totalAmount,
        totalBets: totals.totalBetsA + totals.totalBetsB
      },
      userBet: userBet || null
    });
  } catch (error) {
    console.error('Error fetching fight betting details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/fight/:fightId/odds
router.get('/fight/:fightId/odds', auth, async (req, res) => {
  try {
    const db = await readDb();
    const fight = findFightById(db, req.params.fightId);
    if (!fight) {
      return res.status(404).json({ error: 'Fight not found' });
    }

    const oddsA = fight?.betting?.oddsA || 2.0;
    const oddsB = fight?.betting?.oddsB || 2.0;
    const oddsDraw = fight?.betting?.oddsDraw || 3.0;

    res.json({ A: oddsA, B: oddsB, draw: oddsDraw });
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/betting/fight/:fightId (simple betting panel)
router.post('/fight/:fightId', auth, async (req, res) => {
  try {
    const { predictedWinner, betAmount } = req.body;
    const prediction = predictedWinner;
    const amount = Number(betAmount);

    if (!prediction || !amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid bet data' });
    }

    let newBalance = 0;
    let betRecord;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      applyDailyBonus(db, user);
      if (user.coins.balance < amount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const fight = findFightById(db, req.params.fightId);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const odds = prediction === 'A' ? 2.0 : prediction === 'B' ? 2.0 : 3.0;
      const now = new Date().toISOString();
      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId: req.user.id,
        fightId: fight.id,
        prediction,
        selectedTeam: prediction,
        amount,
        odds,
        potentialWinnings: Math.floor(amount * odds),
        status: 'pending',
        placedAt: now,
        createdAt: now
      };

      db.bets = Array.isArray(db.bets) ? db.bets : [];
      db.bets.push(betRecord);
      adjustCoins(db, user, -amount, 'bet', 'Placed bet');
      newBalance = user.coins.balance;
      return db;
    });

    res.json({ bet: betRecord, newBalance });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'User not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ message: 'Insufficient eurodolary' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ message: 'Fight not found' });
    }
    console.error('Error placing bet:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/betting/place/:fightId (BettingSystem)
router.post('/place/:fightId', auth, async (req, res) => {
  try {
    const { prediction, amount, insurance = false } = req.body;
    const betAmount = Number(amount);

    if (!['A', 'B'].includes(prediction)) {
      return res.status(400).json({ error: 'Invalid prediction' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Minimum bet is 1 eurodolar' });
    }

    let betRecord;
    let remainingCoins = 0;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      applyDailyBonus(db, user);

      const fight = findFightById(db, req.params.fightId);
      if (!fight) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const odds = prediction === 'A' ? 2.0 : 2.0;
      const insuranceCost = insurance ? Math.ceil(betAmount * 0.1) : 0;
      const totalCost = betAmount + insuranceCost;

      if (user.coins.balance < totalCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const now = new Date().toISOString();
      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId: req.user.id,
        fightId: fight.id,
        prediction,
        selectedTeam: prediction,
        amount: betAmount,
        odds,
        potentialWinnings: Math.floor(betAmount * odds),
        status: 'pending',
        placedAt: now,
        createdAt: now,
        insurance: insurance
          ? { enabled: true, refundPercentage: 50, cost: insuranceCost }
          : { enabled: false }
      };

      db.bets = Array.isArray(db.bets) ? db.bets : [];
      db.bets.push(betRecord);
      adjustCoins(db, user, -totalCost, 'bet', 'Placed bet');
      remainingCoins = user.coins.balance;
      return db;
    });

    res.json({ success: true, message: 'Bet placed successfully', bet: betRecord, remainingCoins });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ error: 'Fight not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ error: 'Insufficient eurodolary' });
    }
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/betting/place-bet (EnhancedBettingSystem)
router.post('/place-bet', async (req, res) => {
  try {
    const { userId, fightId, prediction, amount } = req.body;
    const betAmount = Number(amount);

    if (!userId || !fightId || !prediction) {
      return res.status(400).json({ error: 'Missing bet data' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let betRecord;

    await updateDb((db) => {
      const user = findUserById(db, userId);
      const fight = findFightById(db, fightId);
      if (!user || !fight) {
        const error = new Error('User or fight not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      applyDailyBonus(db, user);
      if (user.coins.balance < betAmount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const odds = prediction === 'team1' ? 2.0 : 2.0;
      const now = new Date().toISOString();
      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId,
        fightId: fight.id,
        prediction,
        amount: betAmount,
        odds,
        potentialWinnings: Math.floor(betAmount * odds),
        status: 'pending',
        placedAt: now,
        createdAt: now
      };

      db.bets = Array.isArray(db.bets) ? db.bets : [];
      db.bets.push(betRecord);
      adjustCoins(db, user, -betAmount, 'bet', 'Placed bet');
      return db;
    });

    res.json({ success: true, bet: betRecord });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'User or fight not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ error: 'Insufficient eurodolary' });
    }
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/betting/parlay
router.post('/parlay', auth, async (req, res) => {
  try {
    const { bets, amount, insurance = false } = req.body;
    const betAmount = Number(amount);
    if (!Array.isArray(bets) || bets.length < 2) {
      return res.status(400).json({ error: 'Parlay requires at least 2 fights' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let parlayBet;
    let remainingCoins = 0;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      applyDailyBonus(db, user);

      const insuranceCost = insurance ? Math.ceil(betAmount * 0.15) : 0;
      const totalCost = betAmount + insuranceCost;
      if (user.coins.balance < totalCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const parlayBets = bets.map((bet) => ({
        fightId: bet.fightId,
        prediction: bet.prediction,
        odds: 2.0,
        fightTitle: bet.fightTitle || 'Fight'
      }));

      const totalOdds = parlayBets.reduce((total, bet) => total * bet.odds, 1);
      const now = new Date().toISOString();
      parlayBet = {
        id: uuidv4(),
        _id: uuidv4(),
        userId: req.user.id,
        type: 'parlay',
        parlayBets,
        amount: betAmount,
        totalOdds,
        potentialWinnings: Math.floor(betAmount * totalOdds * 1.2),
        status: 'pending',
        placedAt: now,
        createdAt: now,
        insurance: insurance
          ? { enabled: true, refundPercentage: 25, cost: insuranceCost }
          : { enabled: false }
      };

      db.bets = Array.isArray(db.bets) ? db.bets : [];
      db.bets.push(parlayBet);
      adjustCoins(db, user, -totalCost, 'bet', 'Placed parlay bet');
      remainingCoins = user.coins.balance;
      return db;
    });

    res.json({
      success: true,
      message: 'Parlay bet placed successfully',
      bet: parlayBet,
      remainingCoins
    });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ error: 'Insufficient eurodolary' });
    }
    console.error('Error placing parlay bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/betting/place-parlay (EnhancedBettingSystem)
router.post('/place-parlay', async (req, res) => {
  try {
    const { userId, bets, totalAmount } = req.body;
    const betAmount = Number(totalAmount);

    if (!userId || !Array.isArray(bets) || bets.length < 2) {
      return res.status(400).json({ error: 'Invalid parlay data' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let parlayBet;

    await updateDb((db) => {
      const user = findUserById(db, userId);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      applyDailyBonus(db, user);

      if (user.coins.balance < betAmount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const parlayBets = bets.map((bet) => ({
        fightId: bet.fightId,
        prediction: bet.prediction,
        odds: 2.0,
        fightTitle: bet.fight?.title || 'Fight'
      }));

      const totalOdds = parlayBets.reduce((total, bet) => total * bet.odds, 1);
      const now = new Date().toISOString();
      parlayBet = {
        id: uuidv4(),
        _id: uuidv4(),
        userId,
        type: 'parlay',
        parlayBets,
        amount: betAmount,
        totalOdds,
        potentialWinnings: Math.floor(betAmount * totalOdds),
        status: 'pending',
        placedAt: now,
        createdAt: now
      };

      db.bets = Array.isArray(db.bets) ? db.bets : [];
      db.bets.push(parlayBet);
      adjustCoins(db, user, -betAmount, 'bet', 'Placed parlay bet');
      return db;
    });

    res.json({ success: true, bet: parlayBet });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (error.code === 'INSUFFICIENT_COINS') {
      return res.status(400).json({ error: 'Insufficient eurodolary' });
    }
    console.error('Error placing parlay bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/my-bets
router.get('/my-bets', auth, async (req, res) => {
  try {
    const db = await readDb();
    const bets = (db.bets || []).filter((bet) => bet.userId === req.user.id);
    const fightsById = new Map((db.fights || []).map((fight) => [fight.id, fight]));

    const betsWithDetails = bets.map((bet) => ({
      ...bet,
      fightDetails: bet.fightId ? fightsById.get(bet.fightId) || null : null
    }));

    res.json({ success: true, bets: betsWithDetails });
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/history/:userId
router.get('/history/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const bets = (db.bets || []).filter((bet) => bet.userId === req.params.userId);
    res.json(
      bets.map((bet) => ({
        ...bet,
        result: bet.status === 'pending' ? 'pending' : bet.status,
        winnings: bet.actualWinnings || 0,
        fight: buildAvailableFight(db, findFightById(db, bet.fightId) || {})
      }))
    );
  } catch (error) {
    console.error('Error fetching betting history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/betting/active-bets/:userId
router.get('/active-bets/:userId', async (req, res) => {
  try {
    const db = await readDb();
    const activeBets = (db.bets || []).filter(
      (bet) => bet.userId === req.params.userId && bet.status === 'pending'
    );

    res.json(
      activeBets.map((bet) => ({
        ...bet,
        fight: buildAvailableFight(db, findFightById(db, bet.fightId) || {})
      }))
    );
  } catch (error) {
    console.error('Error fetching active bets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Moderator endpoints
router.get('/moderator/all', auth, roleMiddleware(['moderator']), async (_req, res) => {
  try {
    const db = await readDb();
    const bets = (db.bets || []).map((bet) => ({
      ...bet,
      userId: findUserById(db, bet.userId) || bet.userId,
      fightId: findFightById(db, bet.fightId) || bet.fightId
    }));
    res.json(bets);
  } catch (error) {
    console.error('Error fetching all bets:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/moderator/settle/:betId', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    const { result } = req.body;
    if (!['won', 'lost'].includes(result)) {
      return res.status(400).json({ error: 'Invalid result' });
    }

    await updateDb((db) => {
      const bet = (db.bets || []).find((entry) => entry.id === req.params.betId || entry._id === req.params.betId);
      if (!bet) {
        const error = new Error('Bet not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (bet.status !== 'pending') {
        const error = new Error('Bet already settled');
        error.code = 'ALREADY_SETTLED';
        throw error;
      }

      bet.status = result;
      bet.settledAt = new Date().toISOString();

      const user = findUserById(db, bet.userId);
      if (user && result === 'won') {
        const winnings = bet.actualWinnings || bet.potentialWinnings || 0;
        bet.actualWinnings = winnings;
        adjustCoins(db, user, winnings, 'bet_won', 'Bet winnings');
      }

      return db;
    });

    res.json({ message: 'Bet settled' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Bet not found' });
    }
    if (error.code === 'ALREADY_SETTLED') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error settling bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/moderator/refund/:betId', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    await updateDb((db) => {
      const bet = (db.bets || []).find((entry) => entry.id === req.params.betId || entry._id === req.params.betId);
      if (!bet) {
        const error = new Error('Bet not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (bet.status !== 'pending') {
        const error = new Error('Bet already settled');
        error.code = 'ALREADY_SETTLED';
        throw error;
      }

      bet.status = 'refunded';
      bet.settledAt = new Date().toISOString();

      const user = findUserById(db, bet.userId);
      if (user) {
        adjustCoins(db, user, bet.amount || 0, 'bet_refund', 'Bet refund');
      }

      return db;
    });

    res.json({ message: 'Bet refunded' });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Bet not found' });
    }
    if (error.code === 'ALREADY_SETTLED') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error refunding bet:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
