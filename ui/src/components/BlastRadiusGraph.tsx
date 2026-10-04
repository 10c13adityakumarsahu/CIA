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
      { id: 'gw', label: 'Gateway (:8080)', type: 'gateway', impact: 'none', pos: [40, 240] },
      { id: 'r_orders', label: 'Route: /api/orders', type: 'route', impact: 'confirmed', pos: [320, 100], cite: 'LOG-0001' },
      { id: 'r_products', label: 'Route: /api/products', type: 'route', impact: 'likely', pos: [320, 380] },
      { id: 'fn_orders', label: 'Func: orders()', type: 'func', impact: 'confirmed', pos: [640, 100], cite: 'FILE:target_app/v1.5.0/app.py:53' },
      { id: 'pool', label: 'Pool: Postgres (max=5)', type: 'pool', impact: 'confirmed', pos: [640, 380] },
      { id: 'db_customers', label: 'Table: customers (PII)', type: 'table', impact: 'possible', pos: [960, 40], cite: 'GRAPH:table:customers' },
      { id: 'db_payments', label: 'Table: payments (Financial)', type: 'table', impact: 'possible', pos: [960, 180], cite: 'GRAPH:table:payments' },
      { id: 'db_inventory', label: 'Table: inventory', type: 'table', impact: 'likely', pos: [960, 320] },
      { id: 'db_orders', label: 'Table: orders', type: 'table', impact: 'confirmed', pos: [960, 460] },
    ];

    // Helper for impact styling (clean monochrome)
    const getImpactStyle = (impact: NodeImpact) => {
      switch (impact) {
        case 'confirmed':
          return { border: 'border-black bg-white shadow-xs', badge: 'bg-black text-white font-bold', tag: 'CRITICAL' };
        case 'likely':
          return { border: 'border-zinc-500 bg-white shadow-xs', badge: 'bg-zinc-800 text-white font-semibold', tag: 'STARVED' };
        case 'possible':
          return { border: 'border-zinc-300 bg-white shadow-xs', badge: 'bg-zinc-100 text-zinc-800 border border-zinc-200', tag: 'REACHABLE' };
        default:
          return { border: 'border-zinc-200 bg-zinc-50/50', badge: 'bg-zinc-100 text-zinc-500 border border-zinc-200', tag: 'NOMINAL' };
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
            <div className={`p-3 rounded-lg border-2 ${style.border} text-xs font-mono w-56 text-left`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-zinc-900 font-bold truncate text-[11px]">{n.label}</span>
                <span className="text-[9px] font-mono text-zinc-400 uppercase font-semibold">
                  {style.tag}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-100">
                <span className={`text-[10px] uppercase font-mono px-1.5 py-0.2 rounded ${style.badge}`}>
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
      { id: 'e-gw-orders', source: 'gw', target: 'r_orders', animated: true, style: { stroke: '#18181b', strokeWidth: 2 } },
      { id: 'e-gw-prod', source: 'gw', target: 'r_products', animated: true, style: { stroke: '#71717a', strokeWidth: 1.5 } },
      { id: 'e-orders-fn', source: 'r_orders', target: 'fn_orders', animated: true, style: { stroke: '#18181b', strokeWidth: 2 } },
      { id: 'e-orders-pool', source: 'r_orders', target: 'pool', animated: true, style: { stroke: '#18181b', strokeWidth: 2 } },
      { id: 'e-prod-pool', source: 'r_products', target: 'pool', animated: true, style: { stroke: '#71717a', strokeWidth: 1.5 } },
      { id: 'e-fn-cust', source: 'fn_orders', target: 'db_customers', animated: false, style: { stroke: '#a1a1aa', strokeDasharray: '4 4' } },
      { id: 'e-fn-pay', source: 'fn_orders', target: 'db_payments', animated: false, style: { stroke: '#a1a1aa', strokeDasharray: '4 4' } },
      { id: 'e-fn-ord', source: 'fn_orders', target: 'db_orders', animated: true, style: { stroke: '#18181b', strokeWidth: 2 } },
      { id: 'e-pool-inv', source: 'pool', target: 'db_inventory', animated: true, style: { stroke: '#71717a', strokeWidth: 1.5 } },
    ];

    return { nodes: flowNodes, edges: flowEdges };
  }, [blastRadius, onSelectCitation]);

  return (
    <div className="w-full h-full bg-[#FAFAFA] relative">
      <div className="absolute top-4 left-4 z-10 bg-white border border-zinc-200 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium text-zinc-800 shadow-xs flex items-center space-x-3">
        <span className="font-bold text-zinc-900 uppercase tracking-wider text-[11px]">Blast Radius Graph</span>
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="px-1.5 py-0.2 bg-black text-white rounded font-bold">CONFIRMED</span>
          <span className="px-1.5 py-0.2 bg-zinc-800 text-white rounded font-semibold">LIKELY</span>
          <span className="px-1.5 py-0.2 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded">POSSIBLE</span>
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        minZoom={0.4}
        maxZoom={1.2}
        nodesDraggable={true}
        className="bg-[#FAFAFA]"
      >
        <Background color="#E4E4E7" gap={16} />
        <Controls className="bg-white border border-zinc-200 fill-zinc-800 shadow-xs rounded" />
      </ReactFlow>
    </div>
  );
};
