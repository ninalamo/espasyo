'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { GetPrecinctsDictionary } from '../../constants/consts';
import { forecastApi } from '../api/utils/forecastApi';
import withAuth from '../hoc/withAuth';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';

interface PrecinctAllocation {
  precinctNumber: number;
  precinctName: string;
  avgMonthlyCrimes: number;
  totalPredicted: number;
  riskLevel: string;
  increasingCount: number;
  decreasingCount: number;
  suggestedOfficers: number;
  trend: 'up' | 'down' | 'stable';
}

const OFFICERS_PER_SQKM = 1.5;
const PATROL_DEMAND = 40;

const CRIME_SEVERITY_WEIGHTS: Record<number, number> = {
  0: 5,  1: 4,  2: 3,  3: 2,  4: 2,
  5: 3,  6: 4,  7: 4,  8: 2,  9: 4,
  10: 2, 11: 5, 12: 5, 13: 5, 14: 5,
  15: 5, 16: 5, 17: 5, 18: 2, 19: 2,
};

const RISK_BASELINE: Record<string, number> = {
  critical: 6, high: 4, medium: 3, low: 2,
};

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300',
};

function ManpowerProposalPage() {
  const searchParams = useSearchParams();
  const forecastId = searchParams.get('forecastId');

  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastName, setForecastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [precinctAreas, setPrecinctAreas] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    fetch('/data/precincts.geojson')
      .then(res => res.json())
      .then(data => {
        const areas = new Map<number, number>();
        data.features.forEach((f: any) => {
          const id = f.properties?.id;
          if (id !== undefined) {
            import('@turf/area').then(mod => {
              const areaSqM = mod.default(f);
              areas.set(id, Math.round((areaSqM / 10000)) / 100);
              setPrecinctAreas(new Map(areas));
            });
          }
        });
      })
      .catch(() => {});
  }, []);

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

  const getOverallRisk = (avgPerMonth: number): string => {
    if (avgPerMonth >= 50) return 'critical';
    if (avgPerMonth >= 25) return 'high';
    if (avgPerMonth >= 10) return 'medium';
    return 'low';
  };

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const byPrecinct = new Map<number, ForecastData[]>();
    for (const f of forecastData) {
      const existing = byPrecinct.get(f.precinct) || [];
      existing.push(f);
      byPrecinct.set(f.precinct, existing);
    }

    const monthCount = new Set(forecastData.map(f => `${f.year}-${f.month}`)).size;

    return Array.from(byPrecinct.entries())
      .map(([num, items]) => {
        const name = GetPrecinctsDictionary[num] || `Precinct ${num}`;
        const totalPredicted = items.reduce((s, i) => s + i.predictedCount, 0);
        const avgPerMonth = totalPredicted / monthCount;
        const riskLevel = getOverallRisk(avgPerMonth);
        const areaSqKm = precinctAreas.get(num) || 0;
        const weightedScore = items.reduce((s, i) => s + i.predictedCount * (CRIME_SEVERITY_WEIGHTS[i.crimeType] ?? 1), 0);
        const monthlyWeighted = weightedScore / monthCount;
        const patrolUnits = monthlyWeighted / PATROL_DEMAND;
        const areaUnits = areaSqKm * OFFICERS_PER_SQKM;
        const suggestedOfficers = Math.max(RISK_BASELINE[riskLevel], Math.round(patrolUnits + areaUnits));

        const inc = items.filter(i => i.trend === 'increasing').length;
        const dec = items.filter(i => i.trend === 'decreasing').length;
        const trend: 'up' | 'down' | 'stable' = inc > dec ? 'up' : dec > inc ? 'down' : 'stable';

        return {
          precinctNumber: num,
          precinctName: name,
          avgMonthlyCrimes: Math.round(avgPerMonth),
          totalPredicted,
          riskLevel,
          increasingCount: inc,
          decreasingCount: dec,
          suggestedOfficers,
          trend,
        };
      })
      .sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel);
      });
  }, [forecastData, precinctAreas]);

  const totalOfficers = useMemo(
    () => precinctAllocations.reduce((s, p) => s + p.suggestedOfficers, 0),
    [precinctAllocations]
  );

  const totalMonthlyCrimes = useMemo(
    () => precinctAllocations.reduce((s, p) => s + p.avgMonthlyCrimes, 0),
    [precinctAllocations]
  );

  const maxOfficers = useMemo(
    () => Math.max(...precinctAllocations.map(p => p.suggestedOfficers), 1),
    [precinctAllocations]
  );

  const riskCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    precinctAllocations.forEach(p => { counts[p.riskLevel as keyof typeof counts]++; });
    return counts;
  }, [precinctAllocations]);

  const publishProposal = useCallback(() => {
    setPublishing(true);
    try {
      const proposal = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        forecastId,
        forecastName,
        allocations: precinctAllocations,
        totalSuggestedOfficers: totalOfficers,
      };
      const existing = JSON.parse(localStorage.getItem('manpowerProposals') || '[]');
      existing.push(proposal);
      localStorage.setItem('manpowerProposals', JSON.stringify(existing));
      setPublished(true);
      toast.success('Manpower proposal published!');
    } catch {
      toast.error('Failed to publish proposal');
    } finally {
      setPublishing(false);
    }
  }, [forecastId, forecastName, precinctAllocations, totalOfficers]);

  const handlePrint = useCallback(() => window.print(), []);

  const perShift = Math.round(totalOfficers / 3);
  const nightShift = totalOfficers - perShift * 2;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
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
          <Link href="/forecast" className="text-blue-600 hover:text-blue-800 underline">
            ← Go to Forecasts
          </Link>
        </div>
      </div>
    );
  }

  if (forecastData.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Link href="/forecast" className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
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
          <Link href={`/forecast/${forecastId}/overview`} className="text-blue-600 hover:text-blue-800 text-sm flex items-center mb-2">
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
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            Print
          </button>
          {!published ? (
            <button
              onClick={publishProposal}
              disabled={publishing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {publishing ? 'Publishing...' : 'Publish Plan'}
            </button>
          ) : (
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
              Published
            </span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
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
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {riskCounts.critical + riskCounts.high}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  / {precinctAllocations.length}
                </span>
              </div>
              <div className="text-xs text-gray-500">High & Critical Risk</div>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation bar chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Officer Distribution by Precinct</h3>
        <div className="space-y-2">
          {precinctAllocations.map(pa => {
            const pct = (pa.suggestedOfficers / maxOfficers) * 100;
            const barColor =
              pa.riskLevel === 'critical' ? 'bg-red-500' :
              pa.riskLevel === 'high' ? 'bg-orange-500' :
              pa.riskLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500';
            return (
              <div key={pa.precinctNumber} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-right text-gray-700 truncate" title={pa.precinctName}>
                  {pa.precinctName}
                </span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-gray-900">{pa.suggestedOfficers}</span>
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Officers</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Shift Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {precinctAllocations.map(pa => {
                const s = Math.round(pa.suggestedOfficers / 3);
                const n = pa.suggestedOfficers - s * 2;
                const maxCrimes = Math.max(...precinctAllocations.map(p => p.avgMonthlyCrimes), 1);
                const crimeBarPct = (pa.avgMonthlyCrimes / maxCrimes) * 100;
                return (
                  <tr key={pa.precinctNumber} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="font-medium text-gray-900">{pa.precinctName}</span>
                        {pa.trend === 'up' && <span className="text-red-500 text-xs">↑</span>}
                        {pa.trend === 'down' && <span className="text-green-500 text-xs">↓</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${crimeBarPct}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-900 w-10 text-right">{pa.avgMonthlyCrimes}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${RISK_COLORS[pa.riskLevel]}`}>
                        {pa.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{pa.suggestedOfficers}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      M {s} &middot; E {s} &middot; N {n}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{totalMonthlyCrimes}</td>
                <td></td>
                <td className="px-4 py-3 text-right text-gray-900">{totalOfficers}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  M {perShift} &middot; E {perShift} &middot; N {nightShift}
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

export default withAuth(ManpowerProposalPage);
