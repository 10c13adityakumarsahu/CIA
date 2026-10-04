import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { RouteMetrics } from '../types';
import { Activity, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
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
    <div className="h-full flex flex-col justify-between space-y-3">
      {/* Top summary cards - Clean Task Manager Style Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-zinc-100">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-black text-white flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="font-bold text-xs uppercase tracking-wider text-zinc-900 flex items-center space-x-1.5 font-mono">
              <span>Live Telemetry</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-100 text-zinc-800 border border-zinc-200">
                {selectedRoute}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-wrap font-mono text-[11px]">
          <div className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
            <span className="text-zinc-500 font-sans">p50: </span>
            <span className="text-zinc-900 font-bold">{Math.round(currentMetric.p50_ms)}ms</span>
          </div>

          <div
            className={cn(
              'px-2 py-0.5 rounded border transition-colors',
              isDegraded
                ? 'bg-black text-white border-black font-bold'
                : 'bg-zinc-50 border-zinc-200 text-zinc-900'
            )}
          >
            <span className={cn('font-sans', isDegraded ? 'text-zinc-300' : 'text-zinc-500')}>p95: </span>
            <span>{Math.round(currentMetric.p95_ms)}ms</span>
          </div>

          <div className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
            <span className="text-zinc-500 font-sans">Err: </span>
            <span className="text-zinc-900 font-bold">{(currentMetric.err_rate * 100).toFixed(1)}%</span>
          </div>

          <div className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
            <span className="text-zinc-500 font-sans">RPS: </span>
            <span className="text-zinc-900 font-bold">{(currentMetric.rps || 15.0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Task-Manager Grid Chart Area */}
      <div className="h-64 sm:h-72 w-full relative bg-zinc-50/40 rounded border border-zinc-200/80 p-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
            <defs>
              {/* Task Manager Style Area Gradient */}
              <linearGradient id="taskManagerP95Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#09090B" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#09090B" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* Task Manager Grid Lines (Both Horizontal and Vertical) */}
            <CartesianGrid
              strokeDasharray="1 1"
              stroke="#E4E4E7"
              vertical={true}
              horizontal={true}
            />

            <XAxis
              dataKey="time"
              stroke="#A1A1AA"
              fontSize={10}
              tickLine={true}
              axisLine={{ stroke: '#D4D4D8' }}
              minTickGap={30}
              fontFamily="JetBrains Mono, monospace"
            />
            <YAxis
              stroke="#A1A1AA"
              fontSize={10}
              tickLine={true}
              axisLine={{ stroke: '#D4D4D8' }}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              tickFormatter={(v) => `${v}ms`}
              fontFamily="JetBrains Mono, monospace"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as DataPoint;
                  return (
                    <div className="bg-black text-white p-2 rounded shadow-xl border border-zinc-800 text-[11px] font-mono">
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

            {/* p95 Tail Latency: Area fill with Solid Dark Line */}
            <Area
              type="monotone"
              dataKey="p95"
              stroke="#09090B"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#taskManagerP95Grad)"
              isAnimationActive={false}
              name="p95 Tail Latency"
            />

            {/* p50 Median: Stepped / Dashed Line */}
            <Line
              type="monotone"
              dataKey="p50"
              stroke="#71717A"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
              name="p50 Median"
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Legend Overlay */}
        <div className="absolute top-2 right-3 flex items-center space-x-3 bg-white/95 px-2 py-0.5 rounded border border-zinc-200 text-[10px] font-mono select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-0.5 bg-black" />
            <span className="text-zinc-900 font-bold">p95 Tail</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-0.5 bg-zinc-400 border-b border-dashed" />
            <span className="text-zinc-600">p50 Median</span>
          </div>
        </div>
      </div>

      {/* Degradation Alert Bar inside chart */}
      {isDegraded && (
        <div className="bg-zinc-100 border border-zinc-300 rounded p-2 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-black shrink-0" />
            <span className="font-semibold text-zinc-900 text-[11px] font-mono">
              DB Pool Contention (p95 @ {Math.round(currentMetric.p95_ms)}ms)
            </span>
          </div>
          {onInvestigate && (
            <button
              type="button"
              onClick={onInvestigate}
              className="px-2 py-0.5 bg-black text-white hover:bg-zinc-800 rounded text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer"
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
