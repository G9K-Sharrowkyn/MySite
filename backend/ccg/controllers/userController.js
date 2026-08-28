import fs from 'fs/promises';
import path from 'path';
import { randomInt } from 'crypto';
import { fileURLToPath } from 'url';
import { getCcgUser, updateCcgUser } from '../services/profileService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsFile = path.join(__dirname, '..', 'data', 'cards.json');
const XP_PER_LEVEL = 1000;

const ACHIEVEMENTS = {
  CARD_COLLECTOR: {
    id: 'card_collector',
    name: 'Kolekcjoner',
    description: 'Zbierz 50 kart',
    reward: { xp: 150, gold: 100 }
  },
  DECK_BUILDER: {
    id: 'deck_builder',
    name: 'Konstruktor Talii',
    description: 'Stwórz swoją pierwszą talię',
    reward: { xp: 75, gold: 25 }
  }
};

class CcgRuleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ensure = (condition, status, message) => {
  if (!condition) throw new CcgRuleError(status, message);
};

const cleanString = (value, maxLength = 60) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const loadCards = async () => {
  const data = await fs.readFile(cardsFile, 'utf8');
  const cards = JSON.parse(data);
  return Array.isArray(cards) ? cards : [];
};

const applyAchievements = (profile) => {
  const awarded = [];
  const candidates = [
    profile.collection.length >= 50 ? ACHIEVEMENTS.CARD_COLLECTOR : null,
    profile.decks.length >= 1 ? ACHIEVEMENTS.DECK_BUILDER : null
  ].filter(Boolean);

  for (const achievement of candidates) {
    if (profile.achievements.includes(achievement.id)) continue;
    profile.achievements.push(achievement.id);
    profile.xp += achievement.reward.xp;
    profile.currency.gold += achievement.reward.gold;
    awarded.push(achievement);
  }
  return awarded;
};

const calculateLevel = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;
const getXpToNextLevel = (xp) => calculateLevel(xp) * XP_PER_LEVEL - xp;

export const getProfile = async (req, res) => {
  const [user, cards] = await Promise.all([
    getCcgUser(req.user.id),
    loadCards()
  ]);
  if (!user) {
    return res.status(404).json({ message: 'Użytkownik nie został znaleziony' });
  }

  const userCards = user.collection
    .map((cardId) => cards.find((card) => card._id === cardId || card.name === cardId))
    .filter(Boolean);

  return res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    points: user.points,
    collection: userCards,
    decks: user.decks,
    activeDeck: user.activeDeck,
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

export const getAllCards = async (_req, res) => {
  res.json(await loadCards());
};

export const getWalletAndPacks = async (req, res) => {
  const user = await getCcgUser(req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Użytkownik nie został znaleziony' });
  }
  return res.json({ packs: user.packs, currency: user.currency });
};

export const buyPack = async (req, res) => {
  const type = cleanString(req.body?.type, 20);
  const currencyType = cleanString(req.body?.currencyType, 20);
  const prices = {
    normal: { gold: 200, premium: 1 },
    premium: { gold: 1000, premium: 5 }
  };
  ensure(prices[type]?.[currencyType], 400, 'Nieprawidłowy typ paczki lub waluty');

  const user = await updateCcgUser(req.user.id, (profile) => {
    const price = prices[type][currencyType];
    ensure(profile.currency[currencyType] >= price, 400, 'Za mało środków');
    profile.currency[currencyType] -= price;
    profile.packs[type] += 1;
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({ packs: user.packs, currency: user.currency });
};

export const openPack = async (req, res) => {
  const type = cleanString(req.body?.type, 20);
  ensure(['normal', 'premium'].includes(type), 400, 'Nieprawidłowy typ paczki');

  const cards = await loadCards();
  const pool = cards.filter((card) => typeof card?.name === 'string');
  ensure(pool.length >= 5, 503, 'Brak wystarczającej liczby kart w katalogu');

  const drawn = [];
  while (drawn.length < 5) {
    const index = randomInt(pool.length);
    drawn.push(pool[index].name);
    pool.splice(index, 1);
  }

  let goldBonus = 0;
  let fragmentsGained = 0;
  let newAchievements = [];
  const user = await updateCcgUser(req.user.id, (profile) => {
    ensure(profile.packs[type] >= 1, 400, 'Brak paczek do otwarcia');
    profile.packs[type] -= 1;
    for (const cardName of drawn) {
      if (!profile.collection.includes(cardName)) {
        profile.collection.push(cardName);
      } else {
        goldBonus += 50;
        fragmentsGained += 20;
      }
    }
    profile.currency.gold += goldBonus;
    profile.cardFragments += fragmentsGained;
    newAchievements = applyAchievements(profile);
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');

  return res.json({
    cards: drawn,
    packs: user.packs,
    collection: user.collection,
    currency: user.currency,
    goldBonus,
    fragmentsGained,
    cardFragments: user.cardFragments,
    newAchievements
  });
};

export const createDeck = async (req, res) => {
  const name = cleanString(req.body?.name);
  ensure(name.length >= 1, 400, 'Podaj nazwę talii');

  let newAchievements = [];
  const user = await updateCcgUser(req.user.id, (profile) => {
    ensure(profile.decks.length < 30, 400, 'Osiągnięto limit 30 talii');
    ensure(
      !profile.decks.some(
        (deck) => deck.name.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl')
      ),
      409,
      'Talia o tej nazwie już istnieje'
    );
    profile.decks.push({ name, cards: [] });
    newAchievements = applyAchievements(profile);
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.status(201).json({ decks: user.decks, newAchievements });
};

export const deleteDeck = async (req, res) => {
  const name = cleanString(req.params?.name);
  const user = await updateCcgUser(req.user.id, (profile) => {
    const before = profile.decks.length;
    profile.decks = profile.decks.filter((deck) => deck.name !== name);
    ensure(profile.decks.length !== before, 404, 'Talia nie istnieje');
    if (profile.activeDeck === name) profile.activeDeck = null;
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({ decks: user.decks, activeDeck: user.activeDeck });
};

export const addCardToDeck = async (req, res) => {
  const deckName = cleanString(req.params?.deckName);
  const cardName = cleanString(req.body?.cardName, 120);
  ensure(cardName, 400, 'Podaj nazwę karty');

  let updatedDeck;
  const user = await updateCcgUser(req.user.id, (profile) => {
    const deck = profile.decks.find((entry) => entry.name === deckName);
    ensure(deck, 404, 'Talia nie istnieje');
    ensure(deck.cards.length < 40, 400, 'Talia może mieć najwyżej 40 kart');
    ensure(profile.collection.includes(cardName), 400, 'Nie posiadasz tej karty');
    ensure(!deck.cards.includes(cardName), 409, 'Ta karta jest już w talii');
    deck.cards.push(cardName);
    updatedDeck = deck;
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({ deck: updatedDeck });
};

export const removeCardFromDeck = async (req, res) => {
  const deckName = cleanString(req.params?.deckName);
  const cardName = cleanString(req.body?.cardName, 120);
  let updatedDeck;
  const user = await updateCcgUser(req.user.id, (profile) => {
    const deck = profile.decks.find((entry) => entry.name === deckName);
    ensure(deck, 404, 'Talia nie istnieje');
    const index = deck.cards.indexOf(cardName);
    ensure(index >= 0, 404, 'Tej karty nie ma w talii');
    deck.cards.splice(index, 1);
    if (profile.activeDeck === deckName) profile.activeDeck = null;
    updatedDeck = deck;
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({ deck: updatedDeck, activeDeck: user.activeDeck });
};

export const setActiveDeck = async (req, res) => {
  const name = cleanString(req.body?.name);
  const user = await updateCcgUser(req.user.id, (profile) => {
    const deck = profile.decks.find((entry) => entry.name === name);
    ensure(deck, 404, 'Talia nie istnieje');
    ensure(deck.cards.length === 40, 400, 'Talia musi mieć dokładnie 40 kart');
    profile.activeDeck = name;
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({ activeDeck: user.activeDeck });
};

export const craftCard = async (req, res) => {
  const cardName = cleanString(req.body?.cardName, 120);
  const cards = await loadCards();
  ensure(
    cards.some((card) => card.name === cardName),
    404,
    'Karta nie istnieje'
  );

  const craftingCost = 100;
  let newAchievements = [];
  const user = await updateCcgUser(req.user.id, (profile) => {
    ensure(
      profile.cardFragments >= craftingCost,
      400,
      `Potrzebujesz ${craftingCost} fragmentów kart`
    );
    ensure(!profile.collection.includes(cardName), 409, 'Już posiadasz tę kartę');
    profile.cardFragments -= craftingCost;
    profile.collection.push(cardName);
    newAchievements = applyAchievements(profile);
  });
  ensure(user, 404, 'Użytkownik nie został znaleziony');
  return res.json({
    message: 'Karta została stworzona',
    cardName,
    remainingFragments: user.cardFragments,
    newAchievements
  });
};

export const getAchievements = async (_req, res) => {
  res.json(Object.values(ACHIEVEMENTS));
};
