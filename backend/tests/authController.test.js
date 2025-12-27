import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth.js';
import { updateDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Controller', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPass123!'
  };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterAll(async () => {
    await updateDb((db) => {
      db.users = db.users.filter((user) => user.email !== testUser.email);
      return db;
    });
  });

  test('registers a new user', async () => {
    const response = await request(app).post('/auth/register').send(testUser);
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('userId');
  });

  test('logs in an existing user', async () => {
    const response = await request(app).post('/auth/login').send({
      email: testUser.email,
      password: testUser.password
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('userId');
  });
});
