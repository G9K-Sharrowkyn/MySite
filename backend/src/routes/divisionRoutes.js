const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getDivisions, createDivision, joinDivision } = require('../controllers/divisionController');

const router = express.Router();

router.get('/', getDivisions);
router.post('/', protect, createDivision);
router.post('/:id/join', protect, joinDivision);

module.exports = router;