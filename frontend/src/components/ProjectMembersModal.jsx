import { useState } from 'react';
import { X, Users, Copy, Check, Shield, UserMinus, LogOut } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ProjectMembersModal = ({
  isOpen,
  onClose,
  project,
  currentUserId,
  onlineUsers = [],
  onMemberRemoved,
  onLeaveProject,
}) => {
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  if (!isOpen || !project) return null;

  const isOwner =
    project.owner?._id === currentUserId || project.owner === currentUserId;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(project.joinCode);
    setCopied(true);
    toast.success('Join code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (memberUserId, memberUsername) => {
    if (
      !window.confirm(
        `Are you sure you want to remove ${memberUsername || 'this user'} from the project?`
      )
    )
      return;

    setRemovingId(memberUserId);
    try {
      const { data } = await api.delete(
        `/api/projects/${project._id}/members/${memberUserId}`
      );
      toast.success('Member removed');
      if (onMemberRemoved) onMemberRemoved(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleLeaveProject = async () => {
    if (
      !window.confirm(
        'Are you sure you want to leave this project? You will need the join code to return.'
      )
    )
      return;

    try {
      await api.delete(
        `/api/projects/${project._id}/members/${currentUserId}`
      );
      toast.success('You left the project');
      if (onLeaveProject) onLeaveProject();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave project');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/20 text-primary rounded-xl">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Project Members</h3>
              <p className="text-xs text-text-muted">{project.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Join Code Card */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                Shareable Join Code
              </span>
              <p className="font-mono text-base font-bold text-white tracking-widest mt-0.5">
                {project.joinCode}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary-light border border-primary/30 rounded-lg text-xs font-semibold transition-colors"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Members List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                Active Roster ({project.members?.length || 1})
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                {onlineUsers.length} Currently Online
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {project.members?.map((member) => {
                const memberUser = member.user || {};
                const memberUserId = memberUser._id || memberUser;
                const isMemberOwner =
                  memberUserId === (project.owner?._id || project.owner);
                const isCurrent = memberUserId === currentUserId;
                const isOnline = onlineUsers.some(
                  (u) => u.userId === memberUserId
                );

                return (
                  <div
                    key={memberUserId}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-white text-sm">
                          {memberUser.username
                            ? memberUser.username.charAt(0).toUpperCase()
                            : 'U'}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface ${
                            isOnline ? 'bg-green-500' : 'bg-gray-500'
                          }`}
                          title={isOnline ? 'Online now' : 'Offline'}
                        />
                      </div>

                      <div className="overflow-hidden">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {memberUser.username || 'User'}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-white/10 text-text-muted px-1.5 py-0.5 rounded font-medium">
                              You
                            </span>
                          )}
                          {isMemberOwner && (
                            <span className="flex items-center text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-medium">
                              <Shield size={10} className="mr-1" />
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">
                          {memberUser.email || ''}
                        </p>
                      </div>
                    </div>

                    <div>
                      {isOwner && !isMemberOwner && (
                        <button
                          onClick={() =>
                            handleRemoveMember(
                              memberUserId,
                              memberUser.username
                            )
                          }
                          disabled={removingId === memberUserId}
                          className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove from project"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-owner action: Leave Project */}
          {!isOwner && (
            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                onClick={handleLeaveProject}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-sm font-medium transition-colors"
              >
                <LogOut size={16} />
                <span>Leave Project</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectMembersModal;
