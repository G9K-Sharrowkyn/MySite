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

const router = express.Router();

router.get('/', getDivisions);
router.get('/user', protect, getUserDivisions);
router.get('/active-fights', getActiveFights);
router.get('/:id/stats', getDivisionStats);
router.get('/:id/champion', getDivisionChampion);

router.post('/', protect, createDivision);
router.post('/join', protect, joinDivision);
router.post('/leave', protect, leaveDivision);

module.exports = router;