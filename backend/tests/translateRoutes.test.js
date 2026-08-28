import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import translateRoutes from '../routes/translate.js';
import { writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/translate', translateRoutes);

const user = {
  id: 'translation-user',
  username: 'translation-user',
  email: 'translation@test.invalid',
  role: 'user',
  tokenVersion: 0
};

const token = () =>
  jwt.sign(
    {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        tokenVersion: 0
      }
    },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );

describe('Translation privacy defaults', () => {
  beforeEach(async () => {
    await writeDb({ users: [user] });
  });

  test('reports the provider as disabled unless explicitly configured', async () => {
    const response = await request(app).get('/translate/config');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      enabled: false,
      provider: null,
      privacyNotice: null
    });
  });

  test('does not send text to an external service when disabled', async () => {
    const response = await request(app)
      .post('/translate')
      .set('x-auth-token', token())
      .send({ text: 'private comment' });
    expect(response.statusCode).toBe(503);
  });
});
