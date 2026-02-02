import request from 'supertest';
import http from 'http';
import app from '../app.js';

const server = http.createServer(app);

describe('Auth endpoints', () => {
  beforeAll(() => server.listen(0));
  afterAll(() => server.close());

  test('register and login', async () => {
    const timestamp = Date.now();
    const email = `test_${timestamp}@example.com`;
    const username = `test_${timestamp}`;

    const resReg = await request(server)
      .post('/api/auth/register')
      .send({ username, email, password: 'pass123' })
      .expect(201);
    expect(resReg.body).toHaveProperty('token');

    const resLog = await request(server)
      .post('/api/auth/login')
      .send({ username, password: 'pass123' })
      .expect(200);
    expect(resLog.body).toHaveProperty('token');
  });
});
