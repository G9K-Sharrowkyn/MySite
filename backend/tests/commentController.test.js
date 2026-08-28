import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import commentRoutes from '../routes/comments.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const app = express();
app.use(express.json());
app.use('/comments', commentRoutes);

describe('Comment Controller', () => {
  const user = {
    id: 'comment-user',
    username: 'comment-user',
    email: 'comment-user@test.invalid',
    role: 'user',
    tokenVersion: 0,
    activity: {
      postsCreated: 0,
      commentsPosted: 0,
      reactionsGiven: 0,
      likesReceived: 0
    },
    stats: { comments: 0, points: 0 }
  };
  const opponent = {
    id: 'comment-opponent',
    username: 'comment-opponent',
    email: 'comment-opponent@test.invalid',
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
    const now = new Date().toISOString();
    await writeDb({
      users: [user, opponent],
      posts: [
        {
          id: 'active-post',
          authorId: opponent.id,
          title: 'Active post',
          content: 'Active content',
          type: 'discussion',
          createdAt: now
        },
        {
          id: 'empty-post',
          authorId: opponent.id,
          title: 'Empty post',
          content: 'No comments',
          type: 'discussion',
          createdAt: now
        },
        {
          id: 'deleted-post',
          authorId: opponent.id,
          title: 'Deleted post',
          content: 'Deleted content',
          type: 'discussion',
          createdAt: now,
          moderation: {
            deleted: { isDeleted: true, deletedAt: now }
          }
        },
        {
          id: 'deleted-fight-post',
          authorId: opponent.id,
          title: 'Deleted fight post',
          content: 'Deleted fight content',
          type: 'fight',
          createdAt: now,
          moderation: {
            deleted: { isDeleted: true, deletedAt: now }
          }
        }
      ],
      fights: [
        {
          id: 'standalone-fight',
          title: 'Standalone fight',
          status: 'active'
        }
      ],
      comments: [
        {
          id: 'active-comment',
          type: 'post',
          targetId: 'active-post',
          postId: 'active-post',
          parentId: null,
          threadId: 'active-comment',
          authorId: opponent.id,
          authorUsername: opponent.username,
          text: 'Active comment',
          createdAt: now,
          updatedAt: now,
          likes: 0,
          likedBy: [],
          reactions: [
            {
              userId: opponent.id,
              reactionId: 'like2',
              reactionIcon: '👏',
              reactionName: 'Clap',
              reactedAt: now
            }
          ]
        },
        {
          id: 'deleted-post-comment',
          type: 'post',
          targetId: 'deleted-post',
          postId: 'deleted-post',
          parentId: null,
          threadId: 'deleted-post-comment',
          authorId: user.id,
          authorUsername: user.username,
          text: 'Hidden comment',
          createdAt: now,
          updatedAt: now,
          likes: 0,
          likedBy: [],
          reactions: []
        },
        {
          id: 'deleted-fight-comment',
          type: 'fight',
          targetId: 'deleted-fight-post',
          fightId: 'deleted-fight-post',
          parentId: null,
          threadId: 'deleted-fight-comment',
          authorId: user.id,
          authorUsername: user.username,
          text: 'Hidden fight comment',
          createdAt: now,
          updatedAt: now,
          likes: 0,
          likedBy: [],
          reactions: []
        }
      ]
    });
  });

  test('returns an empty list for a post with no comments', async () => {
    const response = await request(app).get('/comments/post/empty-post');
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });

  test('rejects creating a comment without auth', async () => {
    const response = await request(app)
      .post('/comments/post/test-post')
      .send({ text: 'Test comment' });
    expect(response.statusCode).toBe(401);
  });

  test('deduplicates concurrent comments with the same idempotency key', async () => {
    const key = 'comment-create-concurrent-0001';
    const create = () =>
      request(app)
        .post('/comments/post/active-post')
        .set('x-auth-token', authToken())
        .set('Idempotency-Key', key)
        .send({ text: 'Store this comment once' });

    const responses = await Promise.all([create(), create()]);
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);
    expect(
      responses.some((response) => response.headers['idempotency-replayed'] === 'true')
    ).toBe(true);

    const db = await readDb();
    expect(
      db.comments.filter((comment) => comment.text === 'Store this comment once')
    ).toHaveLength(1);
    const storedUser = db.users.find((entry) => entry.id === user.id);
    expect(storedUser.activity.commentsPosted).toBe(1);
    expect(storedUser.stats.comments).toBe(1);
  });

  test('deduplicates profile and standalone fight comments as well', async () => {
    const auth = { 'x-auth-token': authToken() };
    const profileRequest = () =>
      request(app)
        .post(`/comments/user/${opponent.id}`)
        .set(auth)
        .set('Idempotency-Key', 'profile-comment-concurrent-0001')
        .send({ text: 'One profile comment' });
    const fightRequest = () =>
      request(app)
        .post('/comments/fight/standalone-fight')
        .set(auth)
        .set('Idempotency-Key', 'fight-comment-concurrent-0001')
        .send({ text: 'One fight comment' });

    const responses = await Promise.all([
      profileRequest(),
      profileRequest(),
      fightRequest(),
      fightRequest()
    ]);
    expect(responses.every((response) => response.statusCode === 200)).toBe(true);

    const db = await readDb();
    expect(
      db.comments.filter((comment) => comment.text === 'One profile comment')
    ).toHaveLength(1);
    expect(
      db.comments.filter((comment) => comment.text === 'One fight comment')
    ).toHaveLength(1);
  });

  test('hides comments and rejects comment mutations for a deleted post', async () => {
    const auth = { 'x-auth-token': authToken() };
    const [list, create, update, like, reaction] = await Promise.all([
      request(app).get('/comments/post/deleted-post').set(auth),
      request(app)
        .post('/comments/post/deleted-post')
        .set(auth)
        .send({ text: 'Must not be created' }),
      request(app)
        .put('/comments/deleted-post-comment')
        .set(auth)
        .send({ text: 'Must not be edited' }),
      request(app).post('/comments/deleted-post-comment/like').set(auth),
      request(app)
        .post('/comments/deleted-post-comment/reaction')
        .set(auth)
        .send({ reactionId: 'like1' })
    ]);

    expect([list, create, update, like, reaction].map((response) => response.statusCode))
      .toEqual([404, 404, 404, 404, 404]);

    const db = await readDb();
    expect(
      db.comments.find((comment) => comment.id === 'deleted-post-comment').text
    ).toBe('Hidden comment');
    expect(
      db.comments.some((comment) => comment.text === 'Must not be created')
    ).toBe(false);
  });

  test('also hides and locks comments attached to a deleted fight post', async () => {
    const auth = { 'x-auth-token': authToken() };
    const [list, create, update, like, reaction] = await Promise.all([
      request(app).get('/comments/fight/deleted-fight-post'),
      request(app)
        .post('/comments/fight/deleted-fight-post')
        .set(auth)
        .send({ text: 'Must not be created' }),
      request(app)
        .put('/comments/deleted-fight-comment')
        .set(auth)
        .send({ text: 'Must not be edited' }),
      request(app).post('/comments/deleted-fight-comment/like').set(auth),
      request(app)
        .post('/comments/deleted-fight-comment/reaction')
        .set(auth)
        .send({ reactionId: 'like1' })
    ]);

    expect([list, create, update, like, reaction].map((response) => response.statusCode))
      .toEqual([404, 404, 404, 404, 404]);
  });

  test('restores and removes the viewer reaction without touching other users', async () => {
    const auth = { 'x-auth-token': authToken() };
    await request(app)
      .post('/comments/active-comment/reaction')
      .set(auth)
      .send({ reactionId: 'like1' })
      .expect(200);

    const loaded = await request(app)
      .get('/comments/post/active-post')
      .set(auth)
      .expect(200);
    const loadedComment = loaded.body.find((comment) => comment.id === 'active-comment');
    expect(loadedComment.userReaction).toMatchObject({ id: 'like1' });

    await request(app)
      .delete('/comments/active-comment/reaction/like1')
      .set(auth)
      .expect(200);
    await request(app)
      .delete('/comments/active-comment/reaction/like1')
      .set(auth)
      .expect(404);

    const db = await readDb();
    const stored = db.comments.find((comment) => comment.id === 'active-comment');
    expect(stored.reactions.map((reaction) => reaction.userId)).toEqual([
      opponent.id
    ]);
  });
});
