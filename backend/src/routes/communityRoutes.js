const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const communityCtrl = require('../controllers/communityController');

const router = express.Router();

router.get('/discussions', communityCtrl.getCommunityDiscussions);
router.post('/discussions', protect, communityCtrl.createCommunityDiscussion);
router.get('/hot-debates', communityCtrl.getHotDebates);
router.get('/character-rankings', communityCtrl.getCharacterRankings);
router.get('/polls', communityCtrl.getCommunityPolls);

module.exports = router;