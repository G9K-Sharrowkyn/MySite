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

    const password = 'pass12345678';
    const resReg = await request(server)
      .post('/api/auth/register')
      .send({
        username,
        email,
        password,
        consent: {
          termsOfService: true,
          privacyPolicy: true,
          minimumAgeConfirmed: true
        }
      })
      .expect(201);
    expect(resReg.body).toHaveProperty('token');

    const resLog = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(resLog.body).toHaveProperty('token');
  });
});
