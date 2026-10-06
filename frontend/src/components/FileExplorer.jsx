import { useState, useRef, useMemo } from 'react';
import { 
  FileCode, FileText, FileIcon, Trash2, Plus, 
  ChevronRight, ChevronDown, FolderPlus, 
  Settings, Key, Info, Braces, MoreHorizontal,
  FilePlus, Upload, FolderUp, RefreshCw 
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

const getFileIcon = (filename) => {
  const name = filename.toLowerCase();
  if (name === '.env' || name === '.env.example' || name === '.env.local') {
    return <Settings size={14} className="text-gray-400 mr-2 flex-shrink-0" />;
  }
  if (name === 'license' || name === 'license.md') {
    return <Key size={14} className="text-yellow-500 mr-2 flex-shrink-0" />;
  }
  if (name === 'package.json' || name === 'package-lock.json') {
    return <Braces size={14} className="text-yellow-400 mr-2 flex-shrink-0" />;
  }
  if (name === 'readme.md') {
    return <Info size={14} className="text-primary-light mr-2 flex-shrink-0" />;
  }
  
  const ext = name.split('.').pop();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return <FileCode size={14} className="text-yellow-400 mr-2 flex-shrink-0" />;
    case 'json':
      return <Braces size={14} className="text-yellow-400 mr-2 flex-shrink-0" />;
    case 'md':
    case 'txt':
    case 'csv':
      return <FileText size={14} className="text-blue-400 mr-2 flex-shrink-0" />;
    case 'java':
      return <FileCode size={14} className="text-red-500 mr-2 flex-shrink-0" />;
    case 'py':
      return <FileCode size={14} className="text-green-500 mr-2 flex-shrink-0" />;
    case 'c':
    case 'cpp':
      return <FileCode size={14} className="text-blue-500 mr-2 flex-shrink-0" />;
    default:
      return <FileIcon size={14} className="text-gray-400 mr-2 flex-shrink-0" />;
  }
};

const FileTreeNode = ({ node, level, onSelect, activeFile, onDelete, onCreateInside }) => {
  const [isOpen, setIsOpen] = useState(true);

  const isSelected = activeFile?._id === node._id;

  if (!node.isFolder) {
    return (
      <div 
        className={`flex items-center justify-between px-1 py-1 cursor-pointer group transition-colors ${isSelected ? 'bg-primary/20 text-primary-light font-medium' : 'text-text-muted hover:text-text hover:bg-white/5 border border-transparent'}`}
        style={{ paddingLeft: `${level * 12 + 20}px` }}
        onClick={() => onSelect(node)}
      >
        <div className="flex items-center overflow-hidden flex-1">
          {getFileIcon(node.name)}
          <span className="truncate text-sm">{node.name}</span>
        </div>
        <div onClick={(e) => { e.stopPropagation(); onDelete(e, node._id); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-400 rounded transition-all mr-1">
          <Trash2 size={14} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div 
        className={`flex items-center justify-between px-1 py-1 cursor-pointer hover:bg-white/5 text-text-muted hover:text-text transition-colors group border border-transparent`}
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center overflow-hidden flex-1">
          <div className="w-4 h-4 flex items-center justify-center mr-1">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <span className="truncate text-sm font-medium select-none">{node.name}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center mr-1">
          <div onClick={(e) => { e.stopPropagation(); onCreateInside(node); setIsOpen(true); }} className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-all mr-0.5" title="New File here">
             <Plus size={14} />
          </div>
          <div onClick={(e) => { e.stopPropagation(); onDelete(e, node._id); }} className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-white/10 transition-all" title="Delete Folder">
            <Trash2 size={14} />
          </div>
        </div>
      </div>
      {isOpen && node.children?.map(child => (
        <FileTreeNode 
          key={child._id} 
          node={child} 
          level={level + 1} 
          onSelect={onSelect} 
          activeFile={activeFile} 
          onDelete={onDelete} 
          onCreateInside={onCreateInside} 
        />
      ))}
    </div>
  )
};

const FileExplorer = ({
  projectId,
  projectName,
  files,
  activeFile,
  onFileSelect,
  onFileCreated,
  onFileDeleted,
  onSyncFiles,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [creatingType, setCreatingType] = useState('file'); // 'file' or 'folder'
  const [newFileName, setNewFileName] = useState('');
  const [targetFolder, setTargetFolder] = useState(null); // node object
  const [isSyncing, setIsSyncing] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleSyncDisk = async (e) => {
    e?.stopPropagation();
    setIsSyncing(true);
    try {
      const res = await api.post('/api/execute/sync', { projectId });
      if (onSyncFiles) onSyncFiles();
      toast.success(
        res.data.count > 0
          ? `Synced ${res.data.count} items from disk`
          : 'Workspace files up to date'
      );
    } catch (_err) {
      toast.error('Failed to sync workspace');
    } finally {
      setIsSyncing(false);
    }
  };

  const tree = useMemo(() => {
    const root = { children: [], fullPath: '/' };
    const map = { '/': root };

    const processedFiles = files.map(f => {
      let parentPath = f.path;
      if (!f.isFolder && f.path === `/${f.name}`) {
         parentPath = '/';
      }
      return { ...f, parentPath, fullPath: parentPath === '/' ? `/${f.name}` : `${parentPath}/${f.name}`, children: [] };
    });

    processedFiles.forEach(f => {
      map[f.fullPath] = f;
    });

    processedFiles.forEach(f => {
      const parent = map[f.parentPath];
      if (parent) {
        parent.children.push(f);
      } else {
        root.children.push(f);
      }
    });

    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
        return a.isFolder ? -1 : 1;
      });
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children);
      });
    };
    sortNodes(root.children);

    return root.children;
  }, [files]);

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) {
      setIsCreating(false);
      setTargetFolder(null);
      return;
    }

    const parentPath = targetFolder ? targetFolder.fullPath : '/';

    try {
      const { data } = await api.post(`/api/files/project/${projectId}`, {
        name: newFileName,
        path: parentPath,
        language: creatingType === 'file' ? (newFileName.split('.').pop() || 'text') : 'text',
        isFolder: creatingType === 'folder'
      });
      onFileCreated(data);
      setNewFileName('');
      setIsCreating(false);
      setTargetFolder(null);
      toast.success(`${creatingType === 'folder' ? 'Folder' : 'File'} created`);
    } catch (_error) {
      toast.error(`Failed to create ${creatingType}`);
    }
  };

  const handleDeleteFile = async (e, fileId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this?')) return;

    try {
      await api.delete(`/api/files/${fileId}`);
      onFileDeleted(fileId);
      toast.success('Deleted successfully');
    } catch (_error) {
      toast.error('Failed to delete');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target.result;
        const { data } = await api.post(`/api/files/project/${projectId}`, {
          name: file.name,
          path: '/',
          language: file.name.split('.').pop() || 'text',
          isFolder: false,
          content: content
        });
        onFileCreated(data);
        toast.success('File uploaded');
      } catch (_error) {
        toast.error('Upload failed');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  const handleFolderUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    toast.loading('Uploading folder...', { id: 'folder-upload' });

    try {
      const foldersToCreateMap = new Map();
      
      uploadedFiles.forEach(file => {
        const parts = file.webkitRelativePath.split('/');
        parts.pop();
        
        let currentPath = '';
        parts.forEach(part => {
          const parentPath = currentPath || '/';
          currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
          
          if (!foldersToCreateMap.has(currentPath)) {
            foldersToCreateMap.set(currentPath, { name: part, parentPath });
          }
        });
      });

      const foldersToCreate = Array.from(foldersToCreateMap.values()).filter(folder => {
         const exists = files.some(f => f.isFolder && f.name === folder.name && f.path === folder.parentPath); 
         return !exists;
      });

      foldersToCreate.sort((a, b) => a.parentPath.split('/').length - b.parentPath.split('/').length);

      for (const folder of foldersToCreate) {
        const { data } = await api.post(`/api/files/project/${projectId}`, {
          name: folder.name,
          path: folder.parentPath,
          language: 'text',
          isFolder: true
        });
        onFileCreated(data);
      }

      for (const file of uploadedFiles) {
        const parts = file.webkitRelativePath.split('/');
        const name = parts.pop();
        const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
        
        const content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsText(file);
        });

        const { data } = await api.post(`/api/files/project/${projectId}`, {
          name: name,
          path: parentPath,
          language: name.split('.').pop() || 'text',
          isFolder: false,
          content: content
        });
        onFileCreated(data);
      }
      
      toast.success('Folder uploaded successfully!', { id: 'folder-upload' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload folder', { id: 'folder-upload' });
    } finally {
      e.target.value = null;
    }
  };

  return (
    <div className="w-64 flex-shrink-0 bg-surface border-r border-white/5 flex flex-col h-full select-none text-text-muted font-sans z-10">
      <div className="px-4 py-3 flex justify-between items-center text-xs font-bold tracking-widest text-text-muted/70 uppercase">
        <span>Explorer</span>
        <button className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/10 rounded">
          <MoreHorizontal size={14} />
        </button>
      </div>
      
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Project Root Header */}
        <div className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-white/5 text-white font-bold group border border-transparent mx-2 rounded-lg transition-colors">
          <div className="flex items-center flex-1 overflow-hidden">
            <ChevronDown size={16} className="mr-1.5 flex-shrink-0 text-text-muted" />
            <span className="text-sm font-semibold tracking-wide truncate">{projectName || 'PROJECT'}</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsCreating(true); setCreatingType('file'); setTargetFolder(null); }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="New File"
            >
              <FilePlus size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsCreating(true); setCreatingType('folder'); setTargetFolder(null); }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="New Folder"
            >
              <FolderPlus size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Upload File"
            >
              <Upload size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Upload Folder"
            >
              <FolderUp size={14} />
            </button>
            <button 
              onClick={handleSyncDisk}
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Refresh / Sync files from terminal workspace"
            >
              <RefreshCw size={13} className={isSyncing ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        <input type="file" ref={folderInputRef} webkitdirectory="true" directory="true" multiple onChange={handleFolderUpload} className="hidden" />
        
        <div className="flex-1 overflow-y-auto py-2">
          {isCreating && !targetFolder && (
            <form onSubmit={handleCreateFile} className="px-4 py-1 flex items-center bg-primary/10 border-y border-primary/20">
              {creatingType === 'folder' ? <ChevronRight size={14} className="mr-2 text-primary" /> : <FileText size={14} className="mr-2 text-primary" />}
              <input
                autoFocus
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onBlur={() => {
                  if (!newFileName) { setIsCreating(false); setTargetFolder(null); }
                }}
                className="flex-1 bg-transparent text-white text-sm outline-none py-0.5"
                placeholder={`Name...`}
              />
            </form>
          )}

          <div className="space-y-[1px]">
            {tree.map(node => (
              <FileTreeNode 
                key={node._id} 
                node={node} 
                level={0} 
                onSelect={onFileSelect} 
                activeFile={activeFile} 
                onDelete={handleDeleteFile}
                onCreateInside={(folderNode) => {
                   setIsCreating(true);
                   setCreatingType('file');
                   setTargetFolder(folderNode);
                }}
              />
            ))}
            {files.length === 0 && !isCreating && (
              <div className="text-text-muted/50 text-sm px-4 py-8 italic text-center">
                Project is empty
              </div>
            )}
            
            {isCreating && targetFolder && (
               <form onSubmit={handleCreateFile} className="px-1 py-1 flex items-center bg-primary/10 border-y border-primary/20" style={{ paddingLeft: `${(targetFolder.fullPath.split('/').length) * 12 + 20}px` }}>
                {creatingType === 'folder' ? <ChevronRight size={14} className="mr-2 text-primary" /> : <FileText size={14} className="mr-2 text-primary" />}
                <input
                  autoFocus
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => {
                    if (!newFileName) { setIsCreating(false); setTargetFolder(null); }
                  }}
                  className="flex-1 bg-transparent text-white text-sm outline-none w-full py-0.5"
                />
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
