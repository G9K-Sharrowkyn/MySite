const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);