const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const auth = require('../middleware/authMiddleware');

// Profile comments
router.get('/user/:userId', commentController.getProfileComments);
router.post('/user/:userId', auth, commentController.addProfileComment);

// Post comments
router.get('/post/:postId', commentController.getPostComments);
router.post('/post/:postId', auth, commentController.addPostComment);

// Fight comments
router.get('/fight/:fightId', commentController.getFightComments);
router.post('/fight/:fightId', auth, commentController.addFightComment);

module.exports = router;
