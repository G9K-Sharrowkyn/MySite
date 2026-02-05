import { createCollectionRepo } from './collectionRepo.js';
export { readDb, updateDb, writeDb, withDb } from './dbRepo.js';
import { COLLECTION_KEYS } from '../services/dbSchema.js';

const repositories = Object.fromEntries(
  COLLECTION_KEYS.map((key) => [key, createCollectionRepo(key)])
);

export const getRepository = (key) => repositories[key];

export const usersRepo = repositories.users;
export const postsRepo = repositories.posts;
export const commentsRepo = repositories.comments;
export const charactersRepo = repositories.characters;
export const notificationsRepo = repositories.notifications;
export const messagesRepo = repositories.messages;
export const chatMessagesRepo = repositories.chatMessages;
export const friendRequestsRepo = repositories.friendRequests;
export const friendshipsRepo = repositories.friendships;
export const blocksRepo = repositories.blocks;
export const divisionFightsRepo = repositories.divisionFights;
export const fightsRepo = repositories.fights;
export const votesRepo = repositories.votes;
export const tournamentsRepo = repositories.tournaments;
export const badgesRepo = repositories.badges;
export const userBadgesRepo = repositories.userBadges;
export const betsRepo = repositories.bets;
export const conversationsRepo = repositories.conversations;
export const coinTransactionsRepo = repositories.coinTransactions;
export const storePurchasesRepo = repositories.storePurchases;
export const tagsRepo = repositories.tags;
export const communityDiscussionsRepo = repositories.communityDiscussions;
export const communityHotDebatesRepo = repositories.communityHotDebates;
export const communityPollsRepo = repositories.communityPolls;
export const communityCharacterRankingsRepo = repositories.communityCharacterRankings;
export const donationsRepo = repositories.donations;
export const pushSubscriptionsRepo = repositories.pushSubscriptions;
export const legalConsentsRepo = repositories.legalConsents;
export const challengeProgressRepo = repositories.challengeProgress;
export const recommendationEventsRepo = repositories.recommendationEvents;
export const characterSuggestionsRepo = repositories.characterSuggestions;
export const divisionSeasonsRepo = repositories.divisionSeasons;
export const feedbackRepo = repositories.feedback;
export const nicknameChangeLogsRepo = repositories.nicknameChangeLogs;
export const moderatorActionLogsRepo = repositories.moderatorActionLogs;
export const emailVerificationTokensRepo = repositories.emailVerificationTokens;
export const authChallengesRepo = repositories.authChallenges;

export { repositories };
