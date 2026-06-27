'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ChartOptions, ChartData } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chart.js/auto';
import { format } from 'date-fns';
import { Cluster } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../constants/consts';

const precinctNames: Record<number, string> = GetPrecinctsDictionary;

const timeSlots = ['Morning', 'Afternoon', 'Evening'] as const;

const compareTimeSlots = ['Morning_A', 'Afternoon_A', 'Evening_A', 'Morning_B', 'Afternoon_B', 'Evening_B'] as const;

const periodBColors: Record<string, string> = {
  'Morning_B': '#D4AA30',
  'Afternoon_B': '#1A7BB8',
  'Evening_B': '#C44060',
};

const ALL_CRIME_TYPES = Object.entries(CrimeTypesDictionary)
  .filter(([id]) => parseInt(id) >= 0)
  .map(([id, label]) => ({ id: parseInt(id), label }));

const TIME_OF_DAY_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

interface Props {
  clusters: Cluster[];
  timeOfDayColors: Record<string, string>;
}

export const BarangayMonthlyChart: React.FC<Props> = ({ clusters, timeOfDayColors }) => {
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<number[]>([]);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string[]>([]);
  const [selectedPrecincts, setSelectedPrecincts] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  const [stepwise, setStepwise] = useState(false);
  const [play, setPlay] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const [compareMode, setCompareMode] = useState(false);
  const [periodAYears, setPeriodAYears] = useState<number[]>([]);
  const [periodBYears, setPeriodBYears] = useState<number[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const uniqueSteps = useMemo(
    () => Array.from(
      new Set(clusters.flatMap(c => c.clusterItems.map(i => `${i.year}-${i.month.toString().padStart(2, '0')}`)))
    ).sort(),
    [clusters]
  );

  const uniqueYears = useMemo(
    () => Array.from(new Set(clusters.flatMap(c => c.clusterItems.map(i => i.year)))).sort(),
    [clusters]
  );

  const availableCrimeTypes = useMemo(
    () => {
      const typesInData = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.crimeType)));
      return ALL_CRIME_TYPES.filter(ct => typesInData.has(ct.id));
    },
    [clusters]
  );

  const availablePrecincts = useMemo(
    () => {
      const pcsInData = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.precinct)));
      return Object.entries(precinctNames)
        .map(([id, name]) => ({ id: parseInt(id), name }))
        .filter(pc => pcsInData.has(pc.id))
        .sort((a, b) => a.id - b.id);
    },
    [clusters]
  );

  const filteredData = useMemo(() => {
    let items = clusters.flatMap(c => c.clusterItems);

    if (compareMode) {
      items = items.filter(i =>
        (periodAYears.length === 0 && periodBYears.length === 0) ||
        periodAYears.includes(i.year) || periodBYears.includes(i.year)
      );
    } else if (stepwise && uniqueSteps.length > 0) {
      const [y, m] = uniqueSteps[currentStep].split('-').map(Number);
      items = items.filter(i => i.year === y && i.month === m);
    } else {
      if (selectedMonths.length > 0) items = items.filter(i => selectedMonths.includes(i.month));
      if (selectedYears.length > 0) items = items.filter(i => selectedYears.includes(i.year));
    }

    if (selectedCrimeTypes.length > 0) items = items.filter(i => selectedCrimeTypes.includes(i.crimeType));
    if (selectedTimeOfDay.length > 0) items = items.filter(i => selectedTimeOfDay.includes(i.timeOfDay));
    if (selectedPrecincts.length > 0) items = items.filter(i => selectedPrecincts.includes(i.precinct));

    return items.map(i => ({
      precinct: i.precinct,
      month: i.month,
      year: i.year,
      timeOfDay: i.timeOfDay,
      crimeType: i.crimeType,
    }));
  }, [clusters, stepwise, currentStep, selectedMonths, selectedYears, selectedCrimeTypes, selectedTimeOfDay, selectedPrecincts, compareMode, periodAYears, periodBYears, uniqueSteps]);

  useEffect(() => {
    if (play && stepwise && uniqueSteps.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % uniqueSteps.length);
      }, 2000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [play, stepwise, uniqueSteps]);

  const handleCompareToggle = useCallback(() => {
    if (!compareMode) {
      const sortedYears = [...uniqueYears];
      const mid = Math.floor(sortedYears.length / 2);
      setPeriodAYears(sortedYears.slice(0, mid));
      setPeriodBYears(sortedYears.slice(mid));
    } else {
      setPeriodAYears([]);
      setPeriodBYears([]);
    }
    setCompareMode(!compareMode);
  }, [compareMode, uniqueYears]);

  const precincts = useMemo(
    () => Array.from(new Set(filteredData.map(d => d.precinct))).sort((a, b) => a - b),
    [filteredData]
  );

  const months = useMemo(
    () => Array.from(new Set(filteredData.map(d => new Date(d.year, d.month - 1, 1).getTime()))).sort().map(ms => ({ ms, label: format(new Date(ms), 'MMM yyyy') })),
    [filteredData]
  );

  const toRender = selected !== null ? [selected] : precincts;

  const selectedPrecinctSummary = useMemo(() => {
    if (selected === null) return null;
    const items = filteredData.filter(d => d.precinct === selected);
    if (items.length === 0) return null;

    const total = items.length;

    const years = [...new Set(items.map(d => d.year))].sort((a, b) => a - b);
    const months = [...new Set(items.map(d => `${d.year}-${d.month.toString().padStart(2, '0')}`))].sort();
    const dateRange = months.length > 0
      ? `${format(new Date(parseInt(months[0].split('-')[0]), parseInt(months[0].split('-')[1]) - 1), 'MMM yyyy')} — ${format(new Date(parseInt(months[months.length - 1].split('-')[0]), parseInt(months[months.length - 1].split('-')[1]) - 1), 'MMM yyyy')}`
      : 'N/A';

    const timeOfDayDist = timeSlots.reduce((acc, slot) => {
      acc[slot] = items.filter(d => d.timeOfDay === slot).length;
      return acc;
    }, {} as Record<string, number>);

    const crimeTypeMap = new Map<number, number>();
    items.forEach(d => {
      crimeTypeMap.set(d.crimeType, (crimeTypeMap.get(d.crimeType) || 0) + 1);
    });
    const crimeTypeDist = [...crimeTypeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const periodDist = compareMode
      ? {
          periodA: items.filter(d => !periodBYears.includes(d.year)).length,
          periodB: items.filter(d => periodBYears.includes(d.year)).length,
        }
      : null;

    const peakTimeOfDay = [...Object.entries(timeOfDayDist)].sort((a, b) => b[1] - a[1])[0];
    const peakCrimeType = crimeTypeDist.length > 0 ? crimeTypeDist[0] : null;
    const monthlyTotals = new Map<string, number>();
    items.forEach(d => {
      const key = `${d.year}-${d.month.toString().padStart(2, '0')}`;
      monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + 1);
    });
    const peakMonth = [...monthlyTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    const parts: string[] = [
      `This chart shows the monthly distribution of incidents in ${precinctNames[selected] || `Precinct ${selected}`}, grouped by time of day (Morning, Afternoon, Evening).`
    ];

    if (total > 0 && peakTimeOfDay && peakTimeOfDay[1] > 0) {
      const pct = Math.round((peakTimeOfDay[1] / total) * 100);
      parts.push(`Of the ${total} incidents shown, most occurred during the ${peakTimeOfDay[0].toLowerCase()} (${peakTimeOfDay[1]}, ${pct}% of total).`);
    }

    if (peakMonth && peakMonth[1] > 0) {
      const [y, m] = peakMonth[0].split('-').map(Number);
      const label = format(new Date(y, m - 1), 'MMM yyyy');
      parts.push(`The highest concentration was in ${label} with ${peakMonth[1]} incident${peakMonth[1] !== 1 ? 's' : ''}.`);
    }

    if (peakCrimeType) {
      const name = CrimeTypesDictionary[peakCrimeType[0]] || `Type ${peakCrimeType[0]}`;
      const pct = Math.round((peakCrimeType[1] / total) * 100);
      parts.push(`The most common crime type was ${name} (${peakCrimeType[1]}, ${pct}% of total).`);
    }

    if (periodDist) {
      if (periodDist.periodA > periodDist.periodB) {
        parts.push(`Comparing periods, Period A had more incidents (${periodDist.periodA} vs ${periodDist.periodB} in Period B).`);
      } else if (periodDist.periodB > periodDist.periodA) {
        parts.push(`Comparing periods, Period B had more incidents (${periodDist.periodB} vs ${periodDist.periodA} in Period A).`);
      } else {
        parts.push(`Both periods have an equal number of incidents (${periodDist.periodA} each).`);
      }
    }

    const explanation = parts.join(' ');

    return { total, dateRange, years, timeOfDayDist, crimeTypeDist, periodDist, explanation };
  }, [selected, filteredData, compareMode, periodBYears]);

  const ChartTile: React.FC<{ precinct: number }> = ({ precinct }) => {
    const [isContainerReady, setIsContainerReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const brgyName = precinctNames[precinct] || `Precinct ${precinct}`;

    useEffect(() => {
      const checkContainerSize = () => {
        if (containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          if (width > 0 && height > 0) setIsContainerReady(true);
        }
      };
      checkContainerSize();
      const timer = setTimeout(() => setIsContainerReady(true), 100);
      return () => clearTimeout(timer);
    }, []);

    const counts: Record<number, Record<string, number>> = {};
    months.forEach(m => {
      if (compareMode) {
        counts[m.ms] = { Morning_A: 0, Afternoon_A: 0, Evening_A: 0, Morning_B: 0, Afternoon_B: 0, Evening_B: 0 };
      } else {
        counts[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 };
      }
    });

    filteredData.filter(d => d.precinct === precinct).forEach(d => {
      const ms = new Date(d.year, d.month - 1, 1).getTime();
      if (counts[ms]) {
        if (compareMode) {
          const period = periodBYears.includes(d.year) ? 'B' : 'A';
          const key = `${d.timeOfDay}_${period}`;
          if (key in counts[ms]) counts[ms][key]++;
        } else {
          counts[ms][d.timeOfDay]++;
        }
      }
    });

    const barDatasets = compareMode
      ? compareTimeSlots.map(slot => ({
          type: 'bar' as const,
          label: slot.replace('_', ' (').replace('A', 'Period A').replace('B', 'Period B)'),
          data: months.map(m => counts[m.ms][slot] ?? 0),
          backgroundColor: slot.endsWith('_B') ? periodBColors[slot] : timeOfDayColors[slot.replace('_A', '')],
          stack: 'stack',
        }))
      : timeSlots.map(slot => ({
          type: 'bar' as const,
          label: slot,
          data: months.map(m => counts[m.ms][slot] ?? 0),
          backgroundColor: timeOfDayColors[slot],
          stack: 'stack',
        }));

    const chartData: ChartData<'bar'> = {
      labels: months.map(m => m.label),
      datasets: barDatasets,
    };

    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { title: { display: true, text: 'Month' } },
        y: { title: { display: true, text: 'Count' }, beginAtZero: true }
      },
    };

    return (
      <>
        <h3 className="text-center font-medium mb-2">{brgyName}</h3>
        <div ref={containerRef} style={{ height: 300 }}>
          {isContainerReady ? (
            <Chart type="bar" data={chartData} options={options} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="animate-spin h-6 w-6 mx-auto mb-2 border-2 border-ubuntu-500 border-t-transparent rounded-full"></div>
                <p className="text-sm">Loading...</p>
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  if (!clusters || clusters.length === 0) return null;

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(prev => !prev)}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Filters
            </button>
            <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={stepwise} onChange={e => { setStepwise(e.target.checked); setPlay(false); }} className="accent-blue-600" />
                Trends
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={compareMode} onChange={handleCompareToggle} className="accent-purple-600" />
                Compare
              </label>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="space-y-3">
            {compareMode && (
              <div className="flex gap-4 p-2.5 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <span className="text-xs font-medium text-ubuntu-700">Period A</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {uniqueYears.map(y => (
                      <button
                        key={y}
                        onClick={() => setPeriodAYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                        className={`px-2 py-0.5 border rounded text-xs ${periodAYears.includes(y) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                      >{y}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-red-700">Period B</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {uniqueYears.map(y => (
                      <button
                        key={y}
                        onClick={() => setPeriodBYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                        className={`px-2 py-0.5 border rounded text-xs ${periodBYears.includes(y) ? 'bg-red-600 text-white' : 'bg-white'}`}
                      >{y}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {stepwise && (
              <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPlay(!play)} className="px-3 py-1 text-xs font-medium bg-ubuntu-500 text-white rounded hover:bg-ubuntu-700">
                    {play ? '⏸' : '▶'} {play ? 'Pause' : 'Play'}
                  </button>
                  <button onClick={() => setCurrentStep(p => Math.max(p - 1, 0))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">◀</button>
                  <button onClick={() => setCurrentStep(p => Math.min(p + 1, uniqueSteps.length - 1))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">▶</button>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-ubuntu-700 text-xs font-semibold">
                  {(() => { const [y, m] = uniqueSteps[currentStep].split('-').map(Number); return format(new Date(y, m - 1), 'MMM yyyy'); })()}
                </span>
              </div>
            )}

            {!stepwise && !compareMode && (
              <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-gray-600">Month:</span>
                  {[...Array(12)].map((_, i) => {
                    const m = i + 1;
                    return (
                      <button key={m} onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                        className={`px-2 py-0.5 border rounded text-xs ${selectedMonths.includes(m) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                      >{m}</button>
                    );
                  })}
                  <span className="text-xs font-medium text-gray-600 ml-1">Year:</span>
                  {uniqueYears.map(y => (
                    <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                      className={`px-2 py-0.5 border rounded text-xs ${selectedYears.includes(y) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >{y}</button>
                  ))}
                </div>

                {availableCrimeTypes.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Crime:</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {availableCrimeTypes.map(({ id, label }) => (
                      <button key={id} onClick={() => setSelectedCrimeTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedCrimeTypes.includes(id) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Time:</span>
                  <div className="flex flex-wrap gap-1">
                    {TIME_OF_DAY_OPTIONS.map(t => (
                      <button key={t} onClick={() => setSelectedTimeOfDay(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        className={`px-2 py-0.5 border rounded text-xs ${selectedTimeOfDay.includes(t) ? 'text-white' : 'bg-white'}`}
                        style={selectedTimeOfDay.includes(t) ? { backgroundColor: timeOfDayColors[t] } : {}}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {availablePrecincts.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Barangay:</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {availablePrecincts.map(({ id, name }) => (
                      <button key={id} onClick={() => setSelectedPrecincts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                        className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedPrecincts.includes(id) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                      >{name}</button>
                    ))}
                  </div>
                </div>
                )}

                <div className="flex justify-end">
                  <button onClick={() => { setSelectedMonths([]); setSelectedYears([]); setSelectedCrimeTypes([]); setSelectedTimeOfDay([]); setSelectedPrecincts([]); }}
                    className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                  >Reset</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selected !== null && (
        <div className="mb-4">
          <button onClick={() => setSelected(null)} className="px-3 py-1 bg-gray-200 rounded">← Show All Barangays</button>
        </div>
      )}

      {selected !== null && selectedPrecinctSummary && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">{precinctNames[selected] || `Precinct ${selected}`}</span>
            <span className="text-gray-400">—</span>
            <span className="text-gray-600">{selectedPrecinctSummary.total} incident{selectedPrecinctSummary.total !== 1 ? 's' : ''}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{selectedPrecinctSummary.dateRange}</span>
            {selectedPrecinctSummary.periodDist && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-ubuntu-700">A: {selectedPrecinctSummary.periodDist.periodA}</span>
                <span className="text-red-600">B: {selectedPrecinctSummary.periodDist.periodB}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {timeSlots.map(slot => (
              <span key={slot}>
                <span className="text-gray-500">{slot}:</span>{' '}
                <span className="font-medium" style={{ color: timeOfDayColors[slot] }}>{selectedPrecinctSummary.timeOfDayDist[slot]}</span>
              </span>
            ))}
            {selectedPrecinctSummary.crimeTypeDist.length > 0 && (
              <span className="text-gray-300">|</span>
            )}
            {selectedPrecinctSummary.crimeTypeDist.map(([id, count], idx) => (
              <span key={id}>
                <span className="text-gray-500">{CrimeTypesDictionary[id] || `Type ${id}`}:</span>{' '}
                <span className="font-medium">{count}</span>
                {idx < selectedPrecinctSummary.crimeTypeDist.length - 1 && <span className="text-gray-300 ml-1">·</span>}
              </span>
            ))}
          </div>
          <p className="text-gray-700 leading-relaxed">{selectedPrecinctSummary.explanation}</p>
        </div>
      )}

      {selected !== null ? (
        <div className="w-full p-4 border-4 border-blue-500 rounded shadow-sm bg-white" title="Click to show all barangays">
          <ChartTile precinct={selected} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {toRender.map(pc => (
            <div key={pc} className="p-4 border rounded shadow-sm bg-white cursor-pointer" onClick={() => setSelected(pc)} title="Click to focus on this barangay">
              <ChartTile precinct={pc} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
