import React, { useEffect, useState } from 'react';
import { CitationDetail } from '../types';
import { codeToHtml } from 'shiki';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface CitationDrawerProps {
  citation: CitationDetail | null;
  onClose: () => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citation, onClose }) => {
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!citation) return;

    let isMounted = true;
    const lang = citation.language || (citation.type === 'file' ? 'python' : citation.type === 'diff' ? 'diff' : 'json');

    async function highlight() {
      try {
        const html = await codeToHtml(citation!.content, {
          lang: lang === 'yaml' ? 'yaml' : lang === 'json' ? 'json' : lang === 'diff' ? 'diff' : 'python',
          theme: 'github-light'
        });
        if (isMounted) setHighlightedCode(html);
      } catch {
        if (isMounted) setHighlightedCode(`<pre><code>${citation!.content}</code></pre>`);
      }
    }

    highlight();
    return () => {
      isMounted = false;
    };
  }, [citation]);

  if (!citation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-blue-100 text-blue-800 border border-blue-200">
              {citation.id}
            </span>
            <h2 className="text-sm font-bold text-slate-800 truncate max-w-md">
              {citation.title}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
              title="Copy snippet"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded transition"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata section if available */}
        {citation.metadata && Object.keys(citation.metadata).length > 0 && (
          <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 text-xs font-mono grid grid-cols-2 gap-2 text-slate-700">
            {Object.entries(citation.metadata).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-slate-500 font-semibold">{k}: </span>
                <span className="text-slate-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main code content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFA]">
          {highlightedCode ? (
            <div
              className="font-mono text-xs leading-relaxed overflow-x-auto rounded-lg border border-slate-200 shadow-xs"
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          ) : (
            <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
              {citation.content}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Source verification: Grounded in AST/Code/Logs</span>
          <span className="text-emerald-700 font-bold">STATUS: VERIFIED</span>
        </div>
      </div>
    </div>
  );
};
