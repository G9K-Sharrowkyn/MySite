const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const postCtrl = require('../controllers/postController');

const router = express.Router();

router.get('/', postCtrl.getAllPosts);
router.get('/official', postCtrl.getOfficialFights);
router.get('/:id', postCtrl.getPostById);
router.post('/', protect, postCtrl.createPost);
router.post('/:id/like', protect, postCtrl.toggleLike);
router.post('/:id/fight-vote', protect, postCtrl.voteInFight);

module.exports = router;