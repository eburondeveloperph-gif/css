import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, Download, Save, RotateCcw, Pencil, History, 
  Search, ZoomIn, ZoomOut, Maximize, FileCode, FileJson, 
  Table as TableIcon, FileBarChart, ExternalLink, Printer,
  Maximize2, Minimize2, Share2, Shield, Globe, Lock
} from 'lucide-react';
import { useUI } from '../lib/state';
import ReactMarkdown from 'react-markdown';

interface DocumentWorkspaceProps {
  artifact: {
    title: string;
    type: string;
    content: string;
    language?: string;
  };
}

export function DocumentWorkspace({ artifact }: DocumentWorkspaceProps) {
  const [zoom, setZoom] = useState(0.85);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const setActiveWorkspaceResult = useUI((state) => state.setActiveWorkspaceResult);
  const isWorkspaceFullScreen = useUI((state) => state.isWorkspaceFullScreen);
  const setIsWorkspaceFullScreen = useUI((state) => state.setIsWorkspaceFullScreen);

  const handleDownload = (format: string) => {
    if (format === 'PDF') {
      const isHtml = artifact.type === 'html';
      const rootHtml = isHtml ? artifact.content : `
        <html>
          <head>
            <style>
              body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <pre>${artifact.content}</pre>
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

    // Basic download logic
    let mimeType = 'text/plain';
    let ext = format.toLowerCase();
    if (format === 'HTML') mimeType = 'text/html';
    else if (format === 'DOCX') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const blob = new Blob([artifact.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title || 'document'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderPreview = () => {
    const zoomStyle = { transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' };

    switch (artifact.type) {
      case 'html':
      case 'markdown':
      case 'text':
      default:
        return (
          <div className="preview-canvas-container" style={{ width: '100%', height: '100%', overflow: 'auto', backgroundColor: '#1a1a1a', display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
             <div className="a4-page shadow-2xl" style={{ 
               width: '210mm', 
               minHeight: '297mm', 
               backgroundColor: '#fff', 
               color: '#000', 
               padding: '24mm 20mm', 
               boxSizing: 'border-box', 
               borderRadius: '2px',
               ...zoomStyle 
             }}>
                {/* Document Header Branding */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Shield size={18} color="#fff" />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em' }}>EBURON AI</span>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#000' }}>Proposal</div>
                      <div style={{ fontSize: '11px', color: '#666' }}>May 15, 2024</div>
                   </div>
                </div>

                <div className="markdown-body" style={{ color: '#000', width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
                  {artifact.type === 'html' ? (
                    <iframe 
                      srcDoc={artifact.content} 
                      className="w-full h-full border-0 rounded bg-white flex-1" 
                      style={{ minHeight: '600px' }} 
                      title="HTML Preview" 
                    />
                  ) : artifact.type === 'markdown' ? (
                    <ReactMarkdown>{artifact.content}</ReactMarkdown>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{artifact.content}</div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ position: 'absolute', bottom: '40px', left: '20mm', right: '20mm', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                   <span>Eburon AI</span>
                   <span>Page 1 of 1</span>
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="document-workspace" style={{ 
      display: 'flex', 
      width: '100%', 
      height: '100%', 
      backgroundColor: '#050505', 
      color: '#fff', 
      flexDirection: 'column',
      position: 'relative',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #222'
    }}>
      {/* OS Header - Framed Window */}
      <div style={{ 
        height: '48px', 
        backgroundColor: '#0a0a0a', 
        borderBottom: '1px solid #1a1a1a', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 16px',
        gap: '20px'
      }}>
        {/* Traffic Lights */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
        </div>

        {/* Browser Address Bar */}
        <div style={{ 
          flex: 1, 
          height: '32px', 
          backgroundColor: '#141414', 
          borderRadius: '6px', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 12px',
          gap: '8px',
          border: '1px solid #222',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <Lock size={12} color="#666" />
          <span style={{ fontSize: '12px', color: '#888' }}>eburon.ai/workspace/beatrice/{artifact.title.toLowerCase().replace(/\s+/g, '-') || 'proposal'}</span>
        </div>

        <div style={{ width: '60px', display: 'flex', justifyContent: 'flex-end' }}>
          <ExternalLink size={16} color="#666" style={{ cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <motion.div 
          initial={false}
          animate={{ width: isSidebarCollapsed ? '0px' : '280px', opacity: isSidebarCollapsed ? 0 : 1 }}
          className="metadata-panel" 
          style={{ 
            minWidth: isSidebarCollapsed ? '0px' : '280px',
            borderRight: '1px solid #1a1a1a', 
            padding: isSidebarCollapsed ? '0px' : '24px', 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: '#050505',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#444', letterSpacing: '0.1em' }}>WORKSPACE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => handleDownload('PDF')} className="hero-action-btn">
               <Download size={18} />
               <span>Download PDF</span>
            </button>
            <button onClick={() => handleDownload('DOCX')} className="hero-action-btn">
               <FileText size={18} />
               <span>Download DOCX</span>
            </button>
            <button onClick={() => {}} className="hero-action-btn">
               <Globe size={18} />
               <span>Save to Drive</span>
            </button>
            <button onClick={() => {}} className="hero-action-btn">
               <Pencil size={18} />
               <span>Edit</span>
            </button>
            <button onClick={() => {}} className="hero-action-btn">
               <Share2 size={18} />
               <span>Share</span>
            </button>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
              <button 
                  onClick={() => { setActiveWorkspaceResult(null); setIsWorkspaceFullScreen(false); }}
                  style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', border: '1px solid #222', borderRadius: '8px', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}
                  className="hover:text-gray-300 hover:border-gray-600 transition-colors"
              >
                  Close Editor
              </button>
          </div>
        </motion.div>

        {/* Content Area */}
        <div className="preview-panel" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{ height: '40px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px' }}>
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="nav-btn">
                <Maximize2 size={14} style={{ transform: isSidebarCollapsed ? 'none' : 'rotate(180deg)' }} />
             </button>
             <div style={{ width: '1px', height: '16px', backgroundColor: '#222' }} />
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="nav-btn"><ZoomOut size={14} /></button>
               <span style={{ fontSize: '11px', color: '#666', minWidth: '32px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{Math.round(zoom * 100)}%</span>
               <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="nav-btn"><ZoomIn size={14} /></button>
             </div>
             <div style={{ flex: 1 }} />
             <button 
                onClick={() => setIsWorkspaceFullScreen(!isWorkspaceFullScreen)}
                style={{ 
                  color: isWorkspaceFullScreen ? '#cbfb45' : '#666',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                className="nav-btn"
              >
                {isWorkspaceFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isWorkspaceFullScreen ? "Exit Fullscreen" : "Full Screen"}
              </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderPreview()}
          </div>
        </div>
      </div>

      <style>{`
        .hero-action-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 20px;
          background-color: #0d0d0d;
          border: 1px solid #1a1a1a;
          border-radius: 12px;
          color: #eee;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hero-action-btn:hover {
          background-color: #141414;
          border-color: #333;
          transform: translateY(-1px);
        }
        .hero-action-btn svg {
          color: #555;
          transition: color 0.2s;
        }
        .hero-action-btn:hover svg {
          color: #fff;
        }
        .nav-btn {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .nav-btn:hover {
          color: #fff;
          background-color: #1a1a1a;
        }
        .a4-page {
          box-shadow: 0 30px 60px -12px rgba(0,0,0,0.5), 0 18px 36px -18px rgba(0,0,0,0.5);
          position: relative;
        }
      `}</style>
    </div>
  );
}
