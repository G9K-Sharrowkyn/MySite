import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import {
  withDb,
  notificationsRepo,
  tournamentsRepo,
  userBadgesRepo,
  usersRepo
} from '../repositories/index.js';

const getAllTournaments = async () => tournamentsRepo.getAll();

const updateTournament = async (id, tournament) =>
  tournamentsRepo.updateById(id, () => tournament);

// Funkcja wysyłająca powiadomienia do uczestników
async function notifyParticipants(tournament, type, message) {
  try {
    const participants = tournament.participants || [];

    await notificationsRepo.updateAll((notifications) => {
      participants.forEach((participant) => {
        notifications.push({
          id: uuidv4(),
          userId: participant.userId,
          type: 'tournament',
          title: type === 'start' ? '🏆 Tournament Started!' : '🎉 Tournament Completed!',
          message: message,
          data: {
            tournamentId: tournament.id,
            tournamentTitle: tournament.title
          },
          read: false,
          createdAt: new Date().toISOString()
        });
      });

      return notifications;
    });
    
    console.log(`Notifications sent to ${participants.length} participants for tournament ${tournament.id}`);
  } catch (error) {
    console.error('Error sending notifications:', error);
  }
}

// Funkcja dodająca badge zwycięzcy
async function addWinnerBadge(userId, tournament) {
  try {
    await withDb((db) => {
      const badge = {
        id: uuidv4(),
        userId: userId,
        type: 'tournament_winner',
        tournamentId: tournament.id,
        tournamentTitle: tournament.title,
        teamMembers: tournament.participants.find((p) => p.userId === userId)?.characters || [],
        wonAt: new Date().toISOString(),
        displayOnProfile: true
      };

      userBadgesRepo.insert(badge, { db });

      usersRepo.updateById(
        userId,
        (user) => {
          user.tournamentsWon = (user.tournamentsWon || 0) + 1;
          return user;
        },
        { db }
      );

      return db;
    });
    
    console.log(`Winner badge added for user ${userId} in tournament ${tournament.id}`);
  } catch (error) {
    console.error('Error adding winner badge:', error);
  }
}

// Funkcja generująca brackety automatycznie
async function generateBracketsForTournament(tournament) {
  try {
    const participants = tournament.participants || [];
    
    if (participants.length < 2) {
      console.log(`Tournament ${tournament.id} has insufficient participants`);
      return false;
    }

    // Sortuj uczestników według punktów
    participants.sort((a, b) => (b.points || 0) - (a.points || 0));

    // Znajdź najbliższą potęgę 2
    let bracketSize = 2;
    while (bracketSize < participants.length) {
      bracketSize *= 2;
    }

    const byeCount = bracketSize - participants.length;
    const matches = [];

    // Pierwsza runda z bye
    for (let i = 0; i < bracketSize / 2; i++) {
      const participant1 = participants[i] || null;
      const participant2 = participants[bracketSize - 1 - i] || null;

      const match = {
        id: uuidv4(),
        round: 1,
        matchNumber: i + 1,
        participant1: participant1 ? {
          userId: participant1.userId,
          username: participant1.username,
          characters: participant1.characters
        } : { type: 'bye' },
        participant2: participant2 ? {
          userId: participant2.userId,
          username: participant2.username,
          characters: participant2.characters
        } : { type: 'bye' },
        status: 'pending',
        votes: {},
        winner: null
      };

      // Auto-advance jeśli jest bye
      if (!participant2) {
        match.status = 'completed';
        match.winner = participant1.userId;
      } else if (!participant1) {
        match.status = 'completed';
        match.winner = participant2.userId;
      }

      matches.push(match);
    }

    // Oblicz liczbę rund
    const totalRounds = Math.log2(bracketSize);
    
    // Stwórz puste mecze dla pozostałych rund
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: uuidv4(),
          round,
          matchNumber: i + 1,
          participant1: { type: 'tbd' },
          participant2: { type: 'tbd' },
          status: 'pending',
          votes: {},
          winner: null
        });
      }
    }

    // Zaktualizuj turniej
    tournament.brackets = matches;
    tournament.currentRound = 1;
    tournament.status = 'active';

    await updateTournament(tournament.id, tournament);
    
    // Wyślij powiadomienia do uczestników
    await notifyParticipants(
      tournament, 
      'start', 
      `Tournament "${tournament.title}" has started! Check out the brackets and vote for your favorites.`
    );
    
    console.log(`Brackets generated for tournament ${tournament.id}`);
    return true;
  } catch (error) {
    console.error('Error generating brackets:', error);
    return false;
  }
}

// Funkcja zaawansująca rundę turnieju
async function advanceRound(tournament) {
  try {
    const matches = tournament.brackets || [];
    const currentRound = tournament.currentRound || 1;
    
    // Znajdź mecze z obecnej rundy
    const currentRoundMatches = matches.filter(m => m.round === currentRound);
    
    // Sprawdź, czy wszystkie mecze są ukończone
    const allCompleted = currentRoundMatches.every(m => m.status === 'completed');
    
    if (!allCompleted) {
      console.log(`Tournament ${tournament.id} - not all matches completed in round ${currentRound}`);
      return false;
    }

    // Znajdź mecze z następnej rundy
    const nextRound = currentRound + 1;
    const nextRoundMatches = matches.filter(m => m.round === nextRound);
    
    if (nextRoundMatches.length === 0) {
      // Turniej zakończony
      tournament.status = 'completed';
      const finalMatch = currentRoundMatches[0];
      tournament.winner = finalMatch.winner;
      
      // Dodaj badge zwycięzcy
      if (finalMatch.winner) {
        await addWinnerBadge(finalMatch.winner, tournament);
        
        // Wyślij powiadomienia o zakończeniu
        const winnerParticipant = tournament.participants.find(p => p.userId === finalMatch.winner);
        await notifyParticipants(
          tournament,
          'complete',
          `Tournament "${tournament.title}" has ended! Winner: ${winnerParticipant?.username || 'Unknown'} 🏆`
        );
      }
      
      await updateTournament(tournament.id, tournament);
      console.log(`Tournament ${tournament.id} completed! Winner: ${finalMatch.winner}`);
      return true;
    }

    // Zaawansuj zwycięzców do następnej rundy
    for (let i = 0; i < nextRoundMatches.length; i++) {
      const match1 = currentRoundMatches[i * 2];
      const match2 = currentRoundMatches[i * 2 + 1];
      
      if (match1 && match1.winner) {
        const winner1 = tournament.participants.find(p => p.userId === match1.winner);
        nextRoundMatches[i].participant1 = {
          userId: winner1.userId,
          username: winner1.username,
          characters: winner1.characters
        };
      }
      
      if (match2 && match2.winner) {
        const winner2 = tournament.participants.find(p => p.userId === match2.winner);
        nextRoundMatches[i].participant2 = {
          userId: winner2.userId,
          username: winner2.username,
          characters: winner2.characters
        };
      }
      
      // Ustaw status meczu
      if (nextRoundMatches[i].participant1.type !== 'tbd' && 
          nextRoundMatches[i].participant2.type !== 'tbd') {
        nextRoundMatches[i].status = 'active';
      }
    }

    tournament.currentRound = nextRound;
    await updateTournament(tournament.id, tournament);
    
    console.log(`Tournament ${tournament.id} advanced to round ${nextRound}`);
    return true;
  } catch (error) {
    console.error('Error advancing round:', error);
    return false;
  }
}

// Cron job sprawdzający turnieje co godzinę
cron.schedule('0 * * * *', async () => {
  console.log('Running tournament scheduler...');
  
  try {
    const tournaments = await getAllTournaments();
    
    for (const tournament of tournaments) {
      const now = new Date();
      
      // Sprawdź turnieje w fazie rekrutacji
      if (tournament.status === 'recruiting' && tournament.recruitmentEndDate) {
        const endDate = new Date(tournament.recruitmentEndDate);
        
        if (now >= endDate) {
          console.log(`Starting tournament ${tournament.id}`);
          await generateBracketsForTournament(tournament);
        }
      }
      
      // Sprawdź aktywne turnieje
      if (tournament.status === 'active' && tournament.battleTime) {
        const battleTime = tournament.battleTime; // Format "HH:MM"
        const [hours, minutes] = battleTime.split(':').map(Number);
        
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Jeśli jest czas bitwy (z tolerancją 5 minut)
        if (currentHour === hours && currentMinute >= minutes && currentMinute < minutes + 5) {
          console.log(`Checking if round can advance for tournament ${tournament.id}`);
          await advanceRound(tournament);
        }
      }
    }
  } catch (error) {
    console.error('Error in tournament scheduler:', error);
  }
});

// Dodatkowy cron sprawdzający zakończenie głosowania co 10 minut
cron.schedule('*/10 * * * *', async () => {
  console.log('Checking active matches for vote completion...');
  
  try {
    const tournaments = await getAllTournaments();
    
    for (const tournament of tournaments) {
      if (tournament.status !== 'active') continue;
      
      const matches = tournament.brackets || [];
      const currentRound = tournament.currentRound || 1;
      const currentRoundMatches = matches.filter(m => m.round === currentRound && m.status === 'active');
      
      let updated = false;
      
      for (const match of currentRoundMatches) {
        const votes = match.votes || {};
        const participant1Votes = Object.values(votes).filter(v => v === match.participant1?.userId).length;
        const participant2Votes = Object.values(votes).filter(v => v === match.participant2?.userId).length;
        
        // Jeśli któryś osiągnął próg głosów (np. 10), zakończ mecz
        const VOTE_THRESHOLD = 10;
        
        if (participant1Votes >= VOTE_THRESHOLD || participant2Votes >= VOTE_THRESHOLD) {
          match.winner = participant1Votes > participant2Votes ? 
            match.participant1.userId : match.participant2.userId;
          match.status = 'completed';
          updated = true;
          
          console.log(`Match ${match.id} completed by votes in tournament ${tournament.id}`);
        }
      }
      
      if (updated) {
        await updateTournament(tournament.id, tournament);
      }
    }
  } catch (error) {
    console.error('Error checking match votes:', error);
  }
});

console.log('Tournament scheduler initialized');

export {
  generateBracketsForTournament,
  advanceRound
};
