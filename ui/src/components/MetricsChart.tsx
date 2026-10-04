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
import { Activity, Zap, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
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

  // Rolling live time-series buffer (30 points, 1s interval like Task Manager)
  const [series, setSeries] = useState<DataPoint[]>(() => {
    const now = Date.now();
    const initPoints: DataPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 1000);
      const timeStr = d.toTimeString().split(' ')[0];
      initPoints.push({
        time: timeStr,
        p50: 18 + Math.random() * 6,
        p95: 38 + Math.random() * 8,
        err_rate: 0.0,
        rps: 15 + Math.random() * 2
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

      const jitter = (Math.random() - 0.5) * (m.p95_ms > 500 ? 120 : 4);
      const liveP50 = Math.max(5, Math.round(m.p50_ms + (Math.random() - 0.5) * 3));
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

  const maxVal = Math.max(
    500,
    ...series.map((s) => s.p95),
    currentMetric.p95_ms
  );

  return (
    <div className="flex flex-col space-y-4">
      {/* Top summary cards - Clean Monochrome */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-zinc-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded bg-black text-white flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-zinc-900 flex items-center space-x-2">
              <span>Gateway Telemetry (Live Stream)</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-800 border border-zinc-200">
                {selectedRoute}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              1-second sliding time window
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          {/* p50 */}
          <div className="bg-zinc-50 px-3 py-1.5 rounded border border-zinc-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-zinc-500 font-sans">p50:</span>
            <span className="text-zinc-900 font-bold">{Math.round(currentMetric.p50_ms)}ms</span>
          </div>

          {/* p95 */}
          <div
            className={cn(
              'px-3 py-1.5 rounded border flex items-center space-x-1.5 font-mono text-xs transition-colors',
              isDegraded
                ? 'bg-black text-white border-black'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900'
            )}
          >
            <span className={cn('font-sans', isDegraded ? 'text-zinc-300' : 'text-zinc-500')}>p95 (Tail):</span>
            <span className={cn('font-bold', isDegraded ? 'text-white' : 'text-zinc-900')}>
              {Math.round(currentMetric.p95_ms)}ms
            </span>
          </div>

          {/* Error Rate */}
          <div className="bg-zinc-50 px-3 py-1.5 rounded border border-zinc-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-zinc-500 font-sans">Err Rate:</span>
            <span className="text-zinc-900 font-bold">
              {(currentMetric.err_rate * 100).toFixed(1)}%
            </span>
          </div>

          {/* RPS */}
          <div className="bg-zinc-50 px-3 py-1.5 rounded border border-zinc-200 flex items-center space-x-1.5 font-mono text-xs">
            <span className="text-zinc-500 font-sans">Throughput:</span>
            <span className="text-zinc-900 font-bold">{(currentMetric.rps || 15.0).toFixed(2)} rps</span>
          </div>
        </div>
      </div>

      {/* Real-time Streaming Line Chart */}
      <div className="h-64 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#F4F4F5" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#A1A1AA"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#E4E4E7' }}
              minTickGap={25}
              fontFamily="JetBrains Mono, monospace"
            />
            <YAxis
              stroke="#A1A1AA"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#E4E4E7' }}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              tickFormatter={(v) => `${v}ms`}
              fontFamily="JetBrains Mono, monospace"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DataPoint;
                  return (
                    <div className="bg-black text-white p-2.5 rounded shadow-xl border border-zinc-800 text-xs font-mono">
                      <div className="text-zinc-400 text-[10px] mb-1">{data.time}</div>
                      <div className="text-white font-bold">p95: {data.p95}ms</div>
                      <div className="text-zinc-300">p50: {data.p50}ms</div>
                      <div className="text-zinc-300">Errors: {data.err_rate}%</div>
                      <div className="text-zinc-300">RPS: {data.rps.toFixed(1)}</div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {markerText && (
              <ReferenceLine
                x={series[Math.max(0, series.length - 6)]?.time}
                stroke="#09090B"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                label={{
                  value: markerText,
                  position: 'top',
                  fill: '#09090B',
                  fontSize: 10,
                  fontWeight: 'bold',
                  fontFamily: 'monospace'
                }}
              />
            )}

            {/* p95 Tail Latency: Solid High Contrast Black */}
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#09090B"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="p95 Tail Latency"
            />

            {/* p50 Median: Sleek Neutral Grey */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#71717A"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="p50 Median"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="absolute top-2 right-4 flex items-center space-x-4 bg-white/90 px-2.5 py-1 rounded border border-zinc-200 text-[11px] font-mono select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-black" />
            <span className="text-zinc-900 font-semibold">p95 Tail</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-zinc-500 border-b border-dashed" />
            <span className="text-zinc-600">p50 Median</span>
          </div>
        </div>
      </div>

      {/* Degradation Alert Bar inside chart */}
      {isDegraded && (
        <div className="bg-zinc-100 border border-zinc-300 rounded p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-black shrink-0" />
            <span className="font-semibold text-zinc-900">
              Active Incident: DB Pool Contention Detected (p95 @ {Math.round(currentMetric.p95_ms)}ms)
            </span>
          </div>
          {onInvestigate && (
            <button
              type="button"
              onClick={onInvestigate}
              className="px-3 py-1 bg-black text-white hover:bg-zinc-800 rounded text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
            >
              <span>Correlate RCA</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
