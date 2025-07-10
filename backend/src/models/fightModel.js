const mongoose = require('mongoose');
const { Schema } = mongoose;

const fightSchema = new Schema(
  {
    division: { type: Schema.Types.ObjectId, ref: 'Division' }, // nullable for casual fights
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamA: [{ type: Schema.Types.ObjectId, ref: 'Character', required: true }],
    teamB: [{ type: Schema.Types.ObjectId, ref: 'Character', required: true }],
    votesA: { type: Number, default: 0 },
    votesB: { type: Number, default: 0 },
    voters: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, team: { type: String, enum: ['A', 'B'] } }],
    isOfficial: { type: Boolean, default: false },
    isTitleFight: { type: Boolean, default: false },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Fight', fightSchema);