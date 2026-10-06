import { useState, useEffect, useCallback } from 'react';
import { History, GitCommit, CornerUpLeft, Activity, Clock, User as UserIcon } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const VersionHistory = ({ projectId, file, onRevert }) => {
  const [activeTab, setActiveTab] = useState('project'); // 'project' or 'file'
  const [versions, setVersions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  // Fetch file versions
  const fetchVersions = useCallback(async () => {
    if (!file) {
      setVersions([]);
      return;
    }
    setLoadingVersions(true);
    try {
      const { data } = await api.get(`/api/files/${file._id}/versions`);
      setVersions(data);
    } catch (_err) {
      toast.error('Failed to load file versions');
    } finally {
      setLoadingVersions(false);
    }
  }, [file]);

  // Fetch project activity history
  const fetchActivities = useCallback(async () => {
    if (!projectId) return;
    setLoadingActivities(true);
    try {
      const { data } = await api.get(`/api/projects/${projectId}/activities`);
      setActivities(data);
    } catch (_err) {
      toast.error('Failed to load project activity');
    } finally {
      setLoadingActivities(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (file) {
      fetchVersions();
    } else {
      setActiveTab('project');
    }
  }, [file, fetchVersions]);

  const handleCommit = async (e) => {
    e.preventDefault();
    if (!message.trim() || !file) return;

    setIsCommitting(true);
    try {
      const { data } = await api.post(`/api/files/${file._id}/versions`, { message });
      setVersions([data, ...versions]);
      setMessage('');
      toast.success('Version saved');
      fetchActivities(); // Refresh project activities
    } catch (_err) {
      toast.error('Failed to save version');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRevert = async (version) => {
    if (
      !window.confirm(
        `Are you sure you want to revert to: "${version.message}"? This will overwrite the current file.`
      )
    )
      return;

    try {
      const { data } = await api.post(`/api/files/${file._id}/revert/${version._id}`);
      const res = await api.get(`/api/files/${file._id}/versions`);
      setVersions(res.data);
      onRevert(data.content);
      toast.success('File reverted');
      fetchActivities(); // Refresh activities
    } catch (_err) {
      toast.error('Failed to revert file');
    }
  };

  const formatActionBadge = (action) => {
    switch (action) {
      case 'project_created':
        return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Created</span>;
      case 'member_joined':
        return <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Joined</span>;
      case 'member_removed':
        return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Member</span>;
      case 'file_created':
        return <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">File Added</span>;
      case 'file_saved':
        return <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Saved</span>;
      case 'file_deleted':
        return <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Deleted</span>;
      case 'version_saved':
        return <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Snapshot</span>;
      case 'version_reverted':
        return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Reverted</span>;
      case 'github_pushed':
      case 'github_pulled':
        return <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">GitHub</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded text-[10px] font-mono font-medium">Log</span>;
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
        <div className="flex items-center">
          <History size={18} className="text-primary-light mr-2" />
          <h3 className="font-semibold text-gray-200 text-sm tracking-wider uppercase">History</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-black/20 text-xs">
        <button
          onClick={() => setActiveTab('project')}
          className={`flex-1 py-2.5 text-center font-medium transition-colors border-b-2 flex items-center justify-center space-x-1.5 ${
            activeTab === 'project'
              ? 'border-primary text-primary-light bg-white/5'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <Activity size={14} />
          <span>Project Activity</span>
        </button>
        <button
          onClick={() => setActiveTab('file')}
          disabled={!file}
          className={`flex-1 py-2.5 text-center font-medium transition-colors border-b-2 flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'file'
              ? 'border-primary text-primary-light bg-white/5'
              : 'border-transparent text-text-muted hover:text-white'
          }`}
        >
          <GitCommit size={14} />
          <span>File Snapshots {file ? `(${file.name})` : ''}</span>
        </button>
      </div>

      {/* Tab 1: Project Activity Feed */}
      {activeTab === 'project' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingActivities ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading activity...</div>
          ) : activities.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm italic">
              No project activity recorded yet.
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act._id}
                className="bg-black/20 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  {formatActionBadge(act.action)}
                  <div className="flex items-center text-[10px] text-text-muted">
                    <Clock size={10} className="mr-1" />
                    <span>
                      {new Date(act.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-200 font-medium mb-1.5 break-words">
                  {act.details}
                </p>
                <div className="flex items-center text-[11px] text-text-muted">
                  <UserIcon size={11} className="mr-1 text-primary-light/70" />
                  <span>{act.user?.username || 'Team member'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: File Snapshots / Versions */}
      {activeTab === 'file' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Commit Form */}
          <div className="p-4 border-b border-white/5 bg-black/20">
            <form onSubmit={handleCommit}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Snapshot message for ${file?.name}...`}
                className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors mb-3 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={!message.trim() || isCommitting}
                className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg text-sm py-2 transition-colors flex items-center justify-center font-semibold shadow-lg shadow-primary/20"
              >
                <GitCommit size={16} className="mr-2" />
                {isCommitting ? 'Saving Snapshot...' : 'Create Snapshot'}
              </button>
            </form>
          </div>

          {/* Versions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingVersions ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading snapshots...</div>
            ) : versions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm italic">
                No versions saved for this file yet.
              </div>
            ) : (
              versions.map((v) => (
                <div key={v._id} className="relative pl-4 border-l-2 border-white/10 group pb-2">
                  <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5 ring-4 ring-surface" />
                  <div className="bg-black/20 rounded-xl p-3 border border-white/5 group-hover:border-white/10 transition-colors">
                    <p className="text-sm text-gray-200 font-medium mb-1 break-words">{v.message}</p>
                    <div className="flex justify-between items-center text-xs text-text-muted mb-3">
                      <span>{v.createdBy?.username || 'Unknown'}</span>
                      <span>
                        {new Date(v.createdAt).toLocaleDateString()}{' '}
                        {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRevert(v)}
                      className="flex items-center text-xs text-primary-light hover:text-primary transition-colors cursor-pointer"
                    >
                      <CornerUpLeft size={14} className="mr-1" />
                      Revert to this snapshot
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
