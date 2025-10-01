import express from 'express';
import { auth, roleMiddleware } from '../middleware/auth.js';
import Bet from '../models/Bet.js';
import Fight from '../models/Fight.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Middleware do sprawdzania betting window
const checkBettingWindow = async (req, res, next) => {
  try {
    const { fightId } = req.params;
    const fight = await Fight.findById(fightId);
    
    if (!fight) {
      return res.status(404).json({ error: 'Walka nie została znaleziona' });
    }
    
    // Sprawdź czy betting jest włączony dla tej walki
    if (!fight.betting.enabled) {
      return res.status(400).json({ error: 'Zakłady nie są dostępne dla tej walki' });
    }
    
    // Sprawdź czy betting window jest aktywne
    const now = new Date();
    if (fight.betting.bettingWindow.locked || 
        now > fight.betting.bettingWindow.closeTime) {
      return res.status(400).json({ 
        error: 'Okno zakładów zostało zamknięte',
        closeTime: fight.betting.bettingWindow.closeTime
      });
    }
    
    req.fight = fight;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera' });
  }
};

// GET /api/betting/fights - Lista walk z dostępnymi zakładami
router.get('/fights', auth, async (req, res) => {
  try {
    const now = new Date();
    
    const fights = await Fight.find({
      'betting.enabled': true,
      'betting.bettingWindow.active': true,
      'betting.bettingWindow.locked': false,
      'betting.bettingWindow.closeTime': { $gt: now },
      status: 'active'
    })
    .select('title teamA teamB betting.oddsA betting.oddsB betting.bettingWindow timer')
    .sort({ 'betting.bettingWindow.closeTime': 1 });
    
    res.json({
      success: true,
      fights,
      count: fights.length
    });
  } catch (error) {
    console.error('Error fetching betting fights:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/betting/fight/:fightId - Szczegóły zakładów dla walki
router.get('/fight/:fightId', auth, async (req, res) => {
  try {
    const { fightId } = req.params;
    const fight = await Fight.findById(fightId);
    
    if (!fight) {
      return res.status(404).json({ error: 'Walka nie została znaleziona' });
    }
    
    // Pobierz statystyki zakładów
    const bets = await Bet.find({ fightId, status: 'active' });
    const totalBetsA = bets.filter(bet => bet.prediction === 'A').length;
    const totalBetsB = bets.filter(bet => bet.prediction === 'B').length;
    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    // Sprawdź czy użytkownik już postawił zakład
    const userBet = await Bet.findOne({ 
      fightId, 
      userId: req.user.id, 
      status: 'active' 
    });
    
    res.json({
      success: true,
      fight: {
        id: fight._id,
        title: fight.title,
        teamA: fight.teamA,
        teamB: fight.teamB,
        betting: fight.betting,
        timer: fight.timer
      },
      stats: {
        totalBetsA,
        totalBetsB,
        totalAmount,
        totalBets: bets.length
      },
      userBet: userBet || null
    });
  } catch (error) {
    console.error('Error fetching fight betting details:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/betting/place/:fightId - Postaw zakład
router.post('/place/:fightId', auth, checkBettingWindow, async (req, res) => {
  try {
    const { fightId } = req.params;
    const { prediction, amount, type = 'single', insurance = false } = req.body;
    const userId = req.user.id;
    const fight = req.fight;
    
    // Walidacja
    if (!['A', 'B'].includes(prediction)) {
      return res.status(400).json({ error: 'Nieprawidłowa predykcja' });
    }
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimalna kwota zakładu to 1 moneta' });
    }
    
    // Sprawdź czy użytkownik ma wystarczająco monet
    const user = await User.findById(userId);
    if (!user.virtualCoins || user.virtualCoins < amount) {
      return res.status(400).json({ error: 'Niewystarczająca ilość monet' });
    }
    
    // Sprawdź czy użytkownik już postawił zakład na tę walkę
    const existingBet = await Bet.findOne({ 
      fightId, 
      userId, 
      status: 'active' 
    });
    
    if (existingBet) {
      return res.status(400).json({ error: 'Już postawiłeś zakład na tę walkę' });
    }
    
    // Pobierz aktualne kursy
    const odds = prediction === 'A' ? fight.betting.oddsA : fight.betting.oddsB;
    
    // Oblicz koszt ubezpieczenia (10% kwoty zakładu)
    const insuranceCost = insurance ? Math.ceil(amount * 0.1) : 0;
    const totalCost = amount + insuranceCost;
    
    if (user.virtualCoins < totalCost) {
      return res.status(400).json({ error: 'Niewystarczająca ilość monet (z ubezpieczeniem)' });
    }
    
    // Stwórz zakład
    const bet = new Bet({
      userId,
      username: user.username,
      fightId,
      prediction,
      amount,
      odds,
      type,
      insurance: {
        enabled: insurance,
        amount: insuranceCost,
        refundPercentage: 50, // 50% zwrotu przy przegranej
        cost: insuranceCost
      },
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'web'
      }
    });
    
    await bet.save();
    
    // Odejmij monety od użytkownika
    user.virtualCoins -= totalCost;
    await user.save();
    
    // Zaktualizuj statystyki walki
    if (prediction === 'A') {
      fight.betting.totalBetsA += 1;
    } else {
      fight.betting.totalBetsB += 1;
    }
    
    // Przelicz dynamiczne kursy
    await updateDynamicOdds(fight);
    await fight.save();
    
    res.json({
      success: true,
      message: 'Zakład został postawiony pomyślnie',
      bet: {
        id: bet._id,
        amount: bet.amount,
        odds: bet.odds,
        potentialWinnings: bet.potentialWinnings,
        insurance: bet.insurance
      },
      remainingCoins: user.virtualCoins
    });
    
  } catch (error) {
    console.error('Error placing bet:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/betting/parlay - Postaw zakład parlay
router.post('/parlay', auth, async (req, res) => {
  try {
    const { bets, amount, insurance = false } = req.body;
    const userId = req.user.id;
    
    // Walidacja
    if (!Array.isArray(bets) || bets.length < 2) {
      return res.status(400).json({ error: 'Zakład parlay wymaga minimum 2 walk' });
    }
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Minimalna kwota zakładu to 1 moneta' });
    }
    
    // Sprawdź wszystkie walki
    const fightIds = bets.map(bet => bet.fightId);
    const fights = await Fight.find({ 
      _id: { $in: fightIds },
      'betting.enabled': true,
      'betting.bettingWindow.active': true,
      'betting.bettingWindow.locked': false
    });
    
    if (fights.length !== bets.length) {
      return res.status(400).json({ error: 'Niektóre walki nie są dostępne do zakładów' });
    }
    
    // Sprawdź betting window dla wszystkich walk
    const now = new Date();
    for (const fight of fights) {
      if (now > fight.betting.bettingWindow.closeTime) {
        return res.status(400).json({ 
          error: `Okno zakładów dla walki "${fight.title}" zostało zamknięte` 
        });
      }
    }
    
    // Sprawdź monety użytkownika
    const user = await User.findById(userId);
    const insuranceCost = insurance ? Math.ceil(amount * 0.15) : 0; // 15% dla parlay
    const totalCost = amount + insuranceCost;
    
    if (!user.virtualCoins || user.virtualCoins < totalCost) {
      return res.status(400).json({ error: 'Niewystarczająca ilość monet' });
    }
    
    // Przygotuj dane parlay
    const parlayBets = bets.map(bet => {
      const fight = fights.find(f => f._id.toString() === bet.fightId);
      const odds = bet.prediction === 'A' ? fight.betting.oddsA : fight.betting.oddsB;
      
      return {
        fightId: bet.fightId,
        prediction: bet.prediction,
        odds,
        fightTitle: fight.title
      };
    });
    
    // Stwórz zakład parlay
    const parlayBet = new Bet({
      userId,
      username: user.username,
      type: 'parlay',
      parlayBets,
      amount,
      multiplier: 1.2, // bonus 20% za parlay
      insurance: {
        enabled: insurance,
        amount: insuranceCost,
        refundPercentage: 25, // 25% zwrotu dla parlay
        cost: insuranceCost
      },
      metadata: {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'web'
      }
    });
    
    await parlayBet.save();
    
    // Odejmij monety
    user.virtualCoins -= totalCost;
    await user.save();
    
    res.json({
      success: true,
      message: 'Zakład parlay został postawiony pomyślnie',
      bet: {
        id: parlayBet._id,
        amount: parlayBet.amount,
        totalOdds: parlayBet.totalOdds,
        potentialWinnings: parlayBet.potentialWinnings,
        fights: parlayBets.length
      },
      remainingCoins: user.virtualCoins
    });
    
  } catch (error) {
    console.error('Error placing parlay bet:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET /api/betting/my-bets - Moje zakłady
router.get('/my-bets', auth, async (req, res) => {
  try {
    const { status = 'all', page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    
    const query = { userId };
    if (status !== 'all') {
      query.status = status;
    }
    
    const bets = await Bet.find(query)
      .sort({ placedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Bet.countDocuments(query);
    
    // Pobierz szczegóły walk dla zakładów
    const fightIds = [...new Set(bets.flatMap(bet => 
      bet.type === 'parlay' ? bet.parlayBets.map(pb => pb.fightId) : [bet.fightId]
    ))];
    
    const fights = await Fight.find({ _id: { $in: fightIds } })
      .select('title teamA teamB status result');
    
    const fightsMap = fights.reduce((acc, fight) => {
      acc[fight._id.toString()] = fight;
      return acc;
    }, {});
    
    const betsWithDetails = bets.map(bet => ({
      ...bet.toObject(),
      fightDetails: bet.type === 'parlay' 
        ? bet.parlayBets.map(pb => fightsMap[pb.fightId])
        : fightsMap[bet.fightId]
    }));
    
    res.json({
      success: true,
      bets: betsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching user bets:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// Funkcja pomocnicza do aktualizacji dynamicznych kursów
async function updateDynamicOdds(fight) {
  const totalBets = fight.betting.totalBetsA + fight.betting.totalBetsB;
  
  if (totalBets === 0) return;
  
  // Oblicz nowe kursy na podstawie rozkładu zakładów
  const ratioA = fight.betting.totalBetsA / totalBets;
  const ratioB = fight.betting.totalBetsB / totalBets;
  
  // Bazowe kursy z marginesem domu (5%)
  const baseOddsA = 1 / (ratioA + 0.05);
  const baseOddsB = 1 / (ratioB + 0.05);
  
  // Zaokrąglij do 2 miejsc po przecinku
  fight.betting.oddsA = Math.round(Math.max(baseOddsA, 1.01) * 100) / 100;
  fight.betting.oddsB = Math.round(Math.max(baseOddsB, 1.01) * 100) / 100;
}

// MODERATOR ROUTES

// POST /api/betting/admin/enable/:fightId - Włącz zakłady dla walki
router.post('/admin/enable/:fightId', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    const { fightId } = req.params;
    const { bettingDuration = 24 } = req.body; // domyślnie 24h przed walką
    
    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ error: 'Walka nie została znaleziona' });
    }
    
    if (!fight.isOfficial) {
      return res.status(400).json({ error: 'Zakłady dostępne tylko dla oficjalnych walk' });
    }
    
    // Oblicz czas zamknięcia zakładów (24h przed końcem walki)
    const fightEndTime = fight.timer.endTime;
    const bettingCloseTime = new Date(fightEndTime.getTime() - (bettingDuration * 60 * 60 * 1000));
    
    if (bettingCloseTime <= new Date()) {
      return res.status(400).json({ error: 'Za późno na włączenie zakładów' });
    }
    
    // Włącz betting
    fight.betting = {
      enabled: true,
      bettingWindow: {
        openTime: new Date(),
        closeTime: bettingCloseTime,
        active: true,
        locked: false
      },
      totalBetsA: 0,
      totalBetsB: 0,
      oddsA: 1.8,
      oddsB: 1.8
    };
    
    await fight.save();
    
    res.json({
      success: true,
      message: 'Zakłady zostały włączone dla walki',
      bettingWindow: fight.betting.bettingWindow
    });
    
  } catch (error) {
    console.error('Error enabling betting:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST /api/betting/admin/close/:fightId - Zamknij zakłady dla walki
router.post('/admin/close/:fightId', auth, roleMiddleware(['moderator']), async (req, res) => {
  try {
    const { fightId } = req.params;
    
    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({ error: 'Walka nie została znaleziona' });
    }
    
    fight.betting.bettingWindow.locked = true;
    fight.betting.bettingWindow.active = false;
    
    await fight.save();
    
    res.json({
      success: true,
      message: 'Zakłady zostały zamknięte dla walki'
    });
    
  } catch (error) {
    console.error('Error closing betting:', error);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

export default router;