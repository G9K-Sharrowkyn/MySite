import Fight from '../models/Fight.js';
import User from '../models/User.js';
import Bet from '../models/Bet.js';

// Pobierz walki dostępne do obstawiania
export const getAvailableFights = async (req, res) => {
  try {
    // Pobierz tylko walki które są zaplanowane i w okresie obstawiania
    const bettableFights = await Fight.find({
      status: 'scheduled',
      scheduledFor: { $gt: new Date() }
    }).populate('divisionId');

    // Przekształć dane dla frontendu
    const availableFights = bettableFights.map(fight => {
      const division = fight.divisionId || {};

      // Znajdź nazwy drużyn
      const team1 = division.teams?.find(t => t._id.toString() === fight.team1Id) || {};
      const team2 = division.teams?.find(t => t._id.toString() === fight.team2Id) || {};

      return {
        id: fight._id.toString(),
        divisionId: fight.divisionId?._id?.toString(),
        divisionName: division.name || 'Nieznana dywizja',
        team1Id: fight.team1Id,
        team1Name: team1.name || `Drużyna ${fight.team1Id}`,
        team1Odds: fight.team1Odds || 1.5,
        team2Id: fight.team2Id,
        team2Name: team2.name || `Drużyna ${fight.team2Id}`,
        team2Odds: fight.team2Odds || 1.5,
        drawOdds: fight.drawOdds || 3.0,
        scheduledFor: fight.scheduledFor,
        status: fight.status,
        isBettingOpen: true
      };
    });

    res.json({ success: true, fights: availableFights });
  } catch (err) {
    console.error('Error fetching available fights:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Pobierz zakłady użytkownika
export const getUserBets = async (req, res) => {
  try {
    // Filtruj zakłady dla aktualnego użytkownika
    const userBets = await Bet.find({ userId: req.user.id }).sort({ placedAt: -1 });

    // Dodaj szczegóły walk do zakładów
    const betsWithDetails = await Promise.all(userBets.map(async (bet) => {
      const fight = await Fight.findById(bet.fightId).populate('divisionId');
      const division = fight?.divisionId || {};

      // Znajdź nazwy drużyn
      const team1 = division.teams?.find(t => t._id.toString() === fight.team1Id) || {};
      const team2 = division.teams?.find(t => t._id.toString() === fight.team2Id) || {};

      return {
        id: bet._id.toString(),
        fightId: bet.fightId,
        amount: bet.amount,
        selectedTeam: bet.prediction, // Changed from selectedTeam to prediction
        odds: bet.odds,
        status: bet.status,
        potentialWinnings: bet.potentialWinnings,
        createdAt: bet.placedAt,
        team1Name: team1.name || `Drużyna ${fight?.team1Id}`,
        team2Name: team2.name || `Drużyna ${fight?.team2Id}`,
        divisionName: division.name || 'Nieznana dywizja',
        fightScheduledFor: fight?.scheduledFor,
        fightStatus: fight?.status,
        winnerId: fight?.winnerId,
        result: fight ? calculateBetResult(bet, fight) : null
      };
    }));

    res.json({ success: true, bets: betsWithDetails });
  } catch (err) {
    console.error('Error fetching user bets:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Miejsce pojedynczego zakładu
export const placeBet = async (req, res) => {
  try {
    const { fightId, amount, selectedTeam } = req.body;

    if (!fightId || !amount || !selectedTeam) {
      return res.status(400).json({
        success: false,
        message: 'Brak wymaganych danych'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Kwota zakładu musi być większa niż 0'
      });
    }

    // Znajdź użytkownika
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Nie znaleziono użytkownika'
      });
    }

    // Sprawdź czy użytkownik ma wystarczająco monet
    const userBalance = user.coins?.balance || 0;
    if (userBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Niewystarczająca liczba monet'
      });
    }

    // Znajdź walkę
    const fight = await Fight.findById(fightId);
    if (!fight) {
      return res.status(404).json({
        success: false,
        message: 'Nie znaleziono walki'
      });
    }

    // Sprawdź czy walka jest dostępna do obstawiania
    if (fight.status !== 'scheduled' || new Date(fight.scheduledFor) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Walka nie jest dostępna do obstawiania'
      });
    }

    // Pobierz kursy
    let odds;
    let prediction;
    if (selectedTeam === 'team1') {
      odds = fight.team1Odds || 1.5;
      prediction = 'A';
    } else if (selectedTeam === 'team2') {
      odds = fight.team2Odds || 1.5;
      prediction = 'B';
    } else if (selectedTeam === 'draw') {
      odds = fight.drawOdds || 3.0;
      prediction = 'draw';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Nieprawidłowy wybór drużyny'
      });
    }

    // Oblicz potencjalną wygraną
    const potentialWinnings = Math.round(amount * odds);

    // Stwórz zakład
    const newBet = await Bet.create({
      userId: user._id.toString(),
      username: user.username,
      fightId: fight._id,
      amount,
      prediction,
      odds,
      status: 'pending',
      potentialWinnings,
      type: 'single'
    });

    // Odejmij monety od użytkownika
    if (!user.coins) {
      user.coins = { balance: 1000, totalEarned: 1000, totalSpent: 0 };
    }
    user.coins.balance -= amount;
    user.coins.totalSpent = (user.coins.totalSpent || 0) + amount;
    await user.save();

    res.json({
      success: true,
      message: 'Zakład został złożony',
      bet: newBet
    });
  } catch (err) {
    console.error('Error placing bet:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Miejsce złożonego zakładu (parlay/system)
export const placeComplexBet = async (req, res) => {
  try {
    const { betType, systemSize, betAmount, selections } = req.body;

    if (!betType || !betAmount || !selections || selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Brak wymaganych danych'
      });
    }

    if (betAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Kwota zakładu musi być większa niż 0'
      });
    }

    if (betType === 'parlay' && selections.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Zakład parlay wymaga minimum dwóch walk'
      });
    }

    if (betType === 'system') {
      if (!systemSize || systemSize < 2 || systemSize >= selections.length) {
        return res.status(400).json({
          success: false,
          message: 'Nieprawidłowy rozmiar systemu'
        });
      }
    }

    // Znajdź użytkownika
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Nie znaleziono użytkownika'
      });
    }

    // Sprawdź czy użytkownik ma wystarczająco monet
    const userBalance = user.coins?.balance || 0;
    if (userBalance < betAmount) {
      return res.status(400).json({
        success: false,
        message: 'Niewystarczająca liczba monet'
      });
    }

    // Walidacja selekcji
    const validSelections = [];
    for (const selection of selections) {
      const fight = await Fight.findById(selection.fightId);

      if (!fight) {
        return res.status(404).json({
          success: false,
          message: `Nie znaleziono walki: ${selection.fightId}`
        });
      }

      // Sprawdź czy walka jest dostępna do obstawiania
      if (fight.status !== 'scheduled' || new Date(fight.scheduledFor) <= new Date()) {
        return res.status(400).json({
          success: false,
          message: `Walka ${fight._id} nie jest dostępna do obstawiania`
        });
      }

      // Pobierz kurs i prediction
      let odds;
      let prediction;
      if (selection.selectedTeam === 'team1') {
        odds = fight.team1Odds || 1.5;
        prediction = 'A';
      } else if (selection.selectedTeam === 'team2') {
        odds = fight.team2Odds || 1.5;
        prediction = 'B';
      } else if (selection.selectedTeam === 'draw') {
        odds = fight.drawOdds || 3.0;
        prediction = 'draw';
      } else {
        return res.status(400).json({
          success: false,
          message: `Nieprawidłowy wybór drużyny dla walki ${fight._id}`
        });
      }

      validSelections.push({
        fightId: selection.fightId,
        fightTitle: fight.title || 'Walka',
        prediction,
        odds
      });
    }

    let newBet;

    if (betType === 'parlay') {
      // Oblicz całkowity kurs i potencjalną wygraną
      const totalOdds = validSelections.reduce((total, selection) => total * selection.odds, 1);
      const potentialWinnings = Math.round(betAmount * totalOdds);

      // Stwórz zakład parlay
      newBet = await Bet.create({
        userId: user._id.toString(),
        username: user.username,
        type: 'parlay',
        amount: betAmount,
        status: 'pending',
        potentialWinnings,
        totalOdds,
        parlayBets: validSelections,
        odds: totalOdds
      });

    } else if (betType === 'system') {
      // Oblicz liczbę kombinacji
      const combinations = calculateCombinations(validSelections.length, systemSize);

      // Kwota na każdą kombinację
      const amountPerCombo = Math.round((betAmount / combinations) * 100) / 100;

      // Stwórz zakład systemowy
      newBet = await Bet.create({
        userId: user._id.toString(),
        username: user.username,
        type: 'system',
        amount: betAmount,
        status: 'pending',
        parlayBets: validSelections,
        odds: 1, // Will be calculated per combination
        metadata: {
          systemSize,
          combinations,
          amountPerCombo
        }
      });
    }

    // Odejmij monety od użytkownika
    if (!user.coins) {
      user.coins = { balance: 1000, totalEarned: 1000, totalSpent: 0 };
    }
    user.coins.balance -= betAmount;
    user.coins.totalSpent = (user.coins.totalSpent || 0) + betAmount;
    await user.save();

    res.json({
      success: true,
      message: `Zakład ${betType} został złożony`,
      betId: newBet._id.toString()
    });

  } catch (err) {
    console.error('Error placing complex bet:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Pomocnicza funkcja do obliczania rezultatu zakładu
const calculateBetResult = (bet, fight) => {
  if (!bet || !fight) return null;
  
  if (fight.status !== 'completed' || !fight.winnerId) {
    return null;
  }
  
  if (bet.selectedTeam === 'team1' && fight.winnerId === fight.team1Id) {
    return 'win';
  } else if (bet.selectedTeam === 'team2' && fight.winnerId === fight.team2Id) {
    return 'win';
  } else if (bet.selectedTeam === 'draw' && fight.winnerId === 'draw') {
    return 'win';
  } else {
    return 'loss';
  }
};

// Pomocnicza funkcja do obliczania liczby kombinacji
const calculateCombinations = (n, k) => {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - (k - i));
    result /= i;
  }
  return Math.round(result);
};
