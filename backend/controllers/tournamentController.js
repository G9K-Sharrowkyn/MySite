import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from '../services/jsonDb.js';

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (db, userId) =>
  (db.users || []).find((entry) => resolveUserId(entry) === userId);

const findCharacterById = (db, characterId) =>
  (db.characters || []).find((entry) => entry.id === characterId);

const buildParticipant = (db, participant) => {
  if (!participant) return null;
  const user = findUserById(db, participant.userId);
  const character = participant.characterId
    ? findCharacterById(db, participant.characterId)
    : null;

  return {
    ...participant,
    username: participant.username || user?.username || 'Unknown',
    profilePicture: user?.profile?.profilePicture || user?.profile?.avatar || '',
    characterName: participant.characterName || character?.name || ''
  };
};

// Helper function to generate tournament brackets
function generateBrackets(participants, tournamentType = 'single_elimination') {
  const numParticipants = participants.length;
  const rounds = Math.ceil(Math.log2(numParticipants));
  const totalSlots = Math.pow(2, rounds);

  const seededParticipants = [...participants].sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );

  while (seededParticipants.length < totalSlots) {
    seededParticipants.push({ type: 'bye', userId: null, characterId: null });
  }

  const brackets = [];

  if (tournamentType === 'single_elimination') {
    for (let round = 0; round < rounds; round++) {
      const roundMatches = [];
      const matchesInRound = Math.pow(2, rounds - round - 1);

      for (let match = 0; match < matchesInRound; match++) {
        const matchId = `${round}-${match}`;
        let player1;
        let player2;

        if (round === 0) {
          const player1Index = match;
          const player2Index = totalSlots - 1 - match;
          player1 = seededParticipants[player1Index];
          player2 = seededParticipants[player2Index];
        } else {
          player1 = { type: 'tbd', matchId: `${round - 1}-${match * 2}` };
          player2 = { type: 'tbd', matchId: `${round - 1}-${match * 2 + 1}` };
        }

        roundMatches.push({
          id: matchId,
          player1,
          player2,
          winner: null,
          status: 'pending',
          scheduledTime: null,
          votes: { player1: 0, player2: 0 },
          voters: []
        });
      }

      brackets.push({
        round: round + 1,
        matches: roundMatches
      });
    }
  }

  return brackets;
}

// Helper function to advance tournament
function advanceTournament(tournament, matchId, winnerId) {
  const [roundIndex, matchIndex] = matchId.split('-').map(Number);
  const currentRound = tournament.brackets[roundIndex];
  const currentMatch = currentRound.matches[matchIndex];

  currentMatch.winner = winnerId;
  currentMatch.status = 'completed';

  if (roundIndex < tournament.brackets.length - 1) {
    const nextRound = tournament.brackets[roundIndex + 1];
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIndex];

    if (matchIndex % 2 === 0) {
      nextMatch.player1 = { userId: winnerId, type: 'player' };
    } else {
      nextMatch.player2 = { userId: winnerId, type: 'player' };
    }

    nextMatch.status = 'ready';
  } else {
    tournament.winner = winnerId;
    tournament.status = 'completed';
    tournament.completedAt = new Date().toISOString();
  }

  return tournament;
}

const buildTournamentResponse = (db, tournament) => {
  const participants = (tournament.participants || []).map((p) =>
    buildParticipant(db, p)
  );
  const createdBy = findUserById(db, tournament.createdBy);

  return {
    ...tournament,
    participants,
    createdBy: tournament.createdBy,
    createdByUsername: createdBy?.username || 'Unknown',
    participantCount: participants.length,
    isFull: participants.length >= tournament.maxParticipants,
    canJoin:
      tournament.status === 'upcoming' &&
      participants.length < tournament.maxParticipants
  };
};

export const getAllTournaments = async (_req, res) => {
  try {
    const db = await readDb();
    const tournaments = (db.tournaments || []).slice().sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json(tournaments.map((tournament) => buildTournamentResponse(db, tournament)));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const getTournamentById = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const tournament = (db.tournaments || []).find((entry) => entry.id === id);
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    res.json(buildTournamentResponse(db, tournament));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const createTournament = async (req, res) => {
  const {
    title,
    description,
    startDate,
    endDate,
    maxParticipants,
    rules,
    tournamentType,
    divisionId,
    prizePool,
    entryFee
  } = req.body;

  try {
    const db = await readDb();
    const user = findUserById(db, req.user.id);
    if (!user || user.role !== 'moderator') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }

    const newTournament = {
      id: uuidv4(),
      name: title,
      title,
      description,
      startDate,
      endDate,
      maxParticipants: maxParticipants || 32,
      rules: rules || '',
      tournamentType: tournamentType || 'single_elimination',
      divisionId: divisionId || null,
      prizePool: prizePool || 0,
      entryFee: entryFee || 0,
      createdBy: req.user.id,
      status: 'upcoming',
      participants: [],
      fights: [],
      settings: {
        publicJoin: true,
        votingDuration: 24,
        requireApproval: false
      },
      brackets: [],
      stats: {
        totalMatches: 0,
        completedMatches: 0,
        totalVotes: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await updateDb((data) => {
      data.tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
      data.tournaments.push(newTournament);
      return data;
    });

    res.json(newTournament);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const startTournament = async (req, res) => {
  const { id } = req.params;

  try {
    let updatedTournament;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'upcoming') {
        const error = new Error('Tournament cannot be started');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      if ((tournament.participants || []).length < 2) {
        const error = new Error('Need at least 2 participants');
        error.code = 'NOT_ENOUGH_PARTICIPANTS';
        throw error;
      }

      const participantsWithPoints = (tournament.participants || []).map((p) => {
        const participantUser = findUserById(db, p.userId);
        return {
          userId: p.userId,
          username: p.username || participantUser?.username,
          characterId: p.characterId,
          characterName: p.characterName,
          points: participantUser?.stats?.points || 0
        };
      });

      const brackets = generateBrackets(
        participantsWithPoints,
        tournament.tournamentType || 'single_elimination'
      );

      tournament.status = 'active';
      tournament.startDate = new Date().toISOString();
      tournament.brackets = brackets;
      tournament.stats = {
        totalMatches: brackets.reduce((total, round) => total + round.matches.length, 0),
        completedMatches: 0,
        totalVotes: 0
      };
      tournament.updatedAt = new Date().toISOString();

      updatedTournament = tournament;
      return db;
    });

    res.json({
      msg: 'Tournament started successfully',
      tournament: updatedTournament,
      brackets: updatedTournament.brackets
    });
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'INVALID_STATUS' || err.code === 'NOT_ENOUGH_PARTICIPANTS') {
      return res.status(400).json({ msg: err.message });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const advanceMatch = async (req, res) => {
  const { id, matchId } = req.params;
  const { winnerId } = req.body;

  try {
    let updatedTournament;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'active') {
        const error = new Error('Tournament is not active');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      advanceTournament(tournament, matchId, winnerId);

      tournament.stats = tournament.stats || { totalMatches: 0, completedMatches: 0, totalVotes: 0 };
      tournament.stats.completedMatches += 1;
      tournament.updatedAt = new Date().toISOString();

      updatedTournament = tournament;
      return db;
    });

    res.json({
      msg: 'Match advanced successfully',
      tournament: updatedTournament
    });
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'INVALID_STATUS') {
      return res.status(400).json({ msg: err.message });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const voteInTournament = async (req, res) => {
  const { id, matchId } = req.params;
  const { winnerId } = req.body;

  try {
    let matchResult;

    await updateDb((db) => {
      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'active') {
        const error = new Error('Tournament is not active');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      const [roundIndex, matchIndex] = matchId.split('-').map(Number);
      const round = tournament.brackets?.[roundIndex];
      const match = round?.matches?.[matchIndex];
      if (!match) {
        const error = new Error('Match not found');
        error.code = 'MATCH_NOT_FOUND';
        throw error;
      }

      if (match.status !== 'active' && match.status !== 'ready') {
        const error = new Error('Match is not active for voting');
        error.code = 'MATCH_INACTIVE';
        throw error;
      }

      match.voters = match.voters || [];
      const hasVoted = match.voters.some((v) => v.userId === req.user.id);
      if (hasVoted) {
        const error = new Error('Already voted');
        error.code = 'ALREADY_VOTED';
        throw error;
      }

      match.voters.push({
        userId: req.user.id,
        votedFor: winnerId,
        votedAt: new Date().toISOString()
      });

      match.votes = match.votes || { player1: 0, player2: 0 };
      if (winnerId === match.player1?.userId) {
        match.votes.player1 += 1;
      } else if (winnerId === match.player2?.userId) {
        match.votes.player2 += 1;
      }

      tournament.stats = tournament.stats || { totalMatches: 0, completedMatches: 0, totalVotes: 0 };
      tournament.stats.totalVotes += 1;
      tournament.updatedAt = new Date().toISOString();

      matchResult = match;
      return db;
    });

    res.json({
      msg: 'Vote recorded successfully',
      match: matchResult,
      totalVotes: (matchResult.votes?.player1 || 0) + (matchResult.votes?.player2 || 0)
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'MATCH_NOT_FOUND') {
      return res.status(404).json({ msg: 'Match not found' });
    }
    if (err.code === 'INVALID_STATUS' || err.code === 'MATCH_INACTIVE' || err.code === 'ALREADY_VOTED') {
      return res.status(400).json({ msg: err.message });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const getTournamentBrackets = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const tournament = (db.tournaments || []).find((entry) => entry.id === id);

    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    res.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        winner: tournament.winner
      },
      brackets: tournament.brackets || []
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const updateTournament = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    let updated;

    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      Object.keys(updates || {}).forEach((key) => {
        if (updates[key] !== undefined && key !== 'id' && key !== 'createdBy') {
          tournament[key] = updates[key];
        }
      });
      tournament.updatedAt = new Date().toISOString();
      updated = tournament;
      return db;
    });

    res.json(updated);
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const deleteTournament = async (req, res) => {
  const { id } = req.params;

  try {
    await updateDb((db) => {
      const user = findUserById(db, req.user.id);
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const index = (db.tournaments || []).findIndex((entry) => entry.id === id);
      if (index === -1) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      db.tournaments.splice(index, 1);
      return db;
    });

    res.json({ msg: 'Tournament deleted successfully' });
  } catch (err) {
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Access denied. Moderator role required.' });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const joinTournament = async (req, res) => {
  const { id } = req.params;
  const { characterId } = req.body;

  try {
    let updatedTournament;

    await updateDb((db) => {
      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'upcoming') {
        const error = new Error('Tournament cannot be joined');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      tournament.participants = Array.isArray(tournament.participants)
        ? tournament.participants
        : [];

      const alreadyJoined = tournament.participants.some(
        (participant) => participant.userId === req.user.id
      );
      if (alreadyJoined) {
        const error = new Error('Already participating');
        error.code = 'ALREADY_JOINED';
        throw error;
      }

      if (tournament.participants.length >= tournament.maxParticipants) {
        const error = new Error('Tournament is full');
        error.code = 'FULL';
        throw error;
      }

      const user = findUserById(db, req.user.id);
      const character = characterId ? findCharacterById(db, characterId) : null;

      tournament.participants.push({
        userId: req.user.id,
        username: user?.username || 'Unknown',
        characterId: characterId || null,
        characterName: character?.name || ''
      });

      if (user) {
        user.activity = user.activity || {
          postsCreated: 0,
          commentsPosted: 0,
          likesReceived: 0,
          tournamentsWon: 0,
          tournamentsParticipated: 0
        };
        user.activity.tournamentsParticipated += 1;
      }

      tournament.updatedAt = new Date().toISOString();
      updatedTournament = tournament;
      return db;
    });

    res.json({ msg: 'Successfully joined tournament', tournament: updatedTournament });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'INVALID_STATUS' || err.code === 'ALREADY_JOINED' || err.code === 'FULL') {
      return res.status(400).json({ msg: err.message });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const leaveTournament = async (req, res) => {
  const { id } = req.params;

  try {
    let updatedTournament;

    await updateDb((db) => {
      const tournament = (db.tournaments || []).find((entry) => entry.id === id);
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'upcoming') {
        const error = new Error('Tournament cannot be left');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      tournament.participants = Array.isArray(tournament.participants)
        ? tournament.participants
        : [];
      const participantIndex = tournament.participants.findIndex(
        (participant) => participant.userId === req.user.id
      );
      if (participantIndex === -1) {
        const error = new Error('Not participating');
        error.code = 'NOT_PARTICIPANT';
        throw error;
      }

      tournament.participants.splice(participantIndex, 1);
      const user = findUserById(db, req.user.id);
      if (user?.activity?.tournamentsParticipated) {
        user.activity.tournamentsParticipated = Math.max(
          0,
          user.activity.tournamentsParticipated - 1
        );
      }

      tournament.updatedAt = new Date().toISOString();
      updatedTournament = tournament;
      return db;
    });

    res.json({ msg: 'Successfully left tournament', tournament: updatedTournament });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'INVALID_STATUS' || err.code === 'NOT_PARTICIPANT') {
      return res.status(400).json({ msg: err.message });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
