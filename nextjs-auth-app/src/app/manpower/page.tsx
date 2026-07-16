'use client';

import { useState, useEffect, useMemo, useCallback, Fragment, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Users, TrendingUp, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import { forecastApi } from '../api/utils/forecastApi';
import withAuth from '../hoc/withAuth';
import { Skeleton, CardSkeleton, TableSkeleton } from '../../components/ui/skeleton';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';

const PATROL_CAPACITY_KEY = 'manpowerPatrolCapacity';
const DEFAULT_PATROL_CAPACITY = 15;

interface ShiftAllocation {
  shift: string;
  avgMonthlyIncidents: number;
  officers: number;
}

interface PrecinctAllocation {
  precinctNumber: number;
  precinctName: string;
  avgMonthlyCrimes: number;
  totalPredicted: number;
  shiftAllocations: ShiftAllocation[];
  totalOfficers: number;
  trend: 'up' | 'down' | 'stable';
}

const SHIFT_ORDER = ['Morning', 'Afternoon', 'Evening'];
const SHIFT_LABELS: Record<string, string> = {
  Morning: 'Morning (6AM–2PM)',
  Afternoon: 'Afternoon (2PM–10PM)',
  Evening: 'Evening (10PM–6AM)',
};

function ManpowerProposalPage() {
  const searchParams = useSearchParams();
  const forecastId = searchParams.get('forecastId');

  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastName, setForecastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [patrolCapacity, setPatrolCapacity] = useState(() => {
    try {
      const saved = localStorage.getItem(PATROL_CAPACITY_KEY);
      return saved ? parseInt(saved) : DEFAULT_PATROL_CAPACITY;
    } catch {
      return DEFAULT_PATROL_CAPACITY;
    }
  });
  const [expandedPrecinct, setExpandedPrecinct] = useState<number | null>(null);

  useEffect(() => {
    if (!forecastId) { setLoading(false); return; }
    (async () => {
      try {
        const snapshot = await forecastApi.getById(forecastId);
        setForecastData(snapshot.predictions || []);
        setForecastName(snapshot.name);
      } catch { toast.error('Failed to load forecast data'); }
      finally { setLoading(false); }
    })();
  }, [forecastId]);

  const updatePatrolCapacity = useCallback((val: number) => {
    setPatrolCapacity(val);
    try { localStorage.setItem(PATROL_CAPACITY_KEY, String(val)); } catch {}
  }, []);

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const byPrecinct = new Map<number, ForecastData[]>();
    for (const f of forecastData) {
      const existing = byPrecinct.get(f.precinct) || [];
      existing.push(f);
      byPrecinct.set(f.precinct, existing);
    }

    const allMonths = new Set(forecastData.map(f => `${f.year}-${f.month}`));
    const monthCount = allMonths.size;

    return Array.from(byPrecinct.entries())
      .map(([num, items]) => {
        const name = GetPrecinctsDictionary[num] || `Precinct ${num}`;
        const totalPredicted = items.reduce((s, i) => s + i.predictedCount, 0);
        const avgMonthly = totalPredicted / monthCount;

        const byShift = new Map<string, ForecastData[]>();
        for (const f of items) {
          const shift = f.shift || 'Unknown';
          const arr = byShift.get(shift) || [];
          arr.push(f);
          byShift.set(shift, arr);
        }

        const shiftAllocs: ShiftAllocation[] = SHIFT_ORDER
          .map(shift => {
            const shiftItems = byShift.get(shift) || [];
            const shiftTotal = shiftItems.reduce((s, f) => s + f.predictedCount, 0);
            const avgMonthlyIncidents = shiftTotal / monthCount;
            const officers = Math.max(1, Math.ceil(avgMonthlyIncidents / patrolCapacity));
            return { shift, avgMonthlyIncidents, officers };
          });

        const totalOfficers = shiftAllocs.reduce((s, a) => s + a.officers, 0);

        const inc = items.filter(i => i.trend === 'increasing').length;
        const dec = items.filter(i => i.trend === 'decreasing').length;
        const trend: 'up' | 'down' | 'stable' = inc > dec ? 'up' : dec > inc ? 'down' : 'stable';

        return {
          precinctNumber: num,
          precinctName: name,
          avgMonthlyCrimes: Math.round(avgMonthly),
          totalPredicted,
          shiftAllocations: shiftAllocs,
          totalOfficers,
          trend,
        };
      })
      .sort((a, b) => b.totalOfficers - a.totalOfficers);
  }, [forecastData, patrolCapacity]);

  const totalOfficers = useMemo(
    () => precinctAllocations.reduce((s, p) => s + p.totalOfficers, 0),
    [precinctAllocations]
  );

  const totalMonthlyCrimes = useMemo(
    () => precinctAllocations.reduce((s, p) => s + p.avgMonthlyCrimes, 0),
    [precinctAllocations]
  );

  const maxOfficers = useMemo(
    () => Math.max(...precinctAllocations.map(p => p.totalOfficers), 1),
    [precinctAllocations]
  );

  const exportCsv = useCallback(() => {
    const rows = precinctAllocations.map(pa => {
      const morning = pa.shiftAllocations.find(a => a.shift === 'Morning')?.officers ?? 0;
      const afternoon = pa.shiftAllocations.find(a => a.shift === 'Afternoon')?.officers ?? 0;
      const evening = pa.shiftAllocations.find(a => a.shift === 'Evening')?.officers ?? 0;
      return [
        pa.precinctName,
        pa.avgMonthlyCrimes,
        pa.totalOfficers,
        morning,
        afternoon,
        evening,
        pa.trend === 'up' ? 'Increasing' : pa.trend === 'down' ? 'Decreasing' : 'Stable',
      ];
    });
    const csv = [
      ['Precinct', 'Avg Crimes/Month', 'Total Officers', 'Morning', 'Afternoon', 'Evening', 'Trend'],
      ...rows,
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manpower-allocation-${forecastName.replace(/[^a-z0-9]/gi, '_') || 'plan'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [precinctAllocations, forecastName]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <Skeleton className="h-48 w-full rounded" />
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  if (!forecastId) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Manpower Allocation</h1>
          <p className="text-gray-600 mb-6">
            Go to a forecast and click <strong>Build Manpower Plan</strong> to generate an allocation based on predicted crime data.
          </p>
          <Link href="/forecast" className="text-ubuntu-600 hover:text-blue-800 underline">
            ← Go to Forecasts
          </Link>
        </div>
      </div>
    );
  }

  if (forecastData.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Link href="/forecast" className="text-ubuntu-600 hover:text-blue-800 text-sm flex items-center">
          ← Back to Forecasts
        </Link>
        <div className="text-center py-12">
          <h2 className="text-lg font-medium text-gray-900 mb-2">No forecast data found</h2>
          <p className="text-gray-500">The selected forecast has no prediction data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start no-print">
        <div>
          <Link href={`/forecast/${forecastId}/overview`} className="text-ubuntu-600 hover:text-blue-800 text-sm flex items-center mb-2">
            ← Back to Forecast
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Manpower Allocation Plan</h1>
          <p className="text-gray-500 mt-1">
            Based on <strong>{forecastName}</strong> &middot; {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/manpower/faq"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            FAQ
          </Link>
          <button
            onClick={exportCsv}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white border border-gray-200 rounded-lg no-print">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Settings className="w-4 h-4" />
            Patrol Capacity
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">incidents per officer per month</span>
            <input
              type="number"
              value={patrolCapacity}
              onChange={e => updatePatrolCapacity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-2 py-1 border rounded text-right text-sm"
              min={1}
              step={1}
            />
          </div>
        </div>
        <div className="px-4 pb-3 text-xs text-gray-500">
          Each patrolling officer covers approximately <strong>{patrolCapacity}</strong> predicted incidents per month.
          Officers are allocated per precinct per shift proportional to predicted crime volume.
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-ubuntu-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalOfficers}</div>
              <div className="text-xs text-gray-500">Total Officers</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{precinctAllocations.length}</div>
              <div className="text-xs text-gray-500">Precincts Covered</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalMonthlyCrimes}</div>
              <div className="text-xs text-gray-500">Predicted Crimes / Month</div>
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-2xl font-bold text-gray-900">{patrolCapacity}</div>
              <div className="text-xs text-gray-500">Capacity / Officer / Month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation bar chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Officer Distribution by Precinct</h3>
        <div className="space-y-2">
          {precinctAllocations.map(pa => {
            const pct = (pa.totalOfficers / maxOfficers) * 100;
            return (
              <div key={pa.precinctNumber} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-right text-gray-700 truncate" title={pa.precinctName}>
                  {pa.precinctName}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-ubuntu-500"
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-gray-900">{pa.totalOfficers}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Allocation table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precinct</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Predicted Crimes / Month</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Officers</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Shift Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {precinctAllocations.map(pa => {
                const isExpanded = expandedPrecinct === pa.precinctNumber;
                const maxCrimes = Math.max(...precinctAllocations.map(p => p.avgMonthlyCrimes), 1);
                const crimeBarPct = (pa.avgMonthlyCrimes / maxCrimes) * 100;

                const morning = pa.shiftAllocations.find(a => a.shift === 'Morning')?.officers ?? 0;
                const afternoon = pa.shiftAllocations.find(a => a.shift === 'Afternoon')?.officers ?? 0;
                const evening = pa.shiftAllocations.find(a => a.shift === 'Evening')?.officers ?? 0;

                return (
                  <Fragment key={pa.precinctNumber}>
                    <tr
                      onClick={() => setExpandedPrecinct(isExpanded ? null : pa.precinctNumber)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
                          <MapPin className="w-4 h-4 text-ubuntu-600 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{pa.precinctName}</span>
                          {pa.trend === 'up' && <span className="text-red-500 text-xs">↑</span>}
                          {pa.trend === 'down' && <span className="text-green-500 text-xs">↓</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-ubuntu-500"
                              style={{ width: `${crimeBarPct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-900 w-10 text-right">{pa.avgMonthlyCrimes}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{pa.totalOfficers}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        Morning {morning} &middot; Afternoon {afternoon} &middot; Evening {evening}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">

                            {/* Shift breakdown */}
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Shift Allocation</h4>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="text-left py-1 pr-2">Shift</th>
                                    <th className="text-right px-2">Avg Incidents/Mo</th>
                                    <th className="text-right pl-2">Officers</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pa.shiftAllocations.map(sa => (
                                    <tr key={sa.shift} className="border-b border-gray-100">
                                      <td className="py-1 pr-2 text-gray-700">{SHIFT_LABELS[sa.shift] || sa.shift}</td>
                                      <td className="text-right px-2">{Math.round(sa.avgMonthlyIncidents)}</td>
                                      <td className="text-right pl-2 font-medium">{sa.officers}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="font-semibold">
                                  <tr>
                                    <td className="py-1 pr-2">Total</td>
                                    <td className="text-right px-2">{pa.avgMonthlyCrimes}</td>
                                    <td className="text-right pl-2">{pa.totalOfficers}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Crime type breakdown */}
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Crime Type Breakdown</h4>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="text-left py-1 pr-2">Crime Type</th>
                                    <th className="text-right px-2">Predicted/Mo</th>
                                    <th className="text-right px-2">Shift</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from(
                                    new Map(
                                      forecastData
                                        .filter(f => f.precinct === pa.precinctNumber)
                                        .map(f => [f.crimeType, f])
                                    ).values()
                                  )
                                    .sort((a, b) => b.predictedCount - a.predictedCount)
                                    .slice(0, 10)
                                    .map(f => (
                                      <tr key={f.crimeType} className="border-b border-gray-100">
                                        <td className="py-1 pr-2 text-gray-700">{CrimeTypesDictionary[f.crimeType] || `Type ${f.crimeType}`}</td>
                                        <td className="text-right px-2">{Math.round(f.predictedCount)}/mo</td>
                                        <td className="text-right px-2 text-gray-500">{f.shift || '—'}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{totalMonthlyCrimes}</td>
                <td className="px-4 py-3 text-right text-gray-900">{totalOfficers}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  {(() => {
                    const m = precinctAllocations.reduce((s, p) => s + (p.shiftAllocations.find(a => a.shift === 'Morning')?.officers ?? 0), 0);
                    const a = precinctAllocations.reduce((s, p) => s + (p.shiftAllocations.find(a => a.shift === 'Afternoon')?.officers ?? 0), 0);
                    const e = precinctAllocations.reduce((s, p) => s + (p.shiftAllocations.find(a => a.shift === 'Evening')?.officers ?? 0), 0);
                    return <>Morning {m} &middot; Afternoon {a} &middot; Evening {e}</>;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Manpower Allocation Proposal</h1>
        <p className="text-gray-600">Based on: {forecastName}</p>
        <p className="text-gray-500 text-sm">Generated {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}

function ManpowerPage() {
  return (
    <Suspense fallback={<div className="p-6 space-y-6"><div className="flex justify-between items-center"><div className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-96" /></div><Skeleton className="h-10 w-48" /></div><div className="grid grid-cols-1 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div><div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"><Skeleton className="h-48 w-full rounded" /></div><TableSkeleton rows={10} /></div>}>
      <ManpowerProposalPage />
    </Suspense>
  );
}

export default withAuth(ManpowerPage);
