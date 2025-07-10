const mongoose = require('mongoose');
const { Schema } = mongoose;

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    maxParticipants: { type: Number, default: 16 },
    status: { type: String, enum: ['upcoming', 'active', 'completed'], default: 'upcoming' },
    startDate: { type: Date },
    endDate: { type: Date },
    winner: { type: Schema.Types.ObjectId, ref: 'User' },
    bracket: { type: Schema.Types.Mixed },
    rules: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tournament', tournamentSchema);