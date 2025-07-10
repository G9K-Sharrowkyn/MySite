const mongoose = require('mongoose');
const { Schema } = mongoose;

const consentSchema = new Schema(
  {
    privacyPolicy: { type: Boolean, required: true, default: false },
    termsOfService: { type: Boolean, required: true, default: false },
    cookies: { type: Boolean, required: true, default: false },
    marketingEmails: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user'
    },
    profile: {
      avatar: { type: String, default: '' },
      description: { type: String, default: '' },
      background: { type: String, default: '' }
    },
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
      noContest: { type: Number, default: 0 }
    },
    divisions: [
      {
        division: { type: Schema.Types.ObjectId, ref: 'Division' },
        team: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
        record: {
          wins: { type: Number, default: 0 },
          losses: { type: Number, default: 0 }
        },
        isChampion: { type: Boolean, default: false }
      }
    ],
    consent: consentSchema,
    donationHistory: [
      {
        provider: { type: String, enum: ['buymeacoffee', 'paypal'] },
        amount: Number,
        currency: { type: String, default: 'USD' },
        donatedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);