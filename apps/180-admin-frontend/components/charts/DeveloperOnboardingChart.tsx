'use client';

import React, { useState, useId } from 'react';
import { Users, UserPlus, Layers, Calendar, BarChart2, TrendingUp, Sparkles } from 'lucide-react';

export interface DeveloperOnboardingPoint {
  date: string;
  label: string;
  newDevelopers: number;
  newUsers: number;
  newApps: number;
  cumulativeDevelopers: number;
  cumulativeUsers: number;
  cumulativeApps: number;
}

interface DeveloperOnboardingChartProps {
  dailyData?: DeveloperOnboardingPoint[];
  weeklyData?: DeveloperOnboardingPoint[];
  monthlyData?: DeveloperOnboardingPoint[];
  timeRangeLabel?: string;
}

export function DeveloperOnboardingChart({
  dailyData = [],
  weeklyData = [],
  monthlyData = [],
  timeRangeLabel = '30D',
}: DeveloperOnboardingChartProps) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [metricMode, setMetricMode] = useState<'developers' | 'users' | 'apps'>('developers');
  const [isCumulative, setIsCumulative] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId();

  // Pick active dataset based on granularity
  const activeDataset: DeveloperOnboardingPoint[] =
    granularity === 'weekly' && weeklyData.length > 0
      ? weeklyData
      : granularity === 'monthly' && monthlyData.length > 0
      ? monthlyData
      : dailyData.length > 0
      ? dailyData
      : [];

  // Values based on selected metric and cumulative flag
  const getPointValue = (pt: DeveloperOnboardingPoint): number => {
    if (metricMode === 'developers') {
      return isCumulative ? pt.cumulativeDevelopers : pt.newDevelopers;
    }
    if (metricMode === 'users') {
      return isCumulative ? pt.cumulativeUsers : pt.newUsers;
    }
    return isCumulative ? pt.cumulativeApps : pt.newApps;
  };

  const values = activeDataset.map(getPointValue);
  const maxValue = Math.max(...values, 5);
  const totalInPeriod = activeDataset.reduce((acc, pt) => {
    if (metricMode === 'developers') return acc + pt.newDevelopers;
    if (metricMode === 'users') return acc + pt.newUsers;
    return acc + pt.newApps;
  }, 0);

  const latestCumulative =
    activeDataset.length > 0
      ? metricMode === 'developers'
        ? activeDataset[activeDataset.length - 1].cumulativeDevelopers
        : metricMode === 'users'
        ? activeDataset[activeDataset.length - 1].cumulativeUsers
        : activeDataset[activeDataset.length - 1].cumulativeApps
      : 0;

  // SVG Chart Geometry
  const svgWidth = 840;
  const svgHeight = 260;
  const padLeft = 45;
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

  // Bar width for column view
  const barWidth = Math.max(4, Math.min(22, (plotWidth / (pointsCount || 1)) * 0.55));

  // Y-axis gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    val: Math.round(maxValue * pct),
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
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                Developer & User Onboarding Velocity
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  Live Registrations
                </span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tracking developer ecosystem adoption and sovereign accounts over time.
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs">
            <button
              onClick={() => setMetricMode('developers')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'developers'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              Developers
            </button>
            <button
              onClick={() => setMetricMode('users')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setMetricMode('apps')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                metricMode === 'apps'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:white'
              }`}
            >
              Apps Created
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

          {/* Cumulative toggle */}
          <button
            onClick={() => setIsCumulative(!isCumulative)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
              isCumulative
                ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 font-bold'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            <span>Cumulative</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Ribbon above chart */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-blue-500" />
            <span>Total Onboarded ({timeRangeLabel})</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">
            +{totalInPeriod}{' '}
            <span className="text-xs font-normal text-zinc-500">
              {metricMode === 'developers' ? 'devs' : metricMode === 'users' ? 'users' : 'apps'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Cumulative Fleet Total</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {latestCumulative}{' '}
            <span className="text-xs font-normal text-zinc-500">sovereign total</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Calendar className="h-3 w-3 text-amber-500" />
            <span>Peak Velocity in Window</span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-500 mt-1">
            {maxValue}{' '}
            <span className="text-xs font-normal text-zinc-500">single bucket peak</span>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-indigo-500" />
            <span>Active Sampling</span>
          </div>
          <div className="text-xl font-bold font-mono text-indigo-500 mt-1">
            {pointsCount}{' '}
            <span className="text-xs font-normal text-zinc-500">{granularity} data points</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative w-full aspect-[840/260] min-h-[220px]">
        {activeDataset.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No onboarding activity recorded for this period.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible select-none cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <defs>
              <linearGradient id={`blueArea_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.10" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id={`barGrad_${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.3" />
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
                  {t.val}
                </text>
              </g>
            ))}

            {/* Background Bars (Non-cumulative view) */}
            {!isCumulative &&
              coords.map((c, i) => {
                const bHeight = padTop + plotHeight - c.y;
                return (
                  <rect
                    key={i}
                    x={c.x - barWidth / 2}
                    y={c.y}
                    width={barWidth}
                    height={Math.max(2, bHeight)}
                    rx={3}
                    fill={`url(#barGrad_${gradientId})`}
                    className={`transition-opacity duration-200 ${
                      hoveredIndex === i ? 'opacity-100' : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                );
              })}

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill={`url(#blueArea_${gradientId})`} />}

            {/* Smooth Spline Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#3b82f6"
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
                  fill={isSelected ? '#60a5fa' : '#3b82f6'}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="transition-all duration-150"
                />
              );
            })}

            {/* X-axis Labels (Sampled to avoid overlap) */}
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
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="opacity-70"
                />
                <circle
                  cx={hoveredCoord.x}
                  cy={hoveredCoord.y}
                  r="7"
                  fill="#3b82f6"
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
            <div className="bg-zinc-900/95 dark:bg-black/95 text-white border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md min-w-[200px] space-y-1.5 text-xs">
              <div className="text-[11px] font-bold text-zinc-400 pb-1 border-b border-white/10 flex items-center justify-between">
                <span>{hoveredPoint.label}</span>
                <span className="font-mono text-zinc-500">{hoveredPoint.date}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  New Developers:
                </span>
                <span className="font-bold font-mono text-white">+{hoveredPoint.newDevelopers}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-400" />
                  New Sovereign Users:
                </span>
                <span className="font-bold font-mono text-indigo-300">+{hoveredPoint.newUsers}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Apps Created:
                </span>
                <span className="font-bold font-mono text-amber-300">+{hoveredPoint.newApps}</span>
              </div>

              <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Total Devs to Date:</span>
                <span className="font-bold font-mono text-emerald-400">{hoveredPoint.cumulativeDevelopers}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
