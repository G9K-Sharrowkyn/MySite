// Donation controller
const User = require('../models/userModel');

// GET /api/donate/config
const getDonationConfig = (req, res) => {
  res.json({
    buyMeACoffeeLink: process.env.BMC_LINK || 'https://buymeacoffee.com/username',
    paypalLink: process.env.PAYPAL_LINK || 'https://paypal.me/username'
  });
};

// POST /api/donate/history  {provider, amount, currency}
const recordDonation = async (req, res) => {
  const { provider, amount, currency } = req.body;
  if (!['buymeacoffee', 'paypal'].includes(provider)) {
    return res.status(400).json({ message: 'Invalid provider' });
  }

  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

  try {
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        donationHistory: { provider, amount, currency }
      }
    });
    res.json({ message: 'Donation recorded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getDonationConfig, recordDonation };