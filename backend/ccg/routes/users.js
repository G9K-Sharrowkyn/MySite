import express from 'express';
import { getProfile, getAllCards, getWalletAndPacks, buyPack, openPack, createDeck, deleteDeck, addCardToDeck, removeCardFromDeck, setActiveDeck, craftCard, getAchievements } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/me', protect, getProfile);
router.get('/cards', getAllCards);
router.get('/wallet', protect, getWalletAndPacks);
router.post('/buy-pack', protect, buyPack);
router.post('/open-pack', protect, openPack);
router.post('/decks', protect, createDeck);
router.delete('/decks/:name', protect, deleteDeck);
router.post('/decks/:deckName/add', protect, addCardToDeck);
router.post('/decks/:deckName/remove', protect, removeCardFromDeck);
router.post('/decks/active', protect, setActiveDeck);

// System craftingu
router.post('/craft-card', protect, craftCard);

// Osiągnięcia
router.get('/achievements', protect, getAchievements);

export default router;
