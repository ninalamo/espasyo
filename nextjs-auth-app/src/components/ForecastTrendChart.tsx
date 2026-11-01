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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const [stepSize, setStepSize] = useState<1 | 5 | 10>(10);
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

  const timeline = useMemo(() => {
    if (forecastData.length === 0) return [];
    const first = forecastData.reduce((a, b) =>
      a.year < b.year || (a.year === b.year && a.month < b.month) ? a : b
    );
    const last = forecastData.reduce((a, b) =>
      a.year > b.year || (a.year === b.year && a.month > b.month) ? a : b
    );
    const result: Array<{ year: number; month: number }> = [];
    let y = first.year, m = first.month;
    while (y < last.year || (y === last.year && m <= last.month)) {
      result.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result;
  }, [forecastData]);

  const forecastYears = useMemo(() => {
    return [...new Set(forecastData.map(f => f.year))].sort((a, b) => a - b);
  }, [forecastData]);

  const showYearly = timeline.length >= 12;

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

  const filteredForecast = useMemo(() => {
    let items = [...forecastData];
    if (selectedCrimeTypes.length > 0) items = items.filter(i => selectedCrimeTypes.includes(i.crimeType));
    if (selectedPrecincts.length > 0) items = items.filter(i => selectedPrecincts.includes(i.precinct));
    if (selectedYears.length > 0) items = items.filter(i => selectedYears.includes(i.year));
    return items;
  }, [forecastData, selectedCrimeTypes, selectedPrecincts, selectedYears]);

  const displayTimeline = useMemo(() => {
    const forecastDates = new Set(filteredForecast.map(f => `${f.year}-${f.month}`));
    return timeline.filter(({ year, month }) => forecastDates.has(`${year}-${month}`));
  }, [timeline, filteredForecast]);

  const forecastMonths = useMemo(() => {
    const months = [...new Set(displayTimeline.map(t => t.month))].sort((a, b) => a - b);
    return months.length > 0 ? months : null;
  }, [displayTimeline]);

  const normalizedTimeline = useMemo(() => {
    const map = new Map<string, number>();
    const key = (y: number, m: number, t: number) => `${y}-${m}-${t}`;
    filteredForecast.forEach(f => {
      const k = key(f.year, f.month, -1);
      map.set(k, (map.get(k) ?? 0) + f.predictedCount);
      const k2 = key(f.year, f.month, f.crimeType);
      map.set(k2, (map.get(k2) ?? 0) + f.predictedCount);
    });
    return map;
  }, [filteredForecast]);

  const { labels, datasets } = useMemo(() => {
    if (!forecastMonths) return { labels: [], datasets: [] };

    const monthNames = MONTH_NAMES;
    const useYearly = interval === 'yearly' && showYearly;

    if (useYearly) {
      const yearSet = [...new Set(filteredForecast.map(f => f.year))].sort((a, b) => a - b);
      const labels = yearSet.map(String);

      const isIndividual = mode === 'individual' && selectedCrimeTypes.length > 0;
      const typeIds = isIndividual ? selectedCrimeTypes : [-1];

      const datasets: any[] = [];
      typeIds.forEach(typeId => {
        const baseLabel = typeId === -1 ? 'Total' : (CrimeTypesDictionary[typeId] || String(typeId));
        const color = typeId === -1 ? YEAR_COLORS[0] : CRIME_TYPE_COLORS[typeId % CRIME_TYPE_COLORS.length];
        const matchingRowsForYear = (year: number) => filteredForecast.filter(f =>
          f.year === year && (typeId === -1 || f.crimeType === typeId)
        );
        const priorYearActuals = yearSet.map(year => {
          const available = matchingRowsForYear(year).filter(
            f => f.lastYearActual !== undefined && f.lastYearActual !== null
          );
          return available.length > 0
            ? available.reduce((total, f) => total + (f.lastYearActual ?? 0), 0)
            : null;
        });
        const projections = yearSet.map(year =>
          matchingRowsForYear(year).reduce((total, f) => total + f.predictedCount, 0)
        );

        datasets.push({
          label: `${baseLabel} (prior-year actual)`,
          data: priorYearActuals,
          borderColor: '#6B7280',
          backgroundColor: '#6B728022',
          pointBackgroundColor: '#6B7280',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          spanGaps: false,
          borderDash: [6, 4],
        }, {
          label: `${baseLabel} (forecast)`,
          data: projections,
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

      return { labels, datasets };
    }

    const labels = displayTimeline.map(t => `${MONTH_NAMES[t.month - 1]} ${t.year}`);

    const isIndividual = mode === 'individual' && selectedCrimeTypes.length > 0;
    const typeIds = isIndividual ? selectedCrimeTypes : [-1];

    const buildComparisonDataset = (typeId: number) => {
      const baseLabel = typeId === -1 ? 'Total' : (CrimeTypesDictionary[typeId] || String(typeId));
      const forecastSeries = displayTimeline.map(({ year, month }) => {
        const key = `${year}-${month}-${typeId}`;
        return normalizedTimeline.get(key) ?? null;
      });
      const historicalSeries = displayTimeline.map(({ year, month }) => {
        const matchingForecasts = filteredForecast.filter(f =>
          f.year === year &&
          f.month === month &&
          (typeId === -1 || f.crimeType === typeId)
        );
        const availableComparisons = matchingForecasts.filter(
          f => f.lastYearActual !== undefined && f.lastYearActual !== null
        );
        return availableComparisons.length > 0
          ? availableComparisons.reduce((total, f) => total + (f.lastYearActual ?? 0), 0)
          : null;
      });

      const forecastColor = typeId === -1 ? YEAR_COLORS[0] : CRIME_TYPE_COLORS[typeId % CRIME_TYPE_COLORS.length];
      const previousYearColor = typeId === -1 ? '#6B7280' : '#94A3B8';

      return [
        {
          label: `${baseLabel} (previous year)`,
          data: historicalSeries,
          borderColor: previousYearColor,
          backgroundColor: previousYearColor + '22',
          pointBackgroundColor: previousYearColor,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          spanGaps: false,
          borderDash: [6, 4],
        },
        {
          label: `${baseLabel} (forecast)`,
          data: forecastSeries,
          borderColor: forecastColor,
          backgroundColor: forecastColor + '22',
          pointBackgroundColor: forecastColor,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          spanGaps: false,
        },
      ];
    };

    const datasets = typeIds.flatMap(tid => buildComparisonDataset(tid));

    return { labels, datasets };
  }, [filteredForecast, displayTimeline, interval, showYearly, mode, selectedCrimeTypes, normalizedTimeline, forecastMonths]);

  const chartMax = useMemo(() => {
    const totals = new Map<string, { forecast: number; comparison: number }>();
    filteredForecast.forEach(f => {
      const key = `${f.year}-${f.month}`;
      const monthTotals = totals.get(key) ?? { forecast: 0, comparison: 0 };
      monthTotals.forecast += f.predictedCount;
      monthTotals.comparison += f.lastYearActual ?? 0;
      totals.set(key, monthTotals);
    });
    const maxVal = Math.max(
      ...[...totals.values()].flatMap(({ forecast, comparison }) => [forecast, comparison]),
      0
    );
    const padding = stepSize === 1 ? 5 : stepSize * 2;
    const rounded = Math.ceil(maxVal / stepSize) * stepSize + padding;
    return Math.max(rounded, stepSize * 3);
  }, [filteredForecast, stepSize]);

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
        max: chartMax,
        ticks: {
          stepSize,
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

            {forecastYears.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Forecast year:</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {forecastYears.map(year => (
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

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Scale:</span>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {([1, 5, 10] as const).map(s => (
                  <button key={s}
                    onClick={() => setStepSize(s)}
                    className={`px-2 py-0.5 text-xs rounded-md font-medium transition ${
                      stepSize === s
                        ? 'bg-white text-ubuntu-700 shadow-sm border'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >by {s}&apos;s</button>
                ))}
              </div>
            </div>
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

      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">How this prediction is computed</p>
        <p>
          For each precinct and crime type, the system uses Singular Spectrum Analysis (SSA) via ML.NET&apos;s{' '}
          <code>ForecastBySsa</code>. SSA decomposes the historical monthly incident counts into trend, seasonality,
          and noise components, reconstructs each, and projects them forward from the current calendar month.
          The window size is capped at 12 (or half the series length, whichever is smaller) to satisfy SSA&apos;s
          internal constraints. Predicted values are capped so they cannot exceed roughly twice the long-term
          average, preventing runaway extrapolation on sparse or noisy series. If the forecast horizon exceeds
          SSA&apos;s limit, it falls back to a simple linear trend model.
        </p>
        <p>
          Lines for past years are shown faded (older years are lighter) for year-over-year comparison, while the solid
          bright line is the forecast for the upcoming window. Dashed lines mark historical years; the unbroken bright
          line is the prediction.
        </p>
      </div>
    </div>
  );
};
