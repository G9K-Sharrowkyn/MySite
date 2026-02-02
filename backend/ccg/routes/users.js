import express from 'express';
import { getProfile, addToCollection, getAllCards, getWalletAndPacks, buyPack, openPack, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, setActiveDeck, awardXP, updateGameStats, craftCard, getAchievements } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, getProfile);
router.post('/collection', protect, addToCollection);
router.get('/cards', getAllCards);
router.get('/wallet', protect, getWalletAndPacks);
router.post('/buy-pack', protect, buyPack);
router.post('/open-pack', protect, openPack);
router.post('/decks', protect, createDeck);
router.delete('/decks/:name', protect, deleteDeck);
router.post('/decks/:deckName/add', protect, addCardToDeck);
router.post('/decks/:deckName/remove', protect, removeCardFromDeck);
router.post('/decks/active', protect, setActiveDeck);

// System XP i statystyk
router.post('/award-xp', protect, awardXP);
router.post('/update-game-stats', protect, updateGameStats);

// System craftingu
router.post('/craft-card', protect, craftCard);

// Osiągnięcia
router.get('/achievements', protect, getAchievements);

export default router;
