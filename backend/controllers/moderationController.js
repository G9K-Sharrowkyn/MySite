import { feedbackRepo, moderatorActionLogsRepo } from '../repositories/index.js';

const isStaff = (user) => user?.role === 'admin' || user?.role === 'moderator';

export const getModerationLogs = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { limit = 200 } = req.query;
    const limitNumber = Math.max(1, Math.min(Number(limit) || 200, 1000));
    const logs = await moderatorActionLogsRepo.getAll();
    const sorted = [...logs]
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
      .slice(0, limitNumber);

    res.json(sorted);
  } catch (error) {
    console.error('Error fetching moderation logs:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

export const getReportsQueue = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const feedback = await feedbackRepo.getAll();
    const sorted = [...feedback].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const counts = sorted.reduce(
      (acc, item) => {
        const status = item?.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { pending: 0, reviewed: 0, resolved: 0, dismissed: 0, approved: 0 }
    );

    const queue = sorted.filter((entry) =>
      ['pending', 'reviewed'].includes(entry?.status)
    );

    res.json({ counts, queue, total: sorted.length });
  } catch (error) {
    console.error('Error fetching reports queue:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

