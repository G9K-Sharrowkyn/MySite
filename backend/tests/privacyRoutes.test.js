import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import privacyRoutes from '../routes/privacy.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/privacy', privacyRoutes);

const deletedUserId = 'privacy-user';
const avatarName = `privacy-test-${process.pid}.jpg`;
const avatarPath = `/uploads/avatars/${avatarName}`;
const avatarFile = path.resolve('uploads', 'avatars', avatarName);

const token = () =>
  jwt.sign(
    {
      user: {
        id: deletedUserId,
        username: 'privacy-user',
        role: 'user',
        tokenVersion: 0
      }
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

describe('Privacy routes', () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(avatarFile), { recursive: true });
    await fs.writeFile(avatarFile, 'temporary profile upload');
    const password = await bcrypt.hash('Delete-Me-2026!', 4);
    await writeDb({
      users: [
        {
          id: deletedUserId,
          username: 'privacy-user',
          email: 'privacy@test.invalid',
          role: 'user',
          password,
          tokenVersion: 0,
          profile: { profilePicture: avatarPath, avatar: avatarPath }
        },
        {
          id: 'remaining-user',
          username: 'remaining',
          email: 'remaining@test.invalid',
          role: 'user'
        }
      ],
      posts: [
        {
          id: 'remaining-post',
          authorId: 'remaining-user',
          likes: [deletedUserId],
          reactions: [{ userId: deletedUserId, icon: 'like' }],
          poll: { votes: { voters: [{ userId: deletedUserId, optionIndex: 0 }] } },
          fight: {
            teams: [{}, {}],
            votes: {
              voters: [
                { userId: deletedUserId, team: 'teamA' },
                { userId: 'remaining-user', team: 'teamB' }
              ],
              teams: [1, 1],
              teamA: 1,
              teamB: 1,
              draw: 0
            }
          }
        }
      ],
      tournaments: [
        {
          id: 'remaining-tournament',
          createdBy: 'remaining-user',
          participants: [{ userId: deletedUserId, username: 'privacy-user' }],
          brackets: [
            {
              matches: [
                {
                  player1: { userId: deletedUserId, username: 'privacy-user' },
                  player2: { userId: 'remaining-user', username: 'remaining' },
                  voters: [{ userId: deletedUserId, votedFor: 'remaining-user' }]
                }
              ]
            }
          ]
        }
      ],
      messages: [{ id: 'private-message', senderId: deletedUserId }],
      moderatorActionLogs: [
        {
          id: 'audit-entry',
          actorId: deletedUserId,
          actorUsername: 'privacy-user',
          targetUserId: 'remaining-user'
        }
      ]
    });
  });

  afterEach(async () => {
    await fs.unlink(avatarFile).catch(() => {});
  });

  test('erases account data, nested interactions and managed profile uploads', async () => {
    const response = await request(app)
      .delete('/privacy/delete-account')
      .set('x-auth-token', token())
      .send({ password: 'Delete-Me-2026!', confirmation: 'DELETE' });

    expect(response.statusCode).toBe(200);
    const db = await readDb();
    expect(db.users.map((user) => user.id)).not.toContain(deletedUserId);
    expect(db.messages).toHaveLength(0);
    expect(db.posts[0].likes).toHaveLength(0);
    expect(db.posts[0].reactions).toHaveLength(0);
    expect(db.posts[0].poll.votes.voters).toHaveLength(0);
    expect(db.posts[0].fight.votes.voters).toHaveLength(1);
    expect(db.posts[0].fight.votes.teams).toEqual([0, 1]);
    expect(db.tournaments[0].participants).toHaveLength(0);
    expect(db.tournaments[0].brackets[0].matches[0].player1.userId).toBeNull();
    expect(db.tournaments[0].brackets[0].matches[0].voters).toHaveLength(0);
    expect(db.moderatorActionLogs[0].actorId).toBeNull();
    await expect(fs.stat(avatarFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('requires the current password and explicit confirmation', async () => {
    const wrongPassword = await request(app)
      .delete('/privacy/delete-account')
      .set('x-auth-token', token())
      .send({ password: 'wrong', confirmation: 'DELETE' });
    expect(wrongPassword.statusCode).toBe(400);

    const wrongConfirmation = await request(app)
      .delete('/privacy/delete-account')
      .set('x-auth-token', token())
      .send({ password: 'Delete-Me-2026!', confirmation: 'delete' });
    expect(wrongConfirmation.statusCode).toBe(400);
  });
});
