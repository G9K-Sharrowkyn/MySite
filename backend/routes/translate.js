import express from 'express';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import auth from '../middleware/auth.js';

const router = express.Router();
const translationProvider = String(
  process.env.TRANSLATION_PROVIDER || 'disabled'
).trim().toLowerCase();
const translationEnabled = translationProvider === 'mymemory';
const translationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.TRANSLATION_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many translation requests. Please try again later.' }
});

router.get('/config', (_req, res) => {
  res.json({
    enabled: translationEnabled,
    provider: translationEnabled ? 'MyMemory' : null,
    privacyNotice: translationEnabled
      ? 'Only text you explicitly translate is sent to the external MyMemory service.'
      : null
  });
});

// @route   POST /api/translate
// @desc    Translate text to English using MyMemory Translation API
// @access  Private
router.post('/', translationLimiter, auth, async (req, res) => {
  try {
    if (!translationEnabled) {
      return res.status(503).json({ msg: 'Translation is not enabled.' });
    }

    const { text } = req.body;
    
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'Text is required' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ msg: 'Text is too long' });
    }

    // Use MyMemory Translation API (free, no API key required)
    // Detect language and translate to English
    const response = await axios.get('https://api.mymemory.translated.net/get', {
      params: { q: text.trim(), langpair: 'autodetect|en' },
      timeout: 10000,
      maxRedirects: 0,
      maxContentLength: 256 * 1024,
      maxBodyLength: 256 * 1024,
      proxy: false,
      headers: { accept: 'application/json' },
      validateStatus: (status) => status >= 200 && status < 300
    });

    if (response.data && response.data.responseData && response.data.responseData.translatedText) {
      const translatedText = response.data.responseData.translatedText;
      
      return res.json({ 
        translatedText
      });
    }

    return res.status(500).json({ msg: 'Translation failed - unexpected response format' });
    
  } catch (error) {
    console.error('Translation error:', error.message);
    return res.status(500).json({ 
      msg: 'Translation service unavailable'
    });
  }
});

export default router;
