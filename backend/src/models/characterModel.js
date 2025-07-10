const mongoose = require('mongoose');
const { Schema } = mongoose;

const characterSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    universe: { type: String },
    imageUrl: { type: String },
    powerTier: { type: String },
    divisions: [{ type: Schema.Types.ObjectId, ref: 'Division' }],
    isLocked: { type: Boolean, default: false },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Character', characterSchema);