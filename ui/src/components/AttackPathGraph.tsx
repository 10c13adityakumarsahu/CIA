import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Report } from '../types';
import { CitationChip } from './CitationChip';
import { ShieldAlert, ArrowRight, Zap, Target } from 'lucide-react';

interface AttackPathGraphProps {
  report: Report | null;
  onSelectCitation: (citation: string) => void;
}

export const AttackPathGraph: React.FC<AttackPathGraphProps> = ({ report, onSelectCitation }) => {
  const { nodes, edges } = useMemo(() => {
    if (!report || !report.path || report.path.length === 0) {
      // Default placeholder path
      const sampleNodes: Node[] = [
        {
          id: 'step-1',
          position: { x: 50, y: 150 },
          data: {
            label: (
              <div className="p-3 bg-[#111827] border border-cyan-800 rounded-lg text-xs font-mono w-64 text-left shadow-lg">
                <div className="text-cyan-400 font-bold mb-1 flex items-center">
                  <Target className="w-3.5 h-3.5 mr-1" />
                  1. Ingress Request
                </div>
                <div className="text-slate-300 text-[11px] mb-2">
                  POST /api/orders with injected SQL payload
                </div>
                <CitationChip citation="LOG-0001" onClick={onSelectCitation} />
              </div>
            )
          }
        },
        {
          id: 'step-2',
          position: { x: 380, y: 150 },
          data: {
            label: (
              <div className="p-3 bg-[#111827] border border-amber-800 rounded-lg text-xs font-mono w-64 text-left shadow-lg">
                <div className="text-amber-400 font-bold mb-1 flex items-center">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                  2. Vulnerable Function
                </div>
                <div className="text-slate-300 text-[11px] mb-2">
                  orders() executes unsanitized query on sku
                </div>
                <CitationChip citation="SAST-002" onClick={onSelectCitation} />
              </div>
            )
          }
        },
        {
          id: 'step-3',
          position: { x: 710, y: 150 },
          data: {
            label: (
              <div className="p-3 bg-[#111827] border border-red-800 rounded-lg text-xs font-mono w-64 text-left shadow-lg">
                <div className="text-red-400 font-bold mb-1 flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  3. Impact / Exploitation
                </div>
                <div className="text-slate-300 text-[11px] mb-2">
                  Time-delay execution blocks pool connection
                </div>
                <CitationChip citation="GRAPH:table:customers" onClick={onSelectCitation} />
              </div>
            )
          }
        }
      ];

      const sampleEdges: Edge[] = [
        {
          id: 'e1-2',
          source: 'step-1',
          target: 'step-2',
          animated: true,
          style: { stroke: '#06B6D4', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#06B6D4' }
        },
        {
          id: 'e2-3',
          source: 'step-2',
          target: 'step-3',
          animated: true,
          style: { stroke: '#EF4444', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#EF4444' }
        }
      ];

      return { nodes: sampleNodes, edges: sampleEdges };
    }

    // Build dynamically from report.path
    const dynamicNodes: Node[] = report.path.map((step, idx) => {
      const isLast = idx === report.path.length - 1;
      const borderColor = isLast ? 'border-red-700' : idx === 0 ? 'border-cyan-700' : 'border-amber-700';
      const titleColor = isLast ? 'text-red-400' : idx === 0 ? 'text-cyan-400' : 'text-amber-400';

      return {
        id: `node-path-${idx}`,
        position: { x: 50 + idx * 320, y: 140 },
        data: {
          label: (
            <div className={`p-3 bg-[#111827] border ${borderColor} rounded-lg text-xs font-mono w-64 text-left shadow-xl`}>
              <div className={`${titleColor} font-bold mb-1 flex items-center`}>
                <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] mr-1.5">
                  {idx + 1}
                </span>
                Step {idx + 1}
              </div>
              <div className="text-slate-300 text-[11px] mb-2 line-clamp-3">
                {step.description}
              </div>
              {step.citation && (
                <CitationChip citation={step.citation} onClick={onSelectCitation} />
              )}
            </div>
          )
        }
      };
    });

    const dynamicEdges: Edge[] = [];
    for (let i = 0; i < report.path.length - 1; i++) {
      dynamicEdges.push({
        id: `edge-${i}-${i + 1}`,
        source: `node-path-${i}`,
        target: `node-path-${i + 1}`,
        animated: true,
        style: { stroke: '#38BDF8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#38BDF8' }
      });
    }

    return { nodes: dynamicNodes, edges: dynamicEdges };
  }, [report, onSelectCitation]);

  return (
    <div className="w-full h-full bg-[#0B0F19] relative">
      <div className="absolute top-4 left-4 z-10 bg-[#111827]/90 backdrop-blur border border-[#334155] px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
        Attack Path Flowchart (Animated Vector)
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={true}
        className="bg-[#0B0F19]"
      >
        <Background color="#1E293B" gap={16} />
        <Controls className="bg-[#111827] border border-[#334155] fill-slate-300" />
      </ReactFlow>
    </div>
  );
};
