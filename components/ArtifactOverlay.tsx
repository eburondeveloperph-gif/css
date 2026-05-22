import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useUI } from '../lib/state';

const DownloadButton = ({ content, title, type, ext }: { content: string, title: string, type: string, ext: string }) => (
  <button className="flex items-center gap-2 bg-yellow-600/10 text-yellow-500 border border-yellow-600/30 px-4 py-2 rounded-sm hover:bg-yellow-600/20 transition uppercase text-xs font-bold tracking-wider" onClick={() => {
    if (ext === 'pdf' && !content.startsWith('data:')) {
      const rootHtml = type === 'text/html' ? content : `
        <html>
          <head>
            <style>
              body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <pre>${content}</pre>
          </body>
        </html>
      `;
      const win = window.open("", "_blank");
      if (win) {
        win.document.open();
        win.document.write(rootHtml);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
      }
      return;
    }
    
    let url;
    if (type === 'application/pdf' && content.startsWith('data:')) {
      url = content;
    } else {
      const blob = new Blob([content], { type });
      url = URL.createObjectURL(blob);
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'document'}.${ext}`;
    a.click();
    if (!content.startsWith('data:')) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }}>
    <Download size={14} /> Download {ext.toUpperCase()}
  </button>
);

export const ArtifactOverlay: React.FC = () => {
  const activeWorkspaceResult = useUI((state) => state.activeWorkspaceResult);
  const isGenerating = useUI((state) => state.isGenerating);
  const setActiveWorkspaceResult = useUI((state) => state.setActiveWorkspaceResult);
  const setIsGenerating = useUI((state) => state.setIsGenerating);

  const closeOverlay = () => {
    setActiveWorkspaceResult(null);
    setIsGenerating(false);
  };

  return (
    <AnimatePresence>
      {(activeWorkspaceResult || isGenerating) && (
        <motion.div
          id="overlay-workspace"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-[#050505] shadow-2xl font-mono text-yellow-500"
        >
          <div className="flex items-center justify-between p-4 border-b border-yellow-900/50 bg-[#0a0a0a]">
            <div className="flex items-center gap-3">
              <Terminal size={18} className="text-yellow-600" />
              <h2 className="text-lg font-bold text-yellow-500 tracking-widest uppercase">
                {isGenerating ? 'EBURON PC // TERMINAL' : (activeWorkspaceResult?.artifact ? `EBURON PC // ${activeWorkspaceResult.artifact.title}` : 'EBURON PC // DATALINK')}
              </h2>
            </div>
            <button className="p-2 rounded-sm bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 transition-colors" onClick={closeOverlay}>
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#111] via-[#0a0a0a] to-[#050505]">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
                <div className="w-full bg-[#0a0a0a] border border-yellow-900/50 rounded-lg p-8 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-yellow-900/30">
                    <div className="h-full bg-yellow-500" style={{ width: '50%', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                  </div>
                  
                  <div className="flex flex-col items-center text-center space-y-8">
                    <div className="relative flex items-center justify-center">
                      <div className="w-16 h-16 border-2 border-yellow-900/50 border-t-yellow-500 rounded-sm animate-spin" />
                    </div>
                    
                    <div className="space-y-3">
                       <h3 className="text-2xl font-black text-yellow-500 tracking-widest uppercase">OpenMax is generating...</h3>
                       <p className="text-xs text-yellow-600/70 font-mono tracking-widest">BEATRICE PROTOCOL // DOCUMENT COMPILATION STANDBY</p>
                    </div>

                    <div className="w-full text-left bg-black p-5 rounded-sm border border-yellow-900/30 text-xs font-mono text-yellow-600/60 " style={{textShadow: '0 0 5px rgba(212,160,23,0.3)'}}>
                      <div className="space-y-2 opacity-80">
                        <p>{`> INIT SECURE CONNECTION... OK`}</p>
                        <p>{`> LOADING EBURON ASSET MODEL... OK`}</p>
                        <p>{`> COMPILING ARTIFACT DATA...`}</p>
                        <p className="animate-pulse text-yellow-400">{`> SYNTHESIZING FORMATTED OUTPUT_`}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeWorkspaceResult?.artifact ? (
              <div className="max-w-5xl mx-auto bg-[#0f0f0f] p-8 rounded-xl border border-yellow-900/30 shadow-2xl shadow-yellow-900/5">
                <div className="mb-6 flex gap-3">
                  <DownloadButton 
                    content={activeWorkspaceResult.artifact.content}
                    title={activeWorkspaceResult.artifact.title || 'artifact'}
                    type={
                      activeWorkspaceResult.artifact.type === 'markdown' ? 'text/markdown' : 
                      activeWorkspaceResult.artifact.type === 'pdf' ? 'application/pdf' : 
                      activeWorkspaceResult.artifact.type === 'json' ? 'application/json' :
                      activeWorkspaceResult.artifact.type === 'html' ? 'text/html' :
                      'text/plain'
                    }
                    ext={
                      activeWorkspaceResult.artifact.type === 'markdown' ? 'md' : 
                      activeWorkspaceResult.artifact.type === 'pdf' ? 'pdf' : 
                      activeWorkspaceResult.artifact.type === 'json' ? 'json' :
                      activeWorkspaceResult.artifact.type === 'html' ? 'html' :
                      activeWorkspaceResult.artifact.type === 'code' ? 'txt' : 'text'
                    }
                  />
                </div>
                
                {activeWorkspaceResult.artifact.type === 'pdf' && (
                  <div className="bg-white p-1 rounded-md">
                   <iframe src={activeWorkspaceResult.artifact.content} className="w-full h-[70vh] border-0 rounded" title="PDF Preview" />
                  </div>
                )}
                {activeWorkspaceResult.artifact.type === 'html' && (
                  <div className="bg-white p-1 rounded-md">
                   <iframe srcDoc={activeWorkspaceResult.artifact.content} className="w-full h-[70vh] border-0 rounded bg-white" title="HTML Preview" />
                  </div>
                )}
                {activeWorkspaceResult.artifact.type === 'markdown' && (
                  <div className="prose prose-invert prose-yellow max-w-none text-gray-300">
                    <ReactMarkdown>{activeWorkspaceResult.artifact.content}</ReactMarkdown>
                  </div>
                )}
                {(activeWorkspaceResult.artifact.type === 'structured' || activeWorkspaceResult.artifact.type === 'json') && (
                  <pre className="p-4 bg-black border border-yellow-900/30 rounded-sm overflow-x-auto text-xs font-mono text-yellow-500/80">
                    {(() => {
                      const content = activeWorkspaceResult.artifact.content;
                      if (typeof content === 'string') {
                        try {
                          return JSON.stringify(JSON.parse(content), null, 2);
                        } catch (e) {
                          return content;
                        }
                      }
                      return JSON.stringify(content, null, 2);
                    })()}
                  </pre>
                )}
                {activeWorkspaceResult.artifact.type === 'code' && (
                  <pre className="p-4 bg-black border border-yellow-900/30 text-yellow-500/80 rounded-sm overflow-x-auto text-xs font-mono">
                    <code>{activeWorkspaceResult.artifact.content}</code>
                  </pre>
                )}
              </div>
            ) : (
              <pre className="p-4 bg-black border border-yellow-900/30 rounded-sm text-yellow-500/60 overflow-x-auto text-xs font-mono">
                {activeWorkspaceResult ? JSON.stringify(activeWorkspaceResult, null, 2) : ''}
              </pre>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

