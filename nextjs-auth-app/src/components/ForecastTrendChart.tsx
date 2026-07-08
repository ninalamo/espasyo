'use client';

import React, { useMemo, useState } from 'react';
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
  const [showFilters, setShowFilters] = useState(true);

  const forecastMonths = useMemo(() => {
    const months = [...new Set(forecastData.map(f => f.month))].sort((a, b) => a - b);
    return months.length > 0 ? months : null;
  }, [forecastData]);

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

    const labels = forecastMonths.map(m => monthNames[m - 1]);

    const isIndividual = mode === 'individual' && selectedCrimeTypes.length > 0;
    const typeIds = isIndividual ? selectedCrimeTypes : [-1];

    const buildDataset = (typeId: number) => {
      const yearLines: any[] = [];
      const predictionYearSet = new Set(filteredForecast.map(f => f.year));

      allYears.forEach((year, yi) => {
        const hasPrediction = predictionYearSet.has(year);
        const colorIdx = typeId === -1 ? yi % YEAR_COLORS.length : typeId % CRIME_TYPE_COLORS.length;
        const baseColor = typeId === -1 ? YEAR_COLORS[colorIdx] : CRIME_TYPE_COLORS[colorIdx];
        const label = typeId === -1 ? String(year) : `${CrimeTypesDictionary[typeId] || typeId} (${year})`;

        if (!hasPrediction) {
          const values = forecastMonths.map(m => {
            const entry = filteredHistorical.find(h => h.year === year && h.month === m && (typeId === -1 || h.crimeType === typeId));
            return entry ? entry.count : null;
          });
          let lastVal: number | null = null;
          const filled = values.map(v => {
            if (v != null) { lastVal = v; return v; }
            return lastVal;
          });
          yearLines.push({
            label,
            data: filled,
            borderColor: baseColor,
            backgroundColor: baseColor + '22',
            pointBackgroundColor: baseColor,
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.3,
            fill: false,
            spanGaps: false,
          });
          return;
        }

        const histValues = forecastMonths.map(m => {
          const entry = filteredHistorical.find(h => h.year === year && h.month === m && (typeId === -1 || h.crimeType === typeId));
          return entry ? entry.count : null;
        });

        const foreValues = forecastMonths.map(m => {
          const entry = filteredForecast.find(f => f.year === year && f.month === m && (typeId === -1 || f.crimeType === typeId));
          return entry ? entry.predictedCount : null;
        });

        let lastHist: number | null = null;
        const actualData = histValues.map(v => {
          if (v != null) { lastHist = v; return v; }
          return lastHist;
        });

        yearLines.push({
          label: `${label} (Actual)`,
          data: actualData,
          borderColor: baseColor,
          backgroundColor: baseColor + '22',
          pointBackgroundColor: baseColor,
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.3,
          fill: false,
          spanGaps: false,
        });

        let lastFore: number | null = null;
        const predData = foreValues.map((v, i) => {
          if (actualData[i] != null) return null;
          if (v != null) { lastFore = v; return v; }
          return lastFore;
        });

        yearLines.push({
          label: `${label} (Predicted)`,
          data: predData,
          borderColor: baseColor,
          backgroundColor: baseColor + '22',
          pointBackgroundColor: baseColor,
          borderWidth: 2,
          pointRadius: 3,
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
          spanGaps: false,
        });
      });

      return yearLines;
    };

    const datasets = typeIds.flatMap(tid => buildDataset(tid));
    return { labels, datasets };
  }, [filteredHistorical, filteredForecast, forecastMonths, allYears, interval, showYearly, mode, selectedCrimeTypes]);

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
        ticks: { precision: 0 },
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
            {mode === 'individual' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-600">Crime:</span>
                <div className="flex flex-wrap gap-1 flex-1">
                  {availableCrimeTypes.map(({ id, label }) => (
                    <button key={id}
                      onClick={() => setSelectedCrimeTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                      className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedCrimeTypes.includes(id) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >{label}</button>
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
              <button onClick={() => { setSelectedCrimeTypes([]); setSelectedPrecincts([]); }}
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
          <div style={{ height: 420 }}>
            <Line data={{ labels, datasets }} options={options} />
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400 flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-600 inline-block"></span>
          Actual (Historical)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-gray-600 inline-block" style={{ background: 'transparent', borderTop: '2px dashed #666', height: 0 }}></span>
          Predicted (Forecast)
        </span>
      </div>
    </div>
  );
};
