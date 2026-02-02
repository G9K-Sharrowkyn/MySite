import express from 'express';
import ccgUserRoutes from '../ccg/routes/users.js';
import ccgGameRoutes from '../ccg/routes/game.js';

const router = express.Router();

router.use('/users', ccgUserRoutes);
router.use('/game', ccgGameRoutes);

export default router;
