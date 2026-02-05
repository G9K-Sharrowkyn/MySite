export const DEFAULT_DB = {
  users: [],
  posts: [],
  comments: [],
  characters: [],
  notifications: [],
  messages: [],
  chatMessages: [],
  friendRequests: [],
  friendships: [],
  blocks: [],
  divisionFights: [],
  fights: [],
  votes: [],
  tournaments: [],
  badges: [],
  userBadges: [],
  bets: [],
  conversations: [],
  coinTransactions: [],
  storePurchases: [],
  tags: [],
  communityDiscussions: [],
  communityHotDebates: [],
  communityPolls: [],
  communityCharacterRankings: [],
  donations: [],
  pushSubscriptions: [],
  legalConsents: [],
  challengeProgress: [],
  recommendationEvents: [],
  characterSuggestions: [],
  divisionSeasons: [],
  feedback: [],
  nicknameChangeLogs: [],
  moderatorActionLogs: [],
  emailVerificationTokens: [],
  authChallenges: []
};

export const COLLECTION_KEYS = Object.keys(DEFAULT_DB);

const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const normalizeDb = (data = {}) => {
  const normalized = { ...DEFAULT_DB, ...data };
  for (const key of COLLECTION_KEYS) {
    normalized[key] = ensureArray(normalized[key]);
  }
  return normalized;
};
