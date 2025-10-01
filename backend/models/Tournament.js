import mongoose from 'mongoose';

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  fights: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Fight' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'finished', 'cancelled'],
    default: 'upcoming'
  },
  startDate: { type: Date },
  endDate: { type: Date },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  maxParticipants: { type: Number, default: 16 },
  currentRound: { type: Number, default: 1 },
  totalRounds: { type: Number },
  rules: { type: String },
  prize: { type: String },
  settings: {
    publicJoin: { type: Boolean, default: true },
    votingDuration: { type: Number, default: 24 }, // hours
    requireApproval: { type: Boolean, default: false }
  }
}, { timestamps: true });

// Indeksy
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ createdBy: 1 });
tournamentSchema.index({ startDate: 1 });

const Tournament = mongoose.model('Tournament', tournamentSchema);
export default Tournament;
