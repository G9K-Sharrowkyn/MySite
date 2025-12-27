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

const resolveLastBonusKey = (lastBonusDate) => {
  if (!lastBonusDate) return null;
  const parsed = new Date(lastBonusDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateKey(parsed);
};

export const applyDailyBonus = (db, user, amount = 10) => {
  if (!db || !user) return { applied: false, balance: 0 };
  const previousBonusDate = user?.coins?.lastBonusDate;
  ensureCoinAccount(user);

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const lastKey = resolveLastBonusKey(previousBonusDate);

  if (lastKey === todayKey) {
    return { applied: false, balance: user.coins.balance || 0 };
  }

  user.coins.balance = (user.coins.balance || 0) + amount;
  user.coins.totalEarned = (user.coins.totalEarned || 0) + amount;
  user.coins.lastBonusDate = now.toISOString();
  user.virtualCoins = user.coins.balance;

  db.coinTransactions = Array.isArray(db.coinTransactions) ? db.coinTransactions : [];
  db.coinTransactions.push({
    id: uuidv4(),
    _id: uuidv4(),
    userId: resolveUserId(user),
    amount,
    type: 'daily_bonus',
    description: 'Daily eurodolary bonus',
    balance: user.coins.balance,
    createdAt: now.toISOString()
  });

  return { applied: true, balance: user.coins.balance || 0 };
};

export { ensureCoinAccount };
