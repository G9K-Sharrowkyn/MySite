import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import messageRoutes from '../routes/messages.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/messages', messageRoutes);

const users = [
  { id: 'message-user-a', username: 'alice', email: 'alice@test.invalid', role: 'user' },
  { id: 'message-user-b', username: 'bob', email: 'bob@test.invalid', role: 'user' },
  { id: 'message-user-c', username: 'carol', email: 'carol@test.invalid', role: 'user' }
];

const tokenFor = (user) =>
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

describe('Message route authorization', () => {
  beforeEach(async () => {
    await writeDb({
      users,
      blocks: [
        {
          id: 'message-block-1',
          blockerId: users[1].id,
          blockedId: users[0].id
        }
      ],
      conversations: [
        {
          id: 'blocked-conversation',
          participants: [users[0].id, users[1].id],
          messages: []
        }
      ]
    });
  });

  test('enforces a block in both conversation creation and sending', async () => {
    const auth = { 'x-auth-token': tokenFor(users[0]) };

    const createResponse = await request(app)
      .post('/messages/conversations')
      .set(auth)
      .send({ participants: [users[0].id, users[1].id] });
    expect(createResponse.statusCode).toBe(403);

    const sendResponse = await request(app)
      .post('/messages/send')
      .set(auth)
      .send({ conversationId: 'blocked-conversation', content: 'blocked' });
    expect(sendResponse.statusCode).toBe(403);
  });

  test('does not trust a client supplied sender identity', async () => {
    const response = await request(app)
      .post('/messages')
      .set('x-auth-token', tokenFor(users[0]))
      .send({
        senderId: users[1].id,
        recipientId: users[2].id,
        content: 'server-owned sender'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message.senderId).toBe(users[0].id);

    const db = await readDb();
    expect(db.messages).toHaveLength(1);
    expect(db.messages[0].senderId).toBe(users[0].id);
  });

  test('prevents a third party from reading a conversation', async () => {
    const response = await request(app)
      .get('/messages/conversations/blocked-conversation/messages')
      .set('x-auth-token', tokenFor(users[2]));

    expect(response.statusCode).toBe(403);
  });
});
