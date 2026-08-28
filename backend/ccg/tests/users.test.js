import request from 'supertest';
import http from 'http';
import app from '../app.js';

const server = http.createServer(app);

let token;

beforeAll(() => server.listen(0));
afterAll(() => server.close());

test('get cards list', async () => {
  const res = await request(server).get('/api/users/cards').expect(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('register and load an isolated CCG profile', async () => {
  const timestamp = Date.now();
  const email = `u${timestamp}@ex.com`;
  const username = `tester_${timestamp}`;

  const password = 'pass12345678';
  const { body } = await request(server)
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
  token = body.token;

  await request(server)
    .post('/api/users/collection')
    .set('Authorization', `Bearer ${token}`)
    .send({ cardId: 'arbitrary-card' })
    .expect(404);

  const profile = await request(server)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(profile.body.collection).toEqual([]);
  expect(profile.body.packs).toEqual({ normal: 8, premium: 0 });
});
