// SYSTEM MATCHMAKINGU - GOTOWY DO UŻYCIA
// System lokalnej gry z botem

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');
const matchmakingFile = path.join(dataDir, 'matchmaking.json');

// Funkcja do ładowania użytkowników
async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Kolejka matchmakingu
let matchmakingQueue = [];
let activeMatches = new Map();

// Typy gier
const GAME_MODES = {
  RANKED: 'ranked',
  CASUAL: 'casual',
  DRAFT: 'draft'
};

// Funkcje pomocnicze
async function loadMatchmakingData() {
  try {
    const data = await fs.readFile(matchmakingFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { queue: [], matches: [] };
  }
}

async function saveMatchmakingData(data) {
  await fs.writeFile(matchmakingFile, JSON.stringify(data, null, 2));
}

// Oblicza różnicę w rankingu między graczami
function calculateRankDifference(rank1, rank2) {
  const rankValues = {
    'Bronze': 0, 'Silver': 1000, 'Gold': 2000, 
    'Platinum': 3000, 'Diamond': 4000
  };
  
  const value1 = rankValues[rank1.tier] + (10 - rank1.division) * 100 + rank1.points;
  const value2 = rankValues[rank2.tier] + (10 - rank2.division) * 100 + rank2.points;
  
  return Math.abs(value1 - value2);
}

// Znajdź przeciwnika dla gracza
function findOpponent(player, queue) {
  const maxRankDifference = 500; // Maksymalna różnica w rankingu
  
  for (let i = 0; i < queue.length; i++) {
    const opponent = queue[i];
    
    // Nie może grać sam ze sobą
    if (opponent.userId === player.userId) continue;
    
    // Sprawdź tryb gry
    if (opponent.gameMode !== player.gameMode) continue;
    
    // Sprawdź różnicę w rankingu (tylko dla ranked)
    if (player.gameMode === GAME_MODES.RANKED) {
      const rankDiff = calculateRankDifference(player.rank, opponent.rank);
      if (rankDiff > maxRankDifference) continue;
    }
    
    return { opponent, index: i };
  }
  
  return null;
}

// Kontrolery
export const joinQueue = async (req, res) => {
  const { gameMode = GAME_MODES.CASUAL } = req.body;
  const user = req.user;
  
  // Sprawdź czy gracz już jest w kolejce
  const existingIndex = matchmakingQueue.findIndex(p => p.userId === user.id);
  if (existingIndex !== -1) {
    return res.status(400).json({ message: 'Już jesteś w kolejce' });
  }
  
  // Pobierz dane gracza (ranking, talia itp.)
  const users = await loadUsers();
  const playerData = users.find(u => u.id === user.id);
  if (!playerData) {
    return res.status(404).json({ message: 'Dane gracza nie znalezione' });
  }
  
  // Sprawdź czy ma aktywną talię
  if (!playerData.activeDeck) {
    return res.status(400).json({ message: 'Musisz ustawić aktywną talię' });
  }
  
  const player = {
    userId: user.id,
    username: user.username,
    gameMode,
    rank: playerData.rank,
    activeDeck: playerData.activeDeck,
    joinedAt: Date.now()
  };
  
  // Spróbuj znaleźć przeciwnika
  const match = findOpponent(player, matchmakingQueue);
  
  if (match) {
    // Znaleziono przeciwnika - utwórz mecz
    const opponent = match.opponent;
    matchmakingQueue.splice(match.index, 1);
    
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const gameMatch = {
      id: matchId,
      players: [player, opponent],
      gameMode,
      createdAt: Date.now(),
      status: 'starting'
    };
    
    activeMatches.set(matchId, gameMatch);
    
    // Powiadom obu graczy
    // TODO: Użyj WebSocket do powiadomienia
    
    res.json({
      message: 'Mecz znaleziony!',
      matchId,
      opponent: {
        username: opponent.username,
        rank: opponent.rank
      }
    });
    
  } else {
    // Nie znaleziono przeciwnika - dodaj do kolejki
    matchmakingQueue.push(player);
    
    res.json({
      message: 'Dodano do kolejki matchmakingu',
      queuePosition: matchmakingQueue.length,
      estimatedWaitTime: matchmakingQueue.length * 30 // sekund
    });
  }
};

export const leaveQueue = async (req, res) => {
  const user = req.user;
  
  const index = matchmakingQueue.findIndex(p => p.userId === user.id);
  if (index === -1) {
    return res.status(400).json({ message: 'Nie jesteś w kolejce' });
  }
  
  matchmakingQueue.splice(index, 1);
  res.json({ message: 'Usunięto z kolejki' });
};

export const getQueueStatus = async (req, res) => {
  const user = req.user;
  
  const playerInQueue = matchmakingQueue.find(p => p.userId === user.id);
  if (!playerInQueue) {
    return res.json({ inQueue: false });
  }
  
  const position = matchmakingQueue.findIndex(p => p.userId === user.id) + 1;
  
  res.json({
    inQueue: true,
    position,
    gameMode: playerInQueue.gameMode,
    waitTime: Date.now() - playerInQueue.joinedAt,
    estimatedWaitTime: position * 30
  });
};

// Gra przeciwko botowi
export const playVsBot = async (req, res) => {
  const { difficulty = 'medium' } = req.body;
  const user = req.user;
  
  // Sprawdź czy gracz ma aktywną talię
  const users = await loadUsers();
  const playerData = users.find(u => u.id === user.id);
  if (!playerData || !playerData.activeDeck) {
    return res.status(400).json({ message: 'Musisz ustawić aktywną talię' });
  }
  
  const matchId = `bot_match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const botMatch = {
    id: matchId,
    player: {
      userId: user.id,
      username: user.username,
      activeDeck: playerData.activeDeck
    },
    bot: {
      difficulty,
      name: `Bot ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`
    },
    gameMode: 'vs_bot',
    createdAt: Date.now(),
    status: 'starting'
  };
  
  activeMatches.set(matchId, botMatch);
  
  res.json({
    message: 'Mecz przeciwko botowi utworzony!',
    matchId,
    opponent: botMatch.bot
  });
};

// Funkcje pomocnicze dla WebSocket
export const handleMatchmakingSocket = (io, socket) => {
  socket.on('joinMatchmakingQueue', async (data) => {
    // Logika dołączania do kolejki przez WebSocket
  });
  
  socket.on('leaveMatchmakingQueue', async () => {
    // Logika opuszczania kolejki przez WebSocket
  });
  
  socket.on('acceptMatch', async (matchId) => {
    // Logika akceptowania meczu
  });
  
  socket.on('declineMatch', async (matchId) => {
    // Logika odrzucania meczu
  });
};

// Funkcja do czyszczenia starych meczów
export const cleanupOldMatches = () => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minut
  
  for (const [matchId, match] of activeMatches.entries()) {
    if (now - match.createdAt > maxAge) {
      activeMatches.delete(matchId);
    }
  }
  
  // Usuń graczy którzy czekają zbyt długo
  matchmakingQueue = matchmakingQueue.filter(player => {
    return now - player.joinedAt < maxAge;
  });
};

// Uruchom czyszczenie co 5 minut
setInterval(cleanupOldMatches, 5 * 60 * 1000); 