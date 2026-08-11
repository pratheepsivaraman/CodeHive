import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { socket } from '../services/socket';
import { Awareness } from 'y-protocols/awareness';
import * as awarenessProtocol from 'y-protocols/awareness';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Braces, FileText, Hash } from 'lucide-react';

const stringToColor = (str) => {
  if (!str) return '#4f46e5';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.floor(Math.abs((Math.sin(hash) * 16777215)) % 16777215).toString(16);
  return '#' + '000000'.substring(0, 6 - color.length) + color;
};

const CodeEditor = ({ projectId, file, value, onChange, onFileCreate }) => {
  const { user } = useAuth();
  const editorRef = useRef(null);
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef(null);

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

  // Setup Yjs when Monaco mounts or file changes
  const handleEditorDidMount = (editor, _monaco) => {
    editorRef.current = editor;
    setupYjs();
  };

  const setupYjs = () => {
    if (!editorRef.current || !file) return;

    // Cleanup previous bindings
    if (bindingRef.current) bindingRef.current.destroy();
    if (ydocRef.current) ydocRef.current.destroy();
    
    // 1. Create a new Y document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // 2. Get the shared text type
    const ytext = ydoc.getText('monaco');

    // 3. Setup Awareness
    const awareness = new Awareness(ydoc);
    
    // Set local user state
    awareness.setLocalStateField('user', {
      name: user?.username || 'Anonymous',
      color: stringToColor(user?.username || 'Anonymous')
    });

    // 4. Bind Yjs to Monaco
    const binding = new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      awareness
    );
    bindingRef.current = binding;

    // If there's an initial value from the DB and the document is empty, insert it
    if (ytext.toString() === '' && file.content) {
      ytext.insert(0, file.content);
    } else if (ytext.toString() === '' && value) {
      ytext.insert(0, value);
    }

    // 5. Join the file room on the socket
    socket.emit('join-file', { projectId, fileId: file._id });

    // 6. Listen to local Yjs changes and broadcast them to Socket.IO
    ydoc.on('update', (update) => {
      socket.emit('yjs-update', { projectId, fileId: file._id, update });
    });

    // 7. Listen to local awareness updates and broadcast them
    awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
      socket.emit('yjs-awareness-update', { projectId, fileId: file._id, update });
    });

    // 8. Listen to incoming Yjs updates from the network and apply them
    const handleRemoteUpdate = ({ fileId, update }) => {
      if (fileId === file._id) {
        const updateArray = new Uint8Array(update);
        Y.applyUpdate(ydoc, updateArray, 'remote');
      }
    };

    // 9. Listen to incoming awareness updates
    const handleRemoteAwareness = ({ fileId, update }) => {
      if (fileId === file._id) {
        const updateArray = new Uint8Array(update);
        awarenessProtocol.applyAwarenessUpdate(awareness, updateArray, 'remote');
      }
    };

    socket.on('yjs-update', handleRemoteUpdate);
    socket.on('yjs-awareness-update', handleRemoteAwareness);

    // Keep the React state (value) in sync for manual saving
    ytext.observe(() => {
      if (onChange) {
        onChange(ytext.toString());
      }
    });

    // Cleanup on unmount or file change
    return () => {
      socket.emit('leave-file', { projectId, fileId: file._id });
      socket.off('yjs-update', handleRemoteUpdate);
      socket.off('yjs-awareness-update', handleRemoteAwareness);
      binding.destroy();
      awareness.destroy();
      ydoc.destroy();
    };
  };

  // Re-run setup if the file changes
  useEffect(() => {
    let cleanup;
    if (editorRef.current) {
      cleanup = setupYjs();
    }
    return () => {
      if (cleanup) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?._id]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1e1e1e]">
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
      <div className="h-12 bg-surface/80 backdrop-blur-md flex items-center pr-4 border-b border-white/5 flex-shrink-0 relative z-10">
        <div className="flex items-center space-x-2 text-sm text-text-muted bg-surface h-full border-t border-primary/50 px-6 cursor-pointer shadow-[0_-2px_10px_rgba(59,130,246,0.1)] transition-colors">
          <span className="flex items-center font-medium">
            {file?.name?.endsWith('.java') && <span className="text-red-500 mr-2 font-bold font-serif italic text-xs">☕</span>}
            {file?.name?.endsWith('.py') && <span className="text-blue-500 mr-2 text-xs">🐍</span>}
            {file?.name?.endsWith('.js') && <span className="text-yellow-400 mr-2 text-xs">JS</span>}
            {file?.name || 'Untitled'}
          </span>
          {file && (
            <div className="w-2 h-2 bg-primary/50 rounded-full ml-3 opacity-50 hover:opacity-100 cursor-pointer transition-opacity"></div>
          )}
        </div>
        
        <div className="ml-2 relative" ref={menuRef}>
          <button 
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors flex items-center justify-center"
            title="Create New File"
          >
            <Plus size={18} />
          </button>
          
          {showNewMenu && (
            <div className="absolute top-full left-0 mt-2 w-52 bg-surface border border-white/10 rounded-xl shadow-2xl z-50 text-sm text-text overflow-hidden animate-fade-in backdrop-blur-xl">
              <div className="py-1">
                <button onClick={() => { if (onFileCreate) onFileCreate('c'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <span className="text-blue-400 mr-3 font-bold w-4 text-center">C</span> C File
                </button>
                <button onClick={() => { if (onFileCreate) onFileCreate('cpp'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <span className="text-blue-500 mr-3 font-bold w-4 text-center">C++</span> C++ File
                </button>
                <button onClick={() => { if (onFileCreate) onFileCreate('py'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <span className="text-green-500 mr-3 text-xs w-4 text-center font-bold">Py</span> Python File
                </button>
                <button onClick={() => { if (onFileCreate) onFileCreate('java'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <span className="text-red-500 mr-3 font-serif italic font-bold text-xs w-4 text-center">☕</span> Java File
                </button>
                <div className="h-px bg-white/10 my-1 mx-2"></div>
                <button onClick={() => { if (onFileCreate) onFileCreate('txt'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <FileText size={16} className="mr-3 text-gray-400" /> Text File
                </button>
                <button onClick={() => { if (onFileCreate) onFileCreate('csv'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <Hash size={16} className="mr-3 text-green-400" /> CSV File
                </button>
                <button onClick={() => { if (onFileCreate) onFileCreate('json'); setShowNewMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-white/5 flex items-center transition-colors">
                  <Braces size={16} className="mr-3 text-yellow-400" /> JSON File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          }}
          loading={
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading Editor...
            </div>
          }
        />
      </div>
    </div>
  );
};

export default CodeEditor;
