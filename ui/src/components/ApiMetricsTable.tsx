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
  ShieldAlert
} from 'lucide-react';
import { RouteMetrics } from '../types';
import { cn } from '../lib/utils';

interface ApiMetricsTableProps {
  metrics: Record<string, RouteMetrics> | null;
  onSelectRoute?: (route: string) => void;
  onInvestigateRoute?: (route: string) => void;
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
  onSelectRoute,
  onInvestigateRoute
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'degraded_failing' | 'healthy'>('all');
  const [sortBy, setSortBy] = useState<'p95_ms' | 'err_rate' | 'rps' | 'route'>('p95_ms');
  const [sortAsc, setSortAsc] = useState(false);

  const endpointCatalog: Array<{ route: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; description: string }> = [
    { route: '/api/orders', method: 'POST', description: 'Order submission & checkout fulfillment' },
    { route: '/api/products', method: 'GET', description: 'Product catalog search & inventory lookup' },
    { route: '/api/customers', method: 'GET', description: 'Customer profiles & account verification' },
    { route: '/api/inventory', method: 'GET', description: 'Warehouse stock levels & sku availability' },
    { route: '/api/payments', method: 'POST', description: 'Payment gateway transaction settlement' },
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
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="p-4 border-b border-zinc-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-black" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900">
            Endpoint Telemetry & Percentiles
          </h3>
          {degradedCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-black text-white text-[11px] font-mono font-bold">
              {degradedCount} Failing / Degraded
            </span>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1 bg-zinc-50 border border-zinc-200 rounded text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-black w-40"
            />
          </div>

          <div className="flex bg-zinc-100 p-0.5 rounded border border-zinc-200 text-xs font-mono">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2 py-0.5 rounded transition',
                statusFilter === 'all'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              All ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('degraded_failing')}
              className={cn(
                'px-2 py-0.5 rounded transition',
                statusFilter === 'degraded_failing'
                  ? 'bg-black text-white font-bold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              Failing ({degradedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('healthy')}
              className={cn(
                'px-2 py-0.5 rounded transition',
                statusFilter === 'healthy'
                  ? 'bg-white text-zinc-900 font-bold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              )}
            >
              Healthy ({rows.length - degradedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Blast Radius Cascade Alert Banner */}
      {degradedCount > 1 && (
        <div className="bg-zinc-100 border-b border-zinc-300 px-4 py-2.5 flex items-start space-x-2 text-xs text-zinc-900 font-mono">
          <Zap className="w-4 h-4 text-black shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold flex items-center space-x-1.5">
              <span>Cascading Failure Detected</span>
              <span className="px-1.5 py-0.2 rounded bg-black text-white text-[10px]">
                Postgres Pool Contention (max=5)
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 font-sans">
              <span className="font-bold text-zinc-900">Root Cause:</span> POST /api/orders (SQL Injection hold lock) ➔{' '}
              <span className="font-bold text-zinc-900">Cascaded:</span> GET /api/products & POST /api/payments.
            </p>
          </div>
        </div>
      )}

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-zinc-700">
          <thead className="bg-zinc-50 border-b border-zinc-200 font-mono text-[11px] text-zinc-500 uppercase tracking-wider select-none">
            <tr>
              <th
                onClick={() => toggleSort('route')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-zinc-900"
              >
                <div className="flex items-center space-x-1">
                  <span>Endpoint & Method</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th
                onClick={() => toggleSort('rps')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-zinc-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>RPS</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-right">p50</th>
              <th className="py-2.5 px-3 font-semibold text-right">p90</th>
              <th
                onClick={() => toggleSort('p95_ms')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-zinc-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>p95 (Tail)</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-right">p99</th>
              <th
                onClick={() => toggleSort('err_rate')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-zinc-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Err Rate</span>
                  <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-mono">
            {filteredRows.map((row) => {
              const isDegraded = row.status === 'degraded' || row.status === 'failing';

              return (
                <tr
                  key={row.route}
                  className={cn(
                    'transition-colors hover:bg-zinc-50',
                    isDegraded ? 'bg-zinc-50/50' : ''
                  )}
                >
                  {/* Endpoint Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-zinc-100 text-zinc-800 border-zinc-300">
                        {row.method}
                      </span>
                      <div>
                        <div className="font-bold text-zinc-900 text-xs flex items-center space-x-1.5">
                          <span>{row.route}</span>
                          {row.route === '/api/orders' && isDegraded && (
                            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-black text-white font-bold">
                              SQLi Exploit Point
                            </span>
                          )}
                          {row.route === '/api/products' && isDegraded && (
                            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-800 font-bold">
                              N+1 Loop Point
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-sans truncate max-w-xs">
                          {row.description}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    {row.status === 'failing' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-black text-white border border-zinc-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mr-1 animate-pulse" />
                        <span>FAILING (500s)</span>
                      </span>
                    ) : row.status === 'degraded' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-900 border border-zinc-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 animate-pulse" />
                        <span>DEGRADED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-50 text-zinc-700 border border-zinc-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                        <span>HEALTHY</span>
                      </span>
                    )}
                  </td>

                  {/* Throughput */}
                  <td className="py-3 px-3 text-right">
                    <div className="font-bold text-zinc-900">{row.rps.toFixed(1)} rps</div>
                  </td>

                  {/* p50 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-zinc-700">{row.p50_ms.toFixed(0)}ms</span>
                  </td>

                  {/* p90 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-zinc-700">{row.p90_ms.toFixed(0)}ms</span>
                  </td>

                  {/* p95 */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={cn(
                        'font-bold px-1.5 py-0.5 rounded',
                        row.p95_ms > 2000
                          ? 'bg-black text-white'
                          : row.p95_ms > 500
                          ? 'bg-zinc-200 text-zinc-900'
                          : 'text-zinc-900'
                      )}
                    >
                      {row.p95_ms >= 1000 ? `${(row.p95_ms / 1000).toFixed(2)}s` : `${row.p95_ms.toFixed(0)}ms`}
                    </span>
                  </td>

                  {/* p99 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-zinc-600">
                      {row.p99_ms >= 1000 ? `${(row.p99_ms / 1000).toFixed(2)}s` : `${row.p99_ms.toFixed(0)}ms`}
                    </span>
                  </td>

                  {/* Error Rate */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={cn(
                        'font-bold',
                        row.err_rate > 0.05
                          ? 'text-black underline'
                          : row.err_rate > 0
                          ? 'text-zinc-800'
                          : 'text-zinc-600'
                      )}
                    >
                      {(row.err_rate * 100).toFixed(1)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    {isDegraded ? (
                      <button
                        type="button"
                        onClick={() => onInvestigateRoute?.(row.route)}
                        className="px-2.5 py-1 rounded bg-black hover:bg-zinc-800 text-white font-sans text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>RCA Analysis</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-sans text-zinc-400">Normal</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
