const request = require('supertest');
const express = require('express');
const commentRoutes = require('../routes/comments');

const app = express();
app.use(express.json());
app.use('/comments', commentRoutes);

describe('Comment Controller', () => {
  test('should get list of comments', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should create a new comment', async () => {
    const newComment = {
      postId: '1',
      content: 'This is a test comment',
      author: 'testuser'
    };
    const response = await request(app)
      .post('/')
      .send(newComment);
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.content).toBe(newComment.content);
  });
});