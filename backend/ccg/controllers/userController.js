import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const usersFile = path.join(dataDir, 'users.json');
const cardsFile = path.join(dataDir, 'cards.json');

// System XP i levelowania
const XP_PER_LEVEL = 1000;
const XP_REWARDS = {
  GAME_WIN: 100,
  GAME_LOSS: 25,
  CARD_PLAYED: 2,
  UNIT_DEPLOYED: 5,
  COMMAND_PLAYED: 3,
  DAMAGE_DEALT: 1
};

// System rankingowy
const RANKS = {
  'Bronze': { divisions: 9, pointsPerDivision: 100 },
  'Silver': { divisions: 9, pointsPerDivision: 150 },
  'Gold': { divisions: 9, pointsPerDivision: 200 },
  'Platinum': { divisions: 9, pointsPerDivision: 250 },
  'Diamond': { divisions: 1, pointsPerDivision: 300 }
};

const RANK_ORDER = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

// System osiągnięć
const ACHIEVEMENTS = {
  FIRST_WIN: { id: 'first_win', name: 'Pierwsza Wygrana', description: 'Wygraj swoją pierwszą grę', reward: { xp: 100, gold: 50 } },
  CARD_COLLECTOR: { id: 'card_collector', name: 'Kolekcjoner', description: 'Zbierz 50 kart', reward: { xp: 150, gold: 100 } },
  DECK_BUILDER: { id: 'deck_builder', name: 'Konstruktor Talii', description: 'Stwórz swoją pierwszą talię', reward: { xp: 75, gold: 25 } },
  VETERAN_PLAYER: { id: 'veteran_player', name: 'Weteran', description: 'Rozegraj 100 gier', reward: { xp: 500, gold: 200 } },
  RANK_UP_SILVER: { id: 'rank_up_silver', name: 'Srebrny Wojownik', description: 'Osiągnij rangę Silver', reward: { xp: 200, gold: 150 } },
  RANK_UP_GOLD: { id: 'rank_up_gold', name: 'Złoty Mistrz', description: 'Osiągnij rangę Gold', reward: { xp: 300, gold: 250 } },
  WINNING_STREAK: { id: 'winning_streak', name: 'Seria Zwycięstw', description: 'Wygraj 5 gier z rzędu', reward: { xp: 250, gold: 100 } },
  CARD_MASTER: { id: 'card_master', name: 'Mistrz Kart', description: 'Zagraj 1000 kart', reward: { xp: 400, gold: 200 } }
};

// Sprawdza i przyznaje osiągnięcia
function checkAchievements(user) {
  const newAchievements = [];
  
  // Pierwsza wygrana
  if (!user.achievements.includes('first_win') && user.stats.gamesWon >= 1) {
    newAchievements.push(ACHIEVEMENTS.FIRST_WIN);
  }
  
  // Kolekcjoner kart
  if (!user.achievements.includes('card_collector') && user.collection.length >= 50) {
    newAchievements.push(ACHIEVEMENTS.CARD_COLLECTOR);
  }
  
  // Konstruktor talii
  if (!user.achievements.includes('deck_builder') && user.decks.length >= 1) {
    newAchievements.push(ACHIEVEMENTS.DECK_BUILDER);
  }
  
  // Weteran
  if (!user.achievements.includes('veteran_player') && user.stats.gamesPlayed >= 100) {
    newAchievements.push(ACHIEVEMENTS.VETERAN_PLAYER);
  }
  
  // Rangi
  if (!user.achievements.includes('rank_up_silver') && user.rank.tier !== 'Bronze') {
    newAchievements.push(ACHIEVEMENTS.RANK_UP_SILVER);
  }
  
  if (!user.achievements.includes('rank_up_gold') && (user.rank.tier === 'Gold' || user.rank.tier === 'Platinum' || user.rank.tier === 'Diamond')) {
    newAchievements.push(ACHIEVEMENTS.RANK_UP_GOLD);
  }
  
  // Mistrz kart
  if (!user.achievements.includes('card_master') && user.stats.cardsPlayed >= 1000) {
    newAchievements.push(ACHIEVEMENTS.CARD_MASTER);
  }
  
  // Dodaj nowe osiągnięcia
  newAchievements.forEach(achievement => {
    user.achievements.push(achievement.id);
    user.xp += achievement.reward.xp;
    user.currency.gold = (user.currency.gold || 0) + achievement.reward.gold;
  });
  
  return newAchievements;
}

// Oblicza poziom na podstawie XP
function calculateLevel(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

// Oblicza XP potrzebne do następnego poziomu
function getXpToNextLevel(xp) {
  const currentLevel = calculateLevel(xp);
  const xpForNextLevel = currentLevel * XP_PER_LEVEL;
  return xpForNextLevel - xp;
}

// Aktualizuje ranking gracza
function updateRank(user, pointsGained) {
  const currentRankInfo = RANKS[user.rank.tier];
  user.rank.points += pointsGained;
  
  // Sprawdź awans
  while (user.rank.points >= currentRankInfo.pointsPerDivision) {
    user.rank.points -= currentRankInfo.pointsPerDivision;
    
    if (user.rank.division > 1) {
      user.rank.division -= 1;
    } else {
      // Awans do następnego tiera
      const currentTierIndex = RANK_ORDER.indexOf(user.rank.tier);
      if (currentTierIndex < RANK_ORDER.length - 1) {
        user.rank.tier = RANK_ORDER[currentTierIndex + 1];
        user.rank.division = RANKS[user.rank.tier].divisions;
      }
    }
  }
  
  // Sprawdź degradację (tylko jeśli punkty są ujemne)
  while (user.rank.points < 0 && (user.rank.tier !== 'Bronze' || user.rank.division !== 9)) {
    if (user.rank.division < RANKS[user.rank.tier].divisions) {
      user.rank.division += 1;
      user.rank.points += RANKS[user.rank.tier].pointsPerDivision;
    } else {
      // Degradacja do poprzedniego tiera
      const currentTierIndex = RANK_ORDER.indexOf(user.rank.tier);
      if (currentTierIndex > 0) {
        user.rank.tier = RANK_ORDER[currentTierIndex - 1];
        user.rank.division = 1;
        user.rank.points += RANKS[user.rank.tier].pointsPerDivision;
      } else {
        // Najniższy możliwy rank
        user.rank.points = 0;
      }
    }
  }
}

async function loadUsers() {
  try {
    const data = await fs.readFile(usersFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

async function loadCards() {
  try {
    const data = await fs.readFile(cardsFile, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export const getProfile = async (req, res) => {
  const users = await loadUsers();
  const cards = await loadCards();
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  }
  const userCards = user.collection
    .map(cardId => cards.find(c => c._id === cardId || c.name === cardId))
    .filter(Boolean);

  // Upewnij się, że użytkownik ma wszystkie nowe pola
  if (!user.xp) user.xp = 0;
  if (!user.level) user.level = 1;
  if (!user.stats) user.stats = { gamesPlayed: 0, gamesWon: 0, gamesLost: 0, cardsPlayed: 0, damageDealt: 0, unitsDeployed: 0, commandsPlayed: 0 };
  if (!user.achievements) user.achievements = [];
  if (!user.rank) user.rank = { tier: 'Bronze', division: 9, points: 0 };
  if (!user.cardFragments) user.cardFragments = 0;
  if (!user.packs) user.packs = { normal: 0, premium: 0 };
  if (!user.currency) user.currency = { gold: 0, premium: 0 };

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    points: user.points,
    collection: userCards,
    decks: user.decks || [],
    activeDeck: user.activeDeck || null,
    xp: user.xp,
    level: calculateLevel(user.xp),
    xpToNextLevel: getXpToNextLevel(user.xp),
    stats: user.stats,
    achievements: user.achievements,
    rank: user.rank,
    cardFragments: user.cardFragments,
    packs: user.packs,
    currency: user.currency
  });
};

export const addToCollection = async (req, res) => {
  const { cardId } = req.body;
  if (!cardId) {
    return res.status(400).json({ message: 'Brak ID karty' });
  }

  const users = await loadUsers();
  const cards = await loadCards();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  }

  const existsCard = cards.some(c => c._id === cardId || c.name === cardId);
  if (!existsCard) {
    return res.status(404).json({ message: 'Takiej karty nie ma' });
  }

  const user = users[userIndex];
  if (!user.collection.includes(cardId)) {
    user.collection.push(cardId);
    users[userIndex] = user;
    await saveUsers(users);
  }

  res.json({ message: 'Dodano do kolekcji' });
};

export const getAllCards = async (req, res) => {
  const cards = await loadCards();
  res.json(cards);
};

export const getWalletAndPacks = async (req, res) => {
  const users = await loadUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  res.json({
    packs: user.packs || { normal: 0, premium: 0 },
    currency: user.currency || { gold: 0, premium: 0 }
  });
};

export const buyPack = async (req, res) => {
  const { type, currencyType } = req.body; // type: 'normal' lub 'premium', currencyType: 'gold' lub 'premium'
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  // Ceny paczek
  const prices = { normal: { gold: 200, premium: 1 }, premium: { gold: 1000, premium: 5 } };
  if (!prices[type] || !prices[type][currencyType]) return res.status(400).json({ message: 'Nieprawidłowy typ paczki lub waluty' });
  if ((user.currency?.[currencyType] ?? 0) < prices[type][currencyType]) {
    return res.status(400).json({ message: 'Za mało środków' });
  }
  user.currency[currencyType] -= prices[type][currencyType];
  user.packs[type] = (user.packs[type] || 0) + 1;
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ packs: user.packs, currency: user.currency });
};

export const openPack = async (req, res) => {
  const { type } = req.body; // 'normal' lub 'premium'
  const users = await loadUsers();
  const cards = await loadCards();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if ((user.packs?.[type] ?? 0) < 1) return res.status(400).json({ message: 'Brak paczek do otwarcia' });
  // Losuj 5 unikalnych kart
  const availableCards = cards.filter(c => c.name);
  const drawn = [];
  while (drawn.length < 5 && availableCards.length > 0) {
    const idx = Math.floor(Math.random() * availableCards.length);
    drawn.push(availableCards[idx].name);
    availableCards.splice(idx, 1);
  }
  user.packs[type] -= 1;
  let newCards = [];
  let goldBonus = 0;
  let fragmentsGained = 0;
  
  if (!user.cardFragments) user.cardFragments = 0;
  
  for (const card of drawn) {
    if (!(user.collection || []).includes(card)) {
      user.collection.push(card);
      newCards.push(card);
    } else {
      // Duplikat - daj kawałki kart i trochę złota
      goldBonus += 50;
      fragmentsGained += 20;
    }
  }
  user.currency.gold = (user.currency.gold || 0) + goldBonus;
  user.cardFragments += fragmentsGained;
  users[userIndex] = user;
  await saveUsers(users);
  // Sprawdź osiągnięcia
  const newAchievements = checkAchievements(user);
  
  res.json({ 
    cards: newCards, 
    packs: user.packs, 
    collection: user.collection, 
    goldBonus, 
    fragmentsGained,
    cardFragments: user.cardFragments,
    newAchievements
  });
};

export const createDeck = async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') return res.status(400).json({ message: 'Podaj nazwę talii' });
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if (!user.decks) user.decks = [];
  if (user.decks.some(d => d.name === name)) return res.status(400).json({ message: 'Talia o tej nazwie już istnieje' });
  user.decks.push({ name, cards: [] });
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ decks: user.decks });
};

export const deleteDeck = async (req, res) => {
  const { name } = req.params;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if (!user.decks) user.decks = [];
  user.decks = user.decks.filter(d => d.name !== name);
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ decks: user.decks });
};

export const addCardToDeck = async (req, res) => {
  const { deckName } = req.params;
  const { cardName } = req.body;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if (!user.decks) user.decks = [];
  const deck = user.decks.find(d => d.name === deckName);
  if (!deck) return res.status(404).json({ message: 'Talia nie istnieje' });
  if (deck.cards.length >= 40) return res.status(400).json({ message: 'Talia musi mieć dokładnie 40 kart' });
  if (!user.collection.includes(cardName)) return res.status(400).json({ message: 'Nie posiadasz tej karty' });
  deck.cards.push(cardName);
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ deck });
};

export const removeCardFromDeck = async (req, res) => {
  const { deckName } = req.params;
  const { cardName } = req.body;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if (!user.decks) user.decks = [];
  const deck = user.decks.find(d => d.name === deckName);
  if (!deck) return res.status(404).json({ message: 'Talia nie istnieje' });
  deck.cards = deck.cards.filter(c => c !== cardName);
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ deck });
};

export const setActiveDeck = async (req, res) => {
  const { name } = req.body;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  const user = users[userIndex];
  if (!user.decks) user.decks = [];
  const deck = user.decks.find(d => d.name === name);
  if (!deck) return res.status(404).json({ message: 'Talia nie istnieje' });
  if (deck.cards.length !== 40) return res.status(400).json({ message: 'Talia musi mieć dokładnie 40 kart' });
  user.activeDeck = name;
  users[userIndex] = user;
  await saveUsers(users);
  res.json({ activeDeck: name });
};

// Funkcje do zarządzania XP i statystykami
export const awardXP = async (req, res) => {
  const { action, amount } = req.body;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  
  const user = users[userIndex];
  if (!user.xp) user.xp = 0;
  if (!user.stats) user.stats = { gamesPlayed: 0, gamesWon: 0, gamesLost: 0, cardsPlayed: 0, damageDealt: 0, unitsDeployed: 0, commandsPlayed: 0 };
  if (!user.rank) user.rank = { tier: 'Bronze', division: 9, points: 0 };
  
  const oldLevel = calculateLevel(user.xp);
  const xpGained = amount || XP_REWARDS[action] || 0;
  user.xp += xpGained;
  const newLevel = calculateLevel(user.xp);
  
  // Aktualizuj statystyki
  if (action === 'GAME_WIN') {
    user.stats.gamesPlayed += 1;
    user.stats.gamesWon += 1;
    updateRank(user, 25); // Punkty rankingowe za wygraną
  } else if (action === 'GAME_LOSS') {
    user.stats.gamesPlayed += 1;
    user.stats.gamesLost += 1;
    updateRank(user, -10); // Utrata punktów za przegraną
  } else if (action === 'CARD_PLAYED') {
    user.stats.cardsPlayed += 1;
  } else if (action === 'UNIT_DEPLOYED') {
    user.stats.unitsDeployed += 1;
  } else if (action === 'COMMAND_PLAYED') {
    user.stats.commandsPlayed += 1;
  } else if (action === 'DAMAGE_DEALT') {
    user.stats.damageDealt += amount || 1;
  }
  
  users[userIndex] = user;
  await saveUsers(users);
  
  res.json({
    xpGained,
    totalXp: user.xp,
    level: newLevel,
    leveledUp: newLevel > oldLevel,
    xpToNextLevel: getXpToNextLevel(user.xp),
    stats: user.stats,
    rank: user.rank
  });
};

export const updateGameStats = async (req, res) => {
  const { gameResult, deckName, cardsPlayed, unitsDeployed, commandsPlayed, damageDealt } = req.body;
  const users = await loadUsers();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  
  const user = users[userIndex];
  if (!user.stats) user.stats = { gamesPlayed: 0, gamesWon: 0, gamesLost: 0, cardsPlayed: 0, damageDealt: 0, unitsDeployed: 0, commandsPlayed: 0 };
  if (!user.decks) user.decks = [];
  
  // Aktualizuj statystyki talii
  const deck = user.decks.find(d => d.name === deckName);
  if (deck) {
    if (!deck.stats) deck.stats = { gamesPlayed: 0, gamesWon: 0, gamesLost: 0 };
    deck.stats.gamesPlayed += 1;
    if (gameResult === 'win') {
      deck.stats.gamesWon += 1;
    } else if (gameResult === 'loss') {
      deck.stats.gamesLost += 1;
    }
  }
  
  // Aktualizuj statystyki użytkownika
  const oldLevel = calculateLevel(user.xp);
  user.stats.gamesPlayed += 1;
  user.stats.cardsPlayed += cardsPlayed || 0;
  user.stats.unitsDeployed += unitsDeployed || 0;
  user.stats.commandsPlayed += commandsPlayed || 0;
  user.stats.damageDealt += damageDealt || 0;
  
  // Dodaj XP
  let xpGained = 0;
  if (gameResult === 'win') {
    user.stats.gamesWon += 1;
    xpGained += XP_REWARDS.GAME_WIN;
    updateRank(user, 25);
  } else if (gameResult === 'loss') {
    user.stats.gamesLost += 1;
    xpGained += XP_REWARDS.GAME_LOSS;
    updateRank(user, -10);
  }
  
  xpGained += (cardsPlayed || 0) * XP_REWARDS.CARD_PLAYED;
  xpGained += (unitsDeployed || 0) * XP_REWARDS.UNIT_DEPLOYED;
  xpGained += (commandsPlayed || 0) * XP_REWARDS.COMMAND_PLAYED;
  xpGained += (damageDealt || 0) * XP_REWARDS.DAMAGE_DEALT;
  
  user.xp += xpGained;
  const newLevel = calculateLevel(user.xp);
  
  // Sprawdź osiągnięcia
  const newAchievements = checkAchievements(user);
  
  users[userIndex] = user;
  await saveUsers(users);
  
  res.json({
    xpGained,
    totalXp: user.xp,
    level: newLevel,
    leveledUp: newLevel > oldLevel,
    stats: user.stats,
    rank: user.rank,
    deckStats: deck?.stats,
    newAchievements
  });
};

// System craftingu kart
export const craftCard = async (req, res) => {
  const { cardName } = req.body;
  const users = await loadUsers();
  const cards = await loadCards();
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex === -1) return res.status(404).json({ message: 'Użytkownik nie znaleziony' });
  
  const user = users[userIndex];
  if (!user.cardFragments) user.cardFragments = 0;
  
  // Sprawdź czy karta istnieje
  const cardExists = cards.some(c => c.name === cardName);
  if (!cardExists) return res.status(404).json({ message: 'Karta nie istnieje' });
  
  // Koszt craftingu (różny dla różnych typów kart)
  const craftingCost = 100; // Podstawowy koszt
  
  if (user.cardFragments < craftingCost) {
    return res.status(400).json({ message: `Potrzebujesz ${craftingCost} kawałków kart` });
  }
  
  // Sprawdź czy gracz już ma tę kartę
  if (user.collection.includes(cardName)) {
    return res.status(400).json({ message: 'Już posiadasz tę kartę' });
  }
  
  // Wykonaj crafting
  user.cardFragments -= craftingCost;
  user.collection.push(cardName);
  
  // Sprawdź osiągnięcia
  const newAchievements = checkAchievements(user);
  
  users[userIndex] = user;
  await saveUsers(users);
  
  res.json({
    message: 'Karta została stworzona!',
    cardName,
    remainingFragments: user.cardFragments,
    newAchievements
  });
};

export const getAchievements = async (req, res) => {
  const allAchievements = Object.values(ACHIEVEMENTS);
  res.json(allAchievements);
};
