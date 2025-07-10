const mongoose = require('mongoose');
const { Schema } = mongoose;

const teamSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    characters: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 }
  },
  { _id: false }
);

const divisionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    roster: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
    teams: [teamSchema],
    champion: {
      user: { type: Schema.Types.ObjectId, ref: 'User' },
      team: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
      since: { type: Date }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Division', divisionSchema);