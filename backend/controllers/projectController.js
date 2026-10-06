import Project from '../models/Project.js';
import File from '../models/File.js';
import Version from '../models/Version.js';
import Activity from '../models/Activity.js';
import logActivity from '../utils/activityLogger.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Helper to check if a user is an owner or member
const checkUserProjectAccess = (project, userId) => {
  if (!project) return false;
  const isOwner = project.owner.toString() === userId.toString();
  const isMember = project.members.some(
    (m) => m.user?._id?.toString() === userId.toString() || m.user?.toString() === userId.toString()
  );
  return isOwner || isMember;
};

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
export const createProject = async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Project name is required' });
  }

  try {
    const joinCode = crypto.randomBytes(4).toString('hex');
    const project = new Project({
      name: name.trim(),
      description: description ? description.trim() : '',
      joinCode,
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'Leader' }],
    });

    const createdProject = await project.save();

    await logActivity(
      createdProject._id,
      req.user._id,
      'project_created',
      `Created project "${createdProject.name}"`
    );

    const populatedProject = await Project.findById(createdProject._id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    res.status(201).json(populatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a specific project by ID
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!checkUserProjectAccess(project, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to access this project' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join a project using a join code
// @route   POST /api/projects/join
// @access  Private
export const joinProject = async (req, res) => {
  const { joinCode } = req.body;

  if (!joinCode || !joinCode.trim()) {
    return res.status(400).json({ message: 'Join code is required' });
  }

  try {
    const project = await Project.findOne({ joinCode: joinCode.trim() });

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

    await logActivity(
      project._id,
      req.user._id,
      'member_joined',
      `${req.user.username} joined the project`
    );

    const updatedProject = await Project.findById(project._id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove a member from a project or leave project
// @route   DELETE /api/projects/:id/members/:memberId
// @access  Private
export const removeMember = async (req, res) => {
  const { id: projectId, memberId } = req.params;

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    const isSelf = memberId === req.user._id.toString();

    // Only owner or the member themselves can remove
    if (!isOwner && !isSelf) {
      return res.status(403).json({ message: 'Not authorized to remove members' });
    }

    // Owner cannot be removed
    if (project.owner.toString() === memberId) {
      return res.status(400).json({ message: 'The project owner cannot be removed' });
    }

    const memberIndex = project.members.findIndex(
      (m) => m.user.toString() === memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in project' });
    }

    project.members.splice(memberIndex, 1);
    await project.save();

    await logActivity(
      project._id,
      req.user._id,
      'member_removed',
      isSelf ? `${req.user.username} left the project` : `Removed member from project`
    );

    const updatedProject = await Project.findById(project._id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    res.json(updatedProject);
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

// @desc    Get activities/history for a project
// @route   GET /api/projects/:id/activities
// @access  Private
export const getProjectActivities = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!checkUserProjectAccess(project, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const activities = await Activity.find({ projectId: req.params.id })
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(60);

    res.json(activities);
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
    await Activity.deleteMany({ projectId: req.params.id });
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
