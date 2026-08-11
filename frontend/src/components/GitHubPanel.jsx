import { useState } from 'react';
import { GitBranch, DownloadCloud, UploadCloud } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const GitHubPanel = ({ projectId, onPullComplete }) => {
  const [token, setToken] = useState(localStorage.getItem('github_pat') || '');
  const [repoUrl, setRepoUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const handleTokenChange = (e) => {
    const val = e.target.value;
    setToken(val);
    localStorage.setItem('github_pat', val);
  };

  const handlePush = async (e) => {
    e.preventDefault();
    if (!token || !repoUrl) return toast.error('Token and Repo URL required');
    
    setIsPushing(true);
    try {
      const { data } = await api.post('/api/github/push', {
        projectId,
        repoUrl,
        token,
        commitMessage: commitMessage || 'Update from CodeHive'
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
    if (!window.confirm('Pulling will overwrite all current files in this project. Continue?')) return;

    setIsPulling(true);
    try {
      const { data } = await api.post('/api/github/pull', {
        projectId,
        repoUrl,
        token
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
        <GitBranch size={18} className="text-gray-400 mr-2" />
        <h3 className="font-semibold text-gray-300 text-sm tracking-wider uppercase">GitHub Sync</h3>
      </div>
      
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Personal Access Token (PAT)</label>
          <input
            type="password"
            value={token}
            onChange={handleTokenChange}
            placeholder="ghp_xxxxxxxxxxxx"
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors placeholder-gray-500"
          />
          <p className="text-[10px] text-gray-500 mt-1">Requires 'repo' scope. Saved locally.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Repository Path</label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="username/repo-name"
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors placeholder-gray-500"
          />
        </div>
        
        <hr className="border-white/5" />

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Commit Message (Optional)</label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Update from CodeHive"
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors mb-4 placeholder-gray-500"
          />
          <button 
            onClick={handlePush}
            disabled={isPushing || isPulling}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg text-sm py-2 transition-colors flex items-center justify-center font-semibold shadow-lg shadow-primary/20"
          >
            <UploadCloud size={16} className="mr-2" />
            {isPushing ? 'Pushing...' : 'Push to GitHub'}
          </button>
        </div>

        <hr className="border-white/5" />

        <div>
          <button 
            onClick={handlePull}
            disabled={isPushing || isPulling}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-white rounded-lg text-sm py-2 transition-colors flex items-center justify-center font-semibold"
          >
            <DownloadCloud size={16} className="mr-2" />
            {isPulling ? 'Pulling...' : 'Pull from GitHub'}
          </button>
          <p className="text-xs text-red-400 text-center mt-3 opacity-80 font-medium">Warning: Overwrites current project files</p>
        </div>
      </div>
    </div>
  );
};

export default GitHubPanel;
