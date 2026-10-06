import { useState } from 'react';
import { Sparkles, Send, Copy, Check } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

const AIPanel = ({ activeFile }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const userMessage = prompt;
    setPrompt('');
    
    // Add user message to history
    setHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGenerating(true);

    try {
      const { data } = await api.post('/api/ai/suggest', {
        prompt: userMessage,
        codeContext: activeFile?.content || '',
        language: activeFile?.language || 'text'
      });

      setHistory(prev => [...prev, { role: 'ai', content: data.suggestion }]);
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Failed to get AI suggestion';
      toast.error(errMsg);
      setHistory((prev) => [
        ...prev,
        { role: 'ai', content: `⚠️ **Notice:** ${errMsg}` },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center bg-black/10">
        <Sparkles size={18} className="text-orange-400 mr-2" />
        <h3 className="font-semibold text-gray-300 text-sm tracking-wider uppercase">AI Assistant</h3>
      </div>
      
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {history.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-10">
            <Sparkles size={32} className="mx-auto mb-3 opacity-20" />
            <p>Ask me to explain, refactor, or write code.</p>
            {activeFile && <p className="text-xs mt-2 opacity-70">Context: {activeFile.name}</p>}
          </div>
        ) : (
          history.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center mb-1 space-x-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {msg.role === 'user' ? 'You' : 'Gemini'}
                </span>
                {msg.role === 'ai' && (
                  <button 
                    onClick={() => copyToClipboard(msg.content, index)}
                    className="text-gray-500 hover:text-white transition-colors"
                    title="Copy Response"
                  >
                    {copiedIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                )}
              </div>
              <div 
                className={`text-sm rounded-lg p-3 max-w-[90%] break-words shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-orange-600 text-white shadow-orange-900/20' 
                    : 'bg-black/20 border border-white/5 text-gray-300'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {isGenerating && (
          <div className="flex flex-col items-start">
             <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gemini</span>
             <div className="bg-black/20 border border-white/5 text-gray-300 text-sm rounded-lg p-3 flex items-center space-x-2">
               <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
               <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
               <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={activeFile ? `Ask about ${activeFile.name}...` : "Ask a coding question..."}
            className="w-full bg-black/40 border border-white/10 text-text text-sm rounded-full pl-4 pr-10 py-2.5 outline-none focus:border-orange-500 transition-colors shadow-inner placeholder-gray-500"
            disabled={isGenerating}
          />
          <button 
            type="submit" 
            disabled={!prompt.trim() || isGenerating}
            className="absolute right-1.5 top-1.5 p-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white rounded-full transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIPanel;
