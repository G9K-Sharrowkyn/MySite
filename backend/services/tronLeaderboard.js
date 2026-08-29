import { randomUUID } from 'crypto';
import { readDb, withDb } from '../repositories/index.js';

export const TRON_LEADERBOARD_LIMIT = 100;

const resolveUserId = (user) => user?.id || user?._id || null;

export const getTronMonthKey = (date = new Date()) => {
  const resolved = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(resolved.getTime())) return null;
  return `${resolved.getUTCFullYear()}-${String(resolved.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const normalizeTronMonthKey = (value, now = new Date()) => {
  const normalized = String(value || '').trim();
  if (!normalized) return getTronMonthKey(now);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) return null;
  return normalized;
};

const resolveNickname = (user, fallback) =>
  user?.displayName ||
  user?.profile?.displayName ||
  user?.username ||
  fallback ||
  'Program';

export const buildTronLeaderboard = (db, monthKey) => {
  const usersById = new Map(
    (db.users || []).map((user) => [String(resolveUserId(user)), user])
  );
  const totals = new Map();
  for (const win of db.tronWins || []) {
    if (win.monthKey !== monthKey || !win.userId) continue;
    const userId = String(win.userId);
    const current = totals.get(userId) || {
      userId,
      wins: 0,
      lastWinAt: null,
      nickname: win.nickname || 'Program'
    };
    current.wins += 1;
    if (!current.lastWinAt || String(win.wonAt) > current.lastWinAt) {
      current.lastWinAt = win.wonAt;
      current.nickname = win.nickname || current.nickname;
    }
    totals.set(userId, current);
  }

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      nickname: resolveNickname(usersById.get(entry.userId), entry.nickname)
    }))
    .sort((left, right) => (
      right.wins - left.wins ||
      String(left.lastWinAt || '').localeCompare(String(right.lastWinAt || '')) ||
      left.nickname.localeCompare(right.nickname)
    ))
    .slice(0, TRON_LEADERBOARD_LIMIT)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
};

export const getTronLeaderboard = async (monthKey) => {
  const db = await readDb();
  const availableMonths = [...new Set(
    (db.tronWins || []).map((win) => win.monthKey).filter(Boolean)
  )].sort().reverse();
  if (!availableMonths.includes(monthKey)) availableMonths.unshift(monthKey);
  return {
    monthKey,
    limit: TRON_LEADERBOARD_LIMIT,
    availableMonths,
    leaderboard: buildTronLeaderboard(db, monthKey)
  };
};

export const recordTronWin = async ({ userId, nickname, roomId, round, wonAt = new Date() }) => {
  if (!userId || String(userId).startsWith('guest:')) return { recorded: false, monthKey: null };
  const monthKey = getTronMonthKey(wonAt);
  const normalizedWonAt = new Date(wonAt).toISOString();
  let recorded = false;

  await withDb(async (db) => {
    const normalizedUserId = String(userId);
    const user = (db.users || []).find(
      (entry) => String(resolveUserId(entry)) === normalizedUserId
    );
    if (!user) return;
    db.tronWins = Array.isArray(db.tronWins) ? db.tronWins : [];
    const alreadyRecorded = db.tronWins.some((win) => (
      win.roomId === roomId &&
      Number(win.round) === Number(round) &&
      String(win.userId) === normalizedUserId
    ));
    if (alreadyRecorded) return;
    db.tronWins.push({
      id: `tron-win:${randomUUID()}`,
      userId: normalizedUserId,
      nickname: resolveNickname(user, nickname),
      roomId,
      round: Number(round),
      monthKey,
      wonAt: normalizedWonAt
    });
    recorded = true;
  });

  return { recorded, monthKey };
};
