import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { socket } from '../services/socket';
import {
  ArrowLeft,
  Users,
  Save,
  History,
  Mic,
  GitBranch,
  Sparkles,
  MicOff,
  Code2,
  Play,
  Terminal as TerminalIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FileExplorer from '../components/FileExplorer';
import CodeEditor from '../components/CodeEditor';
import TerminalPanel from '../components/TerminalPanel';
import VersionHistory from '../components/VersionHistory';
import VoiceChat from '../components/VoiceChat';
import GitHubPanel from '../components/GitHubPanel';
import AIPanel from '../components/AIPanel';
import ProjectMembersModal from '../components/ProjectMembersModal';

const WorkspacePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Sidebar panels
  const [showHistory, setShowHistory] = useState(false);
  const [showGithub, setShowGithub] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // VS Code Terminal & Output state
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalInitialTab, setTerminalInitialTab] = useState('output');
  const [monacoMarkers, setMonacoMarkers] = useState([]);

  // Fetch project and file list
  const fetchProjectAndFiles = useCallback(async () => {
    try {
      let projectData = null;
      try {
        const pRes = await api.get(`/api/projects/${id}`);
        projectData = pRes.data;
      } catch (_pErr) {
        const listRes = await api.get('/api/projects');
        projectData = listRes.data.find((p) => p._id === id);
      }

      if (!projectData) throw new Error('Project not found or access denied');

      const filesRes = await api.get(`/api/files/project/${id}`);

      setProject(projectData);
      setFiles(filesRes.data);

      // Auto-open first file if none open
      if (filesRes.data.length > 0 && !activeFile) {
        const firstFile = filesRes.data.find((f) => !f.isFolder) || filesRes.data[0];
        if (firstFile && !firstFile.isFolder) {
          setActiveFile(firstFile);
          setOpenFiles([firstFile]);
        }
      }

      // Reset active file if it was removed
      if (activeFile && !filesRes.data.find((f) => f._id === activeFile._id)) {
        setActiveFile(null);
        setOpenFiles((prev) => prev.filter((f) => f._id !== activeFile._id));
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
    if (!socket.connected) {
      socket.connect();
    }

    if (user) {
      socket.emit('join-project', { projectId: id, user });
    }

    const handleUsersUpdated = (users) => {
      setOnlineUsers(users);
    };

    socket.on('project-users-updated', handleUsersUpdated);

    return () => {
      socket.emit('leave-project', { projectId: id });
      socket.off('project-users-updated', handleUsersUpdated);
    };
  }, [id, user, fetchProjectAndFiles]);

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

  // Handle file selection from Explorer or Tabs
  const handleFileSelect = (selectedFile) => {
    if (selectedFile.isFolder) return;
    setActiveFile(selectedFile);
    setOpenFiles((prev) => {
      if (prev.some((f) => f._id === selectedFile._id)) return prev;
      return [...prev, selectedFile];
    });
  };

  // Close tab
  const handleTabClose = (closedFile) => {
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f._id !== closedFile._id);
      if (activeFile?._id === closedFile._id) {
        setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      }
      return remaining;
    });
  };

  const handleFileCreated = (newFile) => {
    setFiles((prev) => [...prev, newFile]);
    handleFileSelect(newFile);
  };

  const handleFileDeleted = (fileId) => {
    setFiles((prev) => prev.filter((f) => f._id !== fileId));
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f._id !== fileId);
      if (activeFile?._id === fileId) {
        setActiveFile(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      }
      return remaining;
    });
  };

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    setIsSaving(true);
    try {
      const { data } = await api.put(`/api/files/${activeFile._id}`, {
        content: fileContent,
      });
      // Update local file state
      setFiles((prev) =>
        prev.map((f) => (f._id === activeFile._id ? { ...f, content: data.content } : f))
      );
      setOpenFiles((prev) =>
        prev.map((f) => (f._id === activeFile._id ? { ...f, content: data.content } : f))
      );
      setActiveFile((prev) => (prev ? { ...prev, content: data.content } : prev));
      toast.success('File saved');
    } catch (_error) {
      toast.error('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, fileContent]);

  // Trigger code execution
  const handleRunCodeTrigger = useCallback(() => {
    setIsTerminalOpen(true);
    setTerminalInitialTab('output');
    if (typeof window.__codehive_run_code === 'function') {
      window.__codehive_run_code();
    }
  }, []);

  // Toggle terminal panel
  const handleToggleTerminal = useCallback((tab = 'terminal') => {
    setTerminalInitialTab(tab);
    setIsTerminalOpen((prev) => !prev);
  }, []);

  // Page level shortcuts: Ctrl+S (Save), Ctrl+Enter / F5 (Run), Ctrl+` (Terminal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCodeTrigger();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleRunCodeTrigger();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        handleToggleTerminal('terminal');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleRunCodeTrigger, handleToggleTerminal]);

  const handleRevertContent = (newContent) => {
    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(null); // Force CodeEditor unmount
    setTimeout(() => {
      setActiveFile(updatedFile); // Remount with updated content
      setFiles((prev) =>
        prev.map((f) => (f._id === updatedFile._id ? updatedFile : f))
      );
      setOpenFiles((prev) =>
        prev.map((f) => (f._id === updatedFile._id ? updatedFile : f))
      );
    }, 50);
  };

  const handleCreateFileFromEditor = async (ext) => {
    try {
      const { data } = await api.post(`/api/files/project/${id}`, {
        name: `Untitled.${ext}`,
        path: '/',
        language: ext === 'txt' || ext === 'csv' ? 'text' : ext,
        isFolder: false,
      });
      handleFileCreated(data);
      toast.success('Created new file');
    } catch (_error) {
      toast.error('Failed to create file');
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-text">
        <Code2 size={48} className="text-primary animate-pulse mb-4" />
        <p className="text-text-muted">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="h-14 bg-surface/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/')}
            className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-white/5 transition-all flex items-center justify-center cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center mr-1">
            <img
              src="/logo.png"
              alt="CodeHive Logo"
              className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-wide text-white">{project?.name}</span>
            <button
              onClick={() => setIsMembersModalOpen(true)}
              className="text-xs text-primary-light hover:text-primary flex items-center font-medium cursor-pointer transition-colors text-left"
              title="Click to view & manage project members"
            >
              <Users size={12} className="mr-1" />
              <span>{onlineUsers.length} Online</span>
              <span className="text-text-muted text-[10px] ml-1">
                ({project?.members?.length || 1} members)
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Member avatars */}
          <div
            onClick={() => setIsMembersModalOpen(true)}
            className="hidden sm:flex -space-x-2 mr-3 cursor-pointer hover:opacity-90 transition-opacity"
            title="Click to manage project members"
          >
            {onlineUsers.slice(0, 3).map((u) => {
              const activeFileName = u.activeFileId
                ? files.find((f) => f._id === u.activeFileId)?.name
                : null;
              return (
                <div
                  key={u.socketId}
                  title={`${u.username}${activeFileName ? ` - Editing: ${activeFileName}` : ''}`}
                  className={`relative w-8 h-8 rounded-full bg-primary-dark/30 border-2 ${
                    u.isSpeaking
                      ? 'border-green-500 animate-pulse ring-2 ring-green-500/50'
                      : 'border-surface'
                  } flex items-center justify-center text-xs font-bold text-white transition-all duration-300 z-10 hover:z-20 hover:-translate-y-0.5`}
                >
                  {u.username.charAt(0).toUpperCase()}
                  {u.isMuted && (
                    <div
                      className="absolute -bottom-1 -right-1 bg-surface rounded-full p-0.5 border border-white/10"
                      title="Muted"
                    >
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

          {/* VS Code Quick Run & Terminal Buttons */}
          <div className="flex items-center space-x-1.5 mr-1">
            <button
              onClick={handleRunCodeTrigger}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-green-900/30 cursor-pointer"
              title="Run Code in Terminal (Ctrl+Enter / F5)"
            >
              <Play size={14} fill="currentColor" />
              <span className="hidden md:inline">Run Code</span>
            </button>

            <button
              onClick={() => handleToggleTerminal('terminal')}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                isTerminalOpen
                  ? 'bg-primary/20 text-primary-light border border-primary/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'hover:bg-white/10 text-text-muted hover:text-white border border-white/5'
              }`}
              title="Toggle Terminal Panel (Ctrl+`)"
            >
              <TerminalIcon size={15} />
              <span className="hidden lg:inline text-xs font-medium">Terminal</span>
            </button>
          </div>

          {/* Toolbar Actions */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 bg-black/20 p-1 rounded-xl border border-white/5">
            {isVoiceActive ? (
              <VoiceChat
                onlineUsers={onlineUsers}
                onDisconnect={() => setIsVoiceActive(false)}
              />
            ) : (
              <button
                onClick={() => setIsVoiceActive(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 hover:bg-white/10 text-text-muted hover:text-white rounded-lg text-sm transition-all cursor-pointer"
                title="Join Voice Chat"
              >
                <Mic size={16} />
                <span className="hidden sm:inline font-medium">Voice</span>
              </button>
            )}

            <div className="w-px h-5 bg-white/10 hidden sm:block mx-1"></div>

            <button
              onClick={() => {
                setShowAI(!showAI);
                setShowHistory(false);
                setShowGithub(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium cursor-pointer ${
                showAI
                  ? 'bg-orange-500/20 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                  : 'hover:bg-white/10 text-text-muted hover:text-white'
              }`}
            >
              <Sparkles size={16} />
              <span className="hidden lg:inline">AI</span>
            </button>

            <button
              onClick={() => {
                setShowGithub(!showGithub);
                setShowHistory(false);
                setShowAI(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium cursor-pointer ${
                showGithub
                  ? 'bg-primary/20 text-primary-light shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'hover:bg-white/10 text-text-muted hover:text-white'
              }`}
            >
              <GitBranch size={16} />
              <span className="hidden lg:inline">GitHub</span>
            </button>

            <button
              onClick={() => {
                setShowHistory(!showHistory);
                setShowGithub(false);
                setShowAI(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm transition-all font-medium cursor-pointer ${
                showHistory
                  ? 'bg-primary/20 text-primary-light shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                  : 'hover:bg-white/10 text-text-muted hover:text-white'
              }`}
            >
              <History size={16} />
              <span className="hidden lg:inline">History</span>
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!activeFile || isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-dark disabled:bg-surface-lighter disabled:text-text-muted disabled:shadow-none text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/20 ml-1 cursor-pointer disabled:cursor-not-allowed"
            title="Save File (Ctrl+S)"
          >
            <Save size={16} />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: File Explorer */}
        <FileExplorer
          projectId={id}
          projectName={project?.name}
          files={files}
          activeFile={activeFile}
          onFileSelect={handleFileSelect}
          onFileCreated={handleFileCreated}
          onFileDeleted={handleFileDeleted}
          onSyncFiles={fetchProjectAndFiles}
        />

        {/* Editor & Integrated Terminal Area */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative overflow-hidden shadow-[-10px_0_20px_rgba(0,0,0,0.5)] z-10">
          <div className="flex-1 overflow-hidden relative flex flex-col">
            <CodeEditor
              projectId={id}
              projectName={project?.name}
              file={activeFile}
              value={fileContent}
              openFiles={openFiles}
              onTabSelect={handleFileSelect}
              onTabClose={handleTabClose}
              onChange={(value) => setFileContent(value)}
              onSave={handleSave}
              onFileCreate={handleCreateFileFromEditor}
              onRunCode={handleRunCodeTrigger}
              onToggleTerminal={handleToggleTerminal}
              isTerminalOpen={isTerminalOpen}
              isSaving={isSaving}
              monacoMarkers={monacoMarkers}
              setMonacoMarkers={setMonacoMarkers}
            />
          </div>

          {/* Integrated VS Code Terminal / Output Panel */}
          <TerminalPanel
            projectId={id}
            activeFile={activeFile}
            fileContent={fileContent}
            files={files}
            isOpen={isTerminalOpen}
            onClose={() => setIsTerminalOpen(false)}
            initialTab={terminalInitialTab}
            monacoMarkers={monacoMarkers}
            onFilesUpdated={fetchProjectAndFiles}
          />
        </div>

        {/* Right Sidebars */}
        {showHistory && (
          <div className="w-80 sm:w-96 border-l border-white/5 bg-surface/95 backdrop-blur-xl z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.3)] animate-fade-in flex flex-col">
            <VersionHistory
              projectId={id}
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
            <AIPanel activeFile={activeFile} />
          </div>
        )}
      </div>

      {/* Project Members & Invite Modal */}
      <ProjectMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        project={project}
        currentUserId={user?._id}
        onlineUsers={onlineUsers}
        onMemberRemoved={(updatedProject) => setProject(updatedProject)}
        onLeaveProject={() => navigate('/')}
      />
    </div>
  );
};

export default WorkspacePage;
