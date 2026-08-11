import Project from '../models/Project.js';
import File from '../models/File.js';
import Version from '../models/Version.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req, res) => {
  const { name, description } = req.body;

  try {
    const joinCode = crypto.randomBytes(4).toString('hex');
    const project = new Project({
      name,
      description,
      joinCode,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'Leader' }],
    });

    const createdProject = await project.save();
    res.status(201).json(createdProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a project using a join code
// @route   POST /api/projects/join
// @access  Private
export const joinProject = async (req, res) => {
  const { joinCode } = req.body;

  if (!joinCode) {
    return res.status(400).json({ message: 'Join code is required' });
  }

  try {
    const project = await Project.findOne({ joinCode });

    if (!project) {
      return res.status(404).json({ message: 'Project not found with this code' });
    }

    const isMember = project.members.some(
      (member) => member.user.toString() === req.user._id.toString()
    );

    if (isMember) {
      return res.status(400).json({ message: 'You are already a member of this project' });
    }

    project.members.push({ user: req.user._id, role: 'Member' });
    await project.save();

    const updatedProject = await Project.findById(project._id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all projects for a user
// @route   GET /api/projects
// @access  Private
export const getUserProjects = async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
    })
      .populate('owner', 'username email')
      .populate('members.user', 'username email')
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    const files = await File.find({ projectId: req.params.id });
    const fileIds = files.map(file => file._id);

    await Version.deleteMany({ fileId: { $in: fileIds } });
    await File.deleteMany({ projectId: req.params.id });
    await Project.deleteOne({ _id: req.params.id });
    
    // Cleanup local workspace
    try {
      const workspaceDir = path.join(process.cwd(), 'workspace', req.params.id.toString());
      await fs.promises.rm(workspaceDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Error cleaning up workspace:', err);
    }
    
    res.json({ message: 'Project removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
