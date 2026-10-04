import React, { useState, useEffect, useRef } from 'react';
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
import { cn } from '../lib/utils';

interface MetricsChartProps {
  metrics: Record<string, RouteMetrics> | null;
  selectedRoute: string;
  markerText?: string;
  onInvestigate?: () => void;
}

interface DataPoint {
  time: string;
  p50: number;
  p95: number;
  err_rate: number;
  rps: number;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({
  metrics,
  selectedRoute,
  markerText,
  onInvestigate
}) => {
  const currentMetric = metrics?.[selectedRoute] || metrics?.['/api/orders|all'] || {
    p50_ms: 22,
    p95_ms: 45,
    err_rate: 0.0,
    rps: 16.2
  };

  const isDegraded = currentMetric.p95_ms > 800 || currentMetric.err_rate > 0.02;

  // Initialize rolling live time-series buffer (30 points, 1s interval like Task Manager)
  const [series, setSeries] = useState<DataPoint[]>(() => {
    const now = Date.now();
    const initPoints: DataPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 1000);
      const timeStr = d.toTimeString().split(' ')[0];
      initPoints.push({
        time: timeStr,
        p50: 20 + Math.random() * 8,
        p95: 42 + Math.random() * 10,
        err_rate: 0.0,
        rps: 14 + Math.random() * 3
      });
    }
    return initPoints;
  });

  const currentMetricRef = useRef(currentMetric);
  useEffect(() => {
    currentMetricRef.current = currentMetric;
  }, [currentMetric]);

  // Rolling Live Clock ticker every 1,000ms
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      const m = currentMetricRef.current;

      // Small jitter for realistic live stream
      const jitter = (Math.random() - 0.5) * (m.p95_ms > 500 ? 150 : 6);
      const liveP50 = Math.max(5, Math.round(m.p50_ms + (Math.random() - 0.5) * 4));
      const liveP95 = Math.max(12, Math.round(m.p95_ms + jitter));
      const liveErr = Math.max(0, Math.min(100, Math.round(m.err_rate * 100 * 10) / 10));

      setSeries((prev) => {
        const next = [...prev.slice(1)];
        next.push({
          time: timeStr,
          p50: liveP50,
          p95: liveP95,
          err_rate: liveErr,
          rps: m.rps || 15.0
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Compute dynamic max for Y-Axis
  const maxVal = Math.max(
    500,
    ...series.map(s => s.p95),
    currentMetric.p95_ms
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col space-y-4">
      {/* Top summary cards */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center space-x-2">
              <span>Real-Time Gateway Telemetry (Live Stream)</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                {selectedRoute}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Live streaming task-manager latency buffer (1,000ms rolling interval)
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          {/* p50 */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs shadow-xs">
            <span className="text-slate-500 font-sans">p50:</span>
            <span className="text-blue-600 font-bold">{Math.round(currentMetric.p50_ms)}ms</span>
          </div>

          {/* p95 */}
          <div className={cn(
            'px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 font-mono text-xs shadow-xs transition-colors',
            isDegraded
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          )}>
            <span className="text-slate-500 font-sans">p95 (Tail):</span>
            <span className={cn('font-bold', isDegraded ? 'text-red-600 animate-pulse text-sm' : 'text-slate-900')}>
              {Math.round(currentMetric.p95_ms)}ms
            </span>
          </div>

          {/* Error Rate */}
          <div className={cn(
            'px-3 py-1.5 rounded-lg border flex items-center space-x-1.5 font-mono text-xs shadow-xs',
            currentMetric.err_rate > 0.01
              ? 'bg-red-50 border-red-300 text-red-700'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          )}>
            <span className="text-slate-500 font-sans">Err Rate:</span>
            <span className={cn('font-bold', currentMetric.err_rate > 0.01 ? 'text-red-600' : 'text-emerald-600')}>
              {(currentMetric.err_rate * 100).toFixed(1)}%
            </span>
          </div>

          {/* RPS */}
          <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5 font-mono text-xs shadow-xs">
            <span className="text-slate-500 font-sans">Throughput:</span>
            <span className="text-slate-800 font-bold">{currentMetric.rps || 16.2} rps</span>
          </div>
        </div>
      </div>

      {/* Latency & Error Chart */}
      <div className="h-48 w-full bg-slate-50/70 rounded-xl border border-slate-200 p-2.5 relative">
        <div className="absolute top-3 right-4 z-10 flex items-center space-x-3 text-[11px] font-mono select-none">
          <span className="flex items-center text-amber-700 font-bold">
            <span className="w-2.5 h-1 bg-amber-500 mr-1.5 rounded" /> p95 Tail Latency
          </span>
          <span className="flex items-center text-blue-700 font-bold">
            <span className="w-2.5 h-1 bg-blue-600 mr-1.5 rounded" /> p50 Median
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 15, right: 20, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="time" stroke="#94A3B8" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis
              stroke="#94A3B8"
              tick={{ fontSize: 10, fontFamily: 'monospace' }}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              unit="ms"
            />
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
                x={series[series.length - 1]?.time}
                stroke="#DC2626"
                strokeDasharray="3 3"
                label={{ value: markerText, fill: '#DC2626', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#D97706"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="p95 Tail (ms)"
            />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="p50 Median (ms)"
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
                <span>ACTIVE INCIDENT: High Latency Surge & DB Pool Contention Detected</span>
                <span className="font-mono font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded border border-red-200">
                  p95 @ {Math.round(currentMetric.p95_ms)}ms
                </span>
              </div>
              <p className="text-[11px] text-red-700 font-mono mt-0.5">
                Database connection pool (5/5) blocked. Attack payload holding worker locks causing 504/500 errors.
              </p>
            </div>
          </div>

          {onInvestigate && (
            <button
              type="button"
              onClick={onInvestigate}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold font-mono shrink-0 shadow-xs flex items-center space-x-1.5 transition active:scale-98 cursor-pointer"
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
