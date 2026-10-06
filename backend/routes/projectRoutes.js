import express from 'express';
import {
  createProject,
  getUserProjects,
  getProjectById,
  deleteProject,
  joinProject,
  removeMember,
  getProjectActivities,
} from '../controllers/projectController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createProject)
  .get(protect, getUserProjects);

router.route('/join')
  .post(protect, joinProject);

router.route('/:id')
  .get(protect, getProjectById)
  .delete(protect, deleteProject);

router.route('/:id/members/:memberId')
  .delete(protect, removeMember);

router.route('/:id/activities')
  .get(protect, getProjectActivities);

export default router;
