'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';
import { SingleModelRun, MODEL_COLORS } from '../../types/forecast/EnsembleTypes';

interface HotspotTimelineProps {
  modelRuns: SingleModelRun[];
}

interface HotspotEntry {
  key: string;
  precinct: number;
  crimeType: number;
  precinctName: string;
  crimeTypeName: string;
  monthlyRanks: { month: string; year: number; monthNum: number; rank: number; count: number }[];
  avgRank: number;
  trend: 'rising' | 'falling' | 'stable';
}

interface SortedMonth {
  label: string;
  year: number;
  monthNum: number;
}

const formatMonthLabel = (year: number, month: number): string => {
  return format(new Date(year, month - 1), 'MMM yyyy');
};

const HotspotTimeline: React.FC<HotspotTimelineProps> = ({ modelRuns }) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [topN, setTopN] = useState(10);

  const { sortedMonths, hotspots, maxRank } = useMemo(() => {
    if (modelRuns.length === 0) return { sortedMonths: [] as SortedMonth[], hotspots: [] as HotspotEntry[], maxRank: 0 };

    const allPredictions = modelRuns.flatMap(run => run.predictions);
    if (allPredictions.length === 0) return { sortedMonths: [] as SortedMonth[], hotspots: [] as HotspotEntry[], maxRank: 0 };

    const monthSet = new Set<string>();
    const comboData = new Map<string, Map<string, { count: number; cnt: number }>>();

    allPredictions.forEach(p => {
      const monthKey = `${p.year}-${String(p.month).padStart(2, '0')}`;
      const comboKey = `${p.precinct}-${p.crimeType}`;
      monthSet.add(monthKey);

      if (!comboData.has(comboKey)) comboData.set(comboKey, new Map());
      const monthMap = comboData.get(comboKey)!;
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { count: 0, cnt: 0 });
      const entry = monthMap.get(monthKey)!;
      entry.count += p.predictedCount;
      entry.cnt++;
    });

    const sm = Array.from(monthSet).sort().map(mk => {
      const [y, m] = mk.split('-');
      return { label: formatMonthLabel(parseInt(y), parseInt(m)), year: parseInt(y), monthNum: parseInt(m) };
    });

    const entries: HotspotEntry[] = [];
    comboData.forEach((monthMap, comboKey) => {
      const [pStr, ctStr] = comboKey.split('-');
      const precinct = parseInt(pStr);
      const crimeType = parseInt(ctStr);

      const monthlyRanks: HotspotEntry['monthlyRanks'] = [];
      sm.forEach(({ year, monthNum, label: mLabel }) => {
        const mk = `${year}-${String(monthNum).padStart(2, '0')}`;
        const d = monthMap.get(mk);
        const avgCount = d ? Math.round(d.count / d.cnt) : 0;
        monthlyRanks.push({ month: mLabel, year, monthNum, rank: 0, count: avgCount });
      });

      const avgRank = 0;
      entries.push({
        key: comboKey,
        precinct,
        crimeType,
        precinctName: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`,
        crimeTypeName: CrimeTypesDictionary[crimeType] || `Crime ${crimeType}`,
        monthlyRanks,
        avgRank,
        trend: 'stable' as const,
      });
    });

    for (let i = 0; i < sm.length; i++) {
      const monthRanked = entries
        .map(e => ({ key: e.key, count: e.monthlyRanks[i].count }))
        .sort((a, b) => b.count - a.count);

      monthRanked.forEach((mr, idx) => {
        const entry = entries.find(e => e.key === mr.key);
        if (entry) entry.monthlyRanks[i].rank = idx + 1;
      });
    }

    const finalEntries = entries
      .filter(e => e.monthlyRanks.some(mr => mr.count > 0))
      .map(e => {
        const firstRank = e.monthlyRanks[0]?.rank || topN;
        const lastRank = e.monthlyRanks[e.monthlyRanks.length - 1]?.rank || topN;
        const trendVal: 'rising' | 'falling' | 'stable' =
          lastRank < firstRank ? 'rising' : lastRank > firstRank ? 'falling' : 'stable';
        const avgR = e.monthlyRanks.reduce((s, mr) => s + mr.rank, 0) / e.monthlyRanks.length;
        return { ...e, avgRank: avgR, trend: trendVal };
      })
      .sort((a, b) => a.avgRank - b.avgRank);

    const maxR = entries.length;

    return { sortedMonths: sm, hotspots: finalEntries, maxRank: maxR };
  }, [modelRuns, topN]);

  const displayedHotspots = useMemo(() => {
    return hotspots.slice(0, topN);
  }, [hotspots, topN]);

  const getColorForCombo = (index: number): string => {
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1'];
    return colors[index % colors.length];
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return <span className="text-red-500 text-xs">↗</span>;
    if (trend === 'falling') return <span className="text-green-500 text-xs">↘</span>;
    return <span className="text-yellow-500 text-xs">→</span>;
  };

  if (sortedMonths.length === 0 || hotspots.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No hotspot data available. Generate a forecast first.
      </div>
    );
  }

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = Math.max(600, sortedMonths.length * 80);
  const chartHeight = 400;
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const xScale = (index: number) => margin.left + (index / (sortedMonths.length - 1 || 1)) * innerWidth;
  const yScale = (rank: number) => margin.top + ((rank - 1) / (Math.min(topN, maxRank) - 1 || 1)) * innerHeight;

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <h3 className="font-semibold text-purple-800">Hotspot Evolution Timeline</h3>
              <p className="text-sm text-purple-600">
                How precinct/crime-type hotspots change rank over the forecast period.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-600">Show top:</label>
            <select
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
        <svg width={chartWidth} height={chartHeight} className="min-w-full">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {displayedHotspots.map((entry, ei) => {
            const color = getColorForCombo(ei);
            const isHovered = hoveredKey === entry.key;
            const points = entry.monthlyRanks.map((mr, mi) => ({
              x: xScale(mi),
              y: yScale(mr.rank),
            }));

            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

            return (
              <g key={entry.key}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isHovered ? color : `${color}80`}
                  strokeWidth={isHovered ? 3 : 1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  filter={isHovered ? 'url(#glow)' : undefined}
                  style={{ transition: 'stroke-width 0.15s, stroke 0.15s' }}
                />
                {isHovered && points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={4}
                    fill={color}
                    stroke="white"
                    strokeWidth={2}
                  />
                ))}
              </g>
            );
          })}

          {hoveredKey && (() => {
            const entry = displayedHotspots.find(e => e.key === hoveredKey);
            if (!entry) return null;
            return entry.monthlyRanks.map((mr, mi) => (
              <g key={`label-${mi}`}>
                <rect
                  x={xScale(mi) - 50}
                  y={yScale(mr.rank) - 18}
                  width={100}
                  height={16}
                  rx={3}
                  fill="white"
                  fillOpacity={0.95}
                  stroke="#D1D5DB"
                  strokeWidth={0.5}
                />
                <text
                  x={xScale(mi)}
                  y={yScale(mr.rank) - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#374151"
                  fontWeight={600}
                >
                  #{mr.rank} ({mr.count})
                </text>
              </g>
            ));
          })()}

          {sortedMonths.map((sm, i) => (
            <text
              key={sm.label}
              x={xScale(i)}
              y={chartHeight - 5}
              textAnchor="middle"
              fontSize={10}
              fill="#6B7280"
              transform={sortedMonths.length > 6 ? `rotate(-30, ${xScale(i)}, ${chartHeight - 5})` : undefined}
            >
              {sm.label}
            </text>
          ))}

          <text x={10} y={margin.top + innerHeight / 2} textAnchor="middle" fontSize={11} fill="#6B7280" transform={`rotate(-90, 10, ${margin.top + innerHeight / 2})`}>
            Rank (1 = highest)
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-80 overflow-y-auto">
          <h4 className="font-medium text-gray-800 mb-3 text-sm flex items-center">
            <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Hotspot Rankings
          </h4>
          <div className="space-y-1">
            {displayedHotspots.map((entry, i) => {
              const color = getColorForCombo(i);
              const firstRank = entry.monthlyRanks[0]?.rank || '-';
              const lastRank = entry.monthlyRanks[entry.monthlyRanks.length - 1]?.rank || '-';
              return (
                <div
                  key={entry.key}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition ${hoveredKey === entry.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  onMouseEnter={() => setHoveredKey(entry.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium truncate">{entry.precinctName}</span>
                    <span className="text-gray-500 truncate">{entry.crimeTypeName}</span>
                  </div>
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-2">
                    <span className="text-gray-600">#{firstRank} → #{lastRank}</span>
                    {getTrendIcon(entry.trend)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-800 mb-3 text-sm flex items-center">
            <svg className="w-4 h-4 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            How to Read
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Bump chart</strong> shows how hotspots change rank month-to-month.</p>
            <p><strong>Lines rising</strong> (lower rank number) = precinct/crime combo becoming more prominent.</p>
            <p><strong>Lines falling</strong> (higher rank number) = relative decrease.</p>
            <p><strong>Hover</strong> any line to see exact ranks and predicted counts per month.</p>
            <p className="text-xs text-gray-500 mt-2">Based on ensemble average predictions across all models.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotspotTimeline;
