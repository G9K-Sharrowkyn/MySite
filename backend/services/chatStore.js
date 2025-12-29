import { v4 as uuidv4 } from 'uuid';
import { readDb, updateDb } from './jsonDb.js';

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
  const db = await readDb();
  const messages = db.chatMessages || [];
  const sorted = [...messages].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
  return sorted.slice(0, limit).reverse().map(normalizeMessage);
};

export const addMessage = async ({ userId, username, profilePicture, text }) => {
  const now = new Date().toISOString();
  let created;

  await updateDb((db) => {
    const message = {
      id: uuidv4(),
      userId,
      username,
      profilePicture,
      text,
      reactions: [],
      createdAt: now
    };
    db.chatMessages = Array.isArray(db.chatMessages) ? db.chatMessages : [];
    db.chatMessages.push(message);
    created = message;
    return db;
  });

  return normalizeMessage(created);
};

export const trimMessages = async () => {
  await updateDb((db) => {
    db.chatMessages = Array.isArray(db.chatMessages) ? db.chatMessages : [];
    
    // Remove messages older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialLength = db.chatMessages.length;
    
    db.chatMessages = db.chatMessages.filter(msg => {
      const messageDate = new Date(msg.createdAt || 0);
      return messageDate > twentyFourHoursAgo;
    });
    
    const removed = initialLength - db.chatMessages.length;
    if (removed > 0) {
      console.log(`Trimmed ${removed} messages older than 24 hours from global chat`);
    }
    
    return db;
  });
};

export const addReaction = async ({ messageId, userId, username, emoji }) => {
  let updated;

  await updateDb((db) => {
    db.chatMessages = Array.isArray(db.chatMessages) ? db.chatMessages : [];
    const message = db.chatMessages.find((entry) => entry.id === messageId);
    if (!message) {
      const error = new Error('Message not found');
      error.code = 'MESSAGE_NOT_FOUND';
      throw error;
    }

    message.reactions = Array.isArray(message.reactions) ? message.reactions : [];
    const existing = message.reactions.find(
      (reaction) => reaction.userId === userId && reaction.emoji === emoji
    );

    if (!existing) {
      message.reactions.push({ userId, username, emoji });
    }

    updated = normalizeMessage(message);
    return db;
  });

  return updated;
};
