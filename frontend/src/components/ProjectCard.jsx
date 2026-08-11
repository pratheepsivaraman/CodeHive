import { FolderGit2, Trash2, Copy, Check, Users, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';

const ProjectCard = ({ project, onDelete, currentUserId }) => {
  const isOwner = project.owner?._id === currentUserId || project.owner === currentUserId;
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(project.joinCode);
    setCopied(true);
    toast.success('Join code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      onClick={() => navigate(`/project/${project._id}`)}
      className="glass-panel rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 group cursor-pointer flex flex-col h-full relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[50px] -mr-10 -mt-10 pointer-events-none group-hover:bg-primary/20 transition-colors"></div>
      
      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="p-3 bg-white/5 rounded-xl text-primary border border-white/5 group-hover:bg-primary/10 transition-colors">
          <FolderGit2 size={24} />
        </div>
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project._id);
            }}
            className="text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2 rounded-lg hover:bg-white/5"
            title="Delete Project"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-primary-light transition-colors relative z-10">{project.name}</h3>
      <p className="text-text-muted text-sm mb-6 flex-grow line-clamp-2 relative z-10 leading-relaxed">
        {project.description || 'No description provided.'}
      </p>

      {project.joinCode && (
        <div 
          onClick={handleCopyCode}
          className="flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 mb-5 hover:border-primary/50 transition-colors group/code relative z-10"
          title="Click to copy join code"
        >
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">Join Code</span>
            <span className="text-sm font-mono text-white mt-0.5">{project.joinCode}</span>
          </div>
          <button className="text-text-muted group-hover/code:text-primary transition-colors p-1.5 rounded-md hover:bg-white/5">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-center text-xs text-text-muted mt-auto pt-4 border-t border-white/10 relative z-10">
        <span className="flex items-center bg-white/5 px-2 py-1 rounded-md">
          <Users size={12} className="mr-1.5" />
          {project.members?.length || 1} Member(s)
        </span>
        <span className="flex items-center">
          <Clock size={12} className="mr-1.5 opacity-70" />
          {new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
};

export default ProjectCard;
