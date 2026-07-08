'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { ChartOptions, TooltipItem } from 'chart.js';
import 'chart.js/auto';
import { format, getISOWeek } from 'date-fns';
import { Cluster } from '../types/analysis/ClusterDto';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../constants/consts';

type Interval = 'daily' | 'weekly' | 'monthly' | 'yearly';

const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const CRIME_TYPE_COLORS = [
  '#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4',
  '#42D4F4', '#F032E6', '#BFEF45', '#469990', '#DCBEFF',
  '#9A6324', '#FFFAC8', '#800000', '#A6CEE3', '#1F78B4',
  '#B2DF8A', '#33A02C', '#FB9A99', '#E31A1C', '#FDBF6F',
];

const ALL_CRIME_TYPES = Object.entries(CrimeTypesDictionary)
  .filter(([id]) => parseInt(id) >= 0)
  .map(([id, label]) => ({ id: parseInt(id), label }));

const TIME_OF_DAY_OPTIONS = ['Morning', 'Afternoon', 'Evening'];

interface Props {
  clusters: Cluster[];
  dateFrom?: string;
  dateTo?: string;
}

export const CrimeTrendChart: React.FC<Props> = ({ clusters, dateFrom, dateTo }) => {
  const [interval, setInterval] = useState<Interval>('daily');
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<number[]>([]);
  const [selectedPrecincts, setSelectedPrecincts] = useState<number[]>([]);
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [filterDateFrom, setFilterDateFrom] = useState(dateFrom || '');
  const [filterDateTo, setFilterDateTo] = useState(dateTo || '');
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

  useEffect(() => {
    setFilterDateFrom(dateFrom || '');
    setFilterDateTo(dateTo || '');
  }, [dateFrom, dateTo]);

  const availableCrimeTypes = useMemo(() => {
    const typesInData = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.crimeType)));
    return ALL_CRIME_TYPES.filter(ct => typesInData.has(ct.id));
  }, [clusters]);

  const availablePrecincts = useMemo(() => {
    const pcsInData = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.precinct)));
    return Object.entries(GetPrecinctsDictionary)
      .map(([id, name]) => ({ id: parseInt(id), name }))
      .filter(pc => pcsInData.has(pc.id))
      .sort((a, b) => a.id - b.id);
  }, [clusters]);

  const filteredItems = useMemo(() => {
    let items = clusters.flatMap(c => c.clusterItems);
    if (selectedCrimeTypes.length > 0) items = items.filter(i => selectedCrimeTypes.includes(i.crimeType));
    if (selectedPrecincts.length > 0) items = items.filter(i => selectedPrecincts.includes(i.precinct));
    if (selectedTimeOfDay.length > 0) items = items.filter(i => selectedTimeOfDay.includes(i.timeOfDay));
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      items = items.filter(i => new Date(i.year, i.month - 1, i.day) >= fromDate);
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      items = items.filter(i => new Date(i.year, i.month - 1, i.day) <= toDate);
    }
    return items;
  }, [clusters, selectedCrimeTypes, selectedPrecincts, selectedTimeOfDay, filterDateFrom, filterDateTo]);

  const { labels, datasets } = useMemo(() => {
    const visibleTypes = selectedCrimeTypes.length > 0 ? selectedCrimeTypes : ALL_CRIME_TYPES.map(ct => ct.id);

    const grouped = new Map<string, Map<number, number>>();

    filteredItems.forEach(item => {
      const day = interval === 'daily' || interval === 'weekly'
        ? item.day
        : 1;
      const date = new Date(item.year, item.month - 1, day);
      let key: string;
      switch (interval) {
        case 'daily':
          key = format(date, 'yyyy-MM-dd');
          break;
        case 'weekly': {
          const week = getISOWeek(date);
          key = `${item.year}-W${String(week).padStart(2, '0')}`;
          break;
        }
        case 'monthly':
          key = `${item.year}-${String(item.month).padStart(2, '0')}`;
          break;
        case 'yearly':
          key = `${item.year}`;
          break;
        default:
          key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      }

      if (!grouped.has(key)) grouped.set(key, new Map());
      const typeMap = grouped.get(key)!;
      typeMap.set(item.crimeType, (typeMap.get(item.crimeType) || 0) + 1);
    });

    // Fill gaps so the timeline is continuous (zero-fill empty buckets)
    if (filteredItems.length > 0 || filterDateFrom || filterDateTo) {
      let minDate: Date;
      let maxDate: Date;

      if (filteredItems.length > 0) {
        minDate = new Date(9999, 11, 31);
        maxDate = new Date(0, 0, 1);
        filteredItems.forEach(item => {
          const day = interval === 'daily' || interval === 'weekly' ? item.day : 1;
          const d = new Date(item.year, item.month - 1, day);
          if (d < minDate) minDate = new Date(d);
          if (d > maxDate) maxDate = new Date(d);
        });
      } else {
        minDate = new Date();
        maxDate = new Date();
      }

      if (filterDateFrom) {
        const [y, m, d] = filterDateFrom.split('-').map(Number);
        const fromDate = new Date(y, m - 1, d || 1);
        if (fromDate < minDate) minDate = fromDate;
      }
      if (filterDateTo) {
        const [y, m, d] = filterDateTo.split('-').map(Number);
        const toDate = new Date(y, m - 1, d || 1);
        toDate.setHours(23, 59, 59, 999);
        if (toDate > maxDate) maxDate = toDate;
      }

      const cursor = new Date(minDate);
      while (cursor <= maxDate) {
        let key: string;
        switch (interval) {
          case 'daily':
            key = format(cursor, 'yyyy-MM-dd');
            break;
          case 'weekly': {
            const week = getISOWeek(cursor);
            key = `${cursor.getFullYear()}-W${String(week).padStart(2, '0')}`;
            break;
          }
          case 'monthly':
            key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'yearly':
            key = `${cursor.getFullYear()}`;
            break;
          default:
            key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        }
        if (!grouped.has(key)) grouped.set(key, new Map());
        switch (interval) {
          case 'daily': cursor.setDate(cursor.getDate() + 1); break;
          case 'weekly': cursor.setDate(cursor.getDate() + 7); break;
          case 'monthly': cursor.setMonth(cursor.getMonth() + 1); break;
          case 'yearly': cursor.setFullYear(cursor.getFullYear() + 1); break;
          default: cursor.setMonth(cursor.getMonth() + 1);
        }
      }
    }

    const sortedKeys = [...grouped.keys()].sort();

    const labels = sortedKeys.map(key => {
      switch (interval) {
        case 'daily': {
          const [y, m, d] = key.split('-').map(Number);
          return format(new Date(y, m - 1, d), 'MMM dd, yyyy');
        }
        case 'weekly': {
          const [y, w] = key.split('-W').map(Number);
          const jan1 = new Date(y, 0, 1);
          const daysOffset = (w - 1) * 7;
          const weekStart = new Date(jan1.getTime() + daysOffset * 86400000);
          return `W${w} (${format(weekStart, 'MMM dd')})`;
        }
        case 'monthly': {
          const [y, m] = key.split('-').map(Number);
          return format(new Date(y, m - 1, 1), 'MMM yyyy');
        }
        case 'yearly':
          return key;
        default:
          return key;
      }
    });

    const datasets = visibleTypes.map((typeId) => {
      const color = CRIME_TYPE_COLORS[typeId % CRIME_TYPE_COLORS.length];
      return {
        label: CrimeTypesDictionary[typeId] || `Type ${typeId}`,
        data: sortedKeys.map(key => grouped.get(key)?.get(typeId) || 0),
        borderColor: color,
        backgroundColor: color + '22',
        pointBackgroundColor: color,
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      };
    });

    return { labels, datasets };
  }, [filteredItems, interval, selectedCrimeTypes]);

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 16,
          font: { size: 11 },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (ctx: TooltipItem<'line'>) => {
            const label = ctx.dataset.label || '';
            const val = ctx.parsed.y;
            return `${label}: ${val}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: interval === 'yearly' ? 'Year' : interval === 'daily' ? 'Date' : 'Time Period' },
        ticks: { maxTicksLimit: 25, font: { size: 10 } },
      },
      y: {
        title: { display: true, text: 'Incident Count' },
        beginAtZero: true,
        ticks: { precision: 0 },
      },
    },
  };

  if (!clusters || clusters.length === 0) return null;

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
              Post-Analysis Filters
            </button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {INTERVAL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                  interval === opt.value
                    ? 'bg-white text-ubuntu-700 shadow-sm border'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
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

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Time:</span>
              <div className="flex flex-wrap gap-1">
                {TIME_OF_DAY_OPTIONS.map(t => (
                  <button key={t} onClick={() => setSelectedTimeOfDay(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={`px-2 py-0.5 border rounded text-xs ${selectedTimeOfDay.includes(t) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Date:</span>
              <input type="date" value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                min={dateFrom || undefined}
                max={filterDateTo || undefined}
                className="border rounded px-2 py-0.5 text-xs" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                min={filterDateFrom || undefined}
                max={dateTo || undefined}
                className="border rounded px-2 py-0.5 text-xs" />
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
              <button onClick={() => { setSelectedCrimeTypes([]); setSelectedTimeOfDay([]); setSelectedPrecincts([]); setFilterDateFrom(dateFrom || ''); setFilterDateTo(dateTo || ''); }}
                className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
              >Reset</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-lg p-4">
        {labels.length === 0 ? (
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
    </div>
  );
};
