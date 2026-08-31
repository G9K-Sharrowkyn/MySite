import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import bettingRoutes from '../routes/betting.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/betting', bettingRoutes);

const user = {
  id: 'betting-user',
  username: 'bettor',
  email: 'bettor@test.invalid',
  role: 'user',
  coins: { balance: 100, totalEarned: 100, totalSpent: 0, dailyActivity: {} },
  virtualCoins: 100
};

const token = () => jwt.sign({
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    tokenVersion: 0
  }
}, process.env.JWT_SECRET, { expiresIn: '5m' });

describe('Betting concurrency', () => {
  beforeEach(async () => {
    await writeDb({
      users: [user],
      fights: [{
        id: 'betting-fight',
        title: 'Concurrency fight',
        status: 'active',
        voteVisibility: 'live',
        votes: { teamA: 0, teamB: 0, draw: 0 }
      }]
    });
  });

  test('cannot overspend the same balance with simultaneous bets', async () => {
    const placeBet = () => request(app)
      .post('/betting/fight/betting-fight')
      .set('x-auth-token', token())
      .send({ predictedWinner: 'A', betAmount: 80 });

    const responses = await Promise.all([placeBet(), placeBet()]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);

    const db = await readDb();
    expect(db.bets).toHaveLength(1);
    expect(db.users[0].coins.balance).toBe(20);
    expect(db.coinTransactions).toHaveLength(1);
    expect(db.coinTransactions[0].amount).toBe(-80);
  });
});
