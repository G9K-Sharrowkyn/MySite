import request from 'supertest';
import express from 'express';
import postRoutes from '../routes/posts.js';

const app = express();
app.use(express.json());
app.use('/posts', postRoutes);

describe('Post Controller', () => {
  test('should get list of posts', async () => {
    const response = await request(app).get('/posts');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body?.posts)).toBe(true);
  });

  test('should reject creating a post without auth', async () => {
    const response = await request(app).post('/posts').send({
      title: 'Test Post',
      content: 'This is a test post'
    });
    expect(response.statusCode).toBe(401);
  });
});
