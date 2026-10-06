import axios from 'axios';
import File from '../models/File.js';
import Project from '../models/Project.js';
import logActivity from '../utils/activityLogger.js';

const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return (
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.user.toString() === userId.toString())
  );
};

// Helper for making GitHub API requests
const getGitHubHeaders = (token) => ({
  Authorization: `token ${token.trim()}`,
  Accept: 'application/vnd.github.v3+json',
});

const formatRepoUrl = (repoUrl) => {
  let cleaned = repoUrl.trim();
  cleaned = cleaned.replace(/^https?:\/\/github\.com\//, '');
  cleaned = cleaned.replace(/\.git$/, '');
  return cleaned;
};

// @desc    Verify GitHub token & repository access
// @route   POST /api/github/verify
// @access  Private
export const verifyGitHubRepo = async (req, res) => {
  const { repoUrl, token } = req.body;

  if (!repoUrl || !token) {
    return res.status(400).json({ message: 'Repository path and token are required' });
  }

  const cleanedRepo = formatRepoUrl(repoUrl);

  try {
    const { data: repoInfo } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}`,
      { headers: getGitHubHeaders(token) }
    );

    res.json({
      valid: true,
      name: repoInfo.full_name,
      defaultBranch: repoInfo.default_branch,
      description: repoInfo.description,
      isPrivate: repoInfo.private,
    });
  } catch (error) {
    res.status(400).json({
      message: error.response?.data?.message || 'Invalid GitHub token or repository path',
    });
  }
};

// @desc    Push project files to GitHub
// @route   POST /api/github/push
// @access  Private
export const pushToGitHub = async (req, res) => {
  const { projectId, repoUrl, token, commitMessage } = req.body;

  if (!repoUrl || !token) {
    return res.status(400).json({ message: 'Repository URL and token are required' });
  }

  const cleanedRepo = formatRepoUrl(repoUrl);

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    const files = await File.find({ projectId, isFolder: false });
    if (files.length === 0) return res.status(400).json({ message: 'No files to push' });

    // 1. Get default branch
    const { data: repoInfo } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}`,
      { headers: getGitHubHeaders(token) }
    );
    const branch = repoInfo.default_branch || 'main';

    // 2. Get latest commit SHA from branch
    const { data: refData } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}/git/refs/heads/${branch}`,
      { headers: getGitHubHeaders(token) }
    );
    const latestCommitSha = refData.object.sha;

    // 3. Get the tree SHA for the latest commit
    const { data: commitData } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}/git/commits/${latestCommitSha}`,
      { headers: getGitHubHeaders(token) }
    );
    const baseTreeSha = commitData.tree.sha;

    // 4. Create blobs for each file
    const tree = await Promise.all(
      files.map(async (file) => {
        let filePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        if (filePath && !filePath.endsWith('/')) {
          filePath = `${filePath}/${file.name}`;
        } else if (filePath) {
          filePath = `${filePath}${file.name}`;
        } else {
          filePath = file.name;
        }

        const { data: blobData } = await axios.post(
          `https://api.github.com/repos/${cleanedRepo}/git/blobs`,
          {
            content: file.content || '',
            encoding: 'utf-8',
          },
          { headers: getGitHubHeaders(token) }
        );

        return {
          path: filePath,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      })
    );

    // 5. Create new tree
    const { data: newTreeData } = await axios.post(
      `https://api.github.com/repos/${cleanedRepo}/git/trees`,
      {
        base_tree: baseTreeSha,
        tree: tree,
      },
      { headers: getGitHubHeaders(token) }
    );

    // 6. Create new commit
    const { data: newCommitData } = await axios.post(
      `https://api.github.com/repos/${cleanedRepo}/git/commits`,
      {
        message: commitMessage || 'CodeHive Sync',
        tree: newTreeData.sha,
        parents: [latestCommitSha],
      },
      { headers: getGitHubHeaders(token) }
    );

    // 7. Update reference
    await axios.patch(
      `https://api.github.com/repos/${cleanedRepo}/git/refs/heads/${branch}`,
      {
        sha: newCommitData.sha,
      },
      { headers: getGitHubHeaders(token) }
    );

    // Log activity
    await logActivity(
      projectId,
      req.user._id,
      'github_pushed',
      `Pushed project to GitHub (${cleanedRepo})`
    );

    res.json({ message: 'Successfully pushed to GitHub', commitUrl: newCommitData.html_url });
  } catch (error) {
    console.error('GitHub Push Error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || 'Failed to push to GitHub' });
  }
};

// @desc    Pull files from GitHub
// @route   POST /api/github/pull
// @access  Private
export const pullFromGitHub = async (req, res) => {
  const { projectId, repoUrl, token } = req.body;

  if (!repoUrl || !token) {
    return res.status(400).json({ message: 'Repository URL and token are required' });
  }

  const cleanedRepo = formatRepoUrl(repoUrl);

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized' });

    // 1. Get default branch
    const { data: repoInfo } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}`,
      { headers: getGitHubHeaders(token) }
    );
    const branch = repoInfo.default_branch || 'main';

    // 2. Fetch git tree recursively
    const { data: treeData } = await axios.get(
      `https://api.github.com/repos/${cleanedRepo}/git/trees/${branch}?recursive=1`,
      { headers: getGitHubHeaders(token) }
    );

    const fileNodes = treeData.tree.filter((node) => node.type === 'blob');

    // 3. Delete existing CodeHive files
    await File.deleteMany({ projectId });

    // 4. Fetch content for each blob and create File records
    const newFiles = await Promise.all(
      fileNodes.map(async (node) => {
        const { data: blobData } = await axios.get(node.url, {
          headers: getGitHubHeaders(token),
        });

        const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
        const filename = node.path.split('/').pop();
        const segments = node.path.split('/');
        segments.pop();
        const parentPath = segments.length > 0 ? `/${segments.join('/')}` : '/';
        const language = filename.split('.').pop() || 'text';

        const file = new File({
          projectId,
          name: filename,
          path: parentPath,
          content,
          language,
          isFolder: false,
        });
        return file.save();
      })
    );

    // Log activity
    await logActivity(
      projectId,
      req.user._id,
      'github_pulled',
      `Pulled ${newFiles.length} files from GitHub (${cleanedRepo})`
    );

    res.json({ message: 'Successfully pulled from GitHub', filesCount: newFiles.length });
  } catch (error) {
    console.error('GitHub Pull Error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || 'Failed to pull from GitHub' });
  }
};
