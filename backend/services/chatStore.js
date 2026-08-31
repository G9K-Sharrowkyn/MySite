import { v4 as uuidv4 } from 'uuid';
import { chatMessagesRepo } from '../repositories/index.js';

const normalizeMessage = (message) => ({
  id: message.id,
  userId: message.userId,
  username: message.username,
  profilePicture: message.profilePicture,
  text: message.text,
  reactions: message.reactions || [],
  createdAt: message.createdAt
});

export const getRecentMessages = async (limit = 50) => {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const messages = await chatMessagesRepo.findManyBy(
    {},
    { sort: { createdAt: -1 }, limit: safeLimit }
  );
  return messages.reverse().map(normalizeMessage);
};

export const addMessage = async ({ userId, username, profilePicture, text }) => {
  const now = new Date().toISOString();
  const created = await chatMessagesRepo.insert({
    id: uuidv4(),
    userId,
    username,
    profilePicture,
    text,
    reactions: [],
    createdAt: now
  });

  return normalizeMessage(created);
};

export const trimMessages = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { deletedCount = 0 } = await chatMessagesRepo.removeManyBy({
    createdAt: { $lt: cutoff }
  });
  if (deletedCount > 0) {
    console.log(`Trimmed ${deletedCount} messages older than 24 hours from global chat`);
  }
};

export const addReaction = async ({ messageId, userId, username, emoji }) => {
  const updated = await chatMessagesRepo.updateById(messageId, (message) => {
    if (!message) {
      return message;
    }
    message.reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const existing = message.reactions.find(
      (reaction) => reaction.userId === userId && reaction.emoji === emoji
    );

    if (!existing) {
      message.reactions.push({ userId, username, emoji });
    }

    return message;
  });

  if (!updated) {
    const error = new Error('Message not found');
    error.code = 'MESSAGE_NOT_FOUND';
    throw error;
  }

  return normalizeMessage(updated);
};
