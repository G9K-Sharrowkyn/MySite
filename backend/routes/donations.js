import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  donationsRepo,
  usersRepo,
  withRepositoryTransaction
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
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const monthlyQuery = {
      $or: [
        { timestamp: { $gte: monthStart.toISOString(), $lt: nextMonth.toISOString() } },
        {
          timestamp: { $exists: false },
          createdAt: { $gte: monthStart.toISOString(), $lt: nextMonth.toISOString() }
        }
      ]
    };
    const [totalAmount, totalDonations, monthlyProgress, recentDonationsRaw, topDonorRows] =
      await Promise.all([
        donationsRepo.sumBy('amount'),
        donationsRepo.countBy({}),
        donationsRepo.sumBy('amount', monthlyQuery),
        donationsRepo.findManyBy({}, { sort: { timestamp: -1, createdAt: -1 }, limit: 10 }),
        donationsRepo.groupSumBy('donorName', 'amount')
      ]);
    const configuredMonthlyGoal = Number(process.env.DONATION_MONTHLY_GOAL);
    const monthlyGoal =
      Number.isFinite(configuredMonthlyGoal) && configuredMonthlyGoal > 0
        ? configuredMonthlyGoal
        : 1000;

    const recentDonations = recentDonationsRaw.map((entry) => ({
        id: entry.id,
        donorName: entry.donorName || 'Supporter',
        amount: entry.amount || 0,
        message: entry.message || '',
        timestamp: entry.timestamp || entry.createdAt
      }));

    const topDonorList = topDonorRows
      .slice(0, 5)
      .map(({ key: name, total: amount }) => ({
        id: name,
        name,
        totalAmount: amount,
        badge: amount >= 100 ? 'Gold' : amount >= 50 ? 'Silver' : 'Bronze'
      }));

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
    await withRepositoryTransaction(async (context) => {
      await donationsRepo.insert(created, context);
      const actor = await usersRepo.findById(req.user.id, context);
      await logModerationAction({
        db: context,
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
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
