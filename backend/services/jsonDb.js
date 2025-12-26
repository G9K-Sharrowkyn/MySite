import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'db.json');

const DEFAULT_DB = {
  users: [],
  posts: [],
  comments: [],
  characters: [],
  notifications: [],
  messages: [],
  chatMessages: [],
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
  characterSuggestions: []
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDb = (data = {}) => ({
  ...DEFAULT_DB,
  ...data,
  users: ensureArray(data.users),
  posts: ensureArray(data.posts),
  comments: ensureArray(data.comments),
  characters: ensureArray(data.characters),
  notifications: ensureArray(data.notifications),
  messages: ensureArray(data.messages),
  chatMessages: ensureArray(data.chatMessages),
  divisionFights: ensureArray(data.divisionFights),
  fights: ensureArray(data.fights),
  votes: ensureArray(data.votes),
  tournaments: ensureArray(data.tournaments),
  badges: ensureArray(data.badges),
  userBadges: ensureArray(data.userBadges),
  bets: ensureArray(data.bets),
  conversations: ensureArray(data.conversations),
  coinTransactions: ensureArray(data.coinTransactions),
  storePurchases: ensureArray(data.storePurchases),
  tags: ensureArray(data.tags),
  communityDiscussions: ensureArray(data.communityDiscussions),
  communityHotDebates: ensureArray(data.communityHotDebates),
  communityPolls: ensureArray(data.communityPolls),
  communityCharacterRankings: ensureArray(data.communityCharacterRankings),
  donations: ensureArray(data.donations),
  pushSubscriptions: ensureArray(data.pushSubscriptions),
  legalConsents: ensureArray(data.legalConsents),
  challengeProgress: ensureArray(data.challengeProgress),
  recommendationEvents: ensureArray(data.recommendationEvents),
  characterSuggestions: ensureArray(data.characterSuggestions)
});

let writeChain = Promise.resolve();

const enqueueWrite = async (task) => {
  let result;
  let error;

  writeChain = writeChain.then(
    async () => {
      try {
        result = await task();
      } catch (err) {
        error = err;
      }
    },
    async () => {
      try {
        result = await task();
      } catch (err) {
        error = err;
      }
    }
  );

  await writeChain;
  if (error) {
    throw error;
  }
  return result;
};

const ensureDbFile = async () => {
  try {
    await fs.access(DB_PATH);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    } else {
      throw error;
    }
  }
};

export const readDb = async () => {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  if (!raw.trim()) {
    return normalizeDb(DEFAULT_DB);
  }
  return normalizeDb(JSON.parse(raw));
};

export const writeDb = async (data) => {
  const normalized = normalizeDb(data);
  await enqueueWrite(() =>
    fs.writeFile(DB_PATH, JSON.stringify(normalized, null, 2), 'utf8')
  );
  return normalized;
};

export const updateDb = async (mutator) => {
  return enqueueWrite(async () => {
    const data = await readDb();
    const result = await mutator(data);
    const updated = normalizeDb(result || data);
    await fs.writeFile(DB_PATH, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  });
};

export const getDbPath = () => DB_PATH;
