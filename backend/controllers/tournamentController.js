import { v4 as uuidv4 } from 'uuid';
import {
  charactersRepo,
  readDb,
  tournamentsRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import { logModerationAction } from '../utils/moderationAudit.js';

const resolveUserId = (user) => user?.id || user?._id;

const findUserById = (users, userId) =>
  (users || []).find((entry) => resolveUserId(entry) === userId);

const findCharacterById = (characters, characterId) =>
  (characters || []).find((entry) => entry.id === characterId);

const normalizeVoteVisibility = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'final' || raw === 'hidden') return 'final';
  return 'live';
};

const shouldRevealMatchVotes = (tournament, match) => {
  const visibility = normalizeVoteVisibility(tournament?.settings?.voteVisibility);
  if (visibility !== 'final') return true;
  if (!match) return true;
  if (match.status === 'completed') return true;
  if (tournament?.status && tournament.status !== 'active') return true;
  return false;
};

const applyTournamentVoteVisibility = (tournament, match) => {
  if (!match) return match;
  if (shouldRevealMatchVotes(tournament, match)) {
    return { ...match, votesHidden: false };
  }

  return {
    ...match,
    votesHidden: true,
    votes: { player1: 0, player2: 0 },
    voters: []
  };
};

const buildParticipant = (context, participant) => {
  if (!participant) return null;
  const users = context?.users || [];
  const characters = context?.characters || [];
  const user = findUserById(users, participant.userId);
  const character = participant.characterId
    ? findCharacterById(characters, participant.characterId)
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
  
  // Find next power of 2
  const rounds = Math.ceil(Math.log2(numParticipants));
  const totalSlots = Math.pow(2, rounds);
  
  // Seed participants by points/ranking
  const seededParticipants = [...participants].sort(
    (a, b) => (b.points || 0) - (a.points || 0)
  );

  // Calculate how many byes needed
  const numByes = totalSlots - numParticipants;
  
  // Top seeds get byes (auto-advance to next round)
  const participantsWithByes = [...seededParticipants];
  
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
          // First round: assign participants
          const player1Index = match * 2;
          const player2Index = match * 2 + 1;
          
          player1 = player1Index < participantsWithByes.length 
            ? participantsWithByes[player1Index]
            : { type: 'bye', userId: null };
            
          player2 = player2Index < participantsWithByes.length
            ? participantsWithByes[player2Index]
            : { type: 'bye', userId: null };
          
          // If one player is bye, other auto-advances
          let matchStatus = 'pending';
          let winner = null;
          
          if (player1.type === 'bye' && player2.type !== 'bye') {
            matchStatus = 'completed';
            winner = player2.userId;
          } else if (player2.type === 'bye' && player1.type !== 'bye') {
            matchStatus = 'completed';
            winner = player1.userId;
          } else if (player1.type === 'bye' && player2.type === 'bye') {
            matchStatus = 'completed';
            winner = null;
          }
          
          roundMatches.push({
            id: matchId,
            player1,
            player2,
            winner,
            status: matchStatus,
            scheduledTime: null,
            votes: { player1: 0, player2: 0 },
            voters: []
          });
        } else {
          // Subsequent rounds: TBD from previous matches
          player1 = { type: 'tbd', matchId: `${round - 1}-${match * 2}` };
          player2 = { type: 'tbd', matchId: `${round - 1}-${match * 2 + 1}` };
          
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
      }

      brackets.push({
        round: round + 1,
        roundName: round === rounds - 1 ? 'Final' : `Round ${round + 1}`,
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

const buildTournamentResponse = (context, tournament) => {
  const participants = (tournament.participants || []).map((p) =>
    buildParticipant(context, p)
  );
  const createdBy = findUserById(context?.users || [], tournament.createdBy);

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
    const tournaments = await tournamentsRepo.getAll({ db });
    const [users, characters] = await Promise.all([
      usersRepo.getAll({ db }),
      charactersRepo.getAll({ db })
    ]);
    const context = { users, characters };
    const sorted = tournaments.slice().sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    res.json(sorted.map((tournament) => buildTournamentResponse(context, tournament)));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const getTournamentById = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const tournament = await tournamentsRepo.findOne(
      (entry) => entry.id === id,
      { db }
    );
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    const [users, characters] = await Promise.all([
      usersRepo.getAll({ db }),
      charactersRepo.getAll({ db })
    ]);
    res.json(buildTournamentResponse({ users, characters }, tournament));
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
    entryFee,
    // New fields
    allowedTiers,        // Array of tier names: ['streetLevel', 'godTier', etc.]
    excludedCharacters,  // Array of character IDs to exclude
    recruitmentDays,     // 1, 2, 3, or 7 days
    battleTime,          // Time of day for battles: '18:00'
    battleDate,          // ISO date string from user's timezone
    userTimezone,        // User's timezone (e.g., 'America/New_York')
    teamSize,            // 1, 2, 3, or more
    showOnFeed,          // Boolean: show battles on main feed
    voteVisibility       // 'live' or 'final'
  } = req.body;

  try {
    // Calculate recruitment end date in UTC
    // battleDate comes from frontend as ISO string in user's local time
    // We parse it and store as UTC
    const recruitmentEnd = new Date(battleDate);
    
    // Validate that the date is in the future
    if (recruitmentEnd <= new Date()) {
      return res.status(400).json({ msg: 'Battle time must be in the future' });
    }

    let createdTournament;

    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );

      // Any logged in user can create tournament now, not just moderators
      if (!user) {
        const error = new Error('User not authenticated');
        error.code = 'USER_NOT_AUTHENTICATED';
        throw error;
      }

      const newTournament = {
        id: uuidv4(),
        name: title,
        title,
        description,
        startDate: recruitmentEnd.toISOString(),
        endDate,
        maxParticipants: maxParticipants || 32,
        rules: rules || '',
        tournamentType: tournamentType || 'single_elimination',
        divisionId: divisionId || null,
        prizePool: prizePool || 0,
        entryFee: entryFee || 0,
        createdBy: req.user.id,
        creatorId: req.user.id,
        creatorName: user.username || 'Unknown',
        status: 'recruiting', // Changed from 'upcoming'
        participants: [],
        fights: [],
        // New settings
        settings: {
          allowedTiers: allowedTiers || ['all'],
          excludedCharacters: excludedCharacters || [],
          recruitmentDays: recruitmentDays || 2,
          battleTime: battleTime || '18:00', // Keep for display purposes
          battleTimeUTC: recruitmentEnd.toISOString(), // Actual UTC time
          userTimezone: userTimezone || 'UTC', // Creator's timezone for reference
          teamSize: teamSize || 1,
          showOnFeed: showOnFeed !== undefined ? showOnFeed : false,
          voteVisibility: normalizeVoteVisibility(voteVisibility),
          publicJoin: true,
          votingDuration: 24,
          requireApproval: false
        },
        brackets: [],
        currentRound: 0,
        stats: {
          totalMatches: 0,
          completedMatches: 0,
          totalVotes: 0
        },
        recruitmentEndDate: recruitmentEnd.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await tournamentsRepo.insert(newTournament, { db });
      createdTournament = newTournament;
      return db;
    });

    res.json(createdTournament);
  } catch (err) {
    if (err.code === 'USER_NOT_AUTHENTICATED') {
      return res.status(401).json({ msg: 'User not authenticated' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

export const startTournament = async (req, res) => {
  const { id } = req.params;

  try {
    let updatedTournament;

    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
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

      const users = await usersRepo.getAll({ db });
      const userById = new Map(
        users.map((entry) => [resolveUserId(entry), entry])
      );

      const participantsWithPoints = (tournament.participants || []).map((p) => {
        const participantUser = userById.get(p.userId);
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

    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
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
    let safeMatch;
    let totalVotes = 0;

    await withDb(async (db) => {
      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
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
      safeMatch = applyTournamentVoteVisibility(tournament, match);
      totalVotes =
        (safeMatch?.votes?.player1 || 0) + (safeMatch?.votes?.player2 || 0);
      return db;
    });

    res.json({
      msg: 'Vote recorded successfully',
      match: safeMatch || matchResult,
      totalVotes
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
    const tournament = await tournamentsRepo.findOne(
      (entry) => entry.id === id,
      { db }
    );

    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    const voteVisibility = normalizeVoteVisibility(tournament?.settings?.voteVisibility);
    const brackets = (tournament.brackets || []).map((round) => ({
      ...round,
      matches: (round.matches || []).map((match) =>
        applyTournamentVoteVisibility(tournament, match)
      )
    }));

    res.json({
      tournament: {
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        winner: tournament.winner,
        voteVisibility
      },
      brackets
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

    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      if (!user || user.role !== 'moderator') {
        const error = new Error('Access denied');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
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

export const joinTournament = async (req, res) => {
  const { id } = req.params;
  const { characterIds } = req.body; // Now accepts array of character IDs for team

  try {
    let updatedTournament;

    await withDb(async (db) => {
      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      if (tournament.status !== 'recruiting') {
        const error = new Error('Tournament is not accepting participants');
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

      const teamSize = tournament.settings?.teamSize || 1;
      if (!characterIds || characterIds.length !== teamSize) {
        const error = new Error(`You must select exactly ${teamSize} character(s)`);
        error.code = 'INVALID_TEAM_SIZE';
        throw error;
      }

      // Check if any selected characters are excluded
      const excludedChars = tournament.settings?.excludedCharacters || [];
      const hasExcluded = characterIds.some(id => excludedChars.includes(id));
      if (hasExcluded) {
        const error = new Error('One or more selected characters are not allowed');
        error.code = 'EXCLUDED_CHARACTER';
        throw error;
      }

      // Check if characters are already taken by other participants
      const takenCharacters = tournament.participants.flatMap(p => p.characterIds || []);
      const alreadyTaken = characterIds.some(id => takenCharacters.includes(id));
      if (alreadyTaken) {
        const error = new Error('One or more characters are already taken');
        error.code = 'CHARACTER_TAKEN';
        throw error;
      }

      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
      const allCharacters = await charactersRepo.getAll({ db });
      const characters = characterIds.map((entryId) => {
        const char = findCharacterById(allCharacters, entryId);
        return { id: entryId, name: char?.name || 'Unknown' };
      });

      tournament.participants.push({
        userId: req.user.id,
        username: user?.username || 'Unknown',
        characterIds: characterIds,
        characters: characters,
        joinedAt: new Date().toISOString()
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

    await withDb(async (db) => {
      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
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
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === req.user.id,
        { db }
      );
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

// Get available characters for tournament
export const getAvailableCharacters = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await readDb();
    const tournament = await tournamentsRepo.findOne(
      (entry) => entry.id === id,
      { db }
    );
    
    if (!tournament) {
      return res.status(404).json({ msg: 'Tournament not found' });
    }

    const allowedTiers = tournament.settings?.allowedTiers || ['all'];
    const excludedCharacters = tournament.settings?.excludedCharacters || [];
    
    // Get all taken characters from participants
    const takenCharacters = tournament.participants?.flatMap(p => p.characterIds || []) || [];
    
    // Filter characters
    const allCharacters = await charactersRepo.getAll({ db });
    let availableCharacters = allCharacters.filter(char => {
      // Check if excluded
      if (excludedCharacters.includes(char.id)) return false;
      
      // Check if already taken
      if (takenCharacters.includes(char.id)) return false;
      
      // Check tier restriction
      // If no tiers selected OR 'all' is selected, allow all characters
      if (allowedTiers.length === 0 || allowedTiers.includes('all')) return true;
      
      // Separate power levels and franchises
      const powerLevels = ['regularPeople', 'metahuman', 'planetBusters', 'godTier', 'universalThreat'];
      const franchises = ['star-wars', 'dragon-ball', 'dc', 'marvel'];
      
      const selectedPowerLevels = allowedTiers.filter(tier => powerLevels.includes(tier));
      const selectedFranchises = allowedTiers.filter(tier => franchises.includes(tier));
      
      // Normalize universe name to match tier format
      const normalizedUniverse = char.universe ? char.universe.toLowerCase().replace(/\s+/g, '-') : '';
      
      // Check matches
      const matchesPowerLevel = selectedPowerLevels.length === 0 || selectedPowerLevels.includes(char.division);
      const matchesFranchise = selectedFranchises.length === 0 || selectedFranchises.includes(normalizedUniverse);
      
      // Both must match (AND logic)
      return matchesPowerLevel && matchesFranchise;
    });

    res.json({
      characters: availableCharacters,
      takenCount: takenCharacters.length,
      availableCount: availableCharacters.length,
      teamSize: tournament.settings?.teamSize || 1,
      allowedTiers: allowedTiers
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

// @route   DELETE /api/tournaments/:id
// @desc    Delete a tournament (creator or moderator only)
// @access  Private
export const deleteTournament = async (req, res) => {
  const { id } = req.params;
  const userId = resolveUserId(req.user);

  try {
    await withDb(async (db) => {
      const user = await usersRepo.findOne(
        (entry) => resolveUserId(entry) === userId,
        { db }
      );

      if (!user) {
        const error = new Error('User not found');
        error.code = 'USER_NOT_FOUND';
        throw error;
      }

      const tournament = await tournamentsRepo.findOne(
        (entry) => entry.id === id,
        { db }
      );
      if (!tournament) {
        const error = new Error('Tournament not found');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const isModerator = user.role === 'moderator' || user.role === 'admin';
      const isCreator = tournament.creatorId === userId;

      // Check permissions
      if (!isModerator && !isCreator) {
        const error = new Error('Not authorized to delete this tournament');
        error.code = 'ACCESS_DENIED';
        throw error;
      }

      // If not moderator, can only delete recruiting tournaments
      if (!isModerator && tournament.status !== 'recruiting') {
        const error = new Error('Can only delete tournaments that have not started');
        error.code = 'INVALID_STATUS';
        throw error;
      }

      await logModerationAction({
        db,
        actor: user,
        action: 'tournament.delete',
        targetType: 'tournament',
        targetId: id,
        details: {
          ownTournament: isCreator,
          status: tournament.status || 'unknown',
          name: tournament.name || tournament.title || ''
        }
      });
      await tournamentsRepo.removeById(id, { db });
      return db;
    });

    res.json({ msg: 'Tournament deleted successfully' });
  } catch (err) {
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ msg: 'Tournament not found' });
    }
    if (err.code === 'ACCESS_DENIED') {
      return res.status(403).json({ msg: 'Not authorized to delete this tournament' });
    }
    if (err.code === 'INVALID_STATUS') {
      return res.status(403).json({ msg: 'Can only delete tournaments that have not started' });
    }
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
