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
  const messages = await chatMessagesRepo.getAll();
  const sorted = [...messages].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  return sorted.slice(0, limit).reverse().map(normalizeMessage);
};

export const addMessage = async ({ userId, username, profilePicture, text }) => {
  const now = new Date().toISOString();
  let created;

  await chatMessagesRepo.updateAll((messages) => {
    const message = {
      id: uuidv4(),
      userId,
      username,
      profilePicture,
      text,
      reactions: [],
      createdAt: now
    };
    messages.push(message);
    created = message;
    return messages;
  });

  return normalizeMessage(created);
};

export const trimMessages = async () => {
  await chatMessagesRepo.updateAll((messages) => {
    // Remove messages older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialLength = messages.length;

    const filtered = messages.filter((msg) => {
      const messageDate = new Date(msg.createdAt || 0);
      return messageDate > twentyFourHoursAgo;
    });

    const removed = initialLength - filtered.length;
    if (removed > 0) {
      console.log(`Trimmed ${removed} messages older than 24 hours from global chat`);
    }

    return filtered;
  });
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
