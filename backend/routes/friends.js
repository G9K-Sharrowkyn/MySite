import express from 'express';
import auth from '../middleware/auth.js';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendStatus,
  listFriendRequests,
  listFriends,
  listFriendsForUser,
  removeFriend,
  sendFriendRequest
} from '../controllers/friendsController.js';

const router = express.Router();

router.get('/', auth, listFriends);
router.get('/user/:userId', listFriendsForUser);
router.get('/status/:userId', auth, getFriendStatus);
router.get('/requests', auth, listFriendRequests);
router.post('/requests', auth, sendFriendRequest);
router.post('/requests/:id/accept', auth, acceptFriendRequest);
router.post('/requests/:id/decline', auth, declineFriendRequest);
router.delete('/:userId', auth, removeFriend);

export default router;
