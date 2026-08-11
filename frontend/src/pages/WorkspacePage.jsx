import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { socket } from '../services/socket';
import { ArrowLeft, Users, Save, History, Mic, GitBranch, Sparkles, MicOff, Code2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import VersionHistory from '../components/VersionHistory';
import VoiceChat from '../components/VoiceChat';
import GitHubPanel from '../components/GitHubPanel';
import AIPanel from '../components/AIPanel';

const WorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Function to reload files
  const fetchProjectAndFiles = useCallback(async () => {
    try {
      const [projectRes, filesRes] = await Promise.all([
        api.get(`/api/projects`),
        api.get(`/api/files/project/${id}`)
      ]);
      
      const currentProject = projectRes.data.find(p => p._id === id);
      if (!currentProject) throw new Error('Project not found');
      
      setProject(currentProject);
      setFiles(filesRes.data);
      // Reset active file if it was deleted by a pull
      if (activeFile && !filesRes.data.find(f => f._id === activeFile._id)) {
        setActiveFile(null);
      }
    } catch (_error) {
      toast.error('Failed to load workspace');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, activeFile, navigate]);

  useEffect(() => {
    fetchProjectAndFiles();

    // Socket Setup
    socket.connect();
    if (user) {
      socket.emit('join-project', { projectId: id, user });
    }

    socket.on('project-users-updated', (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.emit('leave-project', { projectId: id });
      socket.off('project-users-updated');
      socket.disconnect();
    };
  }, [id, navigate, user, fetchProjectAndFiles]);

  // When active file changes, load its content into state
  useEffect(() => {
    if (activeFile) {
      setFileContent(activeFile.content || '');
      socket.emit('active-file-change', { projectId: id, fileId: activeFile._id });
    } else {
      setFileContent('');
      socket.emit('active-file-change', { projectId: id, fileId: null });
    }
  }, [activeFile, id]);

  const handleFileCreated = (newFile) => {
    setFiles([...files, newFile]);
    setActiveFile(newFile);
  };

  const handleFileDeleted = (fileId) => {
    setFiles(files.filter(f => f._id !== fileId));
    if (activeFile?._id === fileId) {
      setActiveFile(null);
    }
  };

  const handleSave = async () => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      const { data } = await api.put(`/api/files/${activeFile._id}`, {
        content: fileContent
      });
      // Update local file state
      setFiles(files.map(f => f._id === activeFile._id ? { ...f, content: data.content } : f));
      setActiveFile({ ...activeFile, content: data.content });
      toast.success('File saved');
    } catch (_error) {
      toast.error('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertContent = (newContent) => {
    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(null); // Force CodeEditor unmount
    setTimeout(() => {
      setActiveFile(updatedFile); // Force CodeEditor mount with new content
      setFiles(files.map(f => f._id === updatedFile._id ? updatedFile : f));
    }, 50);
  };

  const handleCreateFileFromEditor = async (ext) => {
    try {
      const { data } = await api.post(`/api/files/project/${id}`, {
        name: `Untitled.${ext}`,
        path: '/',
        language: ext === 'txt' || ext === 'csv' ? 'text' : ext,
        isFolder: false
      });
      handleFileCreated(data);
      toast.success(`Created new file`);
    } catch (_error) {
      toast.error('Failed to create file');
    }
  };

  if (loading) {
    return <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text">
       <Code2 size={48} className="text-primary animate-pulse mb-4" />
       <p className="text-text-muted">Loading Workspace...</p>
    </div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 bg-surface/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')}
            className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all flex items-center justify-center"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center ml-2 mr-3">
            <img src="/logo.png" alt="CodeHive Logo" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide">{project?.name}</span>
            <span className="text-xs text-primary-light flex items-center font-medium">
              <Users size={12} className="mr-1" /> {onlineUsers.length} Online
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden sm:flex -space-x-2 mr-4">
            {onlineUsers.slice(0, 3).map((u) => {
              const activeFileName = u.activeFileId ? files.find(f => f._id === u.activeFileId)?.name : null;
              return (
                <div 
                  key={u.socketId}
                  title={`${u.username}${activeFileName ? ` - Viewing: ${activeFileName}` : ''}`}
                  className={`relative w-8 h-8 rounded-full bg-primary-dark/30 border-2 ${u.isSpeaking ? 'border-green-500 animate-pulse ring-2 ring-green-500/50' : 'border-surface'} flex items-center justify-center text-xs font-bold text-white transition-all duration-300 z-10 hover:z-20 hover:-translate-y-1`}
                >
                  {u.username.charAt(0).toUpperCase()}
                  {u.isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-white/10" title="Muted">
                      <MicOff size={10} className="text-red-400" />
                    </div>
                  )}
                </div>
              );
            })}
            {onlineUsers.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-surface-lighter border-2 border-surface flex items-center justify-center text-xs font-bold text-text-muted z-0">
                +{onlineUsers.length - 3}
              </div>
            )}
          </div>
          
          {/* Toolbar Actions */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {isVoiceActive ? (
              <VoiceChat 
                onlineUsers={onlineUsers} 
                onDisconnect={() => setIsVoiceActive(false)} 
              />
            ) : (
              <button 
                onClick={() => setIsVoiceActive(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-white/10 text-text-muted hover:text-white rounded-lg text-sm transition-all"
                title="Join Voice Chat"
              >
                <Mic size={16} />
                <span className="hidden sm:inline font-medium">Voice</span>
              </button>
            )}

            <div className="w-px h-5 bg-white/10 hidden sm:block mx-1"></div>

            <button 
              onClick={() => { setShowAI(!showAI); setShowHistory(false); setShowGithub(false); }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium ${showAI ? 'bg-orange-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'hover:bg-white/10 text-text-muted hover:text-white'}`}
            >
              <Sparkles size={16} />
              <span className="hidden lg:inline">AI Assistant</span>
            </button>

            <button 
              onClick={() => {
                setShowGithub(!showGithub);
                if (showHistory) setShowHistory(false);
                if (showAI) setShowAI(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium ${showGithub ? 'bg-primary/20 text-primary-light shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'hover:bg-white/10 text-text-muted hover:text-white'}`}
            >
              <GitBranch size={16} />
              <span className="hidden lg:inline">GitHub</span>
            </button>

            <button 
              onClick={() => {
                setShowHistory(!showHistory);
                if (showGithub) setShowGithub(false);
                if (showAI) setShowAI(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium ${showHistory ? 'bg-primary/20 text-primary-light shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'hover:bg-white/10 text-text-muted hover:text-white'}`}
            >
              <History size={16} />
              <span className="hidden lg:inline">History</span>
            </button>
          </div>

          <button 
            onClick={handleSave}
            disabled={!activeFile || isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-surface-lighter disabled:text-text-muted disabled:shadow-none text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20 ml-2"
          >
            <Save size={16} />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <FileExplorer 
          projectId={id}
          projectName={project?.name}
          files={files}
          activeFile={activeFile}
          onFileSelect={setActiveFile}
          onFileCreated={handleFileCreated}
          onFileDeleted={handleFileDeleted}
        />

        {/* Editor Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative overflow-hidden shadow-[-10px_0_20px_rgba(0,0,0,0.5)] z-10">
          {activeFile ? (
            <CodeEditor 
              projectId={id}
              file={activeFile} 
              value={fileContent} 
              onChange={(value) => setFileContent(value)} 
              onFileCreate={handleCreateFileFromEditor}
            />
          ) : (
            <CodeEditor 
              projectId={id}
              file={null} 
              value={''} 
              onChange={() => {}} 
              onFileCreate={handleCreateFileFromEditor}
            />
          )}
        </div>

        {/* Right Sidebars (Mutually Exclusive for cleaner UI) */}
        {showHistory && (
          <div className="w-80 sm:w-96 border-l border-white/5 bg-surface/95 backdrop-blur-xl z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] animate-fade-in flex flex-col">
             <VersionHistory 
              file={activeFile} 
              onRevert={handleRevertContent} 
             />
          </div>
        )}

        {showGithub && (
           <div className="w-80 sm:w-96 border-l border-white/5 bg-surface/95 backdrop-blur-xl z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] animate-fade-in flex flex-col">
             <GitHubPanel 
              projectId={id}
              onPullComplete={fetchProjectAndFiles}
             />
          </div>
        )}

        {showAI && (
           <div className="w-80 sm:w-96 border-l border-white/5 bg-surface/95 backdrop-blur-xl z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] animate-fade-in flex flex-col">
             <AIPanel 
              activeFile={activeFile}
             />
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspacePage;
