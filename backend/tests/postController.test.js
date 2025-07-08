const request = require('supertest');
const express = require('express');
const postRoutes = require('../routes/posts');

const app = express();
app.use(express.json());
app.use('/posts', postRoutes);

describe('Post Controller', () => {
  test('should get list of posts', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should create a new post', async () => {
    const newPost = {
      title: 'Test Post',
      content: 'This is a test post',
      author: 'testuser'
    };
    const response = await request(app)
      .post('/')
      .send(newPost);
    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe(newPost.title);
  });
});
