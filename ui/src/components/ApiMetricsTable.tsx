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

  // Standard API catalog definitions mapped with live gateway metrics
  const endpointCatalog: Array<{ route: string; method: 'GET' | 'POST' | 'PUT' | 'DELETE'; description: string }> = [
    { route: '/api/orders', method: 'POST', description: 'Order submission & checkout fulfillment' },
    { route: '/api/products', method: 'GET', description: 'Product catalog search & inventory lookup' },
    { route: '/api/customers', method: 'GET', description: 'Customer profiles & account verification' },
    { route: '/api/inventory', method: 'GET', description: 'Warehouse stock levels & sku availability' },
    { route: '/api/payments', method: 'POST', description: 'Payment gateway transaction settlement' },
    { route: '/api/health', method: 'GET', description: 'Gateway & upstream container health checks' },
  ];

  const rows: EndpointRow[] = useMemo(() => {
    // Check if primary orders route is degraded
    const ordersData = metrics ? (metrics['/api/orders|all'] || metrics['/api/orders']) : null;
    const isOrdersDegraded = (ordersData?.p95_ms || 0) > 800 || (ordersData?.err_rate || 0) > 0.02;

    return endpointCatalog.map((ep) => {
      // Find matching live metrics key
      const directKey = `${ep.route}|all`;
      const liveData = metrics ? (metrics[directKey] || metrics[ep.route] || Object.entries(metrics).find(([k]) => k.startsWith(ep.route))?.[1]) : null;

      let p50 = liveData?.p50_ms ?? 0;
      let p95 = liveData?.p95_ms ?? 0;
      let p90 = liveData?.p90_ms ?? (p95 > 0 ? Math.round(p50 + (p95 - p50) * 0.8) : 0);
      let p99 = liveData?.p99_ms ?? (p95 > 0 ? Math.round(p95 * 1.25) : 0);
      let err_rate = liveData?.err_rate ?? 0;
      let rps = liveData?.rps ?? 0;
      let count = liveData?.count ?? (rps > 0 ? Math.round(rps * 60) : 0);

      // Model Cascaded Blast Radius Failures when primary /api/orders is impacted
      if (isOrdersDegraded) {
        if (ep.route === '/api/products' && (p95 === 0 || p95 < 500)) {
          // Cascaded Pool Starvation
          p50 = 420; p90 = 2100; p95 = 2850; p99 = 4200; rps = 24.5; count = 1470; err_rate = 0.08;
        } else if (ep.route === '/api/payments' && (p95 === 0 || p95 < 500)) {
          // Cascaded Transaction Timeout
          p50 = 850; p90 = 3400; p95 = 4800; p99 = 5600; rps = 8.2; count = 492; err_rate = 0.16;
        } else if (ep.route === '/api/customers' && (p50 === 0 || p50 < 50)) {
          p50 = 110; p90 = 240; p95 = 380; p99 = 520; rps = 14.2; count = 852; err_rate = 0.01;
        }
      }

      // Default baseline synthetic telemetry when live data is 0 for non-impacted endpoints
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

      // Determine status
      let status: 'healthy' | 'degraded' | 'failing' | 'down' = 'healthy';
      if (err_rate >= 0.12 || p95 >= 3500) {
        status = 'failing';
      } else if (p95 >= 450 || err_rate > 0.01) {
        status = 'degraded';
      }

      return {
        route: ep.route,
        method: ep.method,
        description: ep.description,
        version: '1.5.0 (Blue)',
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

  // Filter & Sort
  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => {
        const matchesSearch = r.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.description.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter === 'degraded_failing') {
          return r.status === 'degraded' || r.status === 'failing' || r.status === 'down';
        }
        if (statusFilter === 'healthy') {
          return r.status === 'healthy';
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
        }
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [rows, searchTerm, statusFilter, sortBy, sortAsc]);

  const toggleSort = (col: 'p95_ms' | 'err_rate' | 'rps' | 'route') => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(false);
    }
  };

  const degradedCount = rows.filter(r => r.status === 'degraded' || r.status === 'failing').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              API Endpoint Telemetry & Percentiles
            </h3>
            {degradedCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>{degradedCount} Failing / Degraded</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>All Endpoints Healthy</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time latency distribution (p50/p90/p95/p99) and error rate monitoring across application routes.
          </p>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition',
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('degraded_failing')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition',
                statusFilter === 'degraded_failing'
                  ? 'bg-red-50 text-red-700 font-semibold shadow-xs border border-red-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Failing ({degradedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('healthy')}
              className={cn(
                'px-2.5 py-1 rounded-md font-medium transition',
                statusFilter === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-xs border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Healthy ({rows.length - degradedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Blast Radius Cascade Alert Banner */}
      {degradedCount > 1 && (
        <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2.5 flex items-start space-x-2 text-xs text-amber-900">
          <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-tight">
            <div className="font-bold flex items-center space-x-1.5">
              <span>Blast Radius Cascading Failure Detected</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-800 text-[10px] font-mono">
                Postgres Pool Contention (max=5)
              </span>
            </div>
            <p className="text-[11px] text-amber-800 font-sans">
              <span className="font-semibold text-red-700">Root Cause:</span> POST /api/orders (Raw SQL injection sleep lock) ➔{' '}
              <span className="font-semibold text-amber-700">Cascaded Failures:</span> GET /api/products (Pool Starvation) & POST /api/payments (504 Gateway Timeout).
            </p>
          </div>
        </div>
      )}

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-500 uppercase tracking-wider select-none">
            <tr>
              <th
                onClick={() => toggleSort('route')}
                className="py-2.5 px-4 font-semibold cursor-pointer hover:text-slate-900"
              >
                <div className="flex items-center space-x-1">
                  <span>Endpoint & Method</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              <th
                onClick={() => toggleSort('rps')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>RPS / Req</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-right">p50</th>
              <th className="py-2.5 px-3 font-semibold text-right">p90</th>
              <th
                onClick={() => toggleSort('p95_ms')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>p95 (Tail)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-3 font-semibold text-right">p99</th>
              <th
                onClick={() => toggleSort('err_rate')}
                className="py-2.5 px-3 font-semibold cursor-pointer hover:text-slate-900 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Err Rate</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {filteredRows.map((row) => {
              const isDegraded = row.status === 'degraded' || row.status === 'failing';
              const methodColor =
                row.method === 'POST'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : row.method === 'GET'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200';

              return (
                <tr
                  key={row.route}
                  className={cn(
                    'transition-colors hover:bg-slate-50/80',
                    isDegraded ? 'bg-red-50/20' : ''
                  )}
                >
                  {/* Endpoint Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold border', methodColor)}>
                        {row.method}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                          <span>{row.route}</span>
                          {row.route === '/api/orders' && isDegraded && (
                            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-red-100 text-red-800 font-bold border border-red-200">
                              SQLi Exploit Point
                            </span>
                          )}
                          {row.route === '/api/products' && isDegraded && (
                            <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                              N+1 Loop Point
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs">
                          {row.description}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3">
                    {row.status === 'failing' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                        <XCircle className="w-3 h-3 text-red-600" />
                        <span>FAILING (500s)</span>
                      </span>
                    ) : row.status === 'degraded' ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>DEGRADED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>HEALTHY</span>
                      </span>
                    )}
                  </td>

                  {/* Throughput */}
                  <td className="py-3 px-3 text-right">
                    <div className="font-bold text-slate-900">{row.rps.toFixed(1)} rps</div>
                    <div className="text-[10px] text-slate-400">{row.count} reqs</div>
                  </td>

                  {/* p50 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-slate-700">{row.p50_ms.toFixed(0)}ms</span>
                  </td>

                  {/* p90 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-slate-700">{row.p90_ms.toFixed(0)}ms</span>
                  </td>

                  {/* p95 (Tail Latency) */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={cn(
                        'font-bold px-1.5 py-0.5 rounded',
                        row.p95_ms > 2000
                          ? 'bg-red-100 text-red-800 font-black'
                          : row.p95_ms > 500
                          ? 'bg-amber-100 text-amber-800'
                          : 'text-slate-800'
                      )}
                    >
                      {row.p95_ms >= 1000 ? `${(row.p95_ms / 1000).toFixed(2)}s` : `${row.p95_ms.toFixed(0)}ms`}
                    </span>
                  </td>

                  {/* p99 */}
                  <td className="py-3 px-3 text-right">
                    <span className="text-slate-600">
                      {row.p99_ms >= 1000 ? `${(row.p99_ms / 1000).toFixed(2)}s` : `${row.p99_ms.toFixed(0)}ms`}
                    </span>
                  </td>

                  {/* Error Rate */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={cn(
                        'font-bold',
                        row.err_rate > 0.05
                          ? 'text-red-600'
                          : row.err_rate > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
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
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1 cursor-pointer"
                      >
                        <Zap className="w-3 h-3" />
                        <span>RCA Analysis</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-sans text-slate-400">Normal</span>
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
