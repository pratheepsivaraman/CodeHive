import axios from 'axios';
import File from '../models/File.js';
import Project from '../models/Project.js';

const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.owner.toString() === userId.toString() || project.members.some(m => m.user.toString() === userId.toString());
};

// Helper for making GitHub API requests
const getGitHubHeaders = (token) => ({
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github.v3+json',
});

// @desc    Push project files to GitHub
// @route   POST /api/github/push
// @access  Private
export const pushToGitHub = async (req, res) => {
  const { projectId, repoUrl, token, commitMessage } = req.body; // repoUrl e.g. "username/repo"

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const files = await File.find({ projectId });
    if (files.length === 0) return res.status(400).json({ message: 'No files to push' });

    // 1. Get latest commit SHA from main branch
    const { data: refData } = await axios.get(`https://api.github.com/repos/${repoUrl}/git/refs/heads/main`, {
      headers: getGitHubHeaders(token)
    });
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree SHA for the latest commit
    const { data: commitData } = await axios.get(`https://api.github.com/repos/${repoUrl}/git/commits/${latestCommitSha}`, {
      headers: getGitHubHeaders(token)
    });
    const baseTreeSha = commitData.tree.sha;

    // 3. Create a blob for each file and build the tree array
    const tree = await Promise.all(files.map(async (file) => {
      // Remove leading slash if present
      const filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
      
      const { data: blobData } = await axios.post(`https://api.github.com/repos/${repoUrl}/git/blobs`, {
        content: file.content || '',
        encoding: 'utf-8'
      }, { headers: getGitHubHeaders(token) });

      return {
        path: filePath || file.name,
        mode: '100644', // File blob
        type: 'blob',
        sha: blobData.sha
      };
    }));

    // 4. Create new tree
    const { data: newTreeData } = await axios.post(`https://api.github.com/repos/${repoUrl}/git/trees`, {
      base_tree: baseTreeSha,
      tree: tree
    }, { headers: getGitHubHeaders(token) });

    // 5. Create new commit
    const { data: newCommitData } = await axios.post(`https://api.github.com/repos/${repoUrl}/git/commits`, {
      message: commitMessage || 'CodeHive Auto-Commit',
      tree: newTreeData.sha,
      parents: [latestCommitSha]
    }, { headers: getGitHubHeaders(token) });

    // 6. Update reference (push)
    await axios.patch(`https://api.github.com/repos/${repoUrl}/git/refs/heads/main`, {
      sha: newCommitData.sha
    }, { headers: getGitHubHeaders(token) });

    res.json({ message: 'Successfully pushed to GitHub', commitUrl: newCommitData.html_url });
  } catch (error) {
    console.error("GitHub Push Error:", error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || 'Failed to push to GitHub' });
  }
};

// @desc    Pull files from GitHub
// @route   POST /api/github/pull
// @access  Private
export const pullFromGitHub = async (req, res) => {
  const { projectId, repoUrl, token } = req.body;

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    // 1. Get the default branch (usually main)
    const { data: repoInfo } = await axios.get(`https://api.github.com/repos/${repoUrl}`, {
      headers: getGitHubHeaders(token)
    });
    const branch = repoInfo.default_branch;

    // 2. Fetch the git tree recursively
    const { data: treeData } = await axios.get(`https://api.github.com/repos/${repoUrl}/git/trees/${branch}?recursive=1`, {
      headers: getGitHubHeaders(token)
    });

    const fileNodes = treeData.tree.filter(node => node.type === 'blob');

    // 3. Delete existing CodeHive files (or we could update them, but for MVP, replacing is simpler/cleaner)
    await File.deleteMany({ projectId });

    // 4. Fetch content for each blob and create File records
    const newFiles = await Promise.all(fileNodes.map(async (node) => {
      // Get file content
      const { data: blobData } = await axios.get(node.url, {
        headers: getGitHubHeaders(token)
      });
      
      const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
      const filename = node.path.split('/').pop();
      const language = filename.split('.').pop() || 'text';

      const file = new File({
        projectId,
        name: filename,
        path: `/${node.path}`,
        content,
        language
      });
      return file.save();
    }));

    res.json({ message: 'Successfully pulled from GitHub', filesCount: newFiles.length });
  } catch (error) {
    console.error("GitHub Pull Error:", error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || 'Failed to pull from GitHub' });
  }
};
