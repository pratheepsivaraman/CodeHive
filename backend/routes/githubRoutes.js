import express from 'express';
import { pushToGitHub, pullFromGitHub } from '../controllers/githubController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/push', protect, pushToGitHub);
router.post('/pull', protect, pullFromGitHub);

export default router;
