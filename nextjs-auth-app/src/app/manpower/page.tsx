'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import turfArea from '@turf/area';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import { forecastApi } from '../api/utils/forecastApi';
import withAuth from '../hoc/withAuth';
import type { ForecastData, ForecastSummaryCard } from '../../types/forecast/ForecastBaseTypes';

interface RiskRule {
  riskLevel: string;
  label: string;
  officers: number;
}

interface PrecinctAllocation {
  precinctNumber: number;
  precinctName: string;
  avgMonthlyCrimes: number;
  riskLevel: string;
  highRiskCount: number;
  criticalRiskCount: number;
  increasingCount: number;
  decreasingCount: number;
  stableCount: number;
  areaSqKm: number;
  suggestedOfficers: number;
}

const PATROL_HOURS_PER_MONTH = 22 * 8;
const OFFICERS_PER_SQKM = 1.5;

const CRIME_SEVERITY_WEIGHTS: Record<number, number> = {
  0: 5,  1: 4,  2: 3,  3: 2,  4: 2,
  5: 3,  6: 4,  7: 4,  8: 2,  9: 4,
  10: 2, 11: 5, 12: 5, 13: 5, 14: 5,
  15: 5, 16: 5, 17: 5, 18: 2, 19: 2,
};

const DEFAULT_RULES: RiskRule[] = [
  { riskLevel: 'critical', label: 'Critical', officers: 6 },
  { riskLevel: 'high', label: 'High', officers: 4 },
  { riskLevel: 'medium', label: 'Medium', officers: 3 },
  { riskLevel: 'low', label: 'Low', officers: 2 },
];

function ManpowerProposalPage() {
  const searchParams = useSearchParams();
  const forecastId = searchParams.get('forecastId');

  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastName, setForecastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [patrolDemand, setPatrolDemand] = useState(40);
  const [precinctAreas, setPrecinctAreas] = useState<Map<number, number>>(new Map());
  const [rules] = useState<RiskRule[]>(DEFAULT_RULES);

  useEffect(() => {
    fetch('/data/precincts.geojson')
      .then(res => res.json())
      .then(data => {
        const areas = new Map<number, number>();
        data.features.forEach((f: any) => {
          const id = f.properties?.id;
          if (id !== undefined) {
            const areaSqM = turfArea(f);
            areas.set(id, Math.round((areaSqM / 10000)) / 100);
          }
        });
        setPrecinctAreas(areas);
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

  const getRule = (risk: string): RiskRule =>
    rules.find(r => r.riskLevel === risk) || rules[rules.length - 1];

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const getRule = (risk: string): RiskRule =>
      rules.find(r => r.riskLevel === risk) || rules[rules.length - 1];

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
        const rule = getRule(riskLevel);
        const areaSqKm = precinctAreas.get(num) || 0;
        const weightedScore = items.reduce((s, i) => s + i.predictedCount * (CRIME_SEVERITY_WEIGHTS[i.crimeType] ?? 1), 0);
        const monthlyWeighted = weightedScore / monthCount;
        const patrolUnits = monthlyWeighted / patrolDemand;
        const areaUnits = areaSqKm * OFFICERS_PER_SQKM;
        const suggestedOfficers = Math.max(rule.officers, Math.round(patrolUnits + areaUnits));

        return {
          precinctNumber: num,
          precinctName: name,
          avgMonthlyCrimes: Math.round(avgPerMonth),
          riskLevel,
          highRiskCount: items.filter(i => i.riskLevel === 'high').length,
          criticalRiskCount: items.filter(i => i.riskLevel === 'critical').length,
          increasingCount: items.filter(i => i.trend === 'increasing').length,
          decreasingCount: items.filter(i => i.trend === 'decreasing').length,
          stableCount: items.filter(i => i.trend === 'stable').length,
          areaSqKm,
          suggestedOfficers,
        };
      })
      .sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel);
      });
  }, [forecastData, rules, precinctAreas, patrolDemand]);

  const totalOfficers = useMemo(
    () => precinctAllocations.reduce((s, p) => s + p.suggestedOfficers, 0),
    [precinctAllocations]
  );

  const publishProposal = useCallback(() => {
    setPublishing(true);
    try {
      const proposal = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        forecastId,
        forecastName,
        rules,
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
  }, [forecastId, forecastName, rules, precinctAllocations, totalOfficers]);

  const handlePrint = useCallback(() => window.print(), []);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getTrendIcon = (inc: number, dec: number) => {
    if (inc > dec) return <span className="text-red-500">📈</span>;
    if (dec > inc) return <span className="text-green-500">📉</span>;
    return <span className="text-yellow-500">📊</span>;
  };

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
            Please access this page through the <strong>Trend Analysis</strong> page of a specific forecast to ensure the allocation is based on the correct forecast data.
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
      <div className="flex justify-between items-start no-print">
        <div>
          <Link href="/forecast" className="text-blue-600 hover:text-blue-800 text-sm flex items-center mb-2">
            ← Back to Forecasts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Manpower Allocation Proposal</h1>
          <p className="text-gray-600 mt-1">
            Based on forecast: <strong>{forecastName}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            🖨️ Print
          </button>
          {!published ? (
            <button
              onClick={publishProposal}
              disabled={publishing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {publishing ? 'Publishing...' : '📋 Publish Proposal'}
            </button>
          ) : (
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
              ✅ Published
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 no-print">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Patrol capacity:</label>
          <input
            type="range"
            min={10}
            max={200}
            step={5}
            value={patrolDemand}
            onChange={(e) => setPatrolDemand(parseInt(e.target.value))}
            className="w-32"
          />
          <span className="text-sm font-semibold text-blue-700 w-10">{patrolDemand}</span>
          <span className="text-xs text-gray-500">weighted units per officer / month</span>
        </div>
        <div className="text-xs text-gray-400 border-l border-gray-200 pl-4">
          8h patrol · 22 days/mo = {PATROL_HOURS_PER_MONTH}h available
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            Suggested Officer Allocation
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({precinctAllocations.length} precincts, {totalOfficers} total officers)
            </span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precinct</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Monthly Crimes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Area (km²)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Suggested Officers</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Per Shift (Morning / Evening / Night)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {precinctAllocations.map((pa) => {
                const perShift = Math.round(pa.suggestedOfficers / 3);
                return (
                  <tr key={pa.precinctNumber} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-900">{pa.precinctName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{pa.avgMonthlyCrimes}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{pa.areaSqKm > 0 ? pa.areaSqKm.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(pa.riskLevel)}`}>
                        {pa.riskLevel}
                      </span>
                      <div className="text-xs text-gray-500 mt-0.5 space-x-1">
                        {pa.criticalRiskCount > 0 && <span className="text-red-600">{pa.criticalRiskCount} critical</span>}
                        {pa.criticalRiskCount > 0 && pa.highRiskCount > 0 && <span>·</span>}
                        {pa.highRiskCount > 0 && <span className="text-orange-600">{pa.highRiskCount} high</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-sm">
                        {getTrendIcon(pa.increasingCount, pa.decreasingCount)}
                        <span className="text-red-600"><span className="text-xs">↑</span>{pa.increasingCount}</span>
                        <span className="text-green-600"><span className="text-xs">↓</span>{pa.decreasingCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{pa.suggestedOfficers}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600 whitespace-nowrap">
                      <span>☀️{perShift}</span> <span className="text-gray-300">|</span>
                      <span>🌆{perShift}</span> <span className="text-gray-300">|</span>
                      <span>🌙{pa.suggestedOfficers - perShift * 2}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{precinctAllocations.reduce((s, p) => s + p.avgMonthlyCrimes, 0)}</td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {precinctAllocations.reduce((s, p) => s + p.areaSqKm, 0) > 0
                    ? precinctAllocations.reduce((s, p) => s + p.areaSqKm, 0).toFixed(2)
                    : '—'}
                </td>
                <td colSpan={2}></td>
                <td className="px-4 py-3 text-right text-blue-700">{totalOfficers}</td>
                <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                  <span>☀️{Math.round(totalOfficers / 3)}</span> <span className="text-gray-300">|</span>
                  <span>🌆{Math.round(totalOfficers / 3)}</span> <span className="text-gray-300">|</span>
                  <span>🌙{totalOfficers - Math.round(totalOfficers / 3) * 2}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 no-print">
        <div className="flex items-start gap-2">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 space-y-2">
            <p className="font-medium">How each precinct&apos;s officer count is decided</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li><strong>Crime severity:</strong> violent crimes (murder, robbery, etc.) are weighted 5×, property crimes (theft, fraud) weighted 2×, so high-risk areas get more patrols</li>
              <li><strong>Patrol demand:</strong> weighted monthly crimes ÷ {patrolDemand} demand units per officer</li>
              <li><strong>Area coverage:</strong> +{OFFICERS_PER_SQKM} officers per square kilometre to cover the whole barangay</li>
              <li><strong>Baseline:</strong> each precinct gets at least 2–6 officers depending on its risk severity</li>
            </ol>
            <p className="text-blue-600">
              The final number is split across three shifts <strong>Morning</strong> ☀️, <strong>Evening</strong> 🌆, and <strong>Night</strong> 🌙.
            </p>
            <p className="mt-2">
              <strong>Published proposals</strong> are saved locally and can be printed.
            </p>
          </div>
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
