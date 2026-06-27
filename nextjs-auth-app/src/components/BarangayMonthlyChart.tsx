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

const compareColors: Record<string, Record<string, string>> = {
  A: { Morning: '#FFCE56', Afternoon: '#36A2EB', Evening: '#FF6384' },
  B: { Morning: '#D4AA30', Afternoon: '#1A7BB8', Evening: '#C44060' },
};

const ALL_CRIME_TYPES = Object.entries(CrimeTypesDictionary)
  .filter(([id]) => parseInt(id) >= 0)
  .map(([id, label]) => ({ id: parseInt(id), label }));

const TIME_OF_DAY_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

interface SideFilters {
  precincts: number[];
  years: number[];
  months: number[];
  timeOfDay: string[];
  crimeTypes: number[];
}

const emptySideFilters: SideFilters = { precincts: [], years: [], months: [], timeOfDay: [], crimeTypes: [] };

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

  const [compareMode, setCompareMode] = useState(false);
  const [sideAFilters, setSideAFilters] = useState<SideFilters>({ ...emptySideFilters });
  const [sideBFilters, setSideBFilters] = useState<SideFilters>({ ...emptySideFilters });

  const [selected, setSelected] = useState<number | null>(null);

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

    if (selectedMonths.length > 0) items = items.filter(i => selectedMonths.includes(i.month));
    if (selectedYears.length > 0) items = items.filter(i => selectedYears.includes(i.year));
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
  }, [clusters, selectedMonths, selectedYears, selectedCrimeTypes, selectedTimeOfDay, selectedPrecincts]);

  const handleCompareToggle = useCallback(() => {
    setCompareMode(prev => !prev);
    setSideAFilters({ ...emptySideFilters });
    setSideBFilters({ ...emptySideFilters });
  }, []);

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

    const itemsA = compareMode ? applySideFilters(items, sideAFilters) : items;
    const itemsB = compareMode ? applySideFilters(items, sideBFilters) : null;

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

    if (itemsB !== null) {
      if (itemsA.length > itemsB.length) {
        parts.push(`Side A has more incidents (${itemsA.length} vs ${itemsB.length} on Side B).`);
      } else if (itemsB.length > itemsA.length) {
        parts.push(`Side B has more incidents (${itemsB.length} vs ${itemsA.length} on Side A).`);
      } else {
        parts.push(`Both sides have an equal number of incidents (${itemsA.length} each).`);
      }
    }

    const explanation = parts.join(' ');

    return { total, dateRange, years, timeOfDayDist, crimeTypeDist, sideCountA: itemsA.length, sideCountB: itemsB?.length, explanation };
  }, [selected, filteredData, compareMode, sideAFilters, sideBFilters]);

  const makeChartData = (counts: Record<number, Record<string, number>>, colors: Record<string, string>) => ({
    labels: months.map(m => m.label),
    datasets: timeSlots.map(slot => ({
      type: 'bar' as const,
      label: slot,
      data: months.map(m => counts[m.ms]?.[slot] ?? 0),
      backgroundColor: colors[slot],
      stack: 'stack',
    })),
  });

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { title: { display: true, text: 'Month' } },
      y: { title: { display: true, text: 'Count' }, beginAtZero: true }
    },
  };

  const SideFilterPanel: React.FC<{
    side: 'A' | 'B';
    filters: SideFilters;
    setFilters: React.Dispatch<React.SetStateAction<SideFilters>>;
  }> = ({ side, filters, setFilters }) => {
    const toggle = (key: keyof SideFilters, value: number | string) => {
      setFilters(prev => {
        const arr = prev[key] as (number | string)[];
        return {
          ...prev,
          [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value],
        };
      });
    };

    const reset = () => setFilters({ ...emptySideFilters });

    const isA = side === 'A';
    const accentColor = isA ? 'text-ubuntu-700' : 'text-red-700';
    const borderColor = isA ? 'border-ubuntu-300' : 'border-red-300';
    const bgSelected = isA ? 'bg-ubuntu-500 text-white' : 'bg-red-600 text-white';

    return (
      <div className={`p-3 bg-gray-50 rounded-lg border ${borderColor}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold ${accentColor}`}>Side {side}</span>
          <button onClick={reset} className="px-1.5 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300">Reset</button>
        </div>
        <div className="space-y-2">
          {availablePrecincts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-medium text-gray-500 w-14 shrink-0">Brgy:</span>
              {availablePrecincts.map(({ id, name }) => (
                <button key={id} onClick={() => toggle('precincts', id)}
                  className={`px-1.5 py-0.5 border rounded text-xs whitespace-nowrap ${filters.precincts.includes(id) ? bgSelected : 'bg-white'}`}
                >{name}</button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">Year:</span>
            {uniqueYears.map(y => (
              <button key={y} onClick={() => toggle('years', y)}
                className={`px-1.5 py-0.5 border rounded text-xs ${filters.years.includes(y) ? bgSelected : 'bg-white'}`}
              >{y}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">Month:</span>
            {[...Array(12)].map((_, i) => {
              const m = i + 1;
              return (
                <button key={m} onClick={() => toggle('months', m)}
                  className={`px-1.5 py-0.5 border rounded text-xs ${filters.months.includes(m) ? bgSelected : 'bg-white'}`}
                >{m}</button>
              );
            })}
          </div>
          {availableCrimeTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-medium text-gray-500 w-14 shrink-0">Crime:</span>
              {availableCrimeTypes.map(({ id, label }) => (
                <button key={id} onClick={() => toggle('crimeTypes', id)}
                  className={`px-1.5 py-0.5 border rounded text-xs whitespace-nowrap ${filters.crimeTypes.includes(id) ? bgSelected : 'bg-white'}`}
                >{label}</button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs font-medium text-gray-500 w-14 shrink-0">Time:</span>
            {TIME_OF_DAY_OPTIONS.map(t => (
              <button key={t} onClick={() => toggle('timeOfDay', t)}
                className={`px-1.5 py-0.5 border rounded text-xs ${filters.timeOfDay.includes(t) ? bgSelected : 'bg-white'}`}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const applySideFilters = (items: typeof filteredData, f: SideFilters) => {
    if (f.precincts.length > 0) items = items.filter(d => f.precincts.includes(d.precinct));
    if (f.years.length > 0) items = items.filter(d => f.years.includes(d.year));
    if (f.months.length > 0) items = items.filter(d => f.months.includes(d.month));
    if (f.timeOfDay.length > 0) items = items.filter(d => f.timeOfDay.includes(d.timeOfDay));
    if (f.crimeTypes.length > 0) items = items.filter(d => f.crimeTypes.includes(d.crimeType));
    return items;
  };

  const ChartTile: React.FC<{ precinct: number }> = ({ precinct }) => {
    const [isReady, setIsReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const brgyName = precinctNames[precinct] || `Precinct ${precinct}`;

    useEffect(() => {
      const check = () => {
        if (containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          if (width > 0 && height > 0) setIsReady(true);
        }
      };
      check();
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }, []);

    const items = useMemo(() => filteredData.filter(d => d.precinct === precinct), [filteredData, precinct]);

    const chartContent = useMemo(() => {
      if (!isReady) return null;

      if (compareMode) {
        const itemsA = applySideFilters(items, sideAFilters);
        const itemsB = applySideFilters(items, sideBFilters);

        const countsA: Record<number, Record<string, number>> = {};
        const countsB: Record<number, Record<string, number>> = {};
        months.forEach(m => {
          countsA[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 };
          countsB[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 };
        });
        itemsA.forEach(d => {
          const ms = new Date(d.year, d.month - 1, 1).getTime();
          if (countsA[ms]) countsA[ms][d.timeOfDay]++;
        });
        itemsB.forEach(d => {
          const ms = new Date(d.year, d.month - 1, 1).getTime();
          if (countsB[ms]) countsB[ms][d.timeOfDay]++;
        });
        const dataA = makeChartData(countsA, compareColors.A);
        const dataB = makeChartData(countsB, compareColors.B);

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-ubuntu-300 rounded-lg p-3">
              <h4 className="text-center text-sm font-semibold text-ubuntu-700 mb-2">Side A</h4>
              <div style={{ height: 260 }}>
                <Chart type="bar" data={dataA} options={chartOptions} />
              </div>
            </div>
            <div className="border border-red-300 rounded-lg p-3">
              <h4 className="text-center text-sm font-semibold text-red-700 mb-2">Side B</h4>
              <div style={{ height: 260 }}>
                <Chart type="bar" data={dataB} options={chartOptions} />
              </div>
            </div>
          </div>
        );
      }

      const counts: Record<number, Record<string, number>> = {};
      months.forEach(m => { counts[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 }; });
      items.forEach(d => {
        const ms = new Date(d.year, d.month - 1, 1).getTime();
        if (counts[ms]) counts[ms][d.timeOfDay]++;
      });
      const data = makeChartData(counts, timeOfDayColors);

      return (
        <div style={{ height: 300 }}>
          <Chart type="bar" data={data} options={chartOptions} />
        </div>
      );
    }, [isReady, items, months, compareMode, sideAFilters, sideBFilters, timeOfDayColors]);

    return (
      <>
        <h3 className="text-center font-medium mb-2">{brgyName}</h3>
        <div ref={containerRef}>
          {chartContent ?? (
            <div className="flex items-center justify-center h-64 text-gray-500">
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
                <input type="checkbox" checked={compareMode} onChange={handleCompareToggle} className="accent-purple-600" />
                Compare
              </label>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="space-y-3">
            {compareMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SideFilterPanel side="A" filters={sideAFilters} setFilters={setSideAFilters} />
                <SideFilterPanel side="B" filters={sideBFilters} setFilters={setSideBFilters} />
              </div>
            ) : (
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
            {selectedPrecinctSummary.sideCountB !== undefined && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-ubuntu-700">A: {selectedPrecinctSummary.sideCountA}</span>
                <span className="text-red-600">B: {selectedPrecinctSummary.sideCountB}</span>
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
