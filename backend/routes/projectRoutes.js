import express from 'express';
import { createProject, getUserProjects, deleteProject, joinProject } from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createProject)
  .get(protect, getUserProjects);

router.route('/join')
  .post(protect, joinProject);

router.route('/:id')
  .delete(protect, deleteProject);

export default router;
