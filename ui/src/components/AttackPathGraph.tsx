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
import { ShieldAlert, Zap, Target } from 'lucide-react';

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
              <div className="p-3.5 bg-white border-2 border-blue-300 rounded-xl text-xs font-mono w-64 text-left shadow-md">
                <div className="text-blue-700 font-bold mb-1 flex items-center">
                  <Target className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  1. Ingress Request
                </div>
                <div className="text-slate-600 text-[11px] mb-2 font-sans leading-relaxed">
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
              <div className="p-3.5 bg-white border-2 border-amber-300 rounded-xl text-xs font-mono w-64 text-left shadow-md">
                <div className="text-amber-700 font-bold mb-1 flex items-center">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  2. Vulnerable Function
                </div>
                <div className="text-slate-600 text-[11px] mb-2 font-sans leading-relaxed">
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
              <div className="p-3.5 bg-white border-2 border-red-300 rounded-xl text-xs font-mono w-64 text-left shadow-md">
                <div className="text-red-700 font-bold mb-1 flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-1 text-red-600" />
                  3. Impact / Exploitation
                </div>
                <div className="text-slate-600 text-[11px] mb-2 font-sans leading-relaxed">
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
          style: { stroke: '#2563EB', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2563EB' }
        },
        {
          id: 'e2-3',
          source: 'step-2',
          target: 'step-3',
          animated: true,
          style: { stroke: '#DC2626', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#DC2626' }
        }
      ];

      return { nodes: sampleNodes, edges: sampleEdges };
    }

    // Build dynamically from report.path
    const dynamicNodes: Node[] = report.path.map((step, idx) => {
      const isLast = idx === report.path.length - 1;
      const borderColor = isLast ? 'border-red-300' : idx === 0 ? 'border-blue-300' : 'border-amber-300';
      const titleColor = isLast ? 'text-red-700' : idx === 0 ? 'text-blue-700' : 'text-amber-700';

      return {
        id: `node-path-${idx}`,
        position: { x: 50 + idx * 320, y: 140 },
        data: {
          label: (
            <div className={`p-3.5 bg-white border-2 ${borderColor} rounded-xl text-xs font-mono w-64 text-left shadow-md`}>
              <div className={`${titleColor} font-bold mb-1 flex items-center`}>
                <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] mr-1.5 font-bold border border-slate-200">
                  {idx + 1}
                </span>
                Step {idx + 1}
              </div>
              <div className="text-slate-600 text-[11px] mb-2 font-sans leading-relaxed line-clamp-3">
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
        style: { stroke: '#0284C7', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0284C7' }
      });
    }

    return { nodes: dynamicNodes, edges: dynamicEdges };
  }, [report, onSelectCitation]);

  return (
    <div className="w-full h-full bg-[#F8FAFC] relative">
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm flex items-center space-x-2">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span>Attack Path Flowchart (Animated Causality Chain)</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={true}
        className="bg-[#F8FAFC]"
      >
        <Background color="#CBD5E1" gap={16} />
        <Controls className="bg-white border border-slate-200 fill-slate-700 shadow-sm rounded-lg" />
      </ReactFlow>
    </div>
  );
};
