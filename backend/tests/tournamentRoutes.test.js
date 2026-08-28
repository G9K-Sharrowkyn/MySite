import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import tournamentRoutes from '../routes/tournaments.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/tournaments', tournamentRoutes);

const users = [
  { id: 'tournament-user', username: 'player', email: 'player@test.invalid', role: 'user' },
  { id: 'tournament-admin', username: 'admin', email: 'admin@test.invalid', role: 'admin' }
];

const tokenFor = (user) =>
  jwt.sign(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tokenVersion: 0
      }
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

const recruitingTournament = {
  id: 'recruiting-tournament',
  title: 'Recruiting',
  status: 'recruiting',
  maxParticipants: 8,
  participants: [],
  settings: {
    mode: 'character',
    teamSize: 1,
    allowedTiers: ['marvel', 'metahuman'],
    excludedCharacters: []
  }
};

const activeTournament = {
  id: 'active-tournament',
  title: 'Active',
  status: 'active',
  maxParticipants: 8,
  participants: [],
  settings: { mode: 'character', voteVisibility: 'live' },
  brackets: [
    {
      matches: [
        {
          id: '0-0',
          status: 'active',
          player1: { userId: 'fighter-a' },
          player2: { userId: 'fighter-b' },
          voters: [],
          votes: { player1: 0, player2: 0 }
        }
      ]
    }
  ]
};

describe('Tournament integrity', () => {
  beforeEach(async () => {
    await writeDb({
      users,
      characters: [
        {
          id: 'allowed-character',
          name: 'Allowed',
          universe: 'Marvel',
          division: 'metahuman'
        },
        {
          id: 'wrong-tier-character',
          name: 'Wrong tier',
          universe: 'Star Wars',
          division: 'godTier'
        }
      ],
      tournaments: [recruitingTournament, activeTournament]
    });
  });

  test('rejects nonexistent and disallowed character identifiers when joining', async () => {
    const auth = { 'x-auth-token': tokenFor(users[0]) };

    const nonexistent = await request(app)
      .post('/tournaments/recruiting-tournament/join')
      .set(auth)
      .send({ characterIds: ['invented-id'] });
    expect(nonexistent.statusCode).toBe(400);

    const wrongTier = await request(app)
      .post('/tournaments/recruiting-tournament/join')
      .set(auth)
      .send({ characterIds: ['wrong-tier-character'] });
    expect(wrongTier.statusCode).toBe(400);

    const valid = await request(app)
      .post('/tournaments/recruiting-tournament/join')
      .set(auth)
      .send({ characterIds: ['allowed-character'] });
    expect(valid.statusCode).toBe(200);
    expect(valid.body.tournament.participants[0].characters).toEqual([
      { id: 'allowed-character', name: 'Allowed' }
    ]);
  });

  test('rejects votes for identities that are not in the match', async () => {
    const response = await request(app)
      .post('/tournaments/active-tournament/matches/0-0/vote')
      .set('x-auth-token', tokenFor(users[0]))
      .send({ winnerId: 'outsider' });

    expect(response.statusCode).toBe(400);
    const db = await readDb();
    expect(db.tournaments[1].brackets[0].matches[0].voters).toHaveLength(0);
  });

  test('allows only staff updates and ignores protected tournament fields', async () => {
    const forbidden = await request(app)
      .put('/tournaments/recruiting-tournament')
      .set('x-auth-token', tokenFor(users[0]))
      .send({ title: 'Hijacked' });
    expect(forbidden.statusCode).toBe(403);

    const response = await request(app)
      .put('/tournaments/recruiting-tournament')
      .set('x-auth-token', tokenFor(users[1]))
      .send({
        title: 'Approved title',
        status: 'completed',
        participants: [{ userId: 'injected' }]
      });
    expect(response.statusCode).toBe(200);
    expect(response.body.title).toBe('Approved title');
    expect(response.body.status).toBe('recruiting');
    expect(response.body.participants).toEqual([]);
  });
});
