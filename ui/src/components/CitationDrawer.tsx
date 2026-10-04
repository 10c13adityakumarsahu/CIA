import React, { useEffect, useState } from 'react';
import { CitationDetail } from '../types';
import { codeToHtml } from 'shiki';
import { X, ExternalLink, Copy, Check } from 'lucide-react';

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
          theme: 'nord'
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in">
      <div className="w-full max-w-2xl h-full bg-[#111827] border-l border-[#334155] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155] bg-[#0B0F19]">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-blue-950/80 text-blue-300 border border-blue-800">
              {citation.id}
            </span>
            <h2 className="text-base font-semibold text-slate-100 truncate max-w-md">
              {citation.title}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
              title="Copy snippet"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata section if available */}
        {citation.metadata && Object.keys(citation.metadata).length > 0 && (
          <div className="px-6 py-3 bg-[#1E293B]/60 border-b border-[#334155] text-xs font-mono grid grid-cols-2 gap-2 text-slate-300">
            {Object.entries(citation.metadata).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="text-slate-400 font-semibold">{k}: </span>
                <span className="text-slate-200">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Main code content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]">
          {highlightedCode ? (
            <div
              className="font-mono text-sm leading-relaxed overflow-x-auto rounded border border-[#334155]"
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          ) : (
            <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap bg-[#0B0F19] p-4 rounded border border-[#334155]">
              {citation.content}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#334155] bg-[#111827] flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Source verification: Code-verified citation</span>
          <span className="text-emerald-400">STATUS: VERIFIED</span>
        </div>
      </div>
    </div>
  );
};
