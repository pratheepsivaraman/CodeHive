import express from 'express';
import { runCode, runCommand, syncWorkspace } from '../controllers/executionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/run', protect, runCode);
router.post('/command', protect, runCommand);
router.post('/sync', protect, syncWorkspace);

export default router;
