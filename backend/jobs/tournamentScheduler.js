import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { isBackgroundJobsAuthority } from '../config/runtimeConfig.js';
import {
  notificationsRepo,
  tournamentsRepo,
  userBadgesRepo,
  usersRepo,
  withRepositoryTransaction
} from '../repositories/index.js';

const isSchedulerAuthority = () =>
  process.env.NODE_ENV !== 'test' &&
  isBackgroundJobsAuthority();

const processTournamentsByStatus = async (status, handler) => {
  let lastId = '';
  while (true) {
    const query = lastId ? { status, id: { $gt: lastId } } : { status };
    const batch = await tournamentsRepo.findManyBy(query, {
      sort: { id: 1 },
      limit: 200
    });
    if (batch.length === 0) return;
    for (const tournament of batch) await handler(tournament);
    if (batch.length < 200) return;
    lastId = batch.at(-1).id;
  }
};

const notifyParticipants = async (tournament, type, message, context) => {
  for (const participant of tournament.participants || []) {
    if (!participant?.userId) continue;
    const id = `tournament:${tournament.id}:${type}:${participant.userId}`;
    await notificationsRepo.insertIfAbsent(
      { id },
      {
        id,
        userId: participant.userId,
        type: 'tournament',
        title:
          type === 'start' ? 'Tournament Started!' : 'Tournament Completed!',
        message,
        data: {
          tournamentId: tournament.id,
          tournamentTitle: tournament.title
        },
        read: false,
        createdAt: new Date().toISOString()
      },
      context
    );
  }
};

const addWinnerBadge = async (userId, tournament, context) => {
  const id = `tournament-winner:${tournament.id}:${userId}`;
  const { inserted } = await userBadgesRepo.insertIfAbsent(
    { id },
    {
      id,
      badgeId: `tournament:${tournament.id}`,
      userId,
      type: 'tournament_winner',
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      teamMembers:
        tournament.participants.find((entry) => entry.userId === userId)
          ?.characters || [],
      wonAt: new Date().toISOString(),
      displayOnProfile: true,
      isActive: true
    },
    context
  );
  if (!inserted) return;
  await usersRepo.updateById(
    userId,
    (user) => {
      user.tournamentsWon = Number(user.tournamentsWon || 0) + 1;
      return user;
    },
    context
  );
};

const buildTournamentBrackets = (participants) => {
  const ranked = structuredClone(participants).sort(
    (left, right) => Number(right.points || 0) - Number(left.points || 0)
  );
  let bracketSize = 2;
  while (bracketSize < ranked.length) bracketSize *= 2;

  const matches = [];
  for (let index = 0; index < bracketSize / 2; index += 1) {
    const participant1 = ranked[index] || null;
    const participant2 = ranked[bracketSize - 1 - index] || null;
    const match = {
      id: uuidv4(),
      round: 1,
      matchNumber: index + 1,
      participant1: participant1
        ? {
            userId: participant1.userId,
            username: participant1.username,
            characters: participant1.characters
          }
        : { type: 'bye' },
      participant2: participant2
        ? {
            userId: participant2.userId,
            username: participant2.username,
            characters: participant2.characters
          }
        : { type: 'bye' },
      status: 'pending',
      votes: {},
      winner: null
    };
    if (!participant2 && participant1) {
      match.status = 'completed';
      match.winner = participant1.userId;
    } else if (!participant1 && participant2) {
      match.status = 'completed';
      match.winner = participant2.userId;
    }
    matches.push(match);
  }

  const totalRounds = Math.log2(bracketSize);
  for (let round = 2; round <= totalRounds; round += 1) {
    const matchesInRound = bracketSize / 2 ** round;
    for (let index = 0; index < matchesInRound; index += 1) {
      matches.push({
        id: uuidv4(),
        round,
        matchNumber: index + 1,
        participant1: { type: 'tbd' },
        participant2: { type: 'tbd' },
        status: 'pending',
        votes: {},
        winner: null
      });
    }
  }
  return matches;
};

async function generateBracketsForTournament(tournamentOrId) {
  const tournamentId =
    typeof tournamentOrId === 'string' ? tournamentOrId : tournamentOrId?.id;
  if (!tournamentId) return false;
  return withRepositoryTransaction(async (context) => {
    const tournament = await tournamentsRepo.findById(tournamentId, context);
    if (!tournament || tournament.status !== 'recruiting') return false;
    const participants = tournament.participants || [];
    if (participants.length < 2) return false;

    tournament.brackets = buildTournamentBrackets(participants);
    tournament.currentRound = 1;
    tournament.status = 'active';
    tournament.updatedAt = new Date().toISOString();
    await tournamentsRepo.updateById(tournamentId, () => tournament, context);
    await notifyParticipants(
      tournament,
      'start',
      `Tournament "${tournament.title}" has started! Check the brackets and vote for your favorites.`,
      context
    );
    return true;
  });
}

async function advanceRound(tournamentOrId) {
  const tournamentId =
    typeof tournamentOrId === 'string' ? tournamentOrId : tournamentOrId?.id;
  if (!tournamentId) return false;
  return withRepositoryTransaction(async (context) => {
    const tournament = await tournamentsRepo.findById(tournamentId, context);
    if (!tournament || tournament.status !== 'active') return false;
    const matches = tournament.brackets || [];
    const currentRound = Number(tournament.currentRound || 1);
    const currentRoundMatches = matches.filter(
      (match) => Number(match.round) === currentRound
    );
    if (
      currentRoundMatches.length === 0 ||
      !currentRoundMatches.every((match) => match.status === 'completed')
    ) {
      return false;
    }

    const nextRound = currentRound + 1;
    const nextRoundMatches = matches.filter(
      (match) => Number(match.round) === nextRound
    );
    if (nextRoundMatches.length === 0) {
      const winnerId = currentRoundMatches[0]?.winner;
      tournament.status = 'completed';
      tournament.winner = winnerId || null;
      tournament.updatedAt = new Date().toISOString();
      await tournamentsRepo.updateById(tournamentId, () => tournament, context);
      if (winnerId) {
        await addWinnerBadge(winnerId, tournament, context);
        const winner = tournament.participants.find(
          (participant) => participant.userId === winnerId
        );
        await notifyParticipants(
          tournament,
          'complete',
          `Tournament "${tournament.title}" has ended! Winner: ${winner?.username || 'Unknown'}.`,
          context
        );
      }
      return true;
    }

    for (let index = 0; index < nextRoundMatches.length; index += 1) {
      const firstWinnerId = currentRoundMatches[index * 2]?.winner;
      const secondWinnerId = currentRoundMatches[index * 2 + 1]?.winner;
      const firstWinner = tournament.participants.find(
        (participant) => participant.userId === firstWinnerId
      );
      const secondWinner = tournament.participants.find(
        (participant) => participant.userId === secondWinnerId
      );
      if (firstWinner) {
        nextRoundMatches[index].participant1 = {
          userId: firstWinner.userId,
          username: firstWinner.username,
          characters: firstWinner.characters
        };
      }
      if (secondWinner) {
        nextRoundMatches[index].participant2 = {
          userId: secondWinner.userId,
          username: secondWinner.username,
          characters: secondWinner.characters
        };
      }
      if (firstWinner && secondWinner) nextRoundMatches[index].status = 'active';
    }
    tournament.currentRound = nextRound;
    tournament.updatedAt = new Date().toISOString();
    await tournamentsRepo.updateById(tournamentId, () => tournament, context);
    return true;
  });
}

const completeMatchesAtVoteThreshold = async (tournamentId) =>
  withRepositoryTransaction(async (context) => {
    const tournament = await tournamentsRepo.findById(tournamentId, context);
    if (!tournament || tournament.status !== 'active') return false;
    const currentRound = Number(tournament.currentRound || 1);
    let updated = false;
    for (const match of tournament.brackets || []) {
      if (Number(match.round) !== currentRound || match.status !== 'active') continue;
      const votes = Object.values(match.votes || {});
      const firstVotes = votes.filter(
        (vote) => vote === match.participant1?.userId
      ).length;
      const secondVotes = votes.filter(
        (vote) => vote === match.participant2?.userId
      ).length;
      if (firstVotes < 10 && secondVotes < 10) continue;
      match.winner =
        firstVotes > secondVotes
          ? match.participant1.userId
          : match.participant2.userId;
      match.status = 'completed';
      updated = true;
    }
    if (!updated) return false;
    tournament.updatedAt = new Date().toISOString();
    await tournamentsRepo.updateById(tournamentId, () => tournament, context);
    return true;
  });

if (isSchedulerAuthority()) {
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    try {
      await processTournamentsByStatus('recruiting', async (tournament) => {
        if (
          tournament.recruitmentEndDate &&
          now >= new Date(tournament.recruitmentEndDate)
        ) {
          await generateBracketsForTournament(tournament.id);
        }
      });
      await processTournamentsByStatus('active', async (tournament) => {
        if (!tournament.battleTime) return;
        const [hours, minutes] = String(tournament.battleTime).split(':').map(Number);
        if (
          now.getHours() === hours &&
          now.getMinutes() >= minutes &&
          now.getMinutes() < minutes + 5
        ) {
          await advanceRound(tournament.id);
        }
      });
    } catch (error) {
      console.error('Error in tournament scheduler:', error);
    }
  });

  cron.schedule('*/10 * * * *', async () => {
    try {
      await processTournamentsByStatus('active', (tournament) =>
        completeMatchesAtVoteThreshold(tournament.id)
      );
    } catch (error) {
      console.error('Error checking tournament match votes:', error);
    }
  });
  console.log('Tournament scheduler initialized on this authority process.');
} else {
  console.log('Tournament scheduler is disabled on this API process.');
}

export { advanceRound, generateBracketsForTournament };
