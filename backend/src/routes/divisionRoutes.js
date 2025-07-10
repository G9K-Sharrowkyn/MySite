const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { 
  getDivisions, 
  createDivision, 
  joinDivision,
  getUserDivisions,
  getActiveFights,
  getDivisionStats,
  getDivisionChampion,
  leaveDivision
} = require('../controllers/divisionController');
const featureCtrl = require('../controllers/featureController');

const router = express.Router();

router.get('/', getDivisions);
router.get('/user', protect, getUserDivisions);
router.get('/active-fights', getActiveFights);
router.get('/power-tiers', featureCtrl.getPowerTiers);
router.get('/betting-fights', featureCtrl.getBettingFights);
router.get('/leaderboards', featureCtrl.getLeaderboards);
router.get('/championship-history', featureCtrl.getChampionshipHistory);
router.get('/:id/stats', getDivisionStats);
router.get('/:id/champion', getDivisionChampion);

router.post('/', protect, createDivision);
router.post('/join', protect, joinDivision);
router.post('/leave', protect, leaveDivision);
router.post('/register-team', protect, featureCtrl.registerTeam);
router.post('/create-fight', protect, featureCtrl.createDivisionFight);
router.post('/create-official-fight', protect, featureCtrl.createOfficialFight);

module.exports = router;