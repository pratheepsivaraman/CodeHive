import File from '../models/File.js';
import Project from '../models/Project.js';
import Version from '../models/Version.js';
import fs from 'fs';
import path from 'path';

// Helper for local file system sync
const getWorkspacePath = (projectId) => path.join(process.cwd(), 'workspace', projectId.toString());

const syncFileToDisk = async (projectId, file) => {
  try {
    const projectDir = getWorkspacePath(projectId);
    const parentPath = path.join(projectDir, file.path === '/' ? '' : file.path);
    
    if (file.isFolder) {
      const folderPath = path.join(parentPath, file.name);
      await fs.promises.mkdir(folderPath, { recursive: true });
    } else {
      await fs.promises.mkdir(parentPath, { recursive: true });
      const filePath = path.join(parentPath, file.name);
      await fs.promises.writeFile(filePath, file.content || '');
    }
  } catch (error) {
    console.error('Error syncing file to disk:', error);
  }
};

const deleteFileFromDisk = async (projectId, file) => {
  try {
    const projectDir = getWorkspacePath(projectId);
    const targetPath = path.join(projectDir, file.path === '/' ? '' : file.path, file.name);
    await fs.promises.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error deleting file from disk:', error);
  }
};

// Helper to check access
const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.owner.toString() === userId.toString() || project.members.some(m => m.user.toString() === userId.toString());
};

// ... existing endpoints

// @desc    Get all files for a project
// @route   GET /api/projects/:projectId/files
// @access  Private
export const getProjectFiles = async (req, res) => {
  try {
    const hasAccess = await checkAccess(req.params.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const files = await File.find({ projectId: req.params.projectId }).sort({ name: 1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a file in a project
// @route   POST /api/projects/:projectId/files
// @access  Private
export const createFile = async (req, res) => {
  const { name, path, language, isFolder, content } = req.body;
  
  try {
    const hasAccess = await checkAccess(req.params.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const file = new File({
      projectId: req.params.projectId,
      name,
      path: path || '/',
      language: language || 'javascript',
      isFolder: isFolder || false,
      content: content || '',
    });

    const createdFile = await file.save();
    
    // Sync to disk
    await syncFileToDisk(req.params.projectId, createdFile);
    
    res.status(201).json(createdFile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update file content
// @route   PUT /api/files/:id
// @access  Private
export const updateFileContent = async (req, res) => {
  const { content } = req.body;

  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkAccess(file.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    file.content = content;
    const updatedFile = await file.save();
    
    // Sync update to disk
    await syncFileToDisk(file.projectId, updatedFile);

    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a file
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkAccess(file.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    await File.deleteOne({ _id: req.params.id });
    
    // Delete from disk
    await deleteFileFromDisk(file.projectId, file);

    res.json({ message: 'File removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- VERSION ENDPOINTS ---

// @desc    Create a version snapshot
// @route   POST /api/files/:id/versions
// @access  Private
export const createFileVersion = async (req, res) => {
  const { message } = req.body;

  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkAccess(file.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const version = new Version({
      fileId: file._id,
      content: file.content,
      message: message || 'Update file',
      createdBy: req.user._id,
    });

    const savedVersion = await version.save();
    res.status(201).json(savedVersion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get file versions
// @route   GET /api/files/:id/versions
// @access  Private
export const getFileVersions = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkAccess(file.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const versions = await Version.find({ fileId: file._id })
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
      
    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Revert to a specific version
// @route   POST /api/files/:id/revert/:versionId
// @access  Private
export const revertFileVersion = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    const hasAccess = await checkAccess(file.projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const version = await Version.findById(req.params.versionId);
    if (!version || version.fileId.toString() !== file._id.toString()) {
      return res.status(404).json({ message: 'Version not found' });
    }

    file.content = version.content;
    const updatedFile = await file.save();

    // Sync revert to disk
    await syncFileToDisk(file.projectId, updatedFile);

    // Optionally create a new version denoting the revert
    const newVersion = new Version({
      fileId: file._id,
      content: file.content,
      message: `Reverted to ${version.message}`,
      createdBy: req.user._id,
    });
    await newVersion.save();

    res.json(updatedFile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
