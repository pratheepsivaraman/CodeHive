import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { X, LogIn } from 'lucide-react';

const JoinProjectModal = ({ isOpen, onClose, onProjectJoined }) => {
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/api/projects/join', { joinCode });
      toast.success('Joined project successfully!');
      onProjectJoined(data);
      setJoinCode('');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to join project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-gray-700 overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-text flex items-center space-x-2">
            <LogIn size={24} className="text-primary" />
            <span>Join a Project</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Code</label>
            <input
              type="text"
              required
              placeholder="Enter the join code"
              className="w-full px-4 py-3 bg-background border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-2">Ask the project owner for the join code.</p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !joinCode}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Joining...' : 'Join Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinProjectModal;
