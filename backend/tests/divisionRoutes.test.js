import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import divisionRoutes from '../routes/divisions.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/divisions', divisionRoutes);

const users = [
  { id: 'division-user-a', username: 'alpha', email: 'alpha@test.invalid', role: 'user' },
  { id: 'division-user-b', username: 'beta', email: 'beta@test.invalid', role: 'user' }
];

const tokenFor = (user) => jwt.sign({
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    tokenVersion: 0
  }
}, process.env.JWT_SECRET, { expiresIn: '5m' });

describe('Division concurrency', () => {
  beforeEach(async () => {
    await writeDb({
      users,
      divisionSeasons: [{
        id: 'regular',
        name: 'Regular People',
        startAt: new Date(Date.now() - 60_000).toISOString(),
        endAt: new Date(Date.now() + 60_000).toISOString(),
        isLocked: false,
        updatedAt: new Date().toISOString()
      }]
    });
  });

  test('allows only one simultaneous reservation of a character in a division', async () => {
    const team = {
      mainCharacter: { id: 'shared-character', name: 'Shared' },
      secondaryCharacter: { id: 'unique-support', name: 'Support' }
    };
    const join = (user, suffix) => request(app)
      .post('/divisions/join')
      .set('x-auth-token', tokenFor(user))
      .send({
        divisionId: 'regular',
        team: {
          ...team,
          secondaryCharacter: { id: `support-${suffix}`, name: `Support ${suffix}` }
        }
      });

    const responses = await Promise.all([
      join(users[0], 'a'),
      join(users[1], 'b')
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 400]);

    const db = await readDb();
    expect(db.users.filter((user) => user.divisions?.regular)).toHaveLength(1);
    expect(
      db.divisionTeamSlots.filter((slot) =>
        slot.divisionId === 'regular' && slot.characterId === 'shared-character'
      )
    ).toHaveLength(1);
  });
});
