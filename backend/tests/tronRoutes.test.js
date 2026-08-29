import express from 'express';
import request from 'supertest';
import tronRoutes from '../routes/tron.js';
import { readDb, writeDb } from '../services/jsonDb.js';
import { recordTronWin } from '../services/tronLeaderboard.js';

const app = express();
app.use(express.json());
app.use('/tron', tronRoutes);

const users = [
  { id: 'tron-user-1', username: 'quorra', displayName: 'Quorra' },
  { id: 'tron-user-2', username: 'sam', displayName: 'Sam Flynn' }
];

describe('TRON monthly leaderboard', () => {
  beforeEach(async () => {
    await writeDb({ users, tronWins: [] });
  });

  test('aggregates authenticated server-recorded victories by month', async () => {
    await recordTronWin({
      userId: users[0].id,
      nickname: users[0].displayName,
      roomId: 'arena-a',
      round: 1,
      wonAt: new Date('2026-08-03T12:00:00.000Z')
    });
    await recordTronWin({
      userId: users[0].id,
      nickname: users[0].displayName,
      roomId: 'arena-a',
      round: 2,
      wonAt: new Date('2026-08-03T12:05:00.000Z')
    });
    await recordTronWin({
      userId: users[1].id,
      nickname: users[1].displayName,
      roomId: 'arena-b',
      round: 1,
      wonAt: new Date('2026-08-04T12:00:00.000Z')
    });

    const response = await request(app).get('/tron/leaderboard?month=2026-08');

    expect(response.statusCode).toBe(200);
    expect(response.body.limit).toBe(100);
    expect(response.body.leaderboard).toEqual([
      expect.objectContaining({ rank: 1, userId: users[0].id, nickname: 'Quorra', wins: 2 }),
      expect.objectContaining({ rank: 2, userId: users[1].id, nickname: 'Sam Flynn', wins: 1 })
    ]);
  });

  test('records a room round only once and ignores guests', async () => {
    const win = {
      userId: users[0].id,
      nickname: users[0].displayName,
      roomId: 'arena-once',
      round: 7,
      wonAt: new Date('2026-08-05T12:00:00.000Z')
    };
    expect((await recordTronWin(win)).recorded).toBe(true);
    expect((await recordTronWin(win)).recorded).toBe(false);
    expect((await recordTronWin({ ...win, userId: 'guest:socket' })).recorded).toBe(false);
    expect((await readDb()).tronWins).toHaveLength(1);
  });

  test('rejects malformed month keys', async () => {
    const response = await request(app).get('/tron/leaderboard?month=2026-13');
    expect(response.statusCode).toBe(400);
  });
});
