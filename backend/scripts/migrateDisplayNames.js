import { withDb } from '../repositories/index.js';
import { getUserDisplayName } from '../utils/userDisplayName.js';

const run = async () => {
  let usersUpdated = 0;
  let commentsUpdated = 0;
  let messagesUpdated = 0;

  await withDb((db) => {
    const usersById = new Map();
    db.users = Array.isArray(db.users) ? db.users : [];
    db.users.forEach((user) => {
      const userId = user.id || user._id;
      user.profile = user.profile || {};
      if (!user.profile.displayName) {
        user.profile.displayName = user.username || 'User';
        usersUpdated += 1;
      }
      usersById.set(userId, user);
    });

    db.comments = Array.isArray(db.comments) ? db.comments : [];
    db.comments.forEach((comment) => {
      if (comment.authorDisplayName) return;
      const user = usersById.get(comment.authorId);
      comment.authorDisplayName = getUserDisplayName(user) || comment.authorUsername || 'User';
      commentsUpdated += 1;
    });

    db.messages = Array.isArray(db.messages) ? db.messages : [];
    db.messages.forEach((message) => {
      const sender = usersById.get(message.senderId);
      const recipient = usersById.get(message.recipientId);
      if (!message.senderDisplayName) {
        message.senderDisplayName =
          getUserDisplayName(sender) || message.senderUsername || 'User';
        messagesUpdated += 1;
      }
      if (!message.recipientDisplayName) {
        message.recipientDisplayName =
          getUserDisplayName(recipient) || message.recipientUsername || 'User';
        messagesUpdated += 1;
      }
    });

    return db;
  });

  console.log(
    `Done. users=${usersUpdated}, comments=${commentsUpdated}, message_fields=${messagesUpdated}`
  );
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

