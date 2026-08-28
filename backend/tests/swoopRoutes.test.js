import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import swoopRoutes from '../routes/swoop.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/swoop', swoopRoutes);

const user = {
  id: 'swoop-user-1',
  username: 'revan',
  displayName: 'Revan',
  email: 'revan@example.test',
  role: 'user',
  tokenVersion: 0
};

const token = jwt.sign(
  { user: { id: user.id, tokenVersion: 0 } },
  process.env.JWT_SECRET
);

describe('Swoop Racing leaderboards', () => {
  beforeEach(async () => {
    await writeDb({ users: [user], swoopRuns: [] });
  });

  test('requires a signed-in GeekFights account to submit a result', async () => {
    const response = await request(app).post('/swoop/runs').send({
      trackId: 'taris',
      timeMs: 43_856,
      collisions: 0
    });

    expect(response.statusCode).toBe(401);
    expect((await readDb()).swoopRuns).toHaveLength(0);
  });

  test('keeps only the best result for each user and track', async () => {
    const first = await request(app)
      .post('/swoop/runs')
      .set('x-auth-token', token)
      .send({ trackId: 'taris', timeMs: 43_856, collisions: 0 });
    const slower = await request(app)
      .post('/swoop/runs')
      .set('x-auth-token', token)
      .send({ trackId: 'taris', timeMs: 49_000, collisions: 1 });
    const faster = await request(app)
      .post('/swoop/runs')
      .set('x-auth-token', token)
      .send({ trackId: 'taris', timeMs: 42_500, collisions: 0 });

    expect(first.statusCode).toBe(201);
    expect(slower.statusCode).toBe(200);
    expect(slower.body.accepted).toBe(false);
    expect(faster.statusCode).toBe(201);
    expect(faster.body.accepted).toBe(true);

    const db = await readDb();
    expect(db.swoopRuns).toHaveLength(1);
    expect(db.swoopRuns[0]).toMatchObject({
      userId: user.id,
      trackId: 'taris',
      timeMs: 42_500,
      collisions: 0
    });
  });

  test('returns a public per-track leaderboard with account names', async () => {
    await request(app)
      .post('/swoop/runs')
      .set('x-auth-token', token)
      .send({ trackId: 'tatooine', timeMs: 59_000, collisions: 0 });

    const response = await request(app).get('/swoop/leaderboard/tatooine');

    expect(response.statusCode).toBe(200);
    expect(response.body.limit).toBe(100);
    expect(response.body.leaderboard).toEqual([
      expect.objectContaining({
        rank: 1,
        userId: user.id,
        nickname: 'Revan',
        trackId: 'tatooine',
        timeMs: 59_000,
        collisions: 0
      })
    ]);
  });

  test('rejects impossible or malformed runs', async () => {
    const response = await request(app)
      .post('/swoop/runs')
      .set('x-auth-token', token)
      .send({ trackId: 'unknown', timeMs: 1, collisions: -1 });

    expect(response.statusCode).toBe(400);
    expect((await readDb()).swoopRuns).toHaveLength(0);
  });
});
