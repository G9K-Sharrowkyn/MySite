import { readCollection, updateCollection } from '../../services/jsonDb.js';

const DEFAULT_PROFILE = Object.freeze({
  points: 0,
  collection: [],
  packs: { normal: 8, premium: 0 },
  currency: { gold: 1000, premium: 0 },
  decks: [],
  activeDeck: null,
  xp: 0,
  achievements: [],
  rank: { tier: 'Bronze', division: 9, points: 0 },
  cardFragments: 0
});

const resolveUserId = (user) => user?.id || user?._id || null;

const finiteNonNegative = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const normalizeDeck = (deck) => ({
  name: typeof deck?.name === 'string' ? deck.name.trim().slice(0, 60) : '',
  cards: Array.isArray(deck?.cards)
    ? deck.cards.filter((card) => typeof card === 'string').slice(0, 40)
    : [],
  ...(deck?.stats && typeof deck.stats === 'object'
    ? {
        stats: {
          gamesPlayed: finiteNonNegative(deck.stats.gamesPlayed),
          gamesWon: finiteNonNegative(deck.stats.gamesWon),
          gamesLost: finiteNonNegative(deck.stats.gamesLost)
        }
      }
    : {})
});

export const normalizeCcgProfile = (value = {}) => {
  const profile = value && typeof value === 'object' ? value : {};
  return {
    points: finiteNonNegative(profile.points, DEFAULT_PROFILE.points),
    collection: Array.isArray(profile.collection)
      ? profile.collection.filter((card) => typeof card === 'string').slice(0, 10000)
      : [],
    packs: {
      normal: finiteNonNegative(profile.packs?.normal, DEFAULT_PROFILE.packs.normal),
      premium: finiteNonNegative(
        profile.packs?.premium,
        DEFAULT_PROFILE.packs.premium
      )
    },
    currency: {
      gold: finiteNonNegative(
        profile.currency?.gold,
        DEFAULT_PROFILE.currency.gold
      ),
      premium: finiteNonNegative(
        profile.currency?.premium,
        DEFAULT_PROFILE.currency.premium
      )
    },
    decks: Array.isArray(profile.decks)
      ? profile.decks.map(normalizeDeck).filter((deck) => deck.name).slice(0, 30)
      : [],
    activeDeck:
      typeof profile.activeDeck === 'string' ? profile.activeDeck.slice(0, 60) : null,
    xp: finiteNonNegative(profile.xp, DEFAULT_PROFILE.xp),
    stats: {
      gamesPlayed: finiteNonNegative(profile.stats?.gamesPlayed),
      gamesWon: finiteNonNegative(profile.stats?.gamesWon),
      gamesLost: finiteNonNegative(profile.stats?.gamesLost),
      cardsPlayed: finiteNonNegative(profile.stats?.cardsPlayed),
      damageDealt: finiteNonNegative(profile.stats?.damageDealt),
      unitsDeployed: finiteNonNegative(profile.stats?.unitsDeployed),
      commandsPlayed: finiteNonNegative(profile.stats?.commandsPlayed)
    },
    achievements: Array.isArray(profile.achievements)
      ? profile.achievements.filter((item) => typeof item === 'string').slice(0, 100)
      : [],
    rank: {
      tier:
        typeof profile.rank?.tier === 'string'
          ? profile.rank.tier
          : DEFAULT_PROFILE.rank.tier,
      division: finiteNonNegative(
        profile.rank?.division,
        DEFAULT_PROFILE.rank.division
      ),
      points: finiteNonNegative(profile.rank?.points, DEFAULT_PROFILE.rank.points)
    },
    cardFragments: finiteNonNegative(
      profile.cardFragments,
      DEFAULT_PROFILE.cardFragments
    )
  };
};

const toPublicProfile = (mainUser) => ({
  id: resolveUserId(mainUser),
  username: mainUser.username,
  email: mainUser.email,
  ...normalizeCcgProfile(mainUser.ccg)
});

export const getCcgUser = async (userId) => {
  const users = await readCollection('users');
  const user = users.find((entry) => resolveUserId(entry) === userId);
  return user ? toPublicProfile(user) : null;
};

export const updateCcgUser = async (userId, mutator) => {
  let result = null;
  await updateCollection('users', (users) =>
    users.map((entry) => {
      if (resolveUserId(entry) !== userId) return entry;

      const mainUser = { ...entry };
      const profile = normalizeCcgProfile(mainUser.ccg);
      mutator(profile, mainUser);
      mainUser.ccg = normalizeCcgProfile(profile);
      result = toPublicProfile(mainUser);
      return mainUser;
    })
  );
  return result;
};
