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
import { BlastRadius, NodeImpact } from '../types';
import { CitationChip } from './CitationChip';
import { Database, Route, Server, Lock, Layers, AlertTriangle } from 'lucide-react';

interface BlastRadiusGraphProps {
  blastRadius: BlastRadius | null;
  onSelectCitation: (citation: string) => void;
}

export const BlastRadiusGraph: React.FC<BlastRadiusGraphProps> = ({ blastRadius, onSelectCitation }) => {
  const { nodes, edges } = useMemo(() => {
    const defaultNodes: Array<{ id: string; label: string; type: string; impact: NodeImpact; pos: [number, number]; cite?: string }> = [
      { id: 'gw', label: 'Gateway (:8080)', type: 'gateway', impact: 'none', pos: [50, 150] },
      { id: 'r_orders', label: 'Route: /api/orders', type: 'route', impact: 'confirmed', pos: [260, 60], cite: 'LOG-0001' },
      { id: 'r_products', label: 'Route: /api/products', type: 'route', impact: 'likely', pos: [260, 240] },
      { id: 'fn_orders', label: 'Func: orders()', type: 'func', impact: 'confirmed', pos: [480, 60], cite: 'FILE:target_app/v1.5.0/app.py:53' },
      { id: 'pool', label: 'Pool: Postgres (max=5)', type: 'pool', impact: 'confirmed', pos: [480, 240] },
      { id: 'db_customers', label: 'Table: customers (PII)', type: 'table', impact: 'possible', pos: [720, 40], cite: 'GRAPH:table:customers' },
      { id: 'db_payments', label: 'Table: payments (Financial)', type: 'table', impact: 'possible', pos: [720, 140], cite: 'GRAPH:table:payments' },
      { id: 'db_inventory', label: 'Table: inventory', type: 'table', impact: 'likely', pos: [720, 240] },
      { id: 'db_orders', label: 'Table: orders', type: 'table', impact: 'confirmed', pos: [720, 340] },
    ];

    // Helper for impact coloring
    const getImpactStyle = (impact: NodeImpact) => {
      switch (impact) {
        case 'confirmed':
          return { border: 'border-red-500 bg-red-950/40', badge: 'bg-red-950 text-red-300 border-red-800', dot: 'bg-red-400' };
        case 'likely':
          return { border: 'border-amber-500 bg-amber-950/40', badge: 'bg-amber-950 text-amber-300 border-amber-800', dot: 'bg-amber-400' };
        case 'possible':
          return { border: 'border-yellow-500 bg-yellow-950/40', badge: 'bg-yellow-950 text-yellow-300 border-yellow-800', dot: 'bg-yellow-400' };
        default:
          return { border: 'border-slate-700 bg-slate-900', badge: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-400' };
      }
    };

    const flowNodes: Node[] = defaultNodes.map((n) => {
      // If blastRadius nodes provided, match impact
      let impact = n.impact;
      let cite = n.cite;
      if (blastRadius?.nodes) {
        const found = blastRadius.nodes.find(b => b.node_id === n.id || b.node_id.includes(n.id) || n.label.toLowerCase().includes(b.node_id.toLowerCase()));
        if (found) {
          impact = found.impact;
          if (found.citations?.[0]) cite = found.citations[0];
        }
      }

      const style = getImpactStyle(impact);

      return {
        id: n.id,
        position: { x: n.pos[0], y: n.pos[1] },
        data: {
          label: (
            <div className={`p-3 rounded-lg border ${style.border} text-xs font-mono w-56 text-left shadow-lg backdrop-blur-sm`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-100 font-bold truncate">{n.label}</span>
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${style.badge}`}>
                  {impact}
                </span>
                {cite && (
                  <CitationChip citation={cite} onClick={onSelectCitation} className="text-[10px]" />
                )}
              </div>
            </div>
          )
        }
      };
    });

    const flowEdges: Edge[] = [
      { id: 'e-gw-orders', source: 'gw', target: 'r_orders', animated: true, style: { stroke: '#06B6D4' } },
      { id: 'e-gw-prod', source: 'gw', target: 'r_products', animated: true, style: { stroke: '#06B6D4' } },
      { id: 'e-orders-fn', source: 'r_orders', target: 'fn_orders', animated: true, style: { stroke: '#EF4444' } },
      { id: 'e-orders-pool', source: 'r_orders', target: 'pool', animated: true, style: { stroke: '#F59E0B' } },
      { id: 'e-prod-pool', source: 'r_products', target: 'pool', animated: true, style: { stroke: '#F59E0B' } },
      { id: 'e-fn-cust', source: 'fn_orders', target: 'db_customers', animated: true, style: { stroke: '#EAB308' } },
      { id: 'e-fn-pay', source: 'fn_orders', target: 'db_payments', animated: true, style: { stroke: '#EAB308' } },
      { id: 'e-fn-ord', source: 'fn_orders', target: 'db_orders', animated: true, style: { stroke: '#EF4444' } },
      { id: 'e-pool-inv', source: 'pool', target: 'db_inventory', animated: true, style: { stroke: '#F59E0B' } },
    ];

    return { nodes: flowNodes, edges: flowEdges };
  }, [blastRadius, onSelectCitation]);

  return (
    <div className="w-full h-full bg-[#0B0F19] relative">
      <div className="absolute top-4 left-4 z-10 bg-[#111827]/90 backdrop-blur border border-[#334155] px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 flex items-center space-x-3">
        <span className="font-bold text-slate-100">Blast Radius Graph</span>
        <div className="flex items-center space-x-2 text-[11px]">
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-400 mr-1" /> Confirmed</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-400 mr-1" /> Likely</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-400 mr-1" /> Possible</span>
        </div>
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
