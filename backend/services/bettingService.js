import Fight from '../models/Fight.js';
import Bet from '../models/Bet.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import cron from 'node-cron';

class BettingService {
  constructor() {
    this.initializeCronJobs();
  }

  // Inicjalizacja zadań cron
  initializeCronJobs() {
    // Sprawdzaj co minutę czy należy zamknąć betting window
    cron.schedule('* * * * *', () => {
      this.checkAndCloseBettingWindows();
    });

    // Sprawdzaj co 5 minut czy należy rozliczyć zakłady
    cron.schedule('*/5 * * * *', () => {
      this.settleFinishedFights();
    });

    // Aktualizuj dynamiczne kursy co 2 minuty
    cron.schedule('*/2 * * * *', () => {
      this.updateDynamicOdds();
    });

    console.log('🎰 Betting Service: Cron jobs initialized');
  }

  // Sprawdź i zamknij betting windows
  async checkAndCloseBettingWindows() {
    try {
      const now = new Date();
      
      // Znajdź walki z aktywnym betting window, które powinny zostać zamknięte
      const fightsToClose = await Fight.find({
        'betting.enabled': true,
        'betting.bettingWindow.active': true,
        'betting.bettingWindow.locked': false,
        'betting.bettingWindow.closeTime': { $lte: now }
      });

      for (const fight of fightsToClose) {
        await this.closeBettingWindow(fight);
      }

      if (fightsToClose.length > 0) {
        console.log(`🔒 Betting Service: Closed betting for ${fightsToClose.length} fights`);
      }

    } catch (error) {
      console.error('Error checking betting windows:', error);
    }
  }

  // Zamknij betting window dla walki
  async closeBettingWindow(fight) {
    try {
      fight.betting.bettingWindow.active = false;
      fight.betting.bettingWindow.locked = true;
      await fight.save();

      // Powiadom użytkowników którzy postawili zakłady
      const bets = await Bet.find({ 
        fightId: fight._id.toString(), 
        status: 'active' 
      });

      const userIds = [...new Set(bets.map(bet => bet.userId))];
      
      for (const userId of userIds) {
        await Notification.create({
          userId,
          type: 'system',
          category: 'system',
          title: 'Zakłady zamknięte',
          message: `Zakłady dla walki "${fight.title}" zostały zamknięte. Wyniki będą dostępne po zakończeniu walki.`,
          priority: 'medium',
          actionUrl: `/fight/${fight._id}`
        });
      }

      console.log(`🔒 Betting window closed for fight: ${fight.title}`);

    } catch (error) {
      console.error(`Error closing betting window for fight ${fight._id}:`, error);
    }
  }

  // Rozlicz zakończone walki
  async settleFinishedFights() {
    try {
      // Znajdź walki które się zakończyły ale nie zostały rozliczone
      const finishedFights = await Fight.find({
        status: 'finished',
        'betting.enabled': true,
        'result.winner': { $exists: true, $ne: null }
      });

      for (const fight of finishedFights) {
        // Sprawdź czy są nierozliczone zakłady
        const unsettledBets = await Bet.find({
          $or: [
            { fightId: fight._id.toString(), status: 'active' },
            { 'parlayBets.fightId': fight._id.toString(), status: 'active' }
          ]
        });

        if (unsettledBets.length > 0) {
          await this.settleFightBets(fight, unsettledBets);
        }
      }

    } catch (error) {
      console.error('Error settling finished fights:', error);
    }
  }

  // Rozlicz zakłady dla konkretnej walki
  async settleFightBets(fight, bets) {
    try {
      const winner = fight.result.winner; // 'A', 'B', 'draw', 'no_contest'
      let settledCount = 0;
      let totalWinnings = 0;

      for (const bet of bets) {
        if (bet.type === 'single' && bet.fightId === fight._id.toString()) {
          // Pojedynczy zakład
          await bet.settle(winner, 'system');
          
          if (bet.status === 'won') {
            // Dodaj wygrane do konta użytkownika
            await this.payoutWinnings(bet.userId, bet.result.winnings);
            totalWinnings += bet.result.winnings;
          }
          
          // Powiadom użytkownika o wyniku
          await this.notifyBetResult(bet, fight);
          settledCount++;

        } else if (bet.type === 'parlay') {
          // Zakład parlay - sprawdź czy wszystkie walki się zakończyły
          const parlayFightIds = bet.parlayBets.map(pb => pb.fightId);
          const parlayFights = await Fight.find({
            _id: { $in: parlayFightIds },
            status: 'finished',
            'result.winner': { $exists: true, $ne: null }
          });

          if (parlayFights.length === bet.parlayBets.length) {
            // Wszystkie walki zakończone - rozlicz parlay
            const allCorrect = bet.parlayBets.every(parlayBet => {
              const fightResult = parlayFights.find(f => 
                f._id.toString() === parlayBet.fightId
              );
              return fightResult && fightResult.result.winner === parlayBet.prediction;
            });

            if (allCorrect) {
              bet.status = 'won';
              bet.result.winnings = bet.potentialWinnings;
              await this.payoutWinnings(bet.userId, bet.result.winnings);
              totalWinnings += bet.result.winnings;
            } else {
              bet.status = 'lost';
              bet.result.winnings = bet.insurance.enabled ? 
                bet.amount * (bet.insurance.refundPercentage / 100) : 0;
              
              if (bet.result.winnings > 0) {
                await this.payoutWinnings(bet.userId, bet.result.winnings);
              }
            }

            bet.result.settledAt = new Date();
            bet.result.settledBy = 'system';
            await bet.save();

            await this.notifyBetResult(bet, fight);
            settledCount++;
          }
        }
      }

      console.log(`💰 Settled ${settledCount} bets for fight: ${fight.title}, total winnings: ${totalWinnings}`);

    } catch (error) {
      console.error(`Error settling bets for fight ${fight._id}:`, error);
    }
  }

  // Wypłać wygrane użytkownikowi
  async payoutWinnings(userId, amount) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.virtualCoins = (user.virtualCoins || 0) + amount;
        await user.save();
      }
    } catch (error) {
      console.error(`Error paying out winnings to user ${userId}:`, error);
    }
  }

  // Powiadom użytkownika o wyniku zakładu
  async notifyBetResult(bet, fight) {
    try {
      let message;
      let priority = 'medium';

      if (bet.status === 'won') {
        message = `Gratulacje! Wygrałeś zakład na walkę "${fight.title}". Wygrane: ${bet.result.winnings} monet.`;
        priority = 'high';
      } else if (bet.status === 'lost') {
        if (bet.result.winnings > 0) {
          message = `Przegrałeś zakład na walkę "${fight.title}", ale otrzymujesz zwrot z ubezpieczenia: ${bet.result.winnings} monet.`;
        } else {
          message = `Przegrałeś zakład na walkę "${fight.title}".`;
        }
      } else if (bet.status === 'cancelled') {
        message = `Zakład na walkę "${fight.title}" został anulowany. Zwrot stawki: ${bet.amount} monet.`;
      }

      await Notification.create({
        userId: bet.userId,
        type: 'fight_result',
        category: 'fight_result',
        title: 'Wynik zakładu',
        message,
        priority,
        actionUrl: `/betting/my-bets`,
        metadata: {
          fightId: fight._id.toString(),
          betId: bet._id.toString(),
          customData: {
            betAmount: bet.amount,
            winnings: bet.result.winnings,
            betType: bet.type
          }
        }
      });

    } catch (error) {
      console.error(`Error notifying bet result for bet ${bet._id}:`, error);
    }
  }

  // Aktualizuj dynamiczne kursy
  async updateDynamicOdds() {
    try {
      const activeFights = await Fight.find({
        'betting.enabled': true,
        'betting.bettingWindow.active': true,
        'betting.bettingWindow.locked': false
      });

      for (const fight of activeFights) {
        const bets = await Bet.find({ 
          fightId: fight._id.toString(), 
          status: 'active' 
        });

        if (bets.length > 0) {
          const betsA = bets.filter(bet => bet.prediction === 'A');
          const betsB = bets.filter(bet => bet.prediction === 'B');
          
          const totalAmountA = betsA.reduce((sum, bet) => sum + bet.amount, 0);
          const totalAmountB = betsB.reduce((sum, bet) => sum + bet.amount, 0);
          const totalAmount = totalAmountA + totalAmountB;

          if (totalAmount > 0) {
            // Oblicz nowe kursy na podstawie rozkładu pieniędzy
            const ratioA = totalAmountA / totalAmount;
            const ratioB = totalAmountB / totalAmount;

            // Bazowe kursy z marginesem (5%)
            const margin = 0.05;
            const newOddsA = Math.max(1.01, 1 / (ratioA + margin));
            const newOddsB = Math.max(1.01, 1 / (ratioB + margin));

            // Zaokrąglij do 2 miejsc po przecinku
            fight.betting.oddsA = Math.round(newOddsA * 100) / 100;
            fight.betting.oddsB = Math.round(newOddsB * 100) / 100;

            await fight.save();
          }
        }
      }

    } catch (error) {
      console.error('Error updating dynamic odds:', error);
    }
  }

  // Ręczne rozliczenie walki przez moderatora
  async manualSettleFight(fightId, winner, moderatorId) {
    try {
      const fight = await Fight.findById(fightId);
      if (!fight) {
        throw new Error('Fight not found');
      }

      // Ustaw wynik walki
      fight.result = {
        winner,
        finishedAt: new Date(),
        method: 'moderator'
      };
      fight.status = 'finished';
      await fight.save();

      // Rozlicz zakłady
      const bets = await Bet.find({
        $or: [
          { fightId: fightId, status: 'active' },
          { 'parlayBets.fightId': fightId, status: 'active' }
        ]
      });

      await this.settleFightBets(fight, bets);

      console.log(`⚖️ Fight ${fight.title} manually settled by moderator ${moderatorId}`);
      
      return {
        success: true,
        settledBets: bets.length,
        fight: fight.title
      };

    } catch (error) {
      console.error('Error manually settling fight:', error);
      throw error;
    }
  }

  // Anuluj wszystkie zakłady dla walki
  async cancelFightBets(fightId, reason = 'fight_cancelled') {
    try {
      const bets = await Bet.find({
        $or: [
          { fightId: fightId, status: 'active' },
          { 'parlayBets.fightId': fightId, status: 'active' }
        ]
      });

      let refundedAmount = 0;

      for (const bet of bets) {
        await bet.cancel(reason);
        await this.payoutWinnings(bet.userId, bet.amount);
        refundedAmount += bet.amount;

        // Powiadom użytkownika
        await Notification.create({
          userId: bet.userId,
          type: 'system',
          category: 'system',
          title: 'Zakład anulowany',
          message: `Twój zakład został anulowany z powodu: ${reason}. Zwrot: ${bet.amount} monet.`,
          priority: 'high',
          actionUrl: `/betting/my-bets`
        });
      }

      console.log(`❌ Cancelled ${bets.length} bets for fight ${fightId}, refunded: ${refundedAmount} coins`);

      return {
        cancelledBets: bets.length,
        refundedAmount
      };

    } catch (error) {
      console.error('Error cancelling fight bets:', error);
      throw error;
    }
  }

  // Pobierz statystyki zakładów
  async getBettingStats(timeframe = 'week') {
    try {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const stats = await Bet.aggregate([
        {
          $match: {
            placedAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalBets: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            totalWinnings: { $sum: '$result.winnings' },
            wonBets: {
              $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] }
            },
            lostBets: {
              $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] }
            },
            parlayBets: {
              $sum: { $cond: [{ $eq: ['$type', 'parlay'] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalBets: 0,
        totalAmount: 0,
        totalWinnings: 0,
        wonBets: 0,
        lostBets: 0,
        parlayBets: 0
      };

      result.winRate = result.totalBets > 0 ? 
        (result.wonBets / result.totalBets * 100).toFixed(2) : 0;
      result.averageBet = result.totalBets > 0 ? 
        (result.totalAmount / result.totalBets).toFixed(2) : 0;
      result.houseEdge = result.totalAmount > 0 ? 
        ((result.totalAmount - result.totalWinnings) / result.totalAmount * 100).toFixed(2) : 0;

      return result;

    } catch (error) {
      console.error('Error getting betting stats:', error);
      throw error;
    }
  }
}

// Singleton instance
const bettingService = new BettingService();

export default bettingService;