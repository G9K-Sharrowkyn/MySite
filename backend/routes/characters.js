import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import {
  getCharacters,
  searchCharacters,
  addCharacter,
  updateCharacter,
  suggestCharacter,
  deleteCharacter
} from '../controllers/characterController.js';
import auth from '../middleware/auth.js';
import authorize from '../middleware/roleMiddleware.js';

const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const characterUploadDir = path.resolve(__dirname, '..', 'uploads', 'characters');
fs.mkdirSync(characterUploadDir, { recursive: true });

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype || '').startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  }
});

const saveOptimizedImage = async (file, targetDir, { maxWidth, maxHeight, quality }) => {
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  const outputPath = path.join(targetDir, filename);

  await sharp(file.buffer)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality, mozjpeg: true })
    .toFile(outputPath);

  return filename;
};

// @route   GET api/characters
// @desc    Get all characters
// @access  Public
router.get('/', getCharacters);

// @route   GET api/characters/search?q=...
// @desc    Search characters by name/universe (public)
// @access  Public
router.get('/search', searchCharacters);

// @route   POST api/characters/upload
// @desc    Upload character image (admin/mod only)
// @access  Private (admin/moderator)
router.post(
  '/upload',
  auth,
  authorize(['moderator', 'admin']),
  imageUpload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ msg: 'No image uploaded' });
      }

      const filename = await saveOptimizedImage(req.file, characterUploadDir, {
        maxWidth: 1400,
        maxHeight: 1400,
        quality: 82
      });
      const imagePath = `/uploads/characters/${filename}`;
      return res.json({ path: imagePath });
    } catch (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ msg: 'Image must be 8 MB or smaller' });
      }
      if (error.message === 'Only image uploads are allowed') {
        return res.status(400).json({ msg: error.message });
      }
      console.error('Error uploading character image:', error);
      return res.status(500).json({ msg: 'Server error' });
    }
  }
);

// @route   POST api/characters
// @desc    Add a new character
// @access  Private (Moderator)
router.post('/', auth, authorize(['moderator', 'admin']), addCharacter);

// @route   PUT api/characters/:id
// @desc    Update character availability
// @access  Private (Moderator)
router.put('/:id', auth, authorize(['moderator', 'admin']), updateCharacter);

// @route   DELETE api/characters/:id
// @desc    Delete character (admin only, requires double-confirm payload)
// @access  Private (Admin)
router.delete('/:id', auth, authorize(['admin']), deleteCharacter);

// @route   POST api/characters/suggest
// @desc    Suggest a new character (User suggestion)
// @access  Private
router.post('/suggest', auth, suggestCharacter);

export default router;
