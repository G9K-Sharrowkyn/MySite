import express from 'express';
import axios from 'axios';

const router = express.Router();

// @route   POST /api/translate
// @desc    Translate text to English using MyMemory Translation API
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ msg: 'Text is required' });
    }

    console.log('Translation request for text:', text);

    // Use MyMemory Translation API (free, no API key required)
    // Detect language and translate to English
    const encodedText = encodeURIComponent(text);
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=autodetect|en`;
    
    const response = await axios.get(apiUrl, {
      timeout: 10000 // 10 second timeout
    });

    console.log('MyMemory response:', response.data);

    if (response.data && response.data.responseData && response.data.responseData.translatedText) {
      const translatedText = response.data.responseData.translatedText;
      const detectedLanguage = response.data.responseData.match || 'unknown';
      
      return res.json({ 
        translatedText: translatedText,
        detectedLanguage: detectedLanguage
      });
    }

    console.error('Unexpected response format:', response.data);
    return res.status(500).json({ msg: 'Translation failed - unexpected response format' });
    
  } catch (error) {
    console.error('Translation error:', error.message);
    console.error('Error response:', error.response?.data);
    
    // If translation service fails, return a fallback message
    return res.status(500).json({ 
      msg: 'Translation service unavailable',
      error: error.message 
    });
  }
});

export default router;
