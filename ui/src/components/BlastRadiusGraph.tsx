import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BlastRadius, NodeImpact } from '../types';
import { CitationChip } from './CitationChip';

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

    // Helper for impact coloring (light theme)
    const getImpactStyle = (impact: NodeImpact) => {
      switch (impact) {
        case 'confirmed':
          return { border: 'border-red-300 bg-red-50/90', badge: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' };
        case 'likely':
          return { border: 'border-amber-300 bg-amber-50/90', badge: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' };
        case 'possible':
          return { border: 'border-yellow-300 bg-yellow-50/90', badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' };
        default:
          return { border: 'border-slate-200 bg-white', badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
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
            <div className={`p-3 rounded-xl border-2 ${style.border} text-xs font-mono w-56 text-left shadow-sm backdrop-blur-sm`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-800 font-bold truncate text-[11px]">{n.label}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded border ${style.badge}`}>
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
      { id: 'e-gw-orders', source: 'gw', target: 'r_orders', animated: true, style: { stroke: '#0284C7' } },
      { id: 'e-gw-prod', source: 'gw', target: 'r_products', animated: true, style: { stroke: '#0284C7' } },
      { id: 'e-orders-fn', source: 'r_orders', target: 'fn_orders', animated: true, style: { stroke: '#DC2626' } },
      { id: 'e-orders-pool', source: 'r_orders', target: 'pool', animated: true, style: { stroke: '#D97706' } },
      { id: 'e-prod-pool', source: 'r_products', target: 'pool', animated: true, style: { stroke: '#D97706' } },
      { id: 'e-fn-cust', source: 'fn_orders', target: 'db_customers', animated: true, style: { stroke: '#CA8A04' } },
      { id: 'e-fn-pay', source: 'fn_orders', target: 'db_payments', animated: true, style: { stroke: '#CA8A04' } },
      { id: 'e-fn-ord', source: 'fn_orders', target: 'db_orders', animated: true, style: { stroke: '#DC2626' } },
      { id: 'e-pool-inv', source: 'pool', target: 'db_inventory', animated: true, style: { stroke: '#D97706' } },
    ];

    return { nodes: flowNodes, edges: flowEdges };
  }, [blastRadius, onSelectCitation]);

  return (
    <div className="w-full h-full bg-[#F8FAFC] relative">
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur border border-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm flex items-center space-x-3">
        <span className="font-bold text-slate-900">Blast Radius Graph</span>
        <div className="flex items-center space-x-2.5 text-[11px]">
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1" /> Confirmed</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1" /> Likely</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-500 mr-1" /> Possible</span>
        </div>
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
