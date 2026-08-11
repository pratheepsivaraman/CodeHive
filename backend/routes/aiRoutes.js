import express from 'express';
import { generateSuggestion } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/suggest', protect, generateSuggestion);

export default router;
