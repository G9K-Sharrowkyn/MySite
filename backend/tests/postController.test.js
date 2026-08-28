import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import postRoutes from '../routes/posts.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/posts', postRoutes);

describe('Post Controller', () => {
  const user = {
    id: 'post-security-user',
    username: 'post-security-user',
    email: 'post-security@test.invalid',
    role: 'user',
    tokenVersion: 0,
    activity: {
      postsCreated: 0,
      commentsPosted: 0,
      reactionsGiven: 0,
      likesReceived: 0
    },
    stats: { posts: 0, points: 0 }
  };
  const opponent = {
    id: 'post-security-opponent',
    username: 'post-security-opponent',
    email: 'post-security-opponent@test.invalid',
    role: 'user',
    tokenVersion: 0
  };
  const authToken = () =>
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

  beforeEach(async () => {
    await writeDb({
      users: [user, opponent],
      posts: [
        {
          id: 'existing-post',
          authorId: user.id,
          title: 'Existing post',
          content: 'Existing content',
          type: 'discussion',
          photos: [],
          likes: [],
          reactions: [],
          createdAt: new Date().toISOString()
        },
        {
          id: 'deleted-post',
          authorId: user.id,
          title: 'Deleted post',
          content: 'Deleted content',
          type: 'discussion',
          photos: [],
          likes: [],
          reactions: [],
          createdAt: new Date().toISOString(),
          moderation: {
            deleted: {
              isDeleted: true,
              deletedAt: new Date().toISOString()
            }
          }
        }
      ],
      comments: []
    });
  });

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

  test('rejects remote image URLs on create, update and user challenge', async () => {
    const auth = { 'x-auth-token': authToken() };
    const maliciousPhotos = ['http://169.254.169.254/latest/meta-data'];

    const createResponse = await request(app)
      .post('/posts')
      .set(auth)
      .send({
        title: 'Remote image attempt',
        content: 'This URL must never be fetched by the server.',
        type: 'discussion',
        photos: maliciousPhotos
      });
    expect(createResponse.statusCode).toBe(400);

    const updateResponse = await request(app)
      .put('/posts/existing-post')
      .set(auth)
      .send({ photos: maliciousPhotos });
    expect(updateResponse.statusCode).toBe(400);

    const challengeResponse = await request(app)
      .post('/posts/user-challenge')
      .set(auth)
      .send({
        title: 'Challenge',
        content: 'Challenge content',
        opponentId: opponent.id,
        challengerTeam: 'Fighter One',
        photos: maliciousPhotos
      });
    expect(challengeResponse.statusCode).toBe(400);

    const db = await readDb();
    expect(db.posts).toHaveLength(2);
    expect(db.posts[0].photos).toEqual([]);
  });

  test('deduplicates concurrent post creation with the same idempotency key', async () => {
    const key = 'post-create-concurrent-0001';
    const create = () =>
      request(app)
        .post('/posts')
        .set('x-auth-token', authToken())
        .set('Idempotency-Key', key)
        .send({
          title: 'One idempotent post',
          content: 'This should be stored exactly once.',
          type: 'discussion'
        });

    const responses = await Promise.all([create(), create()]);
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);
    expect(
      responses.some((response) => response.headers['idempotency-replayed'] === 'true')
    ).toBe(true);

    const db = await readDb();
    expect(db.posts.filter((post) => post.title === 'One idempotent post')).toHaveLength(1);
    const storedUser = db.users.find((entry) => entry.id === user.id);
    expect(storedUser.activity.postsCreated).toBe(1);
    expect(storedUser.stats.posts).toBe(1);
  });

  test('rejects edits, likes and reactions on a soft-deleted post', async () => {
    const auth = { 'x-auth-token': authToken() };
    const [edit, like, reaction] = await Promise.all([
      request(app)
        .put('/posts/deleted-post')
        .set(auth)
        .send({ title: 'Edited deleted post' }),
      request(app).post('/posts/deleted-post/like').set(auth),
      request(app)
        .post('/posts/deleted-post/reaction')
        .set(auth)
        .send({ reactionId: 'like1' })
    ]);

    expect(edit.statusCode).toBe(404);
    expect(like.statusCode).toBe(404);
    expect(reaction.statusCode).toBe(404);

    const db = await readDb();
    const deleted = db.posts.find((post) => post.id === 'deleted-post');
    expect(deleted.title).toBe('Deleted post');
    expect(deleted.likes).toEqual([]);
    expect(deleted.reactions).toEqual([]);
  });

  test('keeps likesReceived consistent after two concurrent like toggles', async () => {
    const toggle = () =>
      request(app)
        .post('/posts/existing-post/like')
        .set('x-auth-token', authToken());

    const responses = await Promise.all([toggle(), toggle()]);
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);

    const db = await readDb();
    const post = db.posts.find((entry) => entry.id === 'existing-post');
    const author = db.users.find((entry) => entry.id === user.id);
    expect(post.likes).toEqual([]);
    expect(author.activity.likesReceived).toBe(0);
  });

  test('returns the viewer reaction and removes only that viewer reaction', async () => {
    const auth = { 'x-auth-token': authToken() };
    await request(app)
      .post('/posts/existing-post/reaction')
      .set(auth)
      .send({ reactionId: 'like1' })
      .expect(200);

    const loaded = await request(app)
      .get('/posts/existing-post')
      .set(auth)
      .expect(200);
    expect(loaded.body.userReaction).toMatchObject({ id: 'like1' });

    await request(app)
      .delete('/posts/existing-post/react/like1')
      .set(auth)
      .expect(200);
    await request(app)
      .delete('/posts/existing-post/react/like1')
      .set(auth)
      .expect(404);

    const afterRemoval = await request(app)
      .get('/posts/existing-post')
      .set(auth)
      .expect(200);
    expect(afterRemoval.body.userReaction).toBeNull();
  });

  test('applies create-equivalent limits when editing post text', async () => {
    const response = await request(app)
      .put('/posts/existing-post')
      .set('x-auth-token', authToken())
      .send({ content: '' });
    expect(response.statusCode).toBe(400);

    const db = await readDb();
    expect(db.posts.find((post) => post.id === 'existing-post').content).toBe(
      'Existing content'
    );
  });
});
