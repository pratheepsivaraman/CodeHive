import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socket } from '../services/socket';
import { Awareness } from 'y-protocols/awareness';
import * as awarenessProtocol from 'y-protocols/awareness';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  Play,
  Terminal as TerminalIcon,
  RotateCcw,
  Sparkles,
  AlignLeft,
  Map,
  WrapText,
  X,
  FileCode,
  FileText,
  Braces,
  Hash,
  Globe,
  GitBranch,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Code2,
} from 'lucide-react';

const stringToColor = (str) => {
  if (!str) return '#4f46e5';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs(Math.sin(hash) * 16777215) % 16777215).toString(16);
  return '#' + '000000'.substring(0, 6 - color.length) + color;
};

const toUint8Array = (data) => {
  if (!data) return new Uint8Array();
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  if (typeof data === 'object') return new Uint8Array(Object.values(data));
  return new Uint8Array();
};

const getFileBadge = (filename) => {
  if (!filename) return { label: 'TXT', color: 'text-gray-400', bg: 'bg-gray-400/10' };
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return { label: 'JS', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    case 'ts':
    case 'tsx':
      return { label: 'TS', color: 'text-blue-400', bg: 'bg-blue-400/10' };
    case 'py':
      return { label: 'PY', color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    case 'java':
      return { label: 'JAVA', color: 'text-amber-500', bg: 'bg-amber-500/10' };
    case 'html':
    case 'htm':
      return { label: 'HTML', color: 'text-orange-400', bg: 'bg-orange-400/10' };
    case 'css':
      return { label: 'CSS', color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
    case 'json':
      return { label: '{ }', color: 'text-yellow-300', bg: 'bg-yellow-300/10' };
    case 'md':
      return { label: 'MD', color: 'text-indigo-400', bg: 'bg-indigo-400/10' };
    case 'cpp':
    case 'c':
      return { label: 'C++', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    default:
      return { label: 'DOC', color: 'text-gray-400', bg: 'bg-gray-400/10' };
  }
};

const CodeEditor = ({
  projectId,
  projectName,
  file,
  value,
  openFiles = [],
  onTabSelect,
  onTabClose,
  onChange,
  onSave,
  onFileCreate,
  onRunCode,
  onToggleTerminal,
  isTerminalOpen = false,
  isSaving = false,
  monacoMarkers = [],
  setMonacoMarkers,
}) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const awarenessRef = useRef(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef(null);

  // VS Code settings states
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [isMinimapEnabled, setIsMinimapEnabled] = useState(true);
  const [isWordWrap, setIsWordWrap] = useState(true);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLanguage = (filename) => {
    if (!filename) return 'plaintext';
    const ext = filename.split('.').pop().toLowerCase();

    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      htm: 'html',
      css: 'css',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
    };

    return languageMap[ext] || 'plaintext';
  };

  const language = getLanguage(file?.name);

  const setupYjs = useCallback(() => {
    if (!editorRef.current || !file) return;

    // Cleanup previous bindings
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (awarenessRef.current) {
      awarenessRef.current.destroy();
      awarenessRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }

    // 1. Create a new Y document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 2. Get the shared text type
    const ytext = ydoc.getText('monaco');

    // 3. Setup Awareness
    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;

    awareness.setLocalStateField('user', {
      name: user?.username || 'Anonymous',
      color: stringToColor(user?.username || 'Anonymous'),
    });

    // 4. Bind Yjs to Monaco
    const model = editorRef.current.getModel();
    if (model) {
      const binding = new MonacoBinding(
        ytext,
        model,
        new Set([editorRef.current]),
        awareness
      );
      bindingRef.current = binding;
    }

    // Populate initial value if document is empty
    const initialText = file.content !== undefined ? file.content : (value || '');
    if (ytext.toString() === '' && initialText) {
      ytext.insert(0, initialText);
    }

    // 5. Join the file room on the socket
    socket.emit('join-file', { projectId, fileId: file._id });

    // 6. Listen to local Yjs changes and broadcast them to Socket.IO
    const handleYdocUpdate = (update) => {
      socket.emit('yjs-update', { projectId, fileId: file._id, update: Array.from(update) });
    };
    ydoc.on('update', handleYdocUpdate);

    // 7. Listen to local awareness updates and broadcast them
    const handleAwarenessUpdate = ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      socket.emit('yjs-awareness-update', { projectId, fileId: file._id, update: Array.from(update) });
    };
    awareness.on('update', handleAwarenessUpdate);

    // 8. Listen to incoming Yjs updates from network
    const handleRemoteUpdate = ({ fileId, update }) => {
      if (fileId === file._id && ydocRef.current) {
        const updateArray = toUint8Array(update);
        if (updateArray.length > 0) {
          Y.applyUpdate(ydocRef.current, updateArray, 'remote');
        }
      }
    };

    // 9. Listen to incoming awareness updates
    const handleRemoteAwareness = ({ fileId, update }) => {
      if (fileId === file._id && awarenessRef.current) {
        const updateArray = toUint8Array(update);
        if (updateArray.length > 0) {
          awarenessProtocol.applyAwarenessUpdate(awarenessRef.current, updateArray, 'remote');
        }
      }
    };

    // 10. Initial sync handshake
    const handleSyncRequest = ({ fileId: reqFileId, requesterSocketId }) => {
      if (reqFileId === file._id && ydocRef.current) {
        const state = Y.encodeStateAsUpdate(ydocRef.current);
        socket.emit('yjs-sync-response', {
          targetSocketId: requesterSocketId,
          fileId: file._id,
          state: Array.from(state),
        });
      }
    };

    const handleSyncResponse = ({ fileId: respFileId, state }) => {
      if (respFileId === file._id && ydocRef.current && state) {
        const stateArray = toUint8Array(state);
        if (stateArray.length > 0) {
          Y.applyUpdate(ydocRef.current, stateArray, 'sync-response');
        }
      }
    };

    socket.on('yjs-update', handleRemoteUpdate);
    socket.on('yjs-awareness-update', handleRemoteAwareness);
    socket.on('yjs-sync-request', handleSyncRequest);
    socket.on('yjs-sync-response', handleSyncResponse);

    // Keep React state in sync
    const handleTextObserve = () => {
      if (onChange) {
        onChange(ytext.toString());
      }
    };
    ytext.observe(handleTextObserve);

    return () => {
      socket.emit('leave-file', { projectId, fileId: file._id });
      socket.off('yjs-update', handleRemoteUpdate);
      socket.off('yjs-awareness-update', handleRemoteAwareness);
      socket.off('yjs-sync-request', handleSyncRequest);
      socket.off('yjs-sync-response', handleSyncResponse);
      ydoc.off('update', handleYdocUpdate);
      awareness.off('update', handleAwarenessUpdate);
      ytext.unobserve(handleTextObserve);
      if (bindingRef.current) bindingRef.current.destroy();
      if (awarenessRef.current) awarenessRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
    };
  }, [file, projectId, user, value, onChange]);

  // Setup Monaco options and keybindings
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Track cursor position for VS Code status bar
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Track markers (diagnostics / syntax errors)
    if (setMonacoMarkers) {
      monaco.editor.onDidChangeMarkers(() => {
        const model = editor.getModel();
        if (model) {
          const markers = monaco.editor.getModelMarkers({ resource: model.uri });
          setMonacoMarkers(markers);
        }
      });
    }

    // Ctrl+S / Cmd+S save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) onSave();
    });

    // Ctrl+Enter or F5: Run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRunCode) onRunCode();
    });
    editor.addCommand(monaco.KeyCode.F5, () => {
      if (onRunCode) onRunCode();
    });

    // Ctrl+` (backquote): Toggle terminal
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote, () => {
      if (onToggleTerminal) onToggleTerminal();
    });

    setupYjs();
  };

  // Re-run setup if file changes
  useEffect(() => {
    let cleanup;
    if (editorRef.current && file) {
      cleanup = setupYjs();
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [file, setupYjs]);

  // Format active document
  const handleFormatDocument = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e] overflow-hidden select-none">
      <style>{`
        .yRemoteSelection {
          background-color: var(--yjs-color, rgba(255, 165, 0, 0.2));
        }
        .yRemoteSelectionHead {
          position: absolute;
          border-left: 2px solid var(--yjs-color, orange);
          border-top: 2px solid var(--yjs-color, orange);
          border-bottom: 2px solid var(--yjs-color, orange);
          height: 100%;
          box-sizing: border-box;
        }
        .yRemoteSelectionHead::after {
          position: absolute;
          content: attr(data-client-name);
          background-color: var(--yjs-color, orange);
          color: white;
          font-size: 11px;
          padding: 1px 4px;
          border-radius: 0 4px 4px 4px;
          top: -16px;
          left: -2px;
          white-space: nowrap;
          z-index: 10;
          font-family: sans-serif;
          pointer-events: none;
        }
      `}</style>

      {/* 1. VS CODE MULTI-TAB BAR */}
      <div className="h-10 bg-[#181818] border-b border-white/5 flex items-center justify-between overflow-x-auto overflow-y-hidden scrollbar-none flex-shrink-0 z-10 px-1">
        <div className="flex items-center space-x-0.5 h-full overflow-x-auto scrollbar-none">
          {openFiles.length > 0 ? (
            openFiles.map((tabFile) => {
              const isActive = tabFile._id === file?._id;
              const badge = getFileBadge(tabFile.name);
              return (
                <div
                  key={tabFile._id}
                  onClick={() => onTabSelect && onTabSelect(tabFile)}
                  className={`group h-full flex items-center space-x-2 px-3 text-xs font-medium cursor-pointer border-r border-white/5 transition-all select-none ${
                    isActive
                      ? 'bg-[#1e1e1e] text-white border-t-2 border-t-primary shadow-[0_-2px_10px_rgba(59,130,246,0.15)]'
                      : 'bg-[#141414] text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'
                  }`}
                  title={tabFile.name}
                >
                  <span
                    className={`text-[10px] font-bold px-1 py-0.5 rounded ${badge.color} ${badge.bg}`}
                  >
                    {badge.label}
                  </span>
                  <span className="truncate max-w-[120px]">{tabFile.name}</span>

                  {/* Close tab button */}
                  {onTabClose && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tabFile);
                      }}
                      className="p-0.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer opacity-40 group-hover:opacity-100"
                      title="Close Tab"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center space-x-2 px-4 text-xs text-gray-400">
              <Code2 size={14} className="text-primary" />
              <span>No Files Open</span>
            </div>
          )}

          {/* "+ New File" dropdown menu */}
          <div className="relative ml-1" ref={menuRef}>
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
              title="New File..."
            >
              <Plus size={14} />
            </button>

            {showNewMenu && (
              <div className="absolute left-0 mt-1 w-48 bg-[#1f1f1f] border border-white/10 rounded-lg shadow-2xl py-1 text-xs text-text z-50 animate-fade-in font-sans">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 tracking-wider uppercase border-b border-white/5">
                  Create File
                </div>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('js');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <span className="text-yellow-400 font-bold mr-2 text-xs">JS</span> JavaScript
                </button>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('py');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <span className="text-emerald-400 font-bold mr-2 text-xs">PY</span> Python
                </button>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('html');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <span className="text-orange-400 font-bold mr-2 text-xs">&lt;&gt;</span> HTML5
                </button>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('css');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <span className="text-cyan-400 font-bold mr-2 text-xs">#</span> CSS3
                </button>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('java');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <span className="text-amber-500 font-bold mr-2 text-xs">☕</span> Java
                </button>
                <button
                  onClick={() => {
                    if (onFileCreate) onFileCreate('json');
                    setShowNewMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center transition-colors cursor-pointer"
                >
                  <Braces size={13} className="text-yellow-300 mr-2" /> JSON
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. EDITOR ACTION TOOLBAR */}
        <div className="flex items-center space-x-1.5 px-2 text-gray-400 flex-shrink-0">
          {/* Prominent RUN CODE button */}
          <button
            onClick={() => onRunCode && onRunCode()}
            className="flex items-center space-x-1 px-2.5 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs font-semibold shadow-md shadow-green-900/30 transition-all cursor-pointer mr-1"
            title="Run Code (Ctrl+Enter / F5)"
          >
            <Play size={12} fill="currentColor" />
            <span className="hidden sm:inline">Run</span>
          </button>

          {/* Toggle Terminal button */}
          <button
            onClick={() => onToggleTerminal && onToggleTerminal()}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isTerminalOpen
                ? 'bg-primary/20 text-primary-light shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                : 'hover:bg-white/10 hover:text-white'
            }`}
            title="Toggle Integrated Terminal (Ctrl+`)"
          >
            <TerminalIcon size={14} />
          </button>

          {/* Format Document */}
          <button
            onClick={handleFormatDocument}
            className="p-1.5 hover:bg-white/10 hover:text-white rounded transition-colors cursor-pointer"
            title="Format Document"
          >
            <AlignLeft size={14} />
          </button>

          {/* Toggle Word Wrap */}
          <button
            onClick={() => setIsWordWrap(!isWordWrap)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isWordWrap ? 'text-primary-light bg-primary/10' : 'hover:bg-white/10 hover:text-white'
            }`}
            title={isWordWrap ? 'Disable Word Wrap' : 'Enable Word Wrap'}
          >
            <WrapText size={14} />
          </button>

          {/* Toggle Minimap */}
          <button
            onClick={() => setIsMinimapEnabled(!isMinimapEnabled)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isMinimapEnabled ? 'text-primary-light bg-primary/10' : 'hover:bg-white/10 hover:text-white'
            }`}
            title={isMinimapEnabled ? 'Hide Minimap' : 'Show Minimap'}
          >
            <Map size={14} />
          </button>
        </div>
      </div>

      {/* 3. BREADCRUMBS BAR */}
      <div className="h-6 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 text-[11px] text-gray-400 space-x-1 select-none flex-shrink-0">
        <span className="hover:text-gray-200 cursor-pointer">{projectName || 'CodeHive Workspace'}</span>
        <ChevronRight size={12} className="text-gray-600" />
        <span className="hover:text-gray-200 cursor-pointer">{file?.path === '/' ? 'src' : file?.path || 'root'}</span>
        <ChevronRight size={12} className="text-gray-600" />
        <span className="text-white font-medium flex items-center">
          <span className={`text-[10px] font-bold mr-1 ${getFileBadge(file?.name).color}`}>
            {getFileBadge(file?.name).label}
          </span>
          {file?.name || 'No file selected'}
        </span>
      </div>

      {/* 4. MONACO EDITOR CANVAS */}
      <div className="flex-1 overflow-hidden relative">
        {file ? (
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: isMinimapEnabled, scale: 1, renderCharacters: false },
              fontSize: 14,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              glyphMargin: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              formatOnPaste: true,
              formatOnType: true,
              wordWrap: isWordWrap ? 'on' : 'off',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
              fontLigatures: true,
              renderLineHighlight: 'all',
            }}
            loading={
              <div className="flex items-center justify-center h-full text-gray-500 font-mono text-sm">
                Initializing Monaco Workspace...
              </div>
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted select-none bg-[#181818] p-6 text-center">
            <Code2 size={48} className="text-primary/40 mb-4 animate-bounce" />
            <h3 className="text-lg font-semibold text-gray-300 mb-1">CodeHive VS Code Editor</h3>
            <p className="text-xs text-gray-500 max-w-sm mb-6">
              Select a file from the explorer on the left or create a new one to start writing and running code.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-md">
              <button
                onClick={() => onFileCreate && onFileCreate('js')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-yellow-400 rounded text-xs font-medium border border-white/5 transition-all cursor-pointer"
              >
                + New JavaScript File
              </button>
              <button
                onClick={() => onFileCreate && onFileCreate('py')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-emerald-400 rounded text-xs font-medium border border-white/5 transition-all cursor-pointer"
              >
                + New Python File
              </button>
              <button
                onClick={() => onFileCreate && onFileCreate('html')}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-orange-400 rounded text-xs font-medium border border-white/5 transition-all cursor-pointer"
              >
                + New HTML Page
              </button>
            </div>
            <div className="mt-8 text-[11px] text-gray-600 flex items-center space-x-4">
              <span>Run: <kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">Ctrl + Enter</kbd></span>
              <span>Save: <kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">Ctrl + S</kbd></span>
              <span>Terminal: <kbd className="px-1 py-0.5 bg-white/5 rounded text-gray-400">Ctrl + `</kbd></span>
            </div>
          </div>
        )}
      </div>

      {/* 5. VS CODE BOTTOM STATUS BAR */}
      <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[11px] font-sans select-none flex-shrink-0 z-20">
        {/* Left indicators */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer" title="Git Branch">
            <GitBranch size={11} />
            <span>main</span>
          </div>

          <div
            onClick={() => onToggleTerminal && onToggleTerminal()}
            className="flex items-center space-x-1 hover:bg-white/10 px-1.5 py-0.5 rounded cursor-pointer"
            title="Diagnostics / Problems"
          >
            {monacoMarkers.length > 0 ? (
              <span className="flex items-center space-x-1 text-white font-medium">
                <AlertCircle size={11} />
                <span>{monacoMarkers.length}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <CheckCircle2 size={11} />
                <span>0</span>
              </span>
            )}
          </div>
        </div>

        {/* Right indicators */}
        <div className="flex items-center space-x-4">
          <div className="hover:bg-white/10 px-1 py-0.5 rounded cursor-pointer font-mono" title="Cursor Line & Column">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </div>

          <div className="hover:bg-white/10 px-1 py-0.5 rounded cursor-pointer" title="Indentation">
            Spaces: 2
          </div>

          <div className="hover:bg-white/10 px-1 py-0.5 rounded cursor-pointer" title="Encoding">
            UTF-8
          </div>

          <div className="hover:bg-white/10 px-1 py-0.5 rounded cursor-pointer font-semibold uppercase tracking-wider text-[10px]" title="Language Mode">
            {language}
          </div>

          <div
            onClick={() => onToggleTerminal && onToggleTerminal()}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded cursor-pointer transition-colors ${
              isTerminalOpen ? 'bg-black/30 font-bold' : 'hover:bg-white/10'
            }`}
            title="Toggle Terminal Panel (Ctrl+`)"
          >
            <TerminalIcon size={11} />
            <span>Terminal</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
