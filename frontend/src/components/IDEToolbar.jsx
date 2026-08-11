import { Play, Settings, Minus, Square, X } from 'lucide-react';

const IDEToolbar = ({ project }) => {
  return (
    <div className="h-8 bg-[#181818] flex items-center justify-between px-3 select-none flex-shrink-0 text-sm font-sans border-b border-black">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
        <div className="flex items-center justify-center w-5 h-5 bg-primary rounded text-[10px] font-bold text-white mr-1">
          {project?.name?.charAt(0)?.toUpperCase() || 'P'}
        </div>
        </div>
        
        {/* Menu Items */}
        <div className="flex items-center space-x-1">
          <div className="px-2 py-0.5 hover:bg-[#333333] rounded cursor-default text-gray-300">File</div>
          <div className="px-2 py-0.5 hover:bg-[#333333] rounded cursor-default text-gray-300">Edit</div>
          <div className="px-2 py-0.5 hover:bg-[#333333] rounded cursor-default text-gray-300">Run</div>
          <div className="px-2 py-0.5 hover:bg-[#333333] rounded cursor-default text-gray-300">View</div>
          <div className="px-2 py-0.5 hover:bg-[#333333] rounded cursor-default text-gray-300">Help</div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Action icons */}
        <button className="p-1 hover:bg-[#333333] rounded text-green-500" title="Run">
          <Play size={14} fill="currentColor" />
        </button>
        <button className="p-1 hover:bg-[#333333] rounded text-gray-400" title="Settings">
          <Settings size={14} />
        </button>
        
        <div className="h-4 w-[1px] bg-gray-700 mx-1"></div>
        
        {/* Window controls */}
        <button className="p-1.5 hover:bg-[#333333] text-gray-400">
          <Minus size={14} />
        </button>
        <button className="p-1.5 hover:bg-[#333333] text-gray-400">
          <Square size={12} />
        </button>
        <button className="p-1.5 hover:bg-red-600 hover:text-white text-gray-400">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default IDEToolbar;
