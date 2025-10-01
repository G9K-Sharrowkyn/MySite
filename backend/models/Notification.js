import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true,
    enum: ['fight_result', 'division_fight', 'reaction', 'comment', 'mention', 'system', 'moderator', 'achievement']
  },
  
  // Podstawowe informacje
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  
  // Priorytet powiadomienia
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Kategoria dla grupowania
  category: {
    type: String,
    enum: ['fight_result', 'division_fight', 'reaction', 'comment', 'mention', 'system'],
    required: true,
    index: true
  },
  
  // URL do akcji związanej z powiadomieniem
  actionUrl: { type: String, default: null },
  
  // Dodatkowe dane powiadomienia
  metadata: {
    fightId: { type: String },
    postId: { type: String },
    commentId: { type: String },
    fromUserId: { type: String },
    fromUsername: { type: String },
    divisionId: { type: String },
    achievementId: { type: String },
    customData: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Informacje o wyświetleniu
  displayed: { type: Boolean, default: false },
  displayedAt: { type: Date },
  
  // Wygaśnięcie powiadomienia
  expiresAt: { type: Date },
  
  // Push notification
  pushSent: { type: Boolean, default: false },
  pushSentAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indeksy dla wydajności
notificationSchema.index({ 'userId': 1, 'read': 1 });
notificationSchema.index({ 'category': 1 });
notificationSchema.index({ 'priority': 1 });
notificationSchema.index({ 'createdAt': -1 });
notificationSchema.index({ 'expiresAt': 1 }, { expireAfterSeconds: 0 });

// Middleware do automatycznego ustawiania updatedAt
notificationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Statyczne metody
notificationSchema.statics.createFightResultNotification = function(userId, fightId, winner, fightTitle) {
  return this.create({
    userId,
    type: 'fight_result',
    category: 'fight_result',
    title: 'Wynik walki',
    message: `Walka "${fightTitle}" została zakończona. Wygrał: ${winner}`,
    priority: 'high',
    actionUrl: `/fight/${fightId}`,
    metadata: {
      fightId,
      customData: { winner, fightTitle }
    }
  });
};

notificationSchema.statics.createReactionNotification = function(userId, fromUserId, fromUsername, postId, reactionType) {
  return this.create({
    userId,
    type: 'reaction',
    category: 'reaction',
    title: 'Nowa reakcja',
    message: `${fromUsername} zareagował na Twój post: ${reactionType}`,
    priority: 'low',
    actionUrl: `/post/${postId}`,
    metadata: {
      postId,
      fromUserId,
      fromUsername,
      customData: { reactionType }
    }
  });
};

notificationSchema.statics.createCommentNotification = function(userId, fromUserId, fromUsername, postId, commentContent) {
  return this.create({
    userId,
    type: 'comment',
    category: 'comment',
    title: 'Nowy komentarz',
    message: `${fromUsername} skomentował Twój post: "${commentContent.substring(0, 50)}..."`,
    priority: 'medium',
    actionUrl: `/post/${postId}`,
    metadata: {
      postId,
      fromUserId,
      fromUsername,
      customData: { commentContent }
    }
  });
};

notificationSchema.statics.createDivisionFightNotification = function(userId, fightId, fightTitle, divisionName) {
  return this.create({
    userId,
    type: 'division_fight',
    category: 'division_fight',
    title: 'Nowa walka w dywizji',
    message: `Nowa walka w dywizji ${divisionName}: "${fightTitle}"`,
    priority: 'medium',
    actionUrl: `/fight/${fightId}`,
    metadata: {
      fightId,
      customData: { fightTitle, divisionName }
    }
  });
};

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
