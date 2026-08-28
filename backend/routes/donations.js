import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  donationsRepo,
  usersRepo,
  withDb
} from '../repositories/index.js';
import auth from '../middleware/auth.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  getDonationCurrency,
  getDonationProviders
} from '../config/donationConfig.js';
import { logModerationAction } from '../utils/moderationAudit.js';

const router = express.Router();

// GET /api/donations/config
router.get('/config', (_req, res) => {
  res.json({
    providers: getDonationProviders(),
    currency: getDonationCurrency()
  });
});

// GET /api/donations/stats
router.get('/stats', async (_req, res) => {
  try {
    const donations = await donationsRepo.getAll();
    const totalAmount = donations.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalDonations = donations.length;
    const now = new Date();
    const monthlyProgress = donations
      .filter((entry) => {
        const date = new Date(entry.timestamp || entry.createdAt || 0);
        return (
          Number.isFinite(date.getTime()) &&
          date.getUTCFullYear() === now.getUTCFullYear() &&
          date.getUTCMonth() === now.getUTCMonth()
        );
      })
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const configuredMonthlyGoal = Number(process.env.DONATION_MONTHLY_GOAL);
    const monthlyGoal =
      Number.isFinite(configuredMonthlyGoal) && configuredMonthlyGoal > 0
        ? configuredMonthlyGoal
        : 1000;

    const recentDonations = donations
      .slice()
      .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || 0))
      .slice(0, 10)
      .map((entry) => ({
        id: entry.id,
        donorName: entry.donorName || 'Supporter',
        amount: entry.amount || 0,
        message: entry.message || '',
        timestamp: entry.timestamp || entry.createdAt
      }));

    const topDonors = donations
      .reduce((acc, entry) => {
        const name = entry.donorName || 'Supporter';
        acc[name] = (acc[name] || 0) + (entry.amount || 0);
        return acc;
      }, {});

    const topDonorList = Object.entries(topDonors)
      .map(([name, amount]) => ({
        id: name,
        name,
        totalAmount: amount,
        badge: amount >= 100 ? 'Gold' : amount >= 50 ? 'Silver' : 'Bronze'
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    res.json({
      totalDonations,
      totalAmount,
      monthlyGoal,
      monthlyProgress,
      topDonors: topDonorList,
      recentDonations
    });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/donations/record
router.post('/record', auth, roleMiddleware(['moderator', 'admin']), async (req, res) => {
  try {
    const { amount, message, platform, timestamp, donorName } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
      return res.status(400).json({ message: 'Invalid donation amount' });
    }

    let created;
    created = {
      id: uuidv4(),
      amount: numericAmount,
      currency: getDonationCurrency(),
      donorName: String(donorName || 'Supporter').trim().slice(0, 80) || 'Supporter',
      message: String(message || '').trim().slice(0, 500),
      platform: String(platform || 'manual').trim().slice(0, 50),
      timestamp: timestamp && Number.isFinite(new Date(timestamp).getTime())
        ? new Date(timestamp).toISOString()
        : new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await withDb(async (db) => {
      await donationsRepo.insert(created, { db });
      const actor = await usersRepo.findOne(
        (user) => (user.id || user._id) === req.user.id,
        { db }
      );
      await logModerationAction({
        db,
        actor: actor || req.user,
        action: 'donation.record',
        targetType: 'donation',
        targetId: created.id,
        details: {
          amount: created.amount,
          currency: created.currency,
          platform: created.platform
        }
      });
      return db;
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
