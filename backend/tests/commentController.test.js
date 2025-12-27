import request from 'supertest';
import express from 'express';
import commentRoutes from '../routes/comments.js';

const app = express();
app.use(express.json());
app.use('/comments', commentRoutes);

describe('Comment Controller', () => {
  test('returns an empty list for a post with no comments', async () => {
    const response = await request(app).get('/comments/post/test-post');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('rejects creating a comment without auth', async () => {
    const response = await request(app)
      .post('/comments/post/test-post')
      .send({ text: 'Test comment' });
    expect(response.statusCode).toBe(401);
  });
});
