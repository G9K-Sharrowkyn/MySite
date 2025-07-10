const express = require('express');
const { getCharacters } = require('../controllers/characterController');

const router = express.Router();

router.get('/', getCharacters);

module.exports = router;