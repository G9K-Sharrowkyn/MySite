const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const commentCtrl = require('../controllers/commentController');

const router = express.Router();

router.post('/user/:userId', protect, commentCtrl.addUserComment);
router.post('/fight/:fightId', protect, commentCtrl.addFightComment);
router.post('/post/:postId', protect, commentCtrl.addPostComment);

router.get('/user/:userId', commentCtrl.getUserComments);
router.get('/fight/:fightId', commentCtrl.getFightComments);
router.get('/post/:postId', commentCtrl.getPostComments);

router.post('/:id/like', protect, commentCtrl.toggleCommentLike);
router.put('/:id', protect, commentCtrl.updateComment);
router.delete('/:id', protect, commentCtrl.deleteComment);

module.exports = router;