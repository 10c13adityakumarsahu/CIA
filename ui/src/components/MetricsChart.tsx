import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { RouteMetrics } from '../types';
import { Activity, Clock, Zap, AlertOctagon } from 'lucide-react';

interface MetricsChartProps {
  metrics: Record<string, RouteMetrics> | null;
  selectedRoute: string;
  markerText?: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  selectedRoute,
  markerText
}) => {
  const currentMetric = metrics?.[selectedRoute] || metrics?.['/api/orders|all'] || {
    p50_ms: 120,
    p95_ms: 140,
    err_rate: 0.0,
    rps: 15.4
  };

  // Generate simulated historical trend if history is not provided
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
    <div className="bg-[#111827] border-b border-[#334155] p-4 flex flex-col space-y-3">
      {/* Top summary cards */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-300">
            Live Gateway Telemetry
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-[#0B0F19] text-cyan-300 border border-cyan-900">
            {selectedRoute}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* p50 */}
          <div className="bg-[#0B0F19] px-3 py-1.5 rounded border border-[#334155] flex items-center space-x-2 font-mono text-xs">
            <span className="text-slate-400">p50:</span>
            <span className="text-cyan-400 font-bold">{Math.round(currentMetric.p50_ms)}ms</span>
          </div>

          {/* p95 */}
          <div className="bg-[#0B0F19] px-3 py-1.5 rounded border border-[#334155] flex items-center space-x-2 font-mono text-xs">
            <span className="text-slate-400">p95:</span>
            <span className={isDegraded ? 'text-amber-400 font-bold animate-pulse' : 'text-slate-200 font-bold'}>
              {Math.round(currentMetric.p95_ms)}ms
            </span>
          </div>

          {/* Error Rate */}
          <div className="bg-[#0B0F19] px-3 py-1.5 rounded border border-[#334155] flex items-center space-x-2 font-mono text-xs">
            <span className="text-slate-400">Err:</span>
            <span className={currentMetric.err_rate > 0.01 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {(currentMetric.err_rate * 100).toFixed(1)}%
            </span>
          </div>

          {/* RPS */}
          <div className="bg-[#0B0F19] px-3 py-1.5 rounded border border-[#334155] flex items-center space-x-2 font-mono text-xs">
            <span className="text-slate-400">RPS:</span>
            <span className="text-slate-200 font-bold">{currentMetric.rps || 12.0}</span>
          </div>
        </div>
      </div>

      {/* Latency & Error Chart */}
      <div className="h-36 w-full bg-[#0B0F19] rounded-lg border border-[#334155] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 11 }} />
            <YAxis stroke="#64748B" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                borderColor: '#334155',
                borderRadius: '0.375rem',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
            {markerText && (
              <ReferenceLine
                x="now"
                stroke="#EF4444"
                strokeDasharray="3 3"
                label={{ value: markerText, fill: '#EF4444', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={false}
              name="p95 (ms)"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#06B6D4"
              strokeWidth={2}
              dot={false}
              name="p50 (ms)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
