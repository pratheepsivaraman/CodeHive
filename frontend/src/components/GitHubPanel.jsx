import { useState } from 'react';
import { GitBranch, DownloadCloud, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const GitHubPanel = ({ projectId, onPullComplete }) => {
  const [token, setToken] = useState(localStorage.getItem('github_pat') || '');
  const [repoUrl, setRepoUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [repoStatus, setRepoStatus] = useState(null); // { valid, name, defaultBranch }

  const handleTokenChange = (e) => {
    const val = e.target.value;
    setToken(val);
    localStorage.setItem('github_pat', val);
    setRepoStatus(null);
  };

  const handleVerify = async () => {
    if (!token.trim() || !repoUrl.trim()) {
      return toast.error('Both Token and Repository Path are required to verify');
    }

    setIsVerifying(true);
    try {
      const { data } = await api.post('/api/github/verify', {
        repoUrl: repoUrl.trim(),
        token: token.trim(),
      });
      setRepoStatus(data);
      toast.success(`Connected to ${data.name} (${data.defaultBranch})`);
    } catch (err) {
      setRepoStatus(null);
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePush = async (e) => {
    e.preventDefault();
    if (!token || !repoUrl) return toast.error('Token and Repo URL required');

    setIsPushing(true);
    try {
      const { data } = await api.post('/api/github/push', {
        projectId,
        repoUrl: repoUrl.trim(),
        token: token.trim(),
        commitMessage: commitMessage || 'Update from CodeHive',
      });
      toast.success(data.message);
      setCommitMessage('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Push failed');
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async (e) => {
    e.preventDefault();
    if (!token || !repoUrl) return toast.error('Token and Repo URL required');
    if (
      !window.confirm(
        'Pulling will overwrite all current files in this project with the GitHub repo contents. Continue?'
      )
    )
      return;

    setIsPulling(true);
    try {
      const { data } = await api.post('/api/github/pull', {
        projectId,
        repoUrl: repoUrl.trim(),
        token: token.trim(),
      });
      toast.success(data.message);
      if (onPullComplete) onPullComplete();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Pull failed');
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-white/5 flex items-center bg-black/10">
        <GitBranch size={18} className="text-primary-light mr-2" />
        <h3 className="font-semibold text-gray-200 text-sm tracking-wider uppercase">
          GitHub Sync
        </h3>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Personal Access Token (PAT)
          </label>
          <input
            type="password"
            value={token}
            onChange={handleTokenChange}
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors placeholder-gray-500 font-mono text-xs"
          />
          <p className="text-[10px] text-gray-500 mt-1">Requires 'repo' scope. Stored locally in your browser.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Repository Path (owner/repo)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setRepoStatus(null);
              }}
              placeholder="e.g. facebook/react"
              className="flex-1 bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors placeholder-gray-500"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || !token || !repoUrl}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-text text-xs rounded-lg font-medium transition-colors cursor-pointer"
            >
              {isVerifying ? 'Checking...' : 'Verify'}
            </button>
          </div>
        </div>

        {repoStatus && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center space-x-2.5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-emerald-300 truncate">
                {repoStatus.name}
              </p>
              <p className="text-[10px] text-emerald-400/80">
                Default branch: <span className="font-mono">{repoStatus.defaultBranch}</span>
              </p>
            </div>
          </div>
        )}

        <hr className="border-white/5" />

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Commit Message
          </label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Update from CodeHive"
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors mb-3 placeholder-gray-500"
          />
          <button
            onClick={handlePush}
            disabled={isPushing || isPulling || !token || !repoUrl}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg text-sm py-2.5 transition-colors flex items-center justify-center font-semibold shadow-lg shadow-primary/20 cursor-pointer"
          >
            <UploadCloud size={16} className="mr-2" />
            {isPushing ? 'Pushing to GitHub...' : 'Push to GitHub'}
          </button>
        </div>

        <hr className="border-white/5" />

        <div>
          <button
            onClick={handlePull}
            disabled={isPushing || isPulling || !token || !repoUrl}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-white rounded-lg text-sm py-2.5 transition-colors flex items-center justify-center font-semibold cursor-pointer"
          >
            <DownloadCloud size={16} className="mr-2" />
            {isPulling ? 'Pulling from GitHub...' : 'Pull from GitHub'}
          </button>
          <div className="flex items-center justify-center space-x-1 text-xs text-amber-400/90 text-center mt-2.5 font-medium">
            <AlertCircle size={12} />
            <span>Overwrites current project files with remote repo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubPanel;
