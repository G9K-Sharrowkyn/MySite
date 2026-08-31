import { readDb, writeDb } from '../services/jsonDb.js';
import { tournamentsRepo } from '../repositories/index.js';
import {
  advanceRound,
  generateBracketsForTournament
} from '../jobs/tournamentScheduler.js';

describe('tournament scheduler concurrency', () => {
  beforeEach(async () => {
    await writeDb({
      users: [
        { id: 'u1', username: 'One', tournamentsWon: 0 },
        { id: 'u2', username: 'Two', tournamentsWon: 0 }
      ],
      tournaments: [
        {
          id: 't1',
          title: 'Test Cup',
          status: 'recruiting',
          participants: [
            { userId: 'u1', username: 'One', characters: ['c1'] },
            { userId: 'u2', username: 'Two', characters: ['c2'] }
          ]
        }
      ]
    });
  });

  test('starts and completes a tournament only once under concurrent jobs', async () => {
    const starts = await Promise.all([
      generateBracketsForTournament('t1'),
      generateBracketsForTournament('t1')
    ]);
    expect(starts.sort()).toEqual([false, true]);

    let db = await readDb();
    expect(db.tournaments[0].status).toBe('active');
    expect(db.notifications).toHaveLength(2);

    await tournamentsRepo.updateById('t1', (tournament) => {
      tournament.brackets[0].status = 'completed';
      tournament.brackets[0].winner = 'u1';
      return tournament;
    });

    const completions = await Promise.all([advanceRound('t1'), advanceRound('t1')]);
    expect(completions.sort()).toEqual([false, true]);

    db = await readDb();
    expect(db.tournaments[0].status).toBe('completed');
    expect(db.tournaments[0].winner).toBe('u1');
    expect(db.userBadges).toHaveLength(1);
    expect(db.users.find((user) => user.id === 'u1').tournamentsWon).toBe(1);
    expect(db.notifications).toHaveLength(4);
  });
});
