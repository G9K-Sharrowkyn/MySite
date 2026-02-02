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

test('register, login, add to collection', async () => {
  const timestamp = Date.now();
  const email = `u${timestamp}@ex.com`;
  const username = `tester_${timestamp}`;

  const { body } = await request(server)
    .post('/api/auth/register')
    .send({ username, email, password: 'pass123' })
    .expect(201);
  token = body.token;

  const cardsRes = await request(server).get('/api/users/cards');
  const cardId = cardsRes.body[0]._id || cardsRes.body[0].name;

  await request(server)
    .post('/api/users/collection')
    .set('Authorization', `Bearer ${token}`)
    .send({ cardId })
    .expect(200);

  const profile = await request(server)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const has = profile.body.collection.some(c => c._id === cardId || c.name === cardId);
  expect(has).toBe(true);
});
