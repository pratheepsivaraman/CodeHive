import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import Project from '../models/Project.js';
import File from '../models/File.js';

const getWorkspacePath = (projectId) => path.join(process.cwd(), 'workspace', projectId.toString());

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.vscode', '.idea']);
const IGNORED_FILES = new Set(['.DS_Store', 'thumbs.db']);

const getLanguageByExtension = (filename) => {
  if (!filename) return 'text';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    md: 'markdown',
    txt: 'text',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    sql: 'sql',
  };
  return map[ext] || 'text';
};

// Sync disk files back into MongoDB File records (e.g. after git clone, mkdir, etc.)
export const syncDiskToDatabase = async (projectId) => {
  const projectDir = getWorkspacePath(projectId);
  if (!fs.existsSync(projectDir)) return 0;

  let count = 0;

  const traverse = async (currentDir, relativePath) => {
    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (_err) {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || IGNORED_FILES.has(entry.name)) {
        continue;
      }

      const fullEntryPath = path.join(currentDir, entry.name);
      const parentPath = relativePath === '' ? '/' : relativePath;

      if (entry.isDirectory()) {
        await File.findOneAndUpdate(
          { projectId, name: entry.name, path: parentPath, isFolder: true },
          { projectId, name: entry.name, path: parentPath, isFolder: true, language: 'text' },
          { upsert: true, returnDocument: 'after' }
        );
        count++;

        const childRelativePath = relativePath === '' ? `/${entry.name}` : `${relativePath}/${entry.name}`;
        await traverse(fullEntryPath, childRelativePath);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.promises.stat(fullEntryPath);
          if (stats.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

          let content = '';
          try {
            content = await fs.promises.readFile(fullEntryPath, 'utf-8');
          } catch (_readErr) {
            continue; // Skip binary non-utf8
          }

          const language = getLanguageByExtension(entry.name);
          await File.findOneAndUpdate(
            { projectId, name: entry.name, path: parentPath, isFolder: false },
            {
              projectId,
              name: entry.name,
              path: parentPath,
              content,
              language,
              isFolder: false,
            },
            { upsert: true, returnDocument: 'after' }
          );
          count++;
        } catch (_err) {
          // Ignore unreadable
        }
      }
    }
  };

  await traverse(projectDir, '');
  return count;
};

// Ensure workspace directory and all files are synced on disk
const ensureWorkspaceFiles = async (projectId) => {
  const projectDir = getWorkspacePath(projectId);
  await fs.promises.mkdir(projectDir, { recursive: true });

  const files = await File.find({ projectId });
  for (const file of files) {
    const parentPath = path.join(projectDir, file.path === '/' ? '' : file.path);
    if (file.isFolder) {
      await fs.promises.mkdir(path.join(parentPath, file.name), { recursive: true });
    } else {
      await fs.promises.mkdir(parentPath, { recursive: true });
      const filePath = path.join(parentPath, file.name);
      await fs.promises.writeFile(filePath, file.content || '');
    }
  }
  return projectDir;
};

// Check if user has access to project
const checkAccess = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return (
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.user.toString() === userId.toString())
  );
};

// @desc    Run code for a specific file or custom snippet
// @route   POST /api/execute/run
// @access  Private
export const runCode = async (req, res) => {
  const { projectId, fileId, code, language, filename } = req.body;

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized for this project' });

    const workspaceDir = await ensureWorkspaceFiles(projectId);

    // Determine target file
    let targetFileName = filename;
    let targetLang = language;

    if (fileId) {
      const fileRecord = await File.findById(fileId);
      if (fileRecord) {
        targetFileName = targetFileName || fileRecord.name;
        targetLang = targetLang || fileRecord.language;
        if (typeof code === 'string') {
          const filePath = path.join(
            workspaceDir,
            fileRecord.path === '/' ? '' : fileRecord.path,
            fileRecord.name
          );
          await fs.promises.writeFile(filePath, code);
        }
      }
    } else if (code && targetFileName) {
      const filePath = path.join(workspaceDir, targetFileName);
      await fs.promises.writeFile(filePath, code);
    }

    if (!targetFileName && !targetLang) {
      return res.status(400).json({ message: 'No file or language specified for execution' });
    }

    const ext = targetFileName ? targetFileName.split('.').pop().toLowerCase() : '';
    let command = '';

    if (ext === 'js' || targetLang === 'javascript') {
      command = `node "${targetFileName}"`;
    } else if (ext === 'py' || targetLang === 'python') {
      command = `python -u "${targetFileName}"`;
    } else if (ext === 'java' || targetLang === 'java') {
      command = `java "${targetFileName}"`;
    } else if (ext === 'ts' || targetLang === 'typescript') {
      command = `node "${targetFileName}"`;
    } else if (ext === 'html' || ext === 'htm') {
      return res.json({
        success: true,
        isWebPreview: true,
        message: 'HTML/Web file detected. Use the Live Web Preview tab to view rendered output.',
        stdout: `Serving "${targetFileName}" preview...\nOpen the "Preview" tab to inspect rendered DOM & styles.`,
        stderr: '',
        exitCode: 0,
        executionTimeMs: 1,
      });
    } else {
      return res.status(400).json({
        message: `Execution for file type ".${ext}" (${targetLang}) is not directly supported via CLI runner. Supported: JavaScript (.js), Python (.py), Java (.java), HTML preview.`,
      });
    }

    const startTime = Date.now();

    const safeEnv = {
      ...process.env,
      PATH: process.env.PATH,
      NODE_ENV: 'development',
    };
    delete safeEnv.MONGODB_URI;
    delete safeEnv.JWT_SECRET;
    delete safeEnv.GEMINI_API_KEY;

    exec(
      command,
      {
        cwd: workspaceDir,
        env: safeEnv,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;

        let errOutput = stderr || '';
        if (error && error.killed) {
          errOutput += '\n[Process terminated: Execution exceeded timeout of 15 seconds]';
        }

        res.json({
          success: !error,
          stdout: stdout || '',
          stderr: errOutput,
          exitCode,
          executionTimeMs,
          command,
        });
      }
    );
  } catch (error) {
    console.error('Error running code:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Run interactive command inside project workspace (supports git clone, npm, node, python, etc.)
// @route   POST /api/execute/command
// @access  Private
export const runCommand = async (req, res) => {
  const { projectId, command } = req.body;

  if (!command || !command.trim()) {
    return res.status(400).json({ message: 'Command is required' });
  }

  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized for this project' });

    const workspaceDir = await ensureWorkspaceFiles(projectId);

    const trimmed = command.trim();
    const disallowed = ['rmdir /s /q c:', 'format', 'shutdown', 'del /f /s /q c:'];
    if (disallowed.some((d) => trimmed.toLowerCase().includes(d))) {
      return res.status(400).json({ message: 'Disallowed system command' });
    }

    // Windows shell alias helpers
    let resolvedCmd = trimmed;
    if (process.platform === 'win32') {
      if (resolvedCmd === 'ls') resolvedCmd = 'dir /b';
      else if (resolvedCmd.startsWith('ls ')) resolvedCmd = 'dir ' + resolvedCmd.slice(3);
      else if (resolvedCmd.startsWith('cat ')) resolvedCmd = 'type ' + resolvedCmd.slice(4);
      else if (resolvedCmd === 'pwd') resolvedCmd = 'cd';
      else if (resolvedCmd === 'clear') {
        return res.json({
          success: true,
          stdout: '',
          stderr: '',
          exitCode: 0,
          executionTimeMs: 1,
          clear: true,
        });
      }
    }

    const startTime = Date.now();
    const safeEnv = {
      ...process.env,
      PATH: process.env.PATH,
      NODE_ENV: 'development',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: '',
    };
    delete safeEnv.MONGODB_URI;
    delete safeEnv.JWT_SECRET;
    delete safeEnv.GEMINI_API_KEY;

    // Give network-intensive commands (git clone, npm install) longer timeout (2 minutes)
    const isLongRunning =
      trimmed.startsWith('git ') ||
      trimmed.startsWith('npm ') ||
      trimmed.startsWith('npx ') ||
      trimmed.startsWith('yarn ');
    const timeoutMs = isLongRunning ? 120000 : 25000;

    exec(
      resolvedCmd,
      {
        cwd: workspaceDir,
        env: safeEnv,
        timeout: timeoutMs,
        maxBuffer: 2 * 1024 * 1024,
      },
      async (error, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;

        let errOutput = stderr || '';
        let stdOutput = stdout || '';

        if (error && error.killed) {
          errOutput += `\n[Process terminated: Execution exceeded timeout of ${Math.round(timeoutMs / 1000)}s]`;
        }

        // Git writes operational status to stderr by design.
        // If git finished with exit code 0, move the progress output into standard output so it's not marked as an error.
        if (trimmed.startsWith('git') && exitCode === 0) {
          if (errOutput) {
            stdOutput = (stdOutput ? stdOutput + '\n' : '') + errOutput;
            errOutput = '';
          }
        }

        // Sync files from disk to MongoDB so newly cloned/created files appear in File Explorer
        let importedCount = 0;
        if (exitCode === 0) {
          try {
            importedCount = await syncDiskToDatabase(projectId);
            if (
              importedCount > 0 &&
              (trimmed.startsWith('git clone') ||
                trimmed.startsWith('git pull') ||
                trimmed.startsWith('mkdir') ||
                trimmed.startsWith('touch') ||
                trimmed.startsWith('echo') ||
                trimmed.startsWith('npm'))
            ) {
              stdOutput =
                (stdOutput ? stdOutput + '\n' : '') +
                `[✓ Synchronized ${importedCount} files & folders with CodeHive workspace]`;
            }
          } catch (syncErr) {
            console.error('Error syncing disk files to DB after command:', syncErr);
          }
        }

        res.json({
          success: exitCode === 0,
          stdout: stdOutput,
          stderr: errOutput,
          exitCode,
          executionTimeMs,
          command: trimmed,
          filesUpdated: importedCount > 0,
          importedCount,
        });
      }
    );
  } catch (error) {
    console.error('Error running terminal command:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manually sync workspace files from disk into MongoDB
// @route   POST /api/execute/sync
// @access  Private
export const syncWorkspace = async (req, res) => {
  const { projectId } = req.body;
  try {
    const hasAccess = await checkAccess(projectId, req.user._id);
    if (!hasAccess) return res.status(403).json({ message: 'Not authorized for this project' });

    const count = await syncDiskToDatabase(projectId);
    res.json({ success: true, count });
  } catch (err) {
    console.error('Error syncing workspace:', err);
    res.status(500).json({ message: err.message });
  }
};
