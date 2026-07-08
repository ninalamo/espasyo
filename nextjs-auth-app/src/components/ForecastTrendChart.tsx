'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { ChartOptions, TooltipItem } from 'chart.js';
import 'chart.js/auto';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../constants/consts';
import type { HistoricalData, ForecastData } from '../types/forecast/ForecastBaseTypes';

type Interval = 'monthly' | 'yearly';
type Mode = 'consolidated' | 'individual';

const CRIME_TYPE_COLORS = [
  '#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4',
  '#42D4F4', '#F032E6', '#BFEF45', '#469990', '#DCBEFF',
  '#9A6324', '#FFFAC8', '#800000', '#A6CEE3', '#1F78B4',
  '#B2DF8A', '#33A02C', '#FB9A99', '#E31A1C', '#FDBF6F',
];

const YEAR_COLORS = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#BE185D', '#65A30D'];

const ALL_CRIME_TYPES = Object.entries(CrimeTypesDictionary)
  .filter(([id]) => parseInt(id) >= 0)
  .map(([id, label]) => ({ id: parseInt(id), label }));

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
}

export const ForecastTrendChart: React.FC<Props> = ({ historicalData, forecastData }) => {
  const [interval, setInterval] = useState<Interval>('monthly');
  const [mode, setMode] = useState<Mode>('consolidated');
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<number[]>([]);
  const [selectedPrecincts, setSelectedPrecincts] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [isContainerReady, setIsContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkContainerSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setIsContainerReady(true);
        }
      }
    };
    checkContainerSize();
    const resizeObserver = new ResizeObserver(checkContainerSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    const fallbackTimer = setTimeout(() => {
      setIsContainerReady(true);
    }, 100);
    return () => {
      resizeObserver.disconnect();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const forecastMonths = useMemo(() => {
    const months = [...new Set(forecastData.map(f => f.month))].sort((a, b) => a - b);
    return months.length > 0 ? months : null;
  }, [forecastData]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const displayMonths = useMemo(() => {
    if (!forecastMonths) return null;
    return forecastMonths.filter(m => m >= currentMonth);
  }, [forecastMonths, currentMonth]);

  const forecastYears = useMemo(() => {
    return [...new Set(forecastData.map(f => f.year))].sort((a, b) => a - b);
  }, [forecastData]);

  const allYears = useMemo(() => {
    const years = new Set<number>();
    historicalData.forEach(h => { if (forecastMonths?.includes(h.month)) years.add(h.year); });
    forecastData.forEach(f => years.add(f.year));
    return [...years].sort((a, b) => a - b);
  }, [historicalData, forecastData, forecastMonths]);

  const windowSpanMonths = useMemo(() => {
    if (!forecastMonths || forecastMonths.length < 2) return 0;
    const start = forecastMonths[0];
    const end = forecastMonths[forecastMonths.length - 1];
    return end >= start ? end - start + 1 : (12 - start + end + 1);
  }, [forecastMonths]);

  const showYearly = windowSpanMonths >= 12;

  const availableCrimeTypes = useMemo(() => {
    const types = new Set([...historicalData.map(h => h.crimeType), ...forecastData.map(f => f.crimeType)]);
    return ALL_CRIME_TYPES.filter(ct => types.has(ct.id));
  }, [historicalData, forecastData]);

  const availablePrecincts = useMemo(() => {
    const pcs = new Set([...historicalData.map(h => h.precinct), ...forecastData.map(f => f.precinct)]);
    return Object.entries(GetPrecinctsDictionary)
      .map(([id, name]) => ({ id: parseInt(id), name }))
      .filter(pc => pcs.has(pc.id))
      .sort((a, b) => a.id - b.id);
  }, [historicalData, forecastData]);

  const filteredHistorical = useMemo(() => {
    let items = [...historicalData];
    if (selectedCrimeTypes.length > 0) items = items.filter(i => selectedCrimeTypes.includes(i.crimeType));
    if (selectedPrecincts.length > 0) items = items.filter(i => selectedPrecincts.includes(i.precinct));
    return items;
  }, [historicalData, selectedCrimeTypes, selectedPrecincts]);

  const filteredForecast = useMemo(() => {
    let items = [...forecastData];
    if (selectedCrimeTypes.length > 0) items = items.filter(i => selectedCrimeTypes.includes(i.crimeType));
    if (selectedPrecincts.length > 0) items = items.filter(i => selectedPrecincts.includes(i.precinct));
    return items;
  }, [forecastData, selectedCrimeTypes, selectedPrecincts]);

  const normalizedTimeline = useMemo(() => {
    const map = new Map<string, { actual: number; predicted: number }>();
    const key = (y: number, m: number, t: number) => `${y}-${m}-${t}`;
    filteredHistorical.forEach(h => {
      const k = key(h.year, h.month, -1);
      map.set(k, { actual: (map.get(k)?.actual ?? 0) + h.count, predicted: map.get(k)?.predicted ?? 0 });
      const k2 = key(h.year, h.month, h.crimeType);
      map.set(k2, { actual: (map.get(k2)?.actual ?? 0) + h.count, predicted: map.get(k2)?.predicted ?? 0 });
    });
    filteredForecast.forEach(f => {
      const k = key(f.year, f.month, -1);
      map.set(k, { actual: map.get(k)?.actual ?? 0, predicted: (map.get(k)?.predicted ?? 0) + f.predictedCount });
      const k2 = key(f.year, f.month, f.crimeType);
      map.set(k2, { actual: map.get(k2)?.actual ?? 0, predicted: (map.get(k2)?.predicted ?? 0) + f.predictedCount });
    });
    return map;
  }, [filteredHistorical, filteredForecast]);

  const displayYears = useMemo(() => {
    const historical = allYears.filter(y => y < currentYear);
    const selected = selectedYears.length > 0 ? historical.filter(y => selectedYears.includes(y)) : historical;
    const projected = allYears.filter(y => y >= currentYear);
    return [...selected, ...projected];
  }, [allYears, selectedYears, currentYear]);

  useEffect(() => {
    setSelectedYears(prev => {
      const historical = allYears.filter(y => y < currentYear);
      const current = new Set(prev);
      if (prev.length === 0 || [...current].every(y => historical.includes(y))) return historical;
      return prev.filter(y => historical.includes(y));
    });
  }, [allYears, currentYear]);

  const tk = (year: number, month: number, typeId: number) => `${year}-${month}-${typeId}`;

  const { labels, datasets } = useMemo(() => {
    if (!forecastMonths) return { labels: [], datasets: [] };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const useYearly = interval === 'yearly' && showYearly;

    if (useYearly) {
      const yearSet = [...new Set([...filteredForecast.map(f => f.year), ...filteredHistorical.map(h => h.year)])].sort();
      const labels = yearSet.map(String);

      const isIndividual = mode === 'individual' && selectedCrimeTypes.length > 0;
      const typeIds = isIndividual ? selectedCrimeTypes : [-1];

      const datasets: any[] = [];
      typeIds.forEach(typeId => {
        yearSet.forEach(year => {
          const histCount = filteredHistorical
            .filter(h => h.year === year && (typeId === -1 || h.crimeType === typeId))
            .reduce((s, h) => s + h.count, 0);
          const foreCount = filteredForecast
            .filter(f => f.year === year && (typeId === -1 || f.crimeType === typeId))
            .reduce((s, f) => s + f.predictedCount, 0);
          const label = typeId === -1 ? String(year) : `${CrimeTypesDictionary[typeId] || typeId} (${year})`;
          const colorIdx = typeId === -1 ? yearSet.indexOf(year) % YEAR_COLORS.length : typeId % CRIME_TYPE_COLORS.length;
          const color = typeId === -1 ? YEAR_COLORS[colorIdx] : CRIME_TYPE_COLORS[colorIdx];
          datasets.push({
            label,
            data: yearSet.map(y => y === year ? (histCount || foreCount) : null),
            borderColor: color,
            backgroundColor: color + '22',
            pointBackgroundColor: color,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            spanGaps: false,
          });
        });
      });

      return { labels, datasets };
    }

    const months = displayMonths || forecastMonths;
    const labels = months.map(m => monthNames[m - 1]);

    const isIndividual = mode === 'individual' && selectedCrimeTypes.length > 0;
    const typeIds = isIndividual ? selectedCrimeTypes : [-1];

    const buildDataset = (typeId: number) => {
      const yearLines: any[] = [];
      const years = displayYears;

      years.forEach((year, yi) => {
        const ageFromNewest = years.length - 1 - yi;
        const dashPatterns = [[2, 4], [6, 4], [10, 4]];
        const histDash = dashPatterns[Math.min(ageFromNewest, dashPatterns.length - 1)];
        const colorIdx = typeId === -1 ? yi % YEAR_COLORS.length : typeId % CRIME_TYPE_COLORS.length;
        const baseColor = typeId === -1 ? YEAR_COLORS[colorIdx] : CRIME_TYPE_COLORS[colorIdx];
        const label = typeId === -1 ? String(year) : `${CrimeTypesDictionary[typeId] || typeId} (${year})`;

        if (year < currentYear) {
          const data = months.map(m =>
            normalizedTimeline.get(tk(year, m, typeId))?.actual ?? 0
          );
          yearLines.push({
            label, data,
            borderColor: baseColor,
            backgroundColor: baseColor + '22',
            pointBackgroundColor: baseColor,
            borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, spanGaps: false,
            borderDash: histDash,
          });
          return;
        }

        if (year > currentYear) {
          const data = months.map(m =>
            normalizedTimeline.get(tk(year, m, typeId))?.predicted ?? 0
          );
          yearLines.push({
            label, data,
            borderColor: baseColor,
            backgroundColor: baseColor + '22',
            pointBackgroundColor: baseColor,
            borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, spanGaps: false,
          });
          return;
        }

        const actualRaw = months.map(m =>
          m >= currentMonth ? null : (normalizedTimeline.get(tk(year, m, typeId))?.actual ?? 0)
        );
        const hasActual = actualRaw.some(v => v != null && v > 0);

        if (!hasActual) {
          const data = months.map(m =>
            normalizedTimeline.get(tk(year, m, typeId))?.predicted ?? 0
          );
          yearLines.push({
            label, data,
            borderColor: baseColor,
            backgroundColor: baseColor + '22',
            pointBackgroundColor: baseColor,
            borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, spanGaps: false,
          });
          return;
        }

        const predData = months.map(m => {
          if (m < currentMonth) return null;
          return normalizedTimeline.get(tk(year, m, typeId))?.predicted ?? 0;
        }).map((v, i) => actualRaw[i] != null ? null : v);

        yearLines.push({
          label: `${label} (Actual)`, data: actualRaw,
          borderColor: baseColor,
          backgroundColor: baseColor + '22',
          pointBackgroundColor: baseColor,
          borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, spanGaps: false,
          borderDash: histDash,
        });
        yearLines.push({
          label: `${label} (Predicted)`, data: predData,
          borderColor: baseColor,
          backgroundColor: baseColor + '22',
          pointBackgroundColor: baseColor,
          borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, spanGaps: false,
        });
      });

      return yearLines;
    };

    const datasets = typeIds.flatMap(tid => buildDataset(tid));

    console.log('=== ForecastTrendChart debug ===', {
      mode,
      selectedCrimeTypes: selectedCrimeTypes.map(id => CrimeTypesDictionary[id] || id),
      selectedPrecincts: selectedPrecincts.map(id => GetPrecinctsDictionary[id] || id),
      monthlyData: labels.map((label, i) => ({
        month: label,
        datasets: datasets.map(d => ({ label: d.label, value: d.data[i] })),
      })),
    });

    return { labels, datasets };
  }, [filteredHistorical, filteredForecast, forecastMonths, displayYears, interval, showYearly, mode, selectedCrimeTypes, normalizedTimeline, currentYear, currentMonth]);

  const unfilteredMax = useMemo(() => {
    const key = (y: number, m: number) => `${y}-${m}`;
    const totals = new Map<string, number>();
    historicalData.forEach(h => {
      const k = key(h.year, h.month);
      totals.set(k, (totals.get(k) ?? 0) + h.count);
    });
    forecastData.forEach(f => {
      const k = key(f.year, f.month);
      totals.set(k, (totals.get(k) ?? 0) + f.predictedCount);
    });
    const maxVal = Math.max(...totals.values(), 0);
    const rounded = Math.ceil(maxVal / 10) * 10 + 20;
    return Math.max(rounded, 30);
  }, [historicalData, forecastData]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 16, font: { size: 11 } },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const label = ctx.dataset.label || '';
            return `${label}: ${ctx.parsed.y}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Month' },
        ticks: { font: { size: 10 } },
      },
      y: {
        title: { display: true, text: 'Incident Count' },
        beginAtZero: true,
        max: unfilteredMax,
        ticks: {
          stepSize: 10,
          precision: 0,
        },
      },
    },
  };

  if (historicalData.length === 0 && forecastData.length === 0) return null;

  return (
    <div>
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between gap-2">
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
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setMode('consolidated')}
                className={`px-2 py-1 text-xs rounded-md font-medium transition ${
                  mode === 'consolidated' ? 'bg-white text-ubuntu-700 shadow-sm border' : 'text-gray-500 hover:text-gray-700'
                }`}
              >Consolidated</button>
              <button
                onClick={() => setMode('individual')}
                className={`px-2 py-1 text-xs rounded-md font-medium transition ${
                  mode === 'individual' ? 'bg-white text-ubuntu-700 shadow-sm border' : 'text-gray-500 hover:text-gray-700'
                }`}
              >Individual</button>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                interval === 'monthly'
                  ? 'bg-white text-ubuntu-700 shadow-sm border'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >Monthly</button>
            {showYearly && (
              <button
                onClick={() => setInterval('yearly')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                  interval === 'yearly'
                    ? 'bg-white text-ubuntu-700 shadow-sm border'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >Yearly</button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Crime:</span>
              <div className="flex flex-wrap gap-1 flex-1">
                  {availableCrimeTypes.map(({ id, label }) => (
                    <button key={id}
                      onClick={() => {
                        if (mode === 'individual') {
                          setSelectedCrimeTypes(prev => prev.includes(id) ? [] : [id]);
                        } else {
                          setSelectedCrimeTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                        }
                      }}
                      className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${
                        selectedCrimeTypes.includes(id)
                          ? mode === 'individual'
                            ? 'bg-ubuntu-500 text-white'
                            : 'bg-ubuntu-500 text-white'
                          : 'bg-white'
                      }`}
                    >{label}</button>
                  ))}
              </div>
            </div>

            {allYears.filter(y => y < currentYear).length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Year:</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {allYears.filter(y => y < currentYear).map(year => (
                    <button key={year}
                      onClick={() => setSelectedYears(prev => prev.includes(year) ? prev.filter(x => x !== year) : [...prev, year])}
                      className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedYears.includes(year) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >{year}</button>
                  ))}
                </div>
              </div>
            )}

            {availablePrecincts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Barangay:</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {availablePrecincts.map(({ id, name }) => (
                    <button key={id}
                      onClick={() => setSelectedPrecincts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedPrecincts.includes(id) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >{name}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => { setSelectedCrimeTypes([]); setSelectedPrecincts([]); setSelectedYears([]); }}
                className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
              >Reset</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4">
        {labels.length === 0 || datasets.length === 0 ? (
          <div className="text-center text-gray-500 italic py-16">No data matches the current filter selection.</div>
        ) : (
          <div ref={containerRef} style={{ height: 420 }}>
            {isContainerReady ? (
              <Line data={{ labels, datasets }} options={options} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <div className="animate-spin h-6 w-6 mx-auto mb-2 border-2 border-ubuntu-500 border-t-transparent rounded-full"></div>
                  <p className="text-sm">Loading chart...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400 flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-600 inline-block" style={{ borderTop: '2px dotted #666', height: 0 }}></span>
          Oldest
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-600 inline-block" style={{ borderTop: '2px dashed #666', height: 0 }}></span>
          Most Recent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-600 inline-block"></span>
          Predicted
        </span>
      </div>
    </div>
  );
};
