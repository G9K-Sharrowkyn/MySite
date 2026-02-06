import { v4 as uuidv4 } from 'uuid';

const resolveUserId = (user) => user?.id || user?._id;

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

const getLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DAILY_ACTIVITY_REWARDS = {
  login: 50,
  post: 100,
  comment: 50,
  reaction: 50,
  message: 50
};

const normalizeActivity = (activity) =>
  String(activity || '').trim().toLowerCase();

export const applyDailyActivityBonus = (db, user, activity, amountOverride) => {
  if (!db || !user) return { applied: false, balance: 0 };
  const action = normalizeActivity(activity);
  if (!action) return { applied: false, balance: user?.coins?.balance || 0 };

  ensureCoinAccount(user);
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const lastKey = user.coins.dailyActivity?.[action] || null;

  if (lastKey === todayKey) {
    return { applied: false, balance: user.coins.balance || 0 };
  }

  const amount =
    Number.isFinite(amountOverride) && amountOverride > 0
      ? amountOverride
      : DAILY_ACTIVITY_REWARDS[action] || 0;

  if (!amount) {
    return { applied: false, balance: user.coins.balance || 0 };
  }

  user.coins.balance = (user.coins.balance || 0) + amount;
  user.coins.totalEarned = (user.coins.totalEarned || 0) + amount;
  user.coins.dailyActivity[action] = todayKey;
  user.virtualCoins = user.coins.balance;

  db.coinTransactions = Array.isArray(db.coinTransactions) ? db.coinTransactions : [];
  db.coinTransactions.push({
    id: uuidv4(),
    _id: uuidv4(),
    userId: resolveUserId(user),
    amount,
    type: 'daily_activity',
    description: `Daily ${action} bonus`,
    balance: user.coins.balance,
    createdAt: now.toISOString()
  });

  return { applied: true, balance: user.coins.balance || 0, amount, action };
};

// Legacy helper kept for compatibility (defaults to login bonus).
export const applyDailyBonus = (db, user, amount = DAILY_ACTIVITY_REWARDS.login) =>
  applyDailyActivityBonus(db, user, 'login', amount);

export { ensureCoinAccount };
