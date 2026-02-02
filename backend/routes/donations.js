import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { donationsRepo } from '../repositories/index.js';

const router = express.Router();

// GET /api/donations/stats
router.get('/stats', async (_req, res) => {
  try {
    const donations = await donationsRepo.getAll();
    const totalAmount = donations.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const totalDonations = donations.length;

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
      monthlyGoal: 1000,
      monthlyProgress: totalAmount,
      topDonors: topDonorList,
      recentDonations
    });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/donations/record
router.post('/record', async (req, res) => {
  try {
    const { amount, message, platform, timestamp } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid donation amount' });
    }

    let created;
    created = {
      id: uuidv4(),
      amount: Number(amount),
      message: message || '',
      platform: platform || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await donationsRepo.insert(created);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
