import express from 'express';
import { 
  getProjectFiles, 
  createFile, 
  updateFileContent, 
  deleteFile,
  createFileVersion,
  getFileVersions,
  revertFileVersion
} from '../controllers/fileController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Project-level file routes (handled by passing projectId as a query param or mounting differently)
// Actually, it's cleaner to mount the project-specific ones in projectRoutes, but let's handle them here with explicit paths.

router.route('/project/:projectId')
  .get(protect, getProjectFiles)
  .post(protect, createFile);

router.route('/:id')
  .put(protect, updateFileContent)
  .delete(protect, deleteFile);

// Version routes
router.route('/:id/versions')
  .get(protect, getFileVersions)
  .post(protect, createFileVersion);

router.route('/:id/revert/:versionId')
  .post(protect, revertFileVersion);

export default router;
