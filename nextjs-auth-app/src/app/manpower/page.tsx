'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapPin, Users, TrendingUp, AlertTriangle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import { forecastApi } from '../api/utils/forecastApi';
import withAuth from '../hoc/withAuth';
import { Skeleton, CardSkeleton, TableSkeleton } from '../../components/ui/skeleton';
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

interface DeploymentSettings {
  riskThresholdCritical: number;
  riskThresholdHigh: number;
  riskThresholdMedium: number;
  officersPerSqKm: number;
  patrolDemand: number;
  riskBaseline: { critical: number; high: number; medium: number; low: number };
  severityWeights: Record<number, number>;
}

const SETTINGS_KEY = 'manpowerDeploymentSettings';

const DEFAULT_SETTINGS: DeploymentSettings = {
  riskThresholdCritical: 50,
  riskThresholdHigh: 25,
  riskThresholdMedium: 10,
  officersPerSqKm: 1.5,
  patrolDemand: 40,
  riskBaseline: { critical: 6, high: 4, medium: 3, low: 2 },
  severityWeights: {
    0: 5,  1: 4,  2: 3,  3: 2,  4: 2,
    5: 3,  6: 4,  7: 4,  8: 2,  9: 4,
    10: 2, 11: 5, 12: 5, 13: 5, 14: 5,
    15: 5, 16: 5, 17: 5, 18: 2, 19: 2,
  },
};

const SEVERITY_TIERS = [
  { label: 'Critical', weight: 5, types: [0, 11, 12, 13, 14, 15, 16, 17] },
  { label: 'High', weight: 4, types: [1, 6, 9] },
  { label: 'Medium', weight: 3, types: [2, 5] },
  { label: 'Low', weight: 2, types: [3, 4, 8, 10, 18, 19] },
];

function loadSettings(): DeploymentSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

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
  const [precinctAreas, setPrecinctAreas] = useState<Map<number, number>>(new Map());
  const [settings, setSettings] = useState<DeploymentSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedPrecinct, setExpandedPrecinct] = useState<number | null>(null);

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

  const getOverallRisk = useCallback((avgPerMonth: number): string => {
    if (avgPerMonth >= settings.riskThresholdCritical) return 'critical';
    if (avgPerMonth >= settings.riskThresholdHigh) return 'high';
    if (avgPerMonth >= settings.riskThresholdMedium) return 'medium';
    return 'low';
  }, [settings.riskThresholdCritical, settings.riskThresholdHigh, settings.riskThresholdMedium]);

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const byPrecinct = new Map<number, ForecastData[]>();
    for (const f of forecastData) {
      const existing = byPrecinct.get(f.precinct) || [];
      existing.push(f);
      byPrecinct.set(f.precinct, existing);
    }

    const monthCount = new Set(forecastData.map(f => `${f.year}-${f.month}`)).size;
    const { severityWeights, patrolDemand, officersPerSqKm, riskBaseline } = settings;

    return Array.from(byPrecinct.entries())
      .map(([num, items]) => {
        const name = GetPrecinctsDictionary[num] || `Precinct ${num}`;
        const totalPredicted = items.reduce((s, i) => s + i.predictedCount, 0);
        const avgPerMonth = totalPredicted / monthCount;
        const riskLevel = getOverallRisk(avgPerMonth) as keyof typeof riskBaseline;
        const areaSqKm = precinctAreas.get(num) || 0;
        const weightedScore = items.reduce((s, i) => s + i.predictedCount * (severityWeights[i.crimeType] ?? 1), 0);
        const monthlyWeighted = weightedScore / monthCount;
        const patrolUnits = monthlyWeighted / patrolDemand;
        const areaUnits = areaSqKm * officersPerSqKm;
        const suggestedOfficers = Math.max(riskBaseline[riskLevel], Math.round(patrolUnits + areaUnits));

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
  }, [forecastData, precinctAreas, settings, getOverallRisk]);

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

  const exportCsv = useCallback(() => {
    const rows = precinctAllocations.map(pa => [
      pa.precinctName,
      pa.avgMonthlyCrimes,
      pa.totalPredicted,
      pa.riskLevel,
      pa.suggestedOfficers,
      pa.trend === 'up' ? 'Increasing' : pa.trend === 'down' ? 'Decreasing' : 'Stable',
    ]);
    const csv = [
      ['Precinct', 'Avg Crimes/Month', 'Total Predicted', 'Risk Level', 'Suggested Officers', 'Trend'],
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

  const updateSetting = useCallback(<K extends keyof DeploymentSettings>(key: K, value: DeploymentSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updateSeverityTier = useCallback((tierWeight: number, newWeight: number) => {
    const tier = SEVERITY_TIERS.find(t => t.weight === tierWeight);
    if (!tier) return;
    const updated = { ...settings.severityWeights };
    tier.types.forEach(t => { updated[t] = newWeight; });
    updateSetting('severityWeights', updated);
  }, [settings.severityWeights, updateSetting]);

  const perShift = Math.round(totalOfficers / 3);
  const nightShift = totalOfficers - perShift * 2;

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
            onClick={exportCsv}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            Export as CSV
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-white border border-gray-200 rounded-lg no-print">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Deployment Parameters
          </div>
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            {/* Risk Thresholds */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Risk Thresholds (crimes/mo)</h4>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-red-700">Critical ≥</span>
                  <input type="number" value={settings.riskThresholdCritical} onChange={e => updateSetting('riskThresholdCritical', +e.target.value)}
                    className="w-20 px-2 py-1 border rounded text-right" min={1} />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-orange-700">High ≥</span>
                  <input type="number" value={settings.riskThresholdHigh} onChange={e => updateSetting('riskThresholdHigh', +e.target.value)}
                    className="w-20 px-2 py-1 border rounded text-right" min={1} />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-yellow-700">Medium ≥</span>
                  <input type="number" value={settings.riskThresholdMedium} onChange={e => updateSetting('riskThresholdMedium', +e.target.value)}
                    className="w-20 px-2 py-1 border rounded text-right" min={0} />
                </label>
              </div>
            </div>

            {/* Patrol & Area */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Patrol & Area</h4>
              <div className="space-y-2">
                <label className="flex items-center justify-between">
                  <span>Patrol demand</span>
                  <span className="text-xs text-gray-500">crimes/officer</span>
                </label>
                <input type="number" value={settings.patrolDemand} onChange={e => updateSetting('patrolDemand', +e.target.value)}
                  className="w-full px-2 py-1 border rounded text-right" min={1} step={5} />
                <label className="flex items-center justify-between">
                  <span>Officers / km²</span>
                </label>
                <input type="number" value={settings.officersPerSqKm} onChange={e => updateSetting('officersPerSqKm', +e.target.value)}
                  className="w-full px-2 py-1 border rounded text-right" min={0} step={0.5} />
              </div>
            </div>

            {/* Risk Baseline */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Min Officers by Risk</h4>
              <div className="space-y-2">
                {(['critical', 'high', 'medium', 'low'] as const).map(level => (
                  <label key={level} className="flex items-center justify-between">
                    <span className="capitalize">{level}</span>
                    <input type="number"
                      value={settings.riskBaseline[level]}
                      onChange={e => setSettings(prev => {
                        const rb = { ...prev.riskBaseline, [level]: +e.target.value };
                        const next = { ...prev, riskBaseline: rb };
                        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
                        return next;
                      })}
                      className="w-20 px-2 py-1 border rounded text-right" min={0} />
                  </label>
                ))}
              </div>
            </div>

            {/* Severity Weights */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Crime Severity Weights</h4>
              <div className="space-y-2">
                {SEVERITY_TIERS.map(tier => {
                  const currentWeight = settings.severityWeights[tier.types[0]];
                  return (
                    <label key={tier.label} className="flex items-center justify-between">
                      <span className="text-xs">{tier.label} ({tier.types.length} types)</span>
                      <input type="number" value={currentWeight}
                        onChange={e => updateSeverityTier(tier.weight, +e.target.value)}
                        className="w-16 px-2 py-1 border rounded text-right" min={1} max={10} />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Reset */}
            <div className="md:col-span-2 lg:col-span-4 flex justify-end">
              <button onClick={() => { setSettings(DEFAULT_SETTINGS); localStorage.removeItem(SETTINGS_KEY); }}
                className="text-xs text-gray-500 hover:text-red-600 underline">
                Reset to defaults
              </button>
            </div>
          </div>
        )}
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
                const isExpanded = expandedPrecinct === pa.precinctNumber;
                const s = Math.round(pa.suggestedOfficers / 3);
                const n = pa.suggestedOfficers - s * 2;
                const maxCrimes = Math.max(...precinctAllocations.map(p => p.avgMonthlyCrimes), 1);
                const crimeBarPct = (pa.avgMonthlyCrimes / maxCrimes) * 100;

                const precinctForecasts = forecastData.filter(f => f.precinct === pa.precinctNumber);
                const byCrimeType = new Map<number, ForecastData[]>();
                for (const f of precinctForecasts) {
                  const arr = byCrimeType.get(f.crimeType) || [];
                  arr.push(f);
                  byCrimeType.set(f.crimeType, arr);
                }
                const areaSqKm = precinctAreas.get(pa.precinctNumber) || 0;
                const monthCount = new Set(forecastData.map(f => `${f.year}-${f.month}`)).size;
                const { severityWeights, patrolDemand, officersPerSqKm, riskBaseline } = settings;

                return (
                  <Fragment key={pa.precinctNumber}>
                    <tr
                      onClick={() => setExpandedPrecinct(isExpanded ? null : pa.precinctNumber)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
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
                        Morning {s} &middot; Afternoon {s} &middot; Evening {n}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">

                            {/* Crime type breakdown */}
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Crime Type Breakdown</h4>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b">
                                    <th className="text-left py-1 pr-2">Crime Type</th>
                                    <th className="text-right px-2">Predicted</th>
                                    <th className="text-right px-2">Weight</th>
                                    <th className="text-right pl-2">Contribution</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Array.from(byCrimeType.entries())
                                    .sort(([, a], [, b]) => b.reduce((s, f) => s + f.predictedCount, 0) - a.reduce((s, f) => s + f.predictedCount, 0))
                                    .map(([ct, items]) => {
                                      const totalPred = items.reduce((s, f) => s + f.predictedCount, 0);
                                      const avgPerM = totalPred / monthCount;
                                      const w = severityWeights[ct] ?? 1;
                                      return (
                                        <tr key={ct} className="border-b border-gray-100">
                                          <td className="py-1 pr-2 text-gray-700">{CrimeTypesDictionary[ct] || `Type ${ct}`}</td>
                                          <td className="text-right px-2">{Math.round(avgPerM)}/mo</td>
                                          <td className="text-right px-2">×{w}</td>
                                          <td className="text-right pl-2 font-medium">{Math.round(avgPerM * w)}</td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>

                            {/* Formula walkthrough */}
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Calculation</h4>
                              <div className="space-y-2 text-xs text-gray-600">
                                <p><strong>Weighted score:</strong> {Math.round(Array.from(byCrimeType.entries()).reduce((s, [ct, items]) => s + (items.reduce((s2, f) => s2 + f.predictedCount, 0) / monthCount) * (severityWeights[ct] ?? 1), 0))}/mo</p>
                                <p className="pl-3 text-gray-500">÷ patrol demand ({patrolDemand}) → <strong>{Math.round((Array.from(byCrimeType.entries()).reduce((s, [ct, items]) => s + (items.reduce((s2, f) => s2 + f.predictedCount, 0) / monthCount) * (severityWeights[ct] ?? 1), 0)) / patrolDemand * 10) / 10}</strong> patrol units</p>
                                <p><strong>Area:</strong> {areaSqKm} km² × {officersPerSqKm} officers/km² → <strong>{(areaSqKm * officersPerSqKm).toFixed(1)}</strong> area units</p>
                                <p><strong>Risk baseline:</strong> {riskBaseline[pa.riskLevel as keyof typeof riskBaseline]} officers (minimum for {pa.riskLevel} risk)</p>
                                <div className="pt-2 border-t font-medium text-gray-800">
                                  Total = max({riskBaseline[pa.riskLevel as keyof typeof riskBaseline]}, round({Math.round((Array.from(byCrimeType.entries()).reduce((s, [ct, items]) => s + (items.reduce((s2, f) => s2 + f.predictedCount, 0) / monthCount) * (severityWeights[ct] ?? 1), 0)) / patrolDemand * 10) / 10} + {(areaSqKm * officersPerSqKm).toFixed(1)})) = <strong className="text-lg">{pa.suggestedOfficers}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Trend detail */}
                            <div>
                              <h4 className="font-semibold text-gray-800 mb-2">Trend Detail</h4>
                              <div className="space-y-2 text-xs">
                                <p><span className="text-red-600">▲ Increasing:</span> {pa.increasingCount} series</p>
                                <p><span className="text-green-600">▼ Decreasing:</span> {pa.decreasingCount} series</p>
                                <p><span className="text-gray-500">― Stable:</span> {precinctForecasts.filter(f => f.trend === 'stable').length} series</p>
                                <div className="pt-2 border-t">
                                  {Array.from(byCrimeType.entries())
                                    .sort(([, a], [, b]) => b.filter(f => f.trend === 'increasing').length - a.filter(f => f.trend === 'increasing').length)
                                    .slice(0, 5)
                                    .map(([ct, items]) => {
                                      const inc = items.filter(f => f.trend === 'increasing').length;
                                      const dec = items.filter(f => f.trend === 'decreasing').length;
                                      if (inc === 0 && dec === 0) return null;
                                      return (
                                        <p key={ct} className="text-gray-600">
                                          {CrimeTypesDictionary[ct] || `Type ${ct}`}: {inc > 0 && <span className="text-red-500">+{inc}</span>}{inc > 0 && dec > 0 && ' '}{dec > 0 && <span className="text-green-500">-{dec}</span>}
                                        </p>
                                      );
                                    })}
                                </div>
                              </div>
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
                <td></td>
                <td className="px-4 py-3 text-right text-gray-900">{totalOfficers}</td>
                <td className="px-4 py-3 text-center text-sm text-gray-600">
                  Morning {perShift} &middot; Afternoon {perShift} &middot; Evening {nightShift}
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
