import express from 'express';
import auth from '../middleware/auth.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { readDb, withDb } from '../repositories/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const resolveUserId = (user) => user?.id || user?._id;

const normalizeOutcome = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  if (['a', 'teama', 'team a', 'team1', 'team 1', 'fighter1', 'fighter 1'].includes(normalized)) {
    return 'A';
  }
  if (['b', 'teamb', 'team b', 'team2', 'team 2', 'fighter2', 'fighter 2'].includes(normalized)) {
    return 'B';
  }
  if (['draw', 'tie'].includes(normalized)) {
    return 'draw';
  }

  // Keep backwards-compat for any legacy values already stored.
  if (normalized === 'team1') return 'A';
  if (normalized === 'team2') return 'B';

  return null;
};

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const findFightById = (db, fightId) =>
  (db.fights || []).find((entry) => entry.id === fightId);

const resolveFightContext = (db, fightId) => {
  const id = String(fightId || '');
  if (!id) return null;

  const postFight = (db.posts || []).find(
    (post) => (post.id || post._id) === id && post.type === 'fight' && post.fight
  );
  if (postFight) {
    return {
      source: 'post',
      id: postFight.id || postFight._id,
      container: postFight,
      fight: postFight.fight
    };
  }

  const divisionFight = (db.divisionFights || []).find(
    (entry) => (entry.id || entry._id) === id && entry.fight
  );
  if (divisionFight) {
    return {
      source: 'division',
      id: divisionFight.id || divisionFight._id,
      container: divisionFight,
      fight: divisionFight.fight
    };
  }

  const standalone = findFightById(db, id);
  if (standalone) {
    return {
      source: 'fight',
      id: standalone.id || standalone._id,
      container: standalone,
      // Some legacy fights store the payload at the top-level; keep it flexible.
      fight: standalone.fight || standalone
    };
  }

  return null;
};

const buildContextFromFight = (fight) => {
  if (!fight) return null;
  const id = fight.id || fight._id;
  if (!id) return null;
  return {
    source: 'fight',
    id,
    container: fight,
    // Some legacy fights store the payload at the top-level; keep it flexible.
    fight: fight.fight || fight
  };
};

const getVoteVisibilitySetting = (fight) => {
  const raw = String(fight?.voteVisibility || 'live').trim().toLowerCase();
  if (raw === 'final' || raw === 'hidden') return 'final';
  return 'live';
};

const getFightLockTime = (context) => {
  if (!context) return null;
  const bettingCloses = context.container?.bettingCloses || context.fight?.bettingCloses;
  if (bettingCloses) return bettingCloses;
  const bettingWindowClose =
    context.container?.betting?.bettingWindow?.closeTime ||
    context.fight?.betting?.bettingWindow?.closeTime;
  if (bettingWindowClose) return bettingWindowClose;
  const fromFight = context.fight?.lockTime || null;
  if (fromFight) return fromFight;

  // Fallback for legacy fight types.
  if (context.container?.endDate) return context.container.endDate;
  if (context.container?.timer?.endTime) return context.container.timer.endTime;
  return null;
};

const getVoteRevealTime = (context) => {
  if (!context) return null;
  const fromFight = context.fight?.lockTime || null;
  if (fromFight) return fromFight;
  if (context.container?.endTime) return context.container.endTime;
  if (context.container?.endDate) return context.container.endDate;
  if (context.container?.timer?.endTime) return context.container.timer.endTime;
  return null;
};

const getFightVoteCounts = (context) => {
  const votes = context?.fight?.votes || context?.container?.votes || {};
  const teamA = Number(votes.teamA || context?.container?.votesA || 0) || 0;
  const teamB = Number(votes.teamB || context?.container?.votesB || 0) || 0;
  const draw = Number(votes.draw || 0) || 0;
  return { A: teamA, B: teamB, draw };
};

const getFightBetStats = (db, fightId) => {
  const stats = {
    A: { count: 0, amount: 0 },
    B: { count: 0, amount: 0 },
    draw: { count: 0, amount: 0 },
    totalCount: 0,
    totalAmount: 0
  };

  (db.bets || [])
    .filter((bet) => bet?.fightId === fightId && (bet.status || 'pending') === 'pending')
    .forEach((bet) => {
      const prediction = normalizeOutcome(bet.prediction || bet.predictedWinner || bet.selectedTeam);
      if (!prediction) return;
      const amount = Number(bet.amount || 0) || 0;
      if (amount <= 0) return;

      stats[prediction].count += 1;
      stats[prediction].amount += amount;
      stats.totalCount += 1;
      stats.totalAmount += amount;
    });

  return stats;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const computeDynamicOdds = ({ votes, bets, isBlind }) => {
  // Tunable knobs (all in "virtual stake" units).
  const PRIOR = 100; // stabilizes odds when there are few bets
  const BET_COUNT_WEIGHT = 5; // 1 bet ~= +5 virtual stake
  const VOTE_WEIGHT = 10; // 1 vote ~= +10 virtual stake (live-votes mode only)

  // House edge: keep blind mode a bit more rewarding (closer to "3.00" baseline).
  const HOUSE_EDGE = isBlind ? 0.0 : 0.08;

  const impliedA = PRIOR + bets.A.amount + BET_COUNT_WEIGHT * bets.A.count + (isBlind ? 0 : VOTE_WEIGHT * votes.A);
  const impliedB = PRIOR + bets.B.amount + BET_COUNT_WEIGHT * bets.B.count + (isBlind ? 0 : VOTE_WEIGHT * votes.B);
  const impliedD = PRIOR + bets.draw.amount + BET_COUNT_WEIGHT * bets.draw.count + (isBlind ? 0 : VOTE_WEIGHT * votes.draw);
  const totalPool = impliedA + impliedB + impliedD;

  const rawA = (totalPool * (1 - HOUSE_EDGE)) / Math.max(1, impliedA);
  const rawB = (totalPool * (1 - HOUSE_EDGE)) / Math.max(1, impliedB);
  const rawD = (totalPool * (1 - HOUSE_EDGE)) / Math.max(1, impliedD);

  // Keep odds sane and UI-friendly.
  const MAX_ODDS = 50;
  const MIN_ODDS = 1.01;

  return {
    A: clamp(rawA, MIN_ODDS, MAX_ODDS),
    B: clamp(rawB, MIN_ODDS, MAX_ODDS),
    draw: clamp(rawD, MIN_ODDS, MAX_ODDS)
  };
};

const getBetLimits = (isBlind) => {
  // User requirement: visible-votes betting should have ~1/5 the staking power of blind betting.
  const minBet = 1;
  const maxBetBlind = 1000;
  const maxBetLive = Math.max(minBet, Math.floor(maxBetBlind / 5));
  return {
    minBet,
    maxBet: isBlind ? maxBetBlind : maxBetLive
  };
};

const buildOddsPayload = (db, context, now = new Date()) => {
  const fight = context?.fight || {};
  const lockTimeValue = getVoteRevealTime(context);
  const lockTime = lockTimeValue ? new Date(lockTimeValue) : null;
  const voteVisibility = getVoteVisibilitySetting(fight);
  const hasLock = lockTime && Number.isFinite(lockTime.getTime());
  const shouldRevealVotes =
    voteVisibility !== 'final' ||
    !hasLock ||
    (fight.status && fight.status !== 'active') ||
    now >= lockTime;

  const isBlind = voteVisibility === 'final' && !shouldRevealVotes;
  const votes = getFightVoteCounts(context);
  const bets = getFightBetStats(db, context.id);
  const odds = computeDynamicOdds({ votes, bets, isBlind });
  const limits = getBetLimits(isBlind);

  return {
    ...odds,
    meta: {
      voteVisibility,
      isBlind,
      minBet: limits.minBet,
      maxBet: limits.maxBet,
      // Helpful for UI decisions if needed later.
      lockTime: hasLock ? lockTime.toISOString() : null
    }
  };
};

const ensureCoinAccount = (user) => {
  if (!user) return;
  user.coins = user.coins || {
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    lastBonusDate: new Date().toISOString()
  };
  if (!user.coins.dailyActivity || typeof user.coins.dailyActivity !== 'object') {
    user.coins.dailyActivity = {};
  }
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

const buildBettingFight = (db, fight, now = new Date()) => {
  const bettingWindow = getBettingWindow(fight);
  const totals = getFightBettingTotals(db, fight.id);
  const context = buildContextFromFight(fight) || resolveFightContext(db, fight.id);
  const oddsPayload = context ? buildOddsPayload(db, context, now) : null;
  const oddsA = Number(oddsPayload?.A || fight?.betting?.oddsA || 2.0);
  const oddsB = Number(oddsPayload?.B || fight?.betting?.oddsB || 2.0);
  const oddsDraw = Number(oddsPayload?.draw || fight?.betting?.oddsDraw || 3.0);
  const isBlind = Boolean(oddsPayload?.meta?.isBlind);
  const votes = context ? getFightVoteCounts(context) : { A: fight.votesA || 0, B: fight.votesB || 0, draw: 0 };

  return {
    ...fight,
    _id: fight.id,
    betting: {
      enabled: true,
      oddsA,
      oddsB,
      oddsDraw,
      bettingWindow,
      totalBetsA: totals.totalBetsA,
      totalBetsB: totals.totalBetsB,
      meta: oddsPayload?.meta || {}
    },
    votesA: isBlind ? 0 : votes.A || 0,
    votesB: isBlind ? 0 : votes.B || 0,
    votesHidden: isBlind
  };
};

const buildAvailableFight = (db, fight, now = new Date()) => {
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
  const context = buildContextFromFight(fight) || resolveFightContext(db, fight.id);
  const oddsPayload = context ? buildOddsPayload(db, context, now) : null;

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
    odds: {
      team1: Number(oddsPayload?.A || 2.0),
      team2: Number(oddsPayload?.B || 2.0),
      draw: Number(oddsPayload?.draw || 3.0)
    },
    bettingMeta: oddsPayload?.meta || {},
    votesHidden: Boolean(oddsPayload?.meta?.isBlind),
    bettingEndTime: getBettingWindow(fight).closeTime
  };
};

// GET /api/betting/fights
router.get('/fights', auth, async (_req, res) => {
  try {
    const db = await readDb();
    const now = new Date();
    const fights = (db.fights || [])
      .filter((fight) => fight.status === 'active')
      .map((fight) => buildBettingFight(db, fight, now));

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
    const now = new Date();
    const fights = (db.fights || [])
      .filter((fight) => fight.status === 'active')
      .map((fight) => buildAvailableFight(db, fight, now));
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
    const context = resolveFightContext(db, req.params.fightId);
    if (!context) {
      return res.status(404).json({ error: 'Fight not found' });
    }

    res.json(buildOddsPayload(db, context));
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/betting/fight/:fightId (simple betting panel)
router.post('/fight/:fightId', auth, async (req, res) => {
  try {
    const { predictedWinner, betAmount } = req.body;
    const prediction = normalizeOutcome(predictedWinner);
    const amount = Number(betAmount);

    if (!prediction || !amount || amount < 1) {
      return res.status(400).json({ message: 'Invalid bet data' });
    }

    let newBalance = 0;
    let betRecord;

    await withDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);
      if (user.coins.balance < amount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const context = resolveFightContext(db, req.params.fightId);
      if (!context) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const now = new Date();
      const lockTimeValue = getFightLockTime(context);
      if (lockTimeValue) {
        const lockTime = new Date(lockTimeValue);
        if (Number.isFinite(lockTime.getTime()) && now >= lockTime) {
          const error = new Error('Betting window is closed');
          error.code = 'BETTING_CLOSED';
          throw error;
        }
      }

      const oddsPayload = buildOddsPayload(db, context, now);
      const isBlind = Boolean(oddsPayload?.meta?.isBlind);
      const limits = getBetLimits(isBlind);

      if (amount < limits.minBet) {
        const error = new Error(`Minimum bet is ${limits.minBet}`);
        error.code = 'BET_TOO_SMALL';
        throw error;
      }
      if (amount > limits.maxBet) {
        const error = new Error(`Maximum bet is ${limits.maxBet}`);
        error.code = 'BET_TOO_LARGE';
        throw error;
      }

      const odds = oddsPayload[prediction] || 2.0;
      const nowIso = new Date().toISOString();
      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId: req.user.id,
        fightId: context.id,
        prediction,
        selectedTeam: prediction,
        amount,
        odds,
        potentialWinnings: Math.floor(amount * odds),
        status: 'pending',
        placedAt: nowIso,
        createdAt: nowIso
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
    if (error.code === 'BETTING_CLOSED') {
      return res.status(400).json({ message: 'Betting window is closed' });
    }
    if (error.code === 'BET_TOO_SMALL' || error.code === 'BET_TOO_LARGE') {
      return res.status(400).json({ message: error.message });
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
    const normalizedPrediction = normalizeOutcome(prediction);

    if (!['A', 'B', 'draw'].includes(normalizedPrediction)) {
      return res.status(400).json({ error: 'Invalid prediction' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Minimum bet is 1 eurodolar' });
    }

    let betRecord;
    let remainingCoins = 0;

    await withDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      ensureCoinAccount(user);

      const context = resolveFightContext(db, req.params.fightId);
      if (!context) {
        const error = new Error('Fight not found');
        error.code = 'FIGHT_NOT_FOUND';
        throw error;
      }

      const now = new Date();
      const lockTimeValue = getFightLockTime(context);
      if (lockTimeValue) {
        const lockTime = new Date(lockTimeValue);
        if (Number.isFinite(lockTime.getTime()) && now >= lockTime) {
          const error = new Error('Betting window is closed');
          error.code = 'BETTING_CLOSED';
          throw error;
        }
      }

      const oddsPayload = buildOddsPayload(db, context, now);
      const isBlind = Boolean(oddsPayload?.meta?.isBlind);
      const limits = getBetLimits(isBlind);

      if (betAmount < limits.minBet) {
        const error = new Error(`Minimum bet is ${limits.minBet}`);
        error.code = 'BET_TOO_SMALL';
        throw error;
      }
      if (betAmount > limits.maxBet) {
        const error = new Error(`Maximum bet is ${limits.maxBet}`);
        error.code = 'BET_TOO_LARGE';
        throw error;
      }

      const odds = oddsPayload?.[normalizedPrediction] || 2.0;
      const nowIso = new Date().toISOString();
      const insuranceCost = insurance ? Math.ceil(betAmount * 0.1) : 0;
      const totalCost = betAmount + insuranceCost;

      if (user.coins.balance < totalCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId: req.user.id,
        fightId: context.id,
        prediction: normalizedPrediction,
        selectedTeam: normalizedPrediction,
        amount: betAmount,
        odds,
        potentialWinnings: Math.floor(betAmount * odds),
        status: 'pending',
        placedAt: nowIso,
        createdAt: nowIso,
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
    if (error.code === 'BETTING_CLOSED') {
      return res.status(400).json({ error: 'Betting window is closed' });
    }
    if (error.code === 'BET_TOO_SMALL' || error.code === 'BET_TOO_LARGE') {
      return res.status(400).json({ error: error.message });
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
    const normalizedPrediction = normalizeOutcome(prediction);

    if (!userId || !fightId || !prediction) {
      return res.status(400).json({ error: 'Missing bet data' });
    }
    if (!normalizedPrediction) {
      return res.status(400).json({ error: 'Invalid prediction' });
    }
    if (!betAmount || betAmount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    let betRecord;

    await withDb((db) => {
      const user = findUserById(db, userId);
      const context = resolveFightContext(db, fightId);
      if (!user || !context) {
        const error = new Error('User or fight not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      ensureCoinAccount(user);
      if (user.coins.balance < betAmount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const now = new Date();
      const lockTimeValue = getFightLockTime(context);
      if (lockTimeValue) {
        const lockTime = new Date(lockTimeValue);
        if (Number.isFinite(lockTime.getTime()) && now >= lockTime) {
          const error = new Error('Betting window is closed');
          error.code = 'BETTING_CLOSED';
          throw error;
        }
      }

      const oddsPayload = buildOddsPayload(db, context, now);
      const isBlind = Boolean(oddsPayload?.meta?.isBlind);
      const limits = getBetLimits(isBlind);

      if (betAmount < limits.minBet) {
        const error = new Error(`Minimum bet is ${limits.minBet}`);
        error.code = 'BET_TOO_SMALL';
        throw error;
      }
      if (betAmount > limits.maxBet) {
        const error = new Error(`Maximum bet is ${limits.maxBet}`);
        error.code = 'BET_TOO_LARGE';
        throw error;
      }

      const odds = oddsPayload?.[normalizedPrediction] || 2.0;
      const nowIso = new Date().toISOString();
      betRecord = {
        id: uuidv4(),
        _id: uuidv4(),
        userId,
        fightId: context.id,
        prediction,
        selectedTeam: normalizedPrediction,
        amount: betAmount,
        odds,
        potentialWinnings: Math.floor(betAmount * odds),
        status: 'pending',
        placedAt: nowIso,
        createdAt: nowIso
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
    if (error.code === 'BETTING_CLOSED') {
      return res.status(400).json({ error: 'Betting window is closed' });
    }
    if (error.code === 'BET_TOO_SMALL' || error.code === 'BET_TOO_LARGE') {
      return res.status(400).json({ error: error.message });
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

    await withDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      ensureCoinAccount(user);

      const insuranceCost = insurance ? Math.ceil(betAmount * 0.15) : 0;
      const totalCost = betAmount + insuranceCost;
      if (user.coins.balance < totalCost) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const now = new Date();
      const parlayBets = bets.map((bet) => {
        const context = resolveFightContext(db, bet.fightId);
        if (!context) {
          const error = new Error('Fight not found');
          error.code = 'FIGHT_NOT_FOUND';
          throw error;
        }
        const lockTimeValue = getFightLockTime(context);
        if (lockTimeValue) {
          const lockTime = new Date(lockTimeValue);
          if (Number.isFinite(lockTime.getTime()) && now >= lockTime) {
            const error = new Error('Betting window is closed');
            error.code = 'BETTING_CLOSED';
            throw error;
          }
        }
        const normalizedPrediction = normalizeOutcome(bet.prediction);
        if (!normalizedPrediction) {
          const error = new Error('Invalid prediction');
          error.code = 'INVALID_PREDICTION';
          throw error;
        }
        const oddsPayload = buildOddsPayload(db, context, now);
        const odds = oddsPayload?.[normalizedPrediction] || 2.0;
        return {
          fightId: context.id,
          prediction: bet.prediction,
          normalizedPrediction,
          odds,
          isBlind: Boolean(oddsPayload?.meta?.isBlind),
          fightTitle: bet.fightTitle || context.fight?.title || 'Fight'
        };
      });

      const parlayIsBlind = parlayBets.every((bet) => bet.isBlind);
      const limits = getBetLimits(parlayIsBlind);
      if (betAmount < limits.minBet) {
        const error = new Error(`Minimum bet is ${limits.minBet}`);
        error.code = 'BET_TOO_SMALL';
        throw error;
      }
      if (betAmount > limits.maxBet) {
        const error = new Error(`Maximum bet is ${limits.maxBet}`);
        error.code = 'BET_TOO_LARGE';
        throw error;
      }

      const totalOdds = parlayBets.reduce((total, bet) => total * bet.odds, 1);
      const nowIso = new Date().toISOString();
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
        placedAt: nowIso,
        createdAt: nowIso,
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
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ error: 'Fight not found' });
    }
    if (error.code === 'INVALID_PREDICTION') {
      return res.status(400).json({ error: 'Invalid prediction' });
    }
    if (error.code === 'BETTING_CLOSED') {
      return res.status(400).json({ error: 'Betting window is closed' });
    }
    if (error.code === 'BET_TOO_SMALL' || error.code === 'BET_TOO_LARGE') {
      return res.status(400).json({ error: error.message });
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

    await withDb((db) => {
      const user = findUserById(db, userId);
      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }
      ensureCoinAccount(user);

      if (user.coins.balance < betAmount) {
        const error = new Error('Insufficient eurodolary');
        error.code = 'INSUFFICIENT_COINS';
        throw error;
      }

      const now = new Date();
      const parlayBets = bets.map((bet) => {
        const context = resolveFightContext(db, bet.fightId);
        if (!context) {
          const error = new Error('Fight not found');
          error.code = 'FIGHT_NOT_FOUND';
          throw error;
        }
        const lockTimeValue = getFightLockTime(context);
        if (lockTimeValue) {
          const lockTime = new Date(lockTimeValue);
          if (Number.isFinite(lockTime.getTime()) && now >= lockTime) {
            const error = new Error('Betting window is closed');
            error.code = 'BETTING_CLOSED';
            throw error;
          }
        }
        const normalizedPrediction = normalizeOutcome(bet.prediction);
        if (!normalizedPrediction) {
          const error = new Error('Invalid prediction');
          error.code = 'INVALID_PREDICTION';
          throw error;
        }
        const oddsPayload = buildOddsPayload(db, context, now);
        const odds = oddsPayload?.[normalizedPrediction] || 2.0;
        return {
          fightId: context.id,
          prediction: bet.prediction,
          normalizedPrediction,
          odds,
          isBlind: Boolean(oddsPayload?.meta?.isBlind),
          fightTitle: bet.fight?.title || context.fight?.title || 'Fight'
        };
      });

      const parlayIsBlind = parlayBets.every((bet) => bet.isBlind);
      const limits = getBetLimits(parlayIsBlind);
      if (betAmount < limits.minBet) {
        const error = new Error(`Minimum bet is ${limits.minBet}`);
        error.code = 'BET_TOO_SMALL';
        throw error;
      }
      if (betAmount > limits.maxBet) {
        const error = new Error(`Maximum bet is ${limits.maxBet}`);
        error.code = 'BET_TOO_LARGE';
        throw error;
      }

      const totalOdds = parlayBets.reduce((total, bet) => total * bet.odds, 1);
      const nowIso = new Date().toISOString();
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
        placedAt: nowIso,
        createdAt: nowIso
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
    if (error.code === 'FIGHT_NOT_FOUND') {
      return res.status(404).json({ error: 'Fight not found' });
    }
    if (error.code === 'INVALID_PREDICTION') {
      return res.status(400).json({ error: 'Invalid prediction' });
    }
    if (error.code === 'BETTING_CLOSED') {
      return res.status(400).json({ error: 'Betting window is closed' });
    }
    if (error.code === 'BET_TOO_SMALL' || error.code === 'BET_TOO_LARGE') {
      return res.status(400).json({ error: error.message });
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
router.get('/moderator/all', auth, roleMiddleware(['moderator', 'admin']), async (_req, res) => {
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

    await withDb((db) => {
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
    await withDb((db) => {
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

