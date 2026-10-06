import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Plus, Loader2, LogIn, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ProjectCard from '../components/ProjectCard';
import CreateProjectModal from '../components/CreateProjectModal';
import JoinProjectModal from '../components/JoinProjectModal';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await api.get('/api/projects');
      setProjects(data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectCreated = (newProject) => {
    setProjects([newProject, ...projects]);
  };

  const handleProjectJoined = (joinedProject) => {
    setProjects([joinedProject, ...projects]);
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await api.delete(`/api/projects/${projectId}`);
      setProjects(projects.filter(p => p._id !== projectId));
      toast.success('Project deleted');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  return (
    <div className="min-h-screen bg-background text-text relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-primary/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen opacity-50"></div>
      
      {/* Header */}
      <header className="border-b border-white/5 bg-surface/50 backdrop-blur-xl sticky top-0 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="p-2.5 bg-primary/20 rounded-xl border border-primary/30 group-hover:bg-primary/30 transition-colors">
              <img src="/logo.png" alt="CodeHive Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Code<span className="text-primary-light">Hive</span></h1>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm text-text-muted">Logged in as</span>
              <span className="text-sm font-semibold">{user?.username}</span>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
            <button 
              onClick={logout}
              className="text-sm px-5 py-2.5 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-6">
          <div>
            <h2 className="text-4xl font-bold mb-3 tracking-tight">Your Workspace</h2>
            <p className="text-text-muted text-lg">Continue where you left off or start something new.</p>
          </div>
          <div className="flex space-x-4 w-full sm:w-auto">
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-surface border border-white/10 hover:border-primary/50 hover:bg-surface-light text-text px-6 py-3 rounded-xl transition-all active:scale-95 group"
            >
              <LogIn size={20} className="text-primary group-hover:text-primary-light transition-colors" />
              <span className="font-medium">Join Project</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 group"
            >
              <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-medium">New Project</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-text-muted animate-pulse">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-6" />
            <p className="text-lg">Syncing your workspace...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="glass border border-white/10 border-dashed rounded-3xl p-16 text-center max-w-3xl mx-auto animate-slide-up relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-surface border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <Sparkles className="text-primary w-10 h-10" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">A blank canvas awaits</h3>
              <p className="text-text-muted mb-8 max-w-md mx-auto text-lg leading-relaxed">
                Create your first project to start writing code, inviting teammates, and building something amazing.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full sm:w-auto bg-white text-black font-semibold px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Create a new project
                </button>
                <button
                  onClick={() => setIsJoinModalOpen(true)}
                  className="w-full sm:w-auto text-text-muted hover:text-white font-medium px-8 py-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  Join via code
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-slide-up">
            {projects.map((project, index) => (
              <div key={project._id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fade-in">
                <ProjectCard 
                  project={project} 
                  currentUserId={user?._id}
                  onDelete={handleDeleteProject}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProjectCreated={handleProjectCreated}
      />
      <JoinProjectModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onProjectJoined={handleProjectJoined}
      />
    </div>
  );
};

export default DashboardPage;
