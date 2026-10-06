import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  X,
  Globe,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CornerDownLeft,
  Laptop,
  Tablet,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const TerminalPanel = ({
  projectId,
  activeFile,
  fileContent,
  files = [],
  isOpen,
  onClose,
  initialTab = 'output',
  onLineClick,
  monacoMarkers = [],
  onFilesUpdated,
}) => {
  const [activeTab, setActiveTab] = useState(initialTab); // 'terminal', 'output', 'preview', 'problems'
  const [isMaximized, setIsMaximized] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(260);

  // Run/Output state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Interactive Terminal state
  const [terminalHistory, setTerminalHistory] = useState([
    {
      type: 'system',
      text: 'CodeHive Integrated Terminal v1.0\nType commands (e.g. "node app.js", "python script.py", "dir", "ls") and press Enter.\n',
    },
  ]);
  const [commandInput, setCommandInput] = useState('');
  const [commandHistoryList, setCommandHistoryList] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Web Preview state
  const [previewDevice, setPreviewDevice] = useState('desktop'); // 'desktop', 'tablet', 'mobile'
  const [previewKey, setPreviewKey] = useState(0);

  const terminalEndRef = useRef(null);
  const outputEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync activeTab when initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Auto-scroll terminal and output
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'output') {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalHistory, runResult, activeTab]);

  // Execute current active file
  const handleRunCode = useCallback(async () => {
    if (!activeFile && !fileContent) {
      toast.error('No active file to run');
      return;
    }

    setIsRunning(true);
    setActiveTab('output');

    try {
      const ext = activeFile?.name ? activeFile.name.split('.').pop().toLowerCase() : '';
      if (ext === 'html' || ext === 'htm') {
        setActiveTab('preview');
        setIsRunning(false);
        return;
      }

      setRunResult({
        status: 'running',
        startTime: Date.now(),
        command: `Running ${activeFile?.name || 'snippet'}...`,
        stdout: '',
        stderr: '',
      });

      const res = await api.post('/api/execute/run', {
        projectId,
        fileId: activeFile?._id,
        filename: activeFile?.name,
        language: activeFile?.language,
        code: fileContent,
      });

      setRunResult({
        status: res.data.success ? 'success' : 'error',
        stdout: res.data.stdout || '',
        stderr: res.data.stderr || '',
        exitCode: res.data.exitCode,
        executionTimeMs: res.data.executionTimeMs,
        command: res.data.command,
      });

      if (res.data.isWebPreview) {
        setActiveTab('preview');
      }
    } catch (err) {
      setRunResult({
        status: 'error',
        stdout: '',
        stderr: err.response?.data?.message || err.message || 'Execution failed',
        exitCode: 1,
        executionTimeMs: 0,
        command: activeFile?.name ? `node ${activeFile.name}` : 'Runner',
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, fileContent, projectId]);

  // Expose Run Code trigger to parent if needed
  useEffect(() => {
    window.__codehive_run_code = handleRunCode;
    return () => {
      delete window.__codehive_run_code;
    };
  }, [handleRunCode]);

  // Execute terminal command
  const handleTerminalSubmit = async (e) => {
    e?.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd || isExecutingCommand) return;

    // Add to command history
    setCommandHistoryList((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommandInput('');

    // Append command prompt line
    setTerminalHistory((prev) => [
      ...prev,
      { type: 'input', text: `$ ${cmd}` },
    ]);

    if (cmd === 'clear' || cmd === 'cls') {
      setTerminalHistory([]);
      return;
    }

    setIsExecutingCommand(true);

    try {
      const res = await api.post('/api/execute/command', {
        projectId,
        command: cmd,
      });

      if (res.data.clear) {
        setTerminalHistory([]);
      } else {
        if (res.data.stdout) {
          setTerminalHistory((prev) => [
            ...prev,
            { type: 'stdout', text: res.data.stdout },
          ]);
        }
        if (res.data.stderr) {
          setTerminalHistory((prev) => [
            ...prev,
            { type: 'stderr', text: res.data.stderr },
          ]);
        }
        if (!res.data.stdout && !res.data.stderr && res.data.exitCode === 0) {
          setTerminalHistory((prev) => [
            ...prev,
            { type: 'system', text: `[Command completed with exit code 0]` },
          ]);
        }

        // If files were cloned, created, or changed on disk, update the workspace explorer
        if (res.data.filesUpdated && onFilesUpdated) {
          onFilesUpdated();
          if (res.data.importedCount > 0) {
            toast.success(`Imported ${res.data.importedCount} files into workspace`);
          }
        }
      }
    } catch (err) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          type: 'stderr',
          text: err.response?.data?.message || err.message || 'Command failed',
        },
      ]);
    } finally {
      setIsExecutingCommand(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Terminal history navigation (Up / Down)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistoryList.length === 0) return;
      const nextIndex = historyIndex === -1 ? commandHistoryList.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCommandInput(commandHistoryList[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistoryList.length) {
        setHistoryIndex(-1);
        setCommandInput('');
      } else {
        setHistoryIndex(nextIndex);
        setCommandInput(commandHistoryList[nextIndex]);
      }
    }
  };

  const handleCopyOutput = () => {
    const text = [runResult?.stdout, runResult?.stderr].filter(Boolean).join('\n');
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Output copied to clipboard');
    }
  };

  // Build live web preview HTML/CSS/JS payload
  const buildPreviewHtml = () => {
    // If active file is HTML
    if (activeFile?.name?.endsWith('.html')) {
      let html = fileContent || '';
      // Inject CSS files in the workspace if referenced or available
      const cssFiles = files.filter((f) => f.name?.endsWith('.css'));
      const jsFiles = files.filter((f) => f.name?.endsWith('.js') && f._id !== activeFile?._id);

      let injectedStyles = cssFiles.map((c) => `<style>/* ${c.name} */\n${c.content || ''}</style>`).join('\n');
      let injectedScripts = jsFiles.map((j) => `<script>/* ${j.name} */\n${j.content || ''}</script>`).join('\n');

      if (html.includes('</head>')) {
        html = html.replace('</head>', `${injectedStyles}\n</head>`);
      } else {
        html = `${injectedStyles}\n${html}`;
      }

      if (html.includes('</body>')) {
        html = html.replace('</body>', `${injectedScripts}\n</body>`);
      } else {
        html = `${html}\n${injectedScripts}`;
      }

      return html;
    }

    // If JavaScript file, create a preview container that captures console.log and DOM
    if (activeFile?.name?.endsWith('.js')) {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; }
    #console-out { background: #1e293b; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; line-height: 1.6; border: 1px solid #334155; }
    .log { color: #38bdf8; }
    .err { color: #f87171; }
  </style>
</head>
<body>
  <h3>JavaScript Web Output Preview</h3>
  <div id="root"></div>
  <div id="app"></div>
  <div id="console-out"><strong>Console:</strong><br/></div>
  <script>
    const out = document.getElementById('console-out');
    const oldLog = console.log;
    console.log = (...args) => {
      oldLog(...args);
      const line = document.createElement('div');
      line.className = 'log';
      line.innerText = '> ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
      out.appendChild(line);
    };
    window.onerror = (msg) => {
      const line = document.createElement('div');
      line.className = 'err';
      line.innerText = '! Error: ' + msg;
      out.appendChild(line);
    };
    try {
      ${fileContent}
    } catch(e) {
      console.error(e);
      const line = document.createElement('div');
      line.className = 'err';
      line.innerText = '! Error: ' + e.message;
      out.appendChild(line);
    }
  </script>
</body>
</html>`;
    }

    return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;color:#94a3b8;background:#0f172a;text-align:center;">
      <p>Select an HTML or JavaScript file to render live web preview.</p>
    </body></html>`;
  };

  if (!isOpen) return null;

  return (
    <div
      className={`border-t border-white/10 bg-[#181818] flex flex-col transition-all duration-200 z-30 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] ${
        isMaximized ? 'absolute inset-0 top-14 h-[calc(100vh-56px)] z-40' : ''
      }`}
      style={{ height: isMaximized ? 'auto' : `${terminalHeight}px` }}
    >
      {/* Resizer Handle */}
      {!isMaximized && (
        <div
          className="h-1 bg-transparent hover:bg-primary/50 cursor-row-resize w-full flex-shrink-0 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = terminalHeight;
            const onMouseMove = (moveEvt) => {
              const delta = startY - moveEvt.clientY;
              const newH = Math.min(Math.max(startH + delta, 160), window.innerHeight - 150);
              setTerminalHeight(newH);
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
      )}

      {/* VS Code Panel Tab Header */}
      <div className="h-9 bg-[#1e1e1e] flex items-center justify-between px-3 border-b border-white/5 select-none flex-shrink-0">
        <div className="flex items-center space-x-1">
          {/* Output / Run tab */}
          <button
            onClick={() => setActiveTab('output')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer ${
              activeTab === 'output'
                ? 'text-white border-b-2 border-primary bg-white/5'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Play size={12} className={isRunning ? 'text-primary animate-pulse' : 'text-green-400'} />
            <span>Output</span>
            {runResult && (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  runResult.status === 'success'
                    ? 'bg-green-500'
                    : runResult.status === 'running'
                    ? 'bg-yellow-400 animate-ping'
                    : 'bg-red-500'
                }`}
              />
            )}
          </button>

          {/* Terminal tab */}
          <button
            onClick={() => {
              setActiveTab('terminal');
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer ${
              activeTab === 'terminal'
                ? 'text-white border-b-2 border-primary bg-white/5'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <TerminalIcon size={12} className="text-yellow-400" />
            <span>Terminal</span>
          </button>

          {/* Web Preview tab */}
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'text-white border-b-2 border-primary bg-white/5'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <Globe size={12} className="text-cyan-400" />
            <span>Preview</span>
          </button>

          {/* Problems tab */}
          <button
            onClick={() => setActiveTab('problems')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded transition-colors cursor-pointer ${
              activeTab === 'problems'
                ? 'text-white border-b-2 border-primary bg-white/5'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <AlertTriangle
              size={12}
              className={monacoMarkers.length > 0 ? 'text-red-400' : 'text-gray-400'}
            />
            <span>Problems</span>
            {monacoMarkers.length > 0 && (
              <span className="px-1.5 py-0.2 bg-red-500/20 text-red-400 text-[10px] rounded-full font-mono">
                {monacoMarkers.length}
              </span>
            )}
          </button>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center space-x-2 text-gray-400">
          {activeTab === 'output' && (
            <>
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="flex items-center space-x-1 text-xs px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded font-medium transition-colors cursor-pointer"
                title="Run active file (Ctrl+Enter)"
              >
                <Play size={11} fill="currentColor" />
                <span>Run</span>
              </button>

              <button
                onClick={handleCopyOutput}
                disabled={!runResult}
                className="p-1 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
                title="Copy output"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>

              <button
                onClick={() => setRunResult(null)}
                className="p-1 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
                title="Clear output"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}

          {activeTab === 'terminal' && (
            <button
              onClick={() => setTerminalHistory([])}
              className="p-1 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
              title="Clear terminal"
            >
              <Trash2 size={14} />
            </button>
          )}

          {activeTab === 'preview' && (
            <div className="flex items-center space-x-1 bg-black/30 p-0.5 rounded border border-white/5 mr-1">
              <button
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1 rounded cursor-pointer ${
                  previewDevice === 'desktop' ? 'bg-primary text-white' : 'hover:text-white'
                }`}
                title="Desktop View"
              >
                <Laptop size={12} />
              </button>
              <button
                onClick={() => setPreviewDevice('tablet')}
                className={`p-1 rounded cursor-pointer ${
                  previewDevice === 'tablet' ? 'bg-primary text-white' : 'hover:text-white'
                }`}
                title="Tablet View"
              >
                <Tablet size={12} />
              </button>
              <button
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1 rounded cursor-pointer ${
                  previewDevice === 'mobile' ? 'bg-primary text-white' : 'hover:text-white'
                }`}
                title="Mobile View"
              >
                <Smartphone size={12} />
              </button>
              <button
                onClick={() => setPreviewKey((k) => k + 1)}
                className="p-1 hover:text-white rounded cursor-pointer"
                title="Reload Preview"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          )}

          <div className="w-px h-3.5 bg-white/10 mx-1" />

          {/* Maximize / Restore */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close Panel */}
          <button
            onClick={onClose}
            className="p-1 hover:text-white hover:bg-white/5 rounded transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Panel Content Body */}
      <div className="flex-1 overflow-auto bg-[#141414] font-mono text-xs select-text">
        {/* OUTPUT TAB */}
        {activeTab === 'output' && (
          <div className="p-3 h-full overflow-auto flex flex-col justify-between">
            <div>
              {isRunning && (
                <div className="flex items-center space-x-2 text-primary-light pb-2 mb-2 border-b border-white/5">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>[Running] {activeFile?.name ? `node "${activeFile.name}"` : 'Executing code...'}</span>
                </div>
              )}

              {runResult ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pb-2 border-b border-white/5">
                    <span className="flex items-center space-x-2">
                      <span className="text-gray-500">$</span>
                      <span className="text-gray-300">{runResult.command}</span>
                    </span>
                    <span className="flex items-center space-x-3">
                      {runResult.status === 'success' ? (
                        <span className="flex items-center text-green-400">
                          <CheckCircle2 size={12} className="mr-1" /> Done (code {runResult.exitCode})
                        </span>
                      ) : (
                        <span className="flex items-center text-red-400">
                          <AlertCircle size={12} className="mr-1" /> Exited with code {runResult.exitCode}
                        </span>
                      )}
                      <span>{runResult.executionTimeMs}ms</span>
                    </span>
                  </div>

                  {runResult.stdout && (
                    <pre className="text-gray-200 whitespace-pre-wrap font-mono leading-relaxed bg-[#111] p-3 rounded border border-white/5">
                      {runResult.stdout}
                    </pre>
                  )}

                  {runResult.stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap font-mono leading-relaxed bg-red-950/20 p-3 rounded border border-red-500/20">
                      {runResult.stderr}
                    </pre>
                  )}

                  {!runResult.stdout && !runResult.stderr && (
                    <p className="text-gray-500 italic p-2">[Program executed with no console output]</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500 select-none">
                  <Play size={32} className="text-gray-600 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-gray-400">No execution output yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Click <span className="text-green-400 font-semibold">Run</span> or press{' '}
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-300">Ctrl + Enter</kbd> to execute{' '}
                    {activeFile?.name || 'your code'}.
                  </p>
                </div>
              )}
              <div ref={outputEndRef} />
            </div>
          </div>
        )}

        {/* TERMINAL TAB */}
        {activeTab === 'terminal' && (
          <div
            className="p-3 h-full flex flex-col justify-between overflow-auto"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="space-y-1">
              {terminalHistory.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                  {line.type === 'input' && (
                    <div className="flex items-center space-x-2 text-primary-light font-semibold">
                      <span>{line.text}</span>
                    </div>
                  )}
                  {line.type === 'stdout' && <div className="text-gray-200">{line.text}</div>}
                  {line.type === 'stderr' && <div className="text-red-400 font-medium">{line.text}</div>}
                  {line.type === 'system' && <div className="text-gray-500 italic">{line.text}</div>}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Input Prompt */}
            <form onSubmit={handleTerminalSubmit} className="flex items-center space-x-2 mt-2 pt-2 border-t border-white/5">
              <span className="text-primary font-bold select-none">$</span>
              <input
                ref={inputRef}
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isExecutingCommand ? 'Running command...' : 'Enter command (e.g. node index.js)...'}
                disabled={isExecutingCommand}
                className="flex-1 bg-transparent text-white outline-none border-none font-mono text-xs placeholder:text-gray-600 disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!commandInput.trim() || isExecutingCommand}
                className="text-gray-500 hover:text-white disabled:opacity-20 cursor-pointer p-1"
                title="Execute (Enter)"
              >
                <CornerDownLeft size={12} />
              </button>
            </form>
          </div>
        )}

        {/* PREVIEW TAB */}
        {activeTab === 'preview' && (
          <div className="w-full h-full flex items-center justify-center p-2 bg-[#0c0c0c]">
            <div
              className={`h-full bg-white rounded shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
                previewDevice === 'mobile'
                  ? 'w-[375px] max-w-full'
                  : previewDevice === 'tablet'
                  ? 'w-[768px] max-w-full'
                  : 'w-full'
              }`}
            >
              {/* Fake browser bar */}
              <div className="h-6 bg-gray-100 border-b border-gray-300 flex items-center px-2 space-x-1.5 flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <div className="flex-1 bg-white mx-2 rounded px-2 text-[10px] text-gray-500 truncate font-mono">
                  http://localhost:5173/preview/{activeFile?.name || 'app.html'}
                </div>
              </div>
              <iframe
                key={previewKey}
                title="CodeHive Live Preview"
                srcDoc={buildPreviewHtml()}
                sandbox="allow-scripts allow-modals"
                className="flex-1 w-full border-none bg-white"
              />
            </div>
          </div>
        )}

        {/* PROBLEMS TAB */}
        {activeTab === 'problems' && (
          <div className="p-3 h-full overflow-auto">
            {monacoMarkers.length > 0 ? (
              <div className="space-y-1">
                {monacoMarkers.map((marker, i) => (
                  <div
                    key={i}
                    onClick={() => onLineClick && onLineClick(marker.startLineNumber, marker.startColumn)}
                    className="flex items-start space-x-2 p-1.5 hover:bg-white/5 rounded cursor-pointer transition-colors group"
                  >
                    {marker.severity === 8 ? (
                      <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="text-gray-300 group-hover:text-white transition-colors">
                        {marker.message}
                      </span>
                      <span className="text-gray-500 text-[11px] ml-2">
                        [{activeFile?.name || 'file'}: line {marker.startLineNumber}, col {marker.startColumn}]
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 select-none">
                <CheckCircle2 size={32} className="text-green-500/50 mb-2" />
                <p className="text-sm font-medium text-gray-400">No problems detected</p>
                <p className="text-xs text-gray-500 mt-1">
                  Syntax errors and diagnostics will be reported here as you type.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
