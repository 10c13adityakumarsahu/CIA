import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ArrowUpDown,
  Zap,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  GitPullRequest,
  Database,
  ArrowRight
} from 'lucide-react';
import { RouteMetrics } from '../types';
import { cn } from '../lib/utils';

interface ApiMetricsTableProps {
  metrics: Record<string, RouteMetrics> | null;
  selectedRoute?: string;
  onSelectRoute?: (route: string) => void;
  onInvestigateRoute?: (route: string) => void;
  onViewBlastRadius?: (route: string) => void;
  onViewDiff?: (route: string) => void;
  onTriggerAttack?: (route: string) => void;
  isFixing?: boolean;
  activeProcessingRoute?: string | null;
}

interface EndpointRow {
  route: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  version: string;
  status: 'healthy' | 'degraded' | 'failing' | 'down';
  count: number;
  rps: number;
  p50_ms: number;
  p90_ms: number;
  p95_ms: number;
  p99_ms: number;
  err_rate: number;
  rawKey: string;
}

export const ApiMetricsTable: React.FC<ApiMetricsTableProps> = ({
  metrics,
  selectedRoute = '/api/orders',
  onSelectRoute,
  onInvestigateRoute,
  onViewBlastRadius,
  onViewDiff,
  onTriggerAttack,
  isFixing = false,
  activeProcessingRoute = null
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'degraded_failing' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'p95_ms' | 'err_rate' | 'rps' | 'route'>('p95_ms');
  const [sortAsc, setSortAsc] = useState(false);

  const endpointCatalog: Array<{ route: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; description: string }> = [
    { route: '/api/orders', method: 'POST', description: 'Order submission & checkout fulfillment' },
    { route: '/api/products', method: 'GET', description: 'Product catalog search & inventory lookup' },
    { route: '/api/payments', method: 'POST', description: 'Payment gateway transaction settlement' },
    { route: '/api/customers', method: 'GET', description: 'Customer profiles & account verification' },
    { route: '/api/inventory', method: 'GET', description: 'Warehouse stock levels & sku availability' },
    { route: '/api/health', method: 'GET', description: 'Gateway & upstream container health checks' },
  ];

  const rows: EndpointRow[] = useMemo(() => {
    const ordersData = metrics ? (metrics['/api/orders|all'] || metrics['/api/orders']) : null;
    const isOrdersDegraded = (ordersData?.p95_ms || 0) > 800 || (ordersData?.err_rate || 0) > 0.02;

    return endpointCatalog.map((ep) => {
      const directKey = `${ep.route}|all`;
      const liveData = metrics ? (metrics[directKey] || metrics[ep.route] || Object.entries(metrics).find(([k]) => k.startsWith(ep.route))?.[1]) : null;

      let p50 = liveData?.p50_ms ?? 0;
      let p95 = liveData?.p95_ms ?? 0;
      let p90 = liveData?.p90_ms ?? (p95 > 0 ? Math.round(p50 + (p95 - p50) * 0.8) : 0);
      let p99 = liveData?.p99_ms ?? (p95 > 0 ? Math.round(p95 * 1.25) : 0);
      let err_rate = liveData?.err_rate ?? 0;
      let rps = liveData?.rps ?? 0;
      let count = liveData?.count ?? (rps > 0 ? Math.round(rps * 60) : 0);

      if (isOrdersDegraded) {
        if (ep.route === '/api/products' && (p95 === 0 || p95 < 500)) {
          p50 = 420; p90 = 2100; p95 = 2850; p99 = 4200; rps = 24.5; count = 1470; err_rate = 0.08;
        } else if (ep.route === '/api/payments' && (p95 === 0 || p95 < 500)) {
          p50 = 850; p90 = 3400; p95 = 4800; p99 = 5600; rps = 8.2; count = 492; err_rate = 0.16;
        } else if (ep.route === '/api/customers' && (p50 === 0 || p50 < 50)) {
          p50 = 110; p90 = 240; p95 = 380; p99 = 520; rps = 14.2; count = 852; err_rate = 0.01;
        }
      }

      if (p50 === 0 && rps === 0) {
        if (ep.route === '/api/customers') {
          p50 = 24; p90 = 42; p95 = 58; p99 = 82; rps = 14.2; count = 852; err_rate = 0.0;
        } else if (ep.route === '/api/inventory') {
          p50 = 18; p90 = 31; p95 = 45; p99 = 64; rps = 18.5; count = 1110; err_rate = 0.0;
        } else if (ep.route === '/api/payments') {
          p50 = 85; p90 = 120; p95 = 145; p99 = 210; rps = 6.4; count = 384; err_rate = 0.0;
        } else if (ep.route === '/api/health') {
          p50 = 2; p90 = 4; p95 = 6; p99 = 10; rps = 30.0; count = 1800; err_rate = 0.0;
        }
      }

      let status: 'healthy' | 'degraded' | 'failing' | 'down' = 'healthy';
      if (err_rate > 0.05 || p95 > 3500) {
        status = 'failing';
      } else if (err_rate > 0.01 || p95 > 800) {
        status = 'degraded';
      }

      return {
        route: ep.route,
        method: ep.method,
        description: ep.description,
        version: 'v1.5.0',
        status,
        count,
        rps,
        p50_ms: p50,
        p90_ms: p90,
        p95_ms: p95,
        p99_ms: p99,
        err_rate,
        rawKey: directKey
      };
    });
  }, [metrics]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const matchesSearch =
          r.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.description.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter === 'degraded_failing') {
          return r.status === 'degraded' || r.status === 'failing';
        }
        if (statusFilter === 'healthy') {
          return r.status === 'healthy';
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        }
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [rows, searchTerm, statusFilter, sortBy, sortAsc]);

  const degradedCount = rows.filter((r) => r.status === 'degraded' || r.status === 'failing').length;

  const toggleSort = (field: 'p95_ms' | 'err_rate' | 'rps' | 'route') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs flex flex-col h-full justify-between select-none">
      {/* Header Bar */}
      <div>
        <div className="p-3 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-[#0176D3]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900 font-mono">
              Endpoint Telemetry
            </h3>
            {degradedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#0176D3] text-white text-[10px] font-mono font-bold shadow-2xs">
                {degradedCount} Impacted
              </span>
            )}
          </div>

          {/* Filter Controls */}
          <div className="flex items-center space-x-1.5">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Filter route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-7 pr-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[11px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-[#0176D3] w-28 font-mono"
              />
            </div>

            <div className="flex bg-zinc-100 p-0.5 rounded border border-zinc-200 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={cn(
                  'px-2 py-0.2 rounded transition',
                  statusFilter === 'all'
                    ? 'bg-white text-zinc-900 font-bold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('degraded_failing')}
                className={cn(
                  'px-2 py-0.2 rounded transition',
                  statusFilter === 'degraded_failing'
                    ? 'bg-[#0176D3] text-white font-bold shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                Failing
              </button>
            </div>
          </div>
        </div>

        {/* Blast Radius Cascade Alert */}
        {degradedCount > 1 && (
          <div className="bg-blue-50/60 border-b border-blue-200 px-3 py-1.5 flex items-center justify-between text-xs text-zinc-900 font-mono">
            <div className="flex items-center space-x-1.5 text-[11px] truncate">
              <Zap className="w-3.5 h-3.5 text-[#0176D3] shrink-0" />
              <span className="font-bold text-[#0176D3]">Postgres Pool Contention:</span>
              <span className="text-zinc-700 truncate">/api/orders lock cascading to products & payments</span>
            </div>
            {onViewBlastRadius && (
              <button
                type="button"
                onClick={() => onViewBlastRadius('/api/orders')}
                className="px-2.5 py-0.5 bg-[#0176D3] hover:bg-[#014486] text-white text-[10px] rounded font-bold transition shrink-0 ml-2 shadow-2xs"
              >
                View Map →
              </button>
            )}
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700">
            <thead className="bg-zinc-50 border-b border-zinc-200 font-mono text-[10px] text-zinc-500 uppercase tracking-wider select-none">
              <tr>
                <th className="py-2 px-3 font-semibold">Endpoint</th>
                <th className="py-2 px-2 font-semibold">Status</th>
                <th className="py-2 px-2 font-semibold text-right">RPS</th>
                <th className="py-2 px-2 font-semibold text-right">p50</th>
                <th className="py-2 px-2 font-semibold text-right">p95 (Tail)</th>
                <th className="py-2 px-3 font-semibold text-right">Direct Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
              {filteredRows.map((row) => {
                const isDegraded = row.status === 'degraded' || row.status === 'failing';
                const isSelected = row.route === selectedRoute;
                const isCurrentlyFixing = isFixing && activeProcessingRoute === row.route;

                return (
                  <tr
                    key={row.route}
                    onClick={() => onSelectRoute?.(row.route)}
                    className={cn(
                      'transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-blue-50/80 ring-2 ring-[#0176D3] font-semibold text-zinc-900 shadow-2xs'
                        : isDegraded
                        ? 'bg-zinc-50/70 hover:bg-blue-50/40'
                        : 'hover:bg-zinc-50/80'
                    )}
                  >
                    {/* Endpoint Name */}
                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-zinc-100 text-zinc-800 border-zinc-300">
                          {row.method}
                        </span>
                        <div>
                          <div className="font-bold text-zinc-900 text-xs flex items-center space-x-1.5">
                            <span>{row.route}</span>
                            {row.route === '/api/orders' && isDegraded && (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-[#0176D3] text-white font-bold">
                                Exploit Point
                              </span>
                            )}
                            {row.route === '/api/products' && isDegraded && (
                              <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-amber-600 text-white font-semibold">
                                Pool Starved
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-2">
                      {row.status === 'failing' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-[#0176D3] text-white shadow-2xs">
                          FAILING
                        </span>
                      ) : row.status === 'degraded' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          DEGRADED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          OK
                        </span>
                      )}
                    </td>

                    {/* Throughput */}
                    <td className="py-2 px-2 text-right">
                      <span className="text-zinc-900 font-bold">{row.rps.toFixed(1)}</span>
                    </td>

                    {/* p50 */}
                    <td className="py-2 px-2 text-right">
                      <span className="text-zinc-600">{row.p50_ms.toFixed(0)}ms</span>
                    </td>

                    {/* p95 */}
                    <td className="py-2 px-2 text-right">
                      <span
                        className={cn(
                          'font-bold px-1.5 py-0.5 rounded',
                          row.p95_ms > 2000
                            ? 'bg-[#0176D3] text-white'
                            : row.p95_ms > 500
                            ? 'bg-amber-100 text-amber-900'
                            : 'text-zinc-900'
                        )}
                      >
                        {row.p95_ms >= 1000 ? `${(row.p95_ms / 1000).toFixed(2)}s` : `${row.p95_ms.toFixed(0)}ms`}
                      </span>
                    </td>

                    {/* Direct Actions from API End */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                        {isCurrentlyFixing ? (
                          <span className="px-2.5 py-0.5 rounded bg-[#0176D3] text-white font-sans text-[10px] font-bold shadow-xs animate-pulse">
                            Fixing...
                          </span>
                        ) : isDegraded ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectRoute?.(row.route);
                                onInvestigateRoute?.(row.route);
                              }}
                              className="px-2.5 py-1 rounded bg-[#0176D3] hover:bg-[#014486] text-white font-sans text-[10px] font-bold shadow-2xs transition cursor-pointer"
                              title="Drive human-in-the-loop investigation on this route"
                            >
                              Drive Flow
                            </button>
                            {onViewBlastRadius && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectRoute?.(row.route);
                                  onViewBlastRadius(row.route);
                                }}
                                className="px-1.5 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-sans text-[10px] font-semibold transition cursor-pointer"
                                title="Inspect blast radius cascade map"
                              >
                                <Database className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {row.route === '/api/orders' && onTriggerAttack && (
                              <button
                                type="button"
                                onClick={() => onTriggerAttack(row.route)}
                                className="px-2 py-0.5 rounded border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-800 font-sans text-[10px] font-bold transition cursor-pointer"
                                title="Initiate whitebox attack against this route"
                              >
                                Attack
                              </button>
                            )}
                            {onViewDiff && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectRoute?.(row.route);
                                  onViewDiff(row.route);
                                }}
                                className="px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 font-sans text-[10px] transition cursor-pointer"
                                title="View code diff"
                              >
                                <GitPullRequest className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-zinc-100 text-[10px] font-mono text-zinc-400 flex items-center justify-between bg-zinc-50/50">
        <span>Click 'Analyze' to isolate tainted AST and unified diff</span>
        <span>Gateway Upstream: :8001 / :8002</span>
      </div>
    </div>
  );
};
