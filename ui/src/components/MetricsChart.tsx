import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { RouteMetrics } from '../types';
import { Activity, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MetricsChartProps {
  metrics: Record<string, RouteMetrics> | null;
  selectedRoute: string;
  markerText?: string;
  onInvestigate?: () => void;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  selectedRoute,
  markerText,
  onInvestigate
}) => {
  const currentMetric = metrics?.[selectedRoute] || metrics?.['/api/orders|all'] || {
    p50_ms: 120,
    p95_ms: 140,
    err_rate: 0.0,
    rps: 15.4
  };

  const chartData = currentMetric.history || [
    { time: '-60s', p50: 110, p95: 125, err_rate: 0.0 },
    { time: '-50s', p50: 115, p95: 130, err_rate: 0.0 },
    { time: '-40s', p50: 120, p95: 135, err_rate: 0.0 },
    { time: '-30s', p50: 118, p95: 140, err_rate: 0.0 },
    { time: '-20s', p50: currentMetric.p50_ms * 0.8, p95: currentMetric.p95_ms * 0.85, err_rate: currentMetric.err_rate * 0.7 },
    { time: '-10s', p50: currentMetric.p50_ms * 0.95, p95: currentMetric.p95_ms * 0.98, err_rate: currentMetric.err_rate * 0.9 },
    { time: 'now', p50: currentMetric.p50_ms, p95: currentMetric.p95_ms, err_rate: currentMetric.err_rate * 100 },
  ];

  const isDegraded = currentMetric.p95_ms > 1000 || currentMetric.err_rate > 0.01;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4">
      {/* Top summary cards */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center space-x-2">
              <span>Live Gateway Telemetry</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                {selectedRoute}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Real-time reverse proxy latency and throughput statistics
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* p50 */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-slate-500">p50:</span>
            <span className="text-blue-600 font-bold">{Math.round(currentMetric.p50_ms)}ms</span>
          </div>

          {/* p95 */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-slate-500">p95:</span>
            <span className={isDegraded ? 'text-red-600 font-bold animate-pulse' : 'text-slate-800 font-bold'}>
              {Math.round(currentMetric.p95_ms)}ms
            </span>
          </div>

          {/* Error Rate */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-slate-500">Err:</span>
            <span className={currentMetric.err_rate > 0.01 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
              {(currentMetric.err_rate * 100).toFixed(1)}%
            </span>
          </div>

          {/* RPS */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-slate-500">RPS:</span>
            <span className="text-slate-800 font-bold">{currentMetric.rps || 12.0}</span>
          </div>
        </div>
      </div>

      {/* Latency & Error Chart */}
      <div className="h-44 w-full bg-slate-50/50 rounded-lg border border-slate-200 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#CBD5E1',
                borderRadius: '0.5rem',
                fontSize: '12px',
                color: '#0F172A',
                fontFamily: 'monospace',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            {markerText && (
              <ReferenceLine
                x="now"
                stroke="#DC2626"
                strokeDasharray="3 3"
                label={{ value: markerText, fill: '#DC2626', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#D97706"
              strokeWidth={2}
              dot={false}
              name="p95 (ms)"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
              name="p50 (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Real-Time Degradation Alert Banner */}
      {isDegraded && (
        <div className="bg-red-50 border border-red-200 p-3.5 rounded-lg flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <div>
              <div className="font-bold text-red-900 flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>ACTIVE INCIDENT: High Latency Surge Detected</span>
                <span className="font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded border border-red-200">
                  p95 @ {Math.round(currentMetric.p95_ms)}ms
                </span>
              </div>
              <p className="text-[11px] text-red-700 font-mono mt-0.5">
                Database connection pool (5/5) blocked. Gateway timeouts causing HTTP 504/500 errors.
              </p>
            </div>
          </div>

          {onInvestigate && (
            <button
              type="button"
              onClick={onInvestigate}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold font-mono shrink-0 shadow-xs flex items-center space-x-1.5 transition active:scale-98"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Correlate RCA</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
