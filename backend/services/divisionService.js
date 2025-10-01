import Fight from '../models/Fight.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
// Will be injected during runtime
let io;
import badgeService from './badgeService.js';

class DivisionService {
  // Set the io instance dynamically
  setIoInstance(ioInstance) {
    io = ioInstance;
  }
  // Automatyczne zamykanie walk po 72 godzinach
  async autoLockExpiredFights() {
    try {
      const now = new Date();
      const expiredFights = await Fight.find({
        'timer.endTime': { $lt: now },
        status: 'active',
        'timer.autoLock': true
      });

      for (const fight of expiredFights) {
        await this.lockFight(fight._id, 'auto_lock');
      }

      console.log(`Auto-locked ${expiredFights.length} expired fights`);
      return expiredFights.length;
    } catch (error) {
      console.error('Error auto-locking expired fights:', error);
      throw error;
    }
  }

  // Zamykanie walki i określanie zwycięzcy
  async lockFight(fightId, method = 'manual') {
    try {
      const fight = await Fight.findById(fightId);
      if (!fight) {
        throw new Error('Fight not found');
      }

      if (fight.status !== 'active') {
        throw new Error('Fight is not active');
      }

      // Określ zwycięzcę na podstawie głosów
      let winner = 'draw';
      let winnerTeam = null;

      if (fight.votesA > fight.votesB) {
        winner = 'A';
        winnerTeam = 'teamA';
      } else if (fight.votesB > fight.votesA) {
        winner = 'B';
        winnerTeam = 'teamB';
      }

      // Aktualizuj walkę
      fight.status = 'finished';
      fight.result = {
        winner,
        winnerTeam,
        finalVotesA: fight.votesA,
        finalVotesB: fight.votesB,
        finishedAt: new Date(),
        method
      };

      await fight.save();

      // Jeśli to walka o tytuł, zaktualizuj mistrza dywizji
      if (fight.type === 'title_fight' && winner !== 'draw') {
        await this.updateDivisionChampion(fight, winner);
      }

      // Jeśli to contender match, zaktualizuj status pretendentów
      if (fight.type === 'contender_match' && winner !== 'draw') {
        await this.updateContenderStatus(fight, winner);
      }

      // Wyślij powiadomienia
      await this.sendFightResultNotifications(fight);

      // Rozlicz zakłady jeśli istnieją
      if (fight.betting?.enabled) {
        await this.settleFightBets(fight);
      }

      return fight;
    } catch (error) {
      console.error('Error locking fight:', error);
      throw error;
    }
  }

  // Tworzenie walki o tytuł
  async createTitleFight(divisionId, challengerId, championId, moderatorId, description = '') {
    try {
      const challenger = await User.findById(challengerId);
      const champion = await User.findById(championId);

      if (!challenger || !champion) {
        throw new Error('Challenger or champion not found');
      }

      const challengerTeam = challenger.divisions?.[divisionId]?.team;
      const championTeam = champion.divisions?.[divisionId]?.team;

      if (!challengerTeam || !championTeam) {
        throw new Error('Both fighters must have teams in this division');
      }

      // Sprawdź czy challenger ma status #1 contender
      if (!challenger.divisions[divisionId]?.contenderStatus?.isNumberOneContender) {
        throw new Error('Challenger must be the #1 contender');
      }

      const titleFight = new Fight({
        title: `${divisionId.toUpperCase()} TITLE FIGHT: ${champion.username} vs ${challenger.username}`,
        description: description || `Championship bout for the ${divisionId} division title`,
        teamA: challengerTeam.characters,
        teamB: championTeam.characters,
        type: 'title_fight',
        isOfficial: true,
        moderatorCreated: true,
        createdBy: moderatorId,
        division: {
          id: divisionId,
          name: this.getDivisionName(divisionId),
          tier: this.getDivisionTier(divisionId)
        },
        timer: {
          duration: 72,
          startTime: new Date(),
          endTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
          autoLock: true
        },
        betting: {
          enabled: true,
          bettingWindow: {
            openTime: new Date(),
            closeTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h betting window
            active: true,
            locked: false
          }
        }
      });

      await titleFight.save();

      // Wyślij powiadomienia
      await this.sendTitleFightNotifications(titleFight, challenger, champion);

      return titleFight;
    } catch (error) {
      console.error('Error creating title fight:', error);
      throw error;
    }
  }

  // Tworzenie contender match
  async createContenderMatch(divisionId, challenger1Id, challenger2Id, moderatorId, description = '') {
    try {
      const challenger1 = await User.findById(challenger1Id);
      const challenger2 = await User.findById(challenger2Id);

      if (!challenger1 || !challenger2) {
        throw new Error('One or both challengers not found');
      }

      const team1 = challenger1.divisions?.[divisionId]?.team;
      const team2 = challenger2.divisions?.[divisionId]?.team;

      if (!team1 || !team2) {
        throw new Error('Both challengers must have teams in this division');
      }

      const contenderMatch = new Fight({
        title: `CONTENDER MATCH: ${challenger1.username} vs ${challenger2.username}`,
        description: description || `Contender match to determine the #1 challenger for the ${divisionId} division`,
        teamA: team1.characters,
        teamB: team2.characters,
        type: 'contender_match',
        isOfficial: true,
        moderatorCreated: true,
        createdBy: moderatorId,
        division: {
          id: divisionId,
          name: this.getDivisionName(divisionId),
          tier: this.getDivisionTier(divisionId)
        },
        timer: {
          duration: 72,
          startTime: new Date(),
          endTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
          autoLock: true
        },
        betting: {
          enabled: true,
          bettingWindow: {
            openTime: new Date(),
            closeTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            active: true,
            locked: false
          }
        }
      });

      await contenderMatch.save();

      // Wyślij powiadomienia
      await this.sendContenderMatchNotifications(contenderMatch, challenger1, challenger2);

      return contenderMatch;
    } catch (error) {
      console.error('Error creating contender match:', error);
      throw error;
    }
  }

  // Aktualizacja mistrza dywizji
  async updateDivisionChampion(fight, winner) {
    try {
      const divisionId = fight.division.id;
      const winnerTeam = winner === 'A' ? fight.teamA : fight.teamB;
      
      // Znajdź nowego mistrza (challenger)
      const newChampion = await User.findOne({
        [`divisions.${divisionId}.team.characters`]: { $in: winnerTeam.map(c => c.characterId) }
      });

      // Znajdź poprzedniego mistrza
      const formerChampion = await User.findOne({
        [`divisions.${divisionId}.isChampion`]: true
      });

      if (newChampion && formerChampion && newChampion._id.toString() !== formerChampion._id.toString()) {
        // Usuń status mistrza od poprzedniego mistrza
        await User.updateOne(
          { _id: formerChampion._id },
          { 
            $unset: { [`divisions.${divisionId}.isChampion`]: 1 },
            $set: { [`divisions.${divisionId}.championshipHistory.endDate`]: new Date() }
          }
        );

        // Nadaj status mistrza nowemu mistrzowi
        await User.updateOne(
          { _id: newChampion._id },
          { 
            $set: { 
              [`divisions.${divisionId}.isChampion`]: true,
              [`divisions.${divisionId}.championshipHistory`]: {
                startDate: new Date(),
                titleDefenses: 0,
                totalFights: 1
              }
            },
            $unset: { [`divisions.${divisionId}.contenderStatus`]: 1 }
          }
        );

        // Zapisz w historii mistrzów
        await this.recordChampionshipChange(divisionId, formerChampion, newChampion, fight);

        // Przyznaj odznakę za mistrzostwo
        await badgeService.awardChampionshipBadge(newChampion._id, divisionId);
      }
    } catch (error) {
      console.error('Error updating division champion:', error);
      throw error;
    }
  }

  // Aktualizacja statusu pretendentów
  async updateContenderStatus(fight, winner) {
    try {
      const divisionId = fight.division.id;
      const winnerTeam = winner === 'A' ? fight.teamA : fight.teamB;
      
      // Znajdź zwycięzcę
      const newContender = await User.findOne({
        [`divisions.${divisionId}.team.characters`]: { $in: winnerTeam.map(c => c.characterId) }
      });

      if (newContender) {
        // Usuń status #1 contender od wszystkich innych
        await User.updateMany(
          { [`divisions.${divisionId}.contenderStatus.isNumberOneContender`]: true },
          { $unset: { [`divisions.${divisionId}.contenderStatus`]: 1 } }
        );

        // Nadaj status #1 contender zwycięzcy
        await User.updateOne(
          { _id: newContender._id },
          { 
            $set: { 
              [`divisions.${divisionId}.contenderStatus`]: {
                isNumberOneContender: true,
                earnedDate: new Date(),
                contenderFights: (newContender.divisions?.[divisionId]?.contenderStatus?.contenderFights || 0) + 1
              }
            }
          }
        );
      }
    } catch (error) {
      console.error('Error updating contender status:', error);
      throw error;
    }
  }

  // Zapisywanie zmiany mistrzostwa
  async recordChampionshipChange(divisionId, formerChampion, newChampion, fight) {
    try {
      // Tu można dodać logikę zapisywania historii mistrzostw w osobnej kolekcji
      // Na razie zapisujemy w modelu User
      console.log(`Championship change recorded: ${formerChampion.username} -> ${newChampion.username} in ${divisionId}`);
    } catch (error) {
      console.error('Error recording championship change:', error);
      throw error;
    }
  }

  // Wysyłanie powiadomień o wyniku walki
  async sendFightResultNotifications(fight) {
    try {
      // Powiadomienia dla uczestników walki
      const participants = await User.find({
        $or: [
          { [`divisions.${fight.division.id}.team.characters`]: { $in: fight.teamA.map(c => c.characterId) } },
          { [`divisions.${fight.division.id}.team.characters`]: { $in: fight.teamB.map(c => c.characterId) } }
        ]
      });

      for (const participant of participants) {
        const notification = new Notification({
          userId: participant._id,
          type: 'fight_result',
          title: 'Fight Result',
          message: `Your ${fight.type.replace('_', ' ')} in ${fight.division.name} division has ended!`,
          data: {
            fightId: fight._id,
            result: fight.result,
            divisionId: fight.division.id
          }
        });

        await notification.save();
        
        // Wyślij przez WebSocket jeśli użytkownik jest online
        if (io) {
          io.to(`user_${participant._id}`).emit('notification', notification);
        }

        // Sprawdź i przyznaj odznaki za osiągnięcia
        await badgeService.checkAndAwardBadges(participant._id);
      }
    } catch (error) {
      console.error('Error sending fight result notifications:', error);
    }
  }

  // Wysyłanie powiadomień o walce o tytuł
  async sendTitleFightNotifications(fight, challenger, champion) {
    try {
      // Powiadomienie dla challengera
      const challengerNotification = new Notification({
        userId: challenger._id,
        type: 'title_fight_created',
        title: 'Title Fight Scheduled!',
        message: `Your title fight against ${champion.username} has been scheduled!`,
        data: {
          fightId: fight._id,
          divisionId: fight.division.id,
          opponent: champion.username
        }
      });

      // Powiadomienie dla mistrza
      const championNotification = new Notification({
        userId: champion._id,
        type: 'title_defense',
        title: 'Title Defense Scheduled!',
        message: `You must defend your title against ${challenger.username}!`,
        data: {
          fightId: fight._id,
          divisionId: fight.division.id,
          challenger: challenger.username
        }
      });

      await Promise.all([
        challengerNotification.save(),
        championNotification.save()
      ]);

      // Wyślij przez WebSocket
      if (io) {
        io.to(`user_${challenger._id}`).emit('notification', challengerNotification);
        io.to(`user_${champion._id}`).emit('notification', championNotification);
      }
    } catch (error) {
      console.error('Error sending title fight notifications:', error);
    }
  }

  // Wysyłanie powiadomień o contender match
  async sendContenderMatchNotifications(fight, challenger1, challenger2) {
    try {
      const notifications = [
        new Notification({
          userId: challenger1._id,
          type: 'contender_match_created',
          title: 'Contender Match Scheduled!',
          message: `Your contender match against ${challenger2.username} has been scheduled!`,
          data: {
            fightId: fight._id,
            divisionId: fight.division.id,
            opponent: challenger2.username
          }
        }),
        new Notification({
          userId: challenger2._id,
          type: 'contender_match_created',
          title: 'Contender Match Scheduled!',
          message: `Your contender match against ${challenger1.username} has been scheduled!`,
          data: {
            fightId: fight._id,
            divisionId: fight.division.id,
            opponent: challenger1.username
          }
        })
      ];

      await Promise.all(notifications.map(n => n.save()));

      // Wyślij przez WebSocket
      if (io) {
        io.to(`user_${challenger1._id}`).emit('notification', notifications[0]);
        io.to(`user_${challenger2._id}`).emit('notification', notifications[1]);
      }
    } catch (error) {
      console.error('Error sending contender match notifications:', error);
    }
  }

  // Rozliczanie zakładów po zakończeniu walki
  async settleFightBets(fight) {
    try {
      // Tu będzie integracja z systemem zakładów
      console.log(`Settling bets for fight ${fight._id}`);
      // Implementacja będzie dodana w integracji z betting service
    } catch (error) {
      console.error('Error settling fight bets:', error);
    }
  }

  // Pobieranie statystyk dywizji
  async getDivisionStats(divisionId) {
    try {
      const activeTeams = await User.countDocuments({
        [`divisions.${divisionId}`]: { $exists: true }
      });

      const totalOfficialFights = await Fight.countDocuments({
        'division.id': divisionId,
        isOfficial: true
      });

      const avgVotesResult = await Fight.aggregate([
        { $match: { 'division.id': divisionId, isOfficial: true } },
        { $group: { _id: null, avgVotes: { $avg: { $add: ['$votesA', '$votesB'] } } } }
      ]);

      const averageVotes = avgVotesResult.length > 0 ? Math.round(avgVotesResult[0].avgVotes) : 0;

      return {
        activeTeams,
        totalOfficialFights,
        averageVotes
      };
    } catch (error) {
      console.error('Error getting division stats:', error);
      throw error;
    }
  }

  // Pobieranie aktualnego mistrza dywizji
  async getDivisionChampion(divisionId) {
    try {
      const champion = await User.findOne({
        [`divisions.${divisionId}.isChampion`]: true
      }).select('username profilePicture divisions');

      if (!champion) {
        return null;
      }

      const championData = champion.divisions[divisionId];
      return {
        username: champion.username,
        profilePicture: champion.profilePicture,
        title: `${this.getDivisionName(divisionId)} Champion`,
        stats: {
          wins: championData.wins || 0,
          losses: championData.losses || 0,
          rank: 'Champion',
          points: championData.points || 0
        },
        team: championData.team,
        championshipHistory: championData.championshipHistory
      };
    } catch (error) {
      console.error('Error getting division champion:', error);
      throw error;
    }
  }

  // Pobieranie leaderboardu dywizji
  async getLeaderboard(divisionId, limit = 50) {
    try {
      const users = await User.find({
        [`divisions.${divisionId}`]: { $exists: true }
      }).select('username profile divisions');

      const leaderboard = users.map(user => {
        const divisionData = user.divisions.get(divisionId);
        return {
          userId: user._id,
          username: user.username,
          profilePicture: user.profile?.profilePicture || '',
          wins: divisionData?.wins || 0,
          losses: divisionData?.losses || 0,
          draws: divisionData?.draws || 0,
          points: divisionData?.points || 0,
          rank: divisionData?.rank || 'Rookie',
          isChampion: divisionData?.isChampion || false,
          team: divisionData?.team
        };
      })
      .sort((a, b) => {
        // Champions first
        if (a.isChampion && !b.isChampion) return -1;
        if (!a.isChampion && b.isChampion) return 1;

        // Then by points
        if (b.points !== a.points) return b.points - a.points;

        // Then by wins
        if (b.wins !== a.wins) return b.wins - a.wins;

        // Finally by username
        return a.username.localeCompare(b.username);
      })
      .slice(0, limit);

      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  // Pomocnicze funkcje
  getDivisionName(divisionId) {
    const names = {
      'regular-people': 'Regular People',
      'regular': 'Regular People',
      'metahuman': 'Metahuman',
      'planet-busters': 'Planet Busters',
      'planetBusters': 'Planet Busters',
      'god-tier': 'God Tier',
      'godTier': 'God Tier',
      'universal-threat': 'Universal Threat',
      'universalThreat': 'Universal Threat',
      'omnipotent': 'Omnipotent'
    };
    return names[divisionId] || divisionId;
  }

  getDivisionTier(divisionId) {
    const tiers = {
      'regular-people': '1-10',
      'regular': '1-10',
      'metahuman': '11-50',
      'planet-busters': '51-100',
      'planetBusters': '51-100',
      'god-tier': '101-500',
      'godTier': '101-500',
      'universal-threat': '501-1000',
      'universalThreat': '501-1000',
      'omnipotent': '1000+'
    };
    return tiers[divisionId] || 'Unknown';
  }
}

export default new DivisionService();