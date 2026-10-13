'use client';

import React, { useState, useId } from 'react';
import { DollarSign, CheckCircle2, CreditCard, ArrowDownToLine, TrendingUp, Sparkles, Activity } from 'lucide-react';

export interface PaymentActivityPoint {
  date: string;
  label: string;
  volume: number;
  paymentsCount: number;
  totalAttempts: number;
  payoutsCount?: number;
  payoutsVolume?: number;
}

interface PaymentActivityChartProps {
  dailyData?: PaymentActivityPoint[];
  weeklyData?: PaymentActivityPoint[];
  monthlyData?: PaymentActivityPoint[];
  currencySymbol?: string;
  timeRangeLabel?: string;
}

export function PaymentActivityChart({
  dailyData = [],
  weeklyData = [],
  monthlyData = [],
  currencySymbol = '$',
  timeRangeLabel = '30D',
}: PaymentActivityChartProps) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metricMode, setMetricMode] = useState<'volume' | 'count' | 'attempts' | 'payouts'>('volume');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

  // Pick dataset based on granularity
  const activeDataset: PaymentActivityPoint[] =
    granularity === 'weekly' && weeklyData.length > 0
      ? weeklyData
      : granularity === 'monthly' && monthlyData.length > 0
      ? monthlyData
      : dailyData.length > 0
      ? dailyData
      : [];

  const getPointValue = (pt: PaymentActivityPoint): number => {
    if (metricMode === 'volume') return pt.volume || 0;
    if (metricMode === 'count') return pt.paymentsCount || 0;
    if (metricMode === 'attempts') return pt.totalAttempts || 0;
    return pt.payoutsCount || 0;
  };

  const values = activeDataset.map(getPointValue);
  const maxValue = Math.max(...values, metricMode === 'volume' ? 10 : 3);

  const totalPeriodVolume = activeDataset.reduce((acc, pt) => acc + (pt.volume || 0), 0);
  const totalPeriodPayments = activeDataset.reduce((acc, pt) => acc + (pt.paymentsCount || 0), 0);
  const totalPeriodAttempts = activeDataset.reduce((acc, pt) => acc + (pt.totalAttempts || 0), 0);
  const successRate =
    totalPeriodAttempts > 0 ? Math.round((totalPeriodPayments / totalPeriodAttempts) * 100) : 100;

  // SVG Chart Geometry
  const svgWidth = 840;
  const svgHeight = 260;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 40;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const pointsCount = activeDataset.length;
  const getX = (index: number) => {
    if (pointsCount <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (pointsCount - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    if (maxValue === 0) return padTop + plotHeight;
    return padTop + plotHeight - (val / maxValue) * plotHeight;
  };

  // Generate smooth cubic bezier SVG path
  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const coords = activeDataset.map((pt, i) => ({
    x: getX(i),
    y: getY(getPointValue(pt)),
  }));

  const linePath = generateSmoothPath(coords);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${padTop + plotHeight} L ${coords[0].x} ${padTop + plotHeight} Z`
      : '';

  const barWidth = Math.max(4, Math.min(22, (plotWidth / (pointsCount || 1)) * 0.55));

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val:
      metricMode === 'volume'
        ? Math.round(maxValue * pct * 10) / 10
        : Math.round(maxValue * pct),
    y: padTop + plotHeight - pct * plotHeight,
  }));

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normX = (clientX - (padLeft / svgWidth) * rect.width) / ((plotWidth / svgWidth) * rect.width);
    const clampedRatio = Math.max(0, Math.min(1, normX));
    const closestIdx = Math.round(clampedRatio * (pointsCount - 1));
    if (closestIdx >= 0 && closestIdx < pointsCount) {
      setHoveredIndex(closestIdx);
    }
  };

  const hoveredPoint = hoveredIndex !== null ? activeDataset[hoveredIndex] : null;
  const hoveredCoord = hoveredIndex !== null ? coords[hoveredIndex] : null;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 shadow-sm space-y-5">
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                180 Pay Payment Activity & Settlement Velocity
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Live Gateway
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tracking payments processed by developer apps, checkout captures, and payout flows.
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs">
            <button
              onClick={() => setMetricMode('volume')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'volume'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              GMV Volume
            </button>
            <button
              onClick={() => setMetricMode('count')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'count'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              Payments Count
            </button>
            <button
              onClick={() => setMetricMode('attempts')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'attempts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              Total Sessions
            </button>
            <button
              onClick={() => setMetricMode('payouts')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'payouts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              Payouts
            </button>
          </div>

          {/* Granularity Selector */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                granularity === 'daily'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Day-by-Day
            </button>
            <button
              onClick={() => setGranularity('weekly')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                granularity === 'weekly'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                granularity === 'monthly'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            <span>Processed GMV ({timeRangeLabel})</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
            {currencySymbol}
            {totalPeriodVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-blue-500" />
            <span>Successful Payments</span>
          </div>
          <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {totalPeriodPayments}{' '}
            <span className="text-xs font-normal text-zinc-500">captured</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <CreditCard className="h-3 w-3 text-indigo-500" />
            <span>Total Checkout Attempts</span>
          </div>
          <div className="text-xl font-bold font-mono text-indigo-500 mt-1">
            {totalPeriodAttempts}{' '}
            <span className="text-xs font-normal text-zinc-500">sessions</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-amber-500" />
            <span>Capture Success Rate</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
            {successRate}%{' '}
            <span className="text-xs font-normal text-zinc-500">checkout rate</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative w-full aspect-[840/260] min-h-[220px]">
        {activeDataset.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No payment transaction volume recorded for this period.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible select-none cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id={`emeraldArea_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#10b981" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id={`emeraldBar_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {yTicks.map((t, idx) => (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={t.y}
                  x2={padLeft + plotWidth}
                  y2={t.y}
                  stroke="currentColor"
                  className="text-zinc-200 dark:text-zinc-800/80"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={t.y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-zinc-400 font-mono font-medium"
                >
                  {metricMode === 'volume' ? `${currencySymbol}${t.val}` : t.val}
                </text>
              </g>
            ))}

            {/* Vertical Bars for Volume/Count */}
            {coords.map((c, i) => {
              const bHeight = padTop + plotHeight - c.y;
              return (
                <rect
                  key={i}
                  x={c.x - barWidth / 2}
                  y={c.y}
                  width={barWidth}
                  height={Math.max(2, bHeight)}
                  rx={3}
                  fill={`url(#emeraldBar_${gradientId})`}
                  className={`transition-opacity duration-200 ${
                    hoveredIndex === i ? 'opacity-100' : 'opacity-65 hover:opacity-100'
                  }`}
                />
              );
            })}

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill={`url(#emeraldArea_${gradientId})`} />}

            {/* Smooth Spline Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Point Dots */}
            {coords.map((c, i) => {
              const isSelected = hoveredIndex === i;
              return (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 6 : pointsCount > 35 ? 0 : 3}
                  fill={isSelected ? '#34d399' : '#10b981'}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />
              );
            })}

            {/* X-axis Labels */}
            {activeDataset.map((pt, i) => {
              const step = Math.ceil(pointsCount / 7);
              if (i % step !== 0 && i !== pointsCount - 1) return null;
              const x = getX(i);
              return (
                <text
                  key={i}
                  x={x}
                  y={padTop + plotHeight + 22}
                  textAnchor="middle"
                  className="text-[10px] fill-zinc-400 dark:fill-zinc-500 font-medium"
                >
                  {pt.label}
                </text>
              );
            })}

            {/* Hover Crosshair */}
            {hoveredCoord && (
              <g>
                <line
                  x1={hoveredCoord.x}
                  y1={padTop}
                  x2={hoveredCoord.x}
                  y2={padTop + plotHeight}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="opacity-70"
                />
                <circle
                  cx={hoveredCoord.x}
                  cy={hoveredCoord.y}
                  r="7"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="3"
                  className="animate-pulse"
                />
              </g>
            )}
          </svg>
        )}

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && hoveredCoord && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
            style={{
              left: `${(hoveredCoord.x / svgWidth) * 100}%`,
              top: `${(hoveredCoord.y / svgHeight) * 100}%`,
            }}
          >
            <div className="bg-zinc-900/95 dark:bg-black/95 text-white border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md min-w-[210px] space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-zinc-400 pb-1 border-b border-white/10 flex items-center justify-between">
                <span>{hoveredPoint.label}</span>
                <span className="font-mono text-zinc-500">{hoveredPoint.date}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Captured Volume:
                </span>
                <span className="font-bold font-mono text-emerald-400">
                  {currencySymbol}
                  {(hoveredPoint.volume || 0).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Successful Payments:
                </span>
                <span className="font-bold font-mono text-white">{hoveredPoint.paymentsCount || 0}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  Sessions Attempted:
                </span>
                <span className="font-bold font-mono text-indigo-300">{hoveredPoint.totalAttempts || 0}</span>
              </div>

              {hoveredPoint.payoutsCount !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Payout Requests:
                  </span>
                  <span className="font-bold font-mono text-amber-300">
                    {hoveredPoint.payoutsCount || 0} ({currencySymbol}
                    {(hoveredPoint.payoutsVolume || 0).toFixed(2)})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
