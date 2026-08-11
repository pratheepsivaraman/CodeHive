import { useState, useEffect } from 'react';
import { History, GitCommit, CornerUpLeft } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const VersionHistory = ({ file, onRevert }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    const fetchVersions = async () => {
      if (!file) return;
      setLoading(true);
      try {
        const { data } = await api.get(`/api/files/${file._id}/versions`);
        setVersions(data);
      } catch (error) {
        toast.error('Failed to load version history');
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, [file]);

  const handleCommit = async (e) => {
    e.preventDefault();
    if (!message.trim() || !file) return;

    setIsCommitting(true);
    try {
      const { data } = await api.post(`/api/files/${file._id}/versions`, { message });
      setVersions([data, ...versions]); // Add new version to top
      setMessage('');
      toast.success('Version saved');
    } catch (error) {
      toast.error('Failed to save version');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRevert = async (version) => {
    if (!window.confirm(`Are you sure you want to revert to: "${version.message}"? This will overwrite the current file.`)) return;

    try {
      const { data } = await api.post(`/api/files/${file._id}/revert/${version._id}`);
      
      // We also fetch versions again to show the new "Reverted to..." commit
      const res = await api.get(`/api/files/${file._id}/versions`);
      setVersions(res.data);
      
      onRevert(data.content);
      toast.success('File reverted');
    } catch (error) {
      toast.error('Failed to revert file');
    }
  };

  if (!file) {
    return (
      <div className="w-full flex flex-col h-full items-center justify-center text-text-muted">
        <History size={48} className="mb-4 opacity-20" />
        <p>Select a file to view history</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center bg-black/10">
        <History size={18} className="text-gray-400 mr-2" />
        <h3 className="font-semibold text-gray-300 text-sm tracking-wider uppercase">History</h3>
      </div>
      
      {/* Commit Form */}
      <div className="p-4 border-b border-white/5 bg-black/20">
        <form onSubmit={handleCommit}>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors mb-3 placeholder-gray-500"
          />
          <button 
            type="submit" 
            disabled={!message.trim() || isCommitting}
            className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg text-sm py-2 transition-colors flex items-center justify-center font-semibold shadow-lg shadow-primary/20"
          >
            <GitCommit size={16} className="mr-2" />
            {isCommitting ? 'Saving...' : 'Commit Version'}
          </button>
        </form>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading history...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm italic">No versions saved yet.</div>
        ) : (
          <div className="p-4 space-y-4">
            {versions.map((v) => (
              <div key={v._id} className="relative pl-4 border-l-2 border-white/10 group pb-2">
                <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5 ring-4 ring-surface" />
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 group-hover:border-white/10 transition-colors">
                  <p className="text-sm text-gray-200 font-medium mb-1 break-words">{v.message}</p>
                  <div className="flex justify-between items-center text-xs text-text-muted mb-3">
                    <span>{v.createdBy?.username || 'Unknown'}</span>
                    <span>{new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <button
                    onClick={() => handleRevert(v)}
                    className="flex items-center text-xs text-primary-light hover:text-primary transition-colors"
                  >
                    <CornerUpLeft size={14} className="mr-1" />
                    Revert to this
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistory;
