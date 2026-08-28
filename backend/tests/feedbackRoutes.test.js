import express from 'express';
import request from 'supertest';
import feedbackRoutes from '../routes/feedback.js';
import { readDb, writeDb } from '../services/jsonDb.js';

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/feedback', feedbackRoutes);

describe('Feedback image security', () => {
  beforeEach(async () => {
    await writeDb({ feedback: [], users: [] });
  });

  test('rejects a file disguised as an image without persisting it', async () => {
    const response = await request(app).post('/feedback').send({
      type: 'character',
      title: 'Forged image',
      description: 'This is not a real PNG.',
      characterName: 'Unsafe character',
      characterTags: ['security'],
      characterImage: 'data:image/png;base64,PGh0bWw+bm90IGFuIGltYWdlPC9odG1sPg=='
    });

    expect(response.statusCode).toBe(400);
    expect((await readDb()).feedback).toHaveLength(0);
  });

  test('accepts a verified bounded raster suggestion', async () => {
    const response = await request(app).post('/feedback').send({
      type: 'character',
      title: 'Valid image',
      description: 'A valid character suggestion.',
      characterName: 'Safe character',
      characterTags: ['security'],
      characterImage: `data:image/png;base64,${ONE_PIXEL_PNG}`
    });

    expect(response.statusCode).toBe(200);
    const db = await readDb();
    expect(db.feedback).toHaveLength(1);
    expect(db.feedback[0].characterImage).toBe(
      `data:image/png;base64,${ONE_PIXEL_PNG}`
    );
  });

  test('requires authentication before approving a suggestion', async () => {
    const response = await request(app).post('/feedback/not-found/approve-character');
    expect(response.statusCode).toBe(401);
  });
});
