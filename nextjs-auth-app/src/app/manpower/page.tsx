'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { GetPrecinctsDictionary } from '../../constants/consts';
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
  totalPredicted: number;
  riskLevel: string;
  highRiskCount: number;
  criticalRiskCount: number;
  increasingCount: number;
  decreasingCount: number;
  stableCount: number;
  suggestedOfficers: number;
}

const DEFAULT_RULES: RiskRule[] = [
  { riskLevel: 'critical', label: 'Critical', officers: 20 },
  { riskLevel: 'high', label: 'High', officers: 15 },
  { riskLevel: 'medium', label: 'Medium', officers: 10 },
  { riskLevel: 'low', label: 'Low', officers: 5 },
];

function ManpowerProposalPage() {
  const searchParams = useSearchParams();
  const forecastId = searchParams.get('forecastId');

  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastName, setForecastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [rules] = useState<RiskRule[]>(DEFAULT_RULES);

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

  const getOverallRisk = (items: ForecastData[]): string => {
    if (items.some(i => i.riskLevel === 'critical')) return 'critical';
    if (items.some(i => i.riskLevel === 'high')) return 'high';
    if (items.some(i => i.riskLevel === 'medium')) return 'medium';
    return 'low';
  };

  const getRule = (risk: string): RiskRule =>
    rules.find(r => r.riskLevel === risk) || rules[rules.length - 1];

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const byPrecinct = new Map<number, ForecastData[]>();
    for (const f of forecastData) {
      const existing = byPrecinct.get(f.precinct) || [];
      existing.push(f);
      byPrecinct.set(f.precinct, existing);
    }

    return Array.from(byPrecinct.entries())
      .map(([num, items]) => {
        const name = GetPrecinctsDictionary[num] || `Precinct ${num}`;
        const totalPredicted = items.reduce((s, i) => s + i.predictedCount, 0);
        const riskLevel = getOverallRisk(items);
        const rule = getRule(riskLevel);
        const suggestedOfficers = Math.max(rule.officers, Math.ceil(totalPredicted / 2));

        return {
          precinctNumber: num,
          precinctName: name,
          totalPredicted,
          riskLevel,
          highRiskCount: items.filter(i => i.riskLevel === 'high').length,
          criticalRiskCount: items.filter(i => i.riskLevel === 'critical').length,
          increasingCount: items.filter(i => i.trend === 'increasing').length,
          decreasingCount: items.filter(i => i.trend === 'decreasing').length,
          stableCount: items.filter(i => i.trend === 'stable').length,
          suggestedOfficers,
        };
      })
      .sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel);
      });
  }, [forecastData]);

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
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Predicted Crimes</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Suggested Officers</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Per Shift (M/E/N)</th>
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
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{pa.totalPredicted}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(pa.riskLevel)}`}>
                        {pa.riskLevel}
                      </span>
                      {(pa.criticalRiskCount > 0 || pa.highRiskCount > 0) && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({pa.criticalRiskCount}C/{pa.highRiskCount}H)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm">
                        {getTrendIcon(pa.increasingCount, pa.decreasingCount)}
                        <span className="text-red-600">{pa.increasingCount}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-green-600">{pa.decreasingCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">{pa.suggestedOfficers}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {perShift} / {perShift} / {pa.suggestedOfficers - perShift * 2}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">Total</td>
                <td className="px-4 py-3 text-right text-gray-900">{forecastData.reduce((s, f) => s + f.predictedCount, 0)}</td>
                <td colSpan={2}></td>
                <td className="px-4 py-3 text-right text-blue-700">{totalOfficers}</td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {Math.round(totalOfficers / 3)} / {Math.round(totalOfficers / 3)} / {totalOfficers - Math.round(totalOfficers / 3) * 2}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 no-print">
        <div className="flex items-start gap-2">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How allocation is calculated</p>
            <p>
              Each precinct gets a suggested officer count based on its forecast risk level and predicted crime volume.
              Critical-risk precincts start at 20 officers, High at 15, Medium at 10, Low at 5,
              with upward adjustments for high crime volume. Officers are split evenly across Morning, Evening, and Night shifts.
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
