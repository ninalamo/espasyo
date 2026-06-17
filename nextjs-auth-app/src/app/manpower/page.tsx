'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, MapPin, Check, RefreshCw, Clock, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { toast } from 'react-toastify';
import { manpowerApi, ManpowerAllocation, UpsertManpowerRequest } from '../../utils/manpowerApi';
import { PrecinctGuidToNumberMap, GetPrecinctsDictionary } from '../../constants/consts';
import { loadForecastFromLocal, loadForecastByIdFromLocal, loadForecastListFromLocal } from '../api/utils/forecastApi';
import withAuth from '../hoc/withAuth';
import type { ForecastData, ForecastSummaryCard } from '../../types/forecast/ForecastBaseTypes';

const PrecinctNumberToGuidMap: Record<number, string> = {};
for (const [guid, num] of Object.entries(PrecinctGuidToNumberMap)) {
  PrecinctNumberToGuidMap[num] = guid;
}

const DEFAULT_RULES: RiskRule[] = [
  { riskLevel: 'critical', label: 'Critical', officers: 20, minCrimes: 0 },
  { riskLevel: 'high', label: 'High', officers: 15, minCrimes: 0 },
  { riskLevel: 'medium', label: 'Medium', officers: 10, minCrimes: 0 },
  { riskLevel: 'low', label: 'Low', officers: 5, minCrimes: 0 },
];

interface RiskRule {
  riskLevel: string;
  label: string;
  officers: number;
  minCrimes: number;
}

interface PrecinctAllocation {
  precinctNumber: number;
  precinctName: string;
  precinctGuid: string | undefined;
  totalPredicted: number;
  riskLevel: string;
  highRiskCount: number;
  criticalRiskCount: number;
  increasingCount: number;
  decreasingCount: number;
  stableCount: number;
  suggestedOfficers: number;
  currentOfficers: number;
  currentAllocationId: string | null;
}

function ManpowerAllocationPage() {
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastList, setForecastList] = useState<ForecastSummaryCard[]>([]);
  const [selectedForecastId, setSelectedForecastId] = useState<string>('');
  const [selectedForecastName, setSelectedForecastName] = useState('');
  const [precincts, setPrecincts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [allocations, setAllocations] = useState<ManpowerAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [rules, setRules] = useState<RiskRule[]>(DEFAULT_RULES);
  const [showRules, setShowRules] = useState(false);
  const [baseOfficersPerCrime, setBaseOfficersPerCrime] = useState(1);

  const loadForecast = (id: string) => {
    if (!id) return;
    const snapshot = id === 'last' ? loadForecastFromLocal() : loadForecastByIdFromLocal(id);
    if (snapshot) {
      setForecastData(snapshot.predictions || []);
      setSelectedForecastName(snapshot.name);
    }
  };

  const handleForecastChange = (id: string) => {
    setSelectedForecastId(id);
    loadForecast(id);
  };

  useEffect(() => {
    const list = loadForecastListFromLocal();
    setForecastList(list);

    const last = loadForecastFromLocal();
    if (last) {
      setSelectedForecastId('last');
      setSelectedForecastName(last.name);
      setForecastData(last.predictions || []);
    }

    loadPrecinctsAndAllocations();
  }, []);

  const loadPrecinctsAndAllocations = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        manpowerApi.getPrecincts(),
        manpowerApi.getAllManpowerWithShifts(),
      ]);
      setPrecincts(p);
      setAllocations(a);
    } catch (error) {
      console.error('Error loading manpower data:', error);
      toast.error('Failed to load precincts and allocations from API');
    } finally {
      setLoading(false);
    }
  };

  const precinctAllocations = useMemo((): PrecinctAllocation[] => {
    if (forecastData.length === 0) return [];

    const byPrecinct = new Map<number, ForecastData[]>();
    for (const f of forecastData) {
      const existing = byPrecinct.get(f.precinct) || [];
      existing.push(f);
      byPrecinct.set(f.precinct, existing);
    }

    const getOverallRisk = (items: ForecastData[]): string => {
      if (items.some(i => i.riskLevel === 'critical')) return 'critical';
      if (items.some(i => i.riskLevel === 'high')) return 'high';
      if (items.some(i => i.riskLevel === 'medium')) return 'medium';
      return 'low';
    };

    const getRule = (risk: string): RiskRule =>
      rules.find(r => r.riskLevel === risk) || rules[rules.length - 1];

    return Array.from(byPrecinct.entries())
      .map(([num, items]) => {
        const name = GetPrecinctsDictionary[num] || `Precinct ${num}`;
        const guid = PrecinctNumberToGuidMap[num];
        const totalPredicted = items.reduce((s, i) => s + i.predictedCount, 0);
        const riskLevel = getOverallRisk(items);
        const rule = getRule(riskLevel);
        const suggestedOfficers = Math.max(rule.officers, Math.ceil(totalPredicted / baseOfficersPerCrime / 2));

        const precinctAllocs = allocations.filter(a =>
          a.precinctId === guid ||
          precincts.find(p => p.id === a.precinctId)?.name === name
        );
        const currentOfficers = precinctAllocs.reduce((s, a) => s + (a.headCount || 0), 0);
        const currentId = precinctAllocs.length > 0 ? precinctAllocs[0].id : null;

        return {
          precinctNumber: num,
          precinctName: name,
          precinctGuid: guid,
          totalPredicted,
          riskLevel,
          highRiskCount: items.filter(i => i.riskLevel === 'high').length,
          criticalRiskCount: items.filter(i => i.riskLevel === 'critical').length,
          increasingCount: items.filter(i => i.trend === 'increasing').length,
          decreasingCount: items.filter(i => i.trend === 'decreasing').length,
          stableCount: items.filter(i => i.trend === 'stable').length,
          suggestedOfficers,
          currentOfficers,
          currentAllocationId: currentId,
        };
      })
      .sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low'];
        return order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel);
      });
  }, [forecastData, allocations, precincts, rules, baseOfficersPerCrime]);

  const applySuggestion = async (pa: PrecinctAllocation) => {
    if (!pa.precinctGuid) {
      toast.error(`No GUID mapping for ${pa.precinctName}`);
      return;
    }
    setApplying(pa.precinctName);
    try {
      const upsert: UpsertManpowerRequest[] = [
        { precinctId: pa.precinctGuid, shift: 0, headCount: Math.ceil(pa.suggestedOfficers / 3) },
        { precinctId: pa.precinctGuid, shift: 1, headCount: Math.ceil(pa.suggestedOfficers / 3) },
        { precinctId: pa.precinctGuid, shift: 2, headCount: Math.floor(pa.suggestedOfficers / 3) },
      ];
      await Promise.all(upsert.map(u => manpowerApi.upsertManpower(u)));
      await loadPrecinctsAndAllocations();
      toast.success(`Applied ${pa.suggestedOfficers} officers to ${pa.precinctName}`);
    } catch (error) {
      toast.error(`Failed to apply allocation for ${pa.precinctName}`);
    } finally {
      setApplying(null);
    }
  };

  const applyAllSuggestions = async () => {
    const valid = precinctAllocations.filter(pa => pa.precinctGuid && pa.suggestedOfficers > 0);
    setApplying('all');
    try {
      const upserts: UpsertManpowerRequest[] = [];
      for (const pa of valid) {
        const perShift = Math.ceil(pa.suggestedOfficers / 3);
        upserts.push(
          { precinctId: pa.precinctGuid!, shift: 0, headCount: perShift },
          { precinctId: pa.precinctGuid!, shift: 1, headCount: perShift },
          { precinctId: pa.precinctGuid!, shift: 2, headCount: pa.suggestedOfficers - perShift * 2 },
        );
      }
      await Promise.all(upserts.map(u => manpowerApi.upsertManpower(u)));
      await loadPrecinctsAndAllocations();
      toast.success(`Applied suggestions to ${valid.length} precincts`);
    } catch (error) {
      toast.error('Failed to apply some allocations');
    } finally {
      setApplying(null);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getTrendIcon = (inc: number, dec: number) => {
    if (inc > dec) return <ArrowUp className="w-4 h-4 text-red-500" />;
    if (dec > inc) return <ArrowDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  const diff = (suggested: number, current: number) => {
    const d = suggested - current;
    if (d > 0) return <span className="text-red-600 font-medium">+{d}</span>;
    if (d < 0) return <span className="text-green-600 font-medium">{d}</span>;
    return <span className="text-gray-400">0</span>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forecast-Guided Manpower Allocation</h1>
          <p className="text-gray-600 mt-1">
            Base officer allocation on a saved forecast
          </p>
          <div className="flex items-center gap-3 mt-3">
            <label className="text-sm font-medium text-gray-700">Forecast:</label>
            <select
              value={selectedForecastId}
              onChange={(e) => handleForecastChange(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
            >
              {forecastList.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({new Date(f.createdAt).toLocaleDateString()})
                </option>
              ))}
              <option value="last">Most recent saved forecast</option>
            </select>
            {selectedForecastName && (
              <span className="text-sm text-gray-500">
                Using: <span className="font-medium text-gray-700">{selectedForecastName}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRules(!showRules)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Allocation Rules
          </button>
          <button
            onClick={loadPrecinctsAndAllocations}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {showRules && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">Allocation Rules</h3>
          <p className="text-sm text-gray-600">
            Base officers per risk level. The final suggestion is max(rule amount, predicted crimes ÷ {baseOfficersPerCrime * 2}).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {rules.map((rule, i) => (
              <div key={rule.riskLevel} className={`p-3 rounded border ${getRiskColor(rule.riskLevel)}`}>
                <div className="text-sm font-medium mb-1">{rule.label}</div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={rule.officers}
                  onChange={(e) => {
                    const next = [...rules];
                    next[i] = { ...next[i], officers: parseInt(e.target.value) || 5 };
                    setRules(next);
                  }}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-xs ml-1">officers</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Scale by crime volume:</span>
            <span className="text-gray-500">1 officer per</span>
            <input
              type="number"
              min={1}
              max={20}
              value={baseOfficersPerCrime}
              onChange={(e) => setBaseOfficersPerCrime(parseInt(e.target.value) || 1)}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
            />
            <span className="text-gray-500">× 2 predicted crimes</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">
            Precinct Allocation Suggestions
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({precinctAllocations.length} precincts)
            </span>
          </h2>
          <button
            onClick={applyAllSuggestions}
            disabled={applying === 'all' || precinctAllocations.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            <Check className="w-4 h-4" />
            {applying === 'all' ? 'Applying...' : 'Apply All Suggestions'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precinct</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Predicted Crimes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diff</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {precinctAllocations.map((pa) => (
                <tr key={pa.precinctNumber} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-gray-900">{pa.precinctName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{pa.totalPredicted}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getRiskColor(pa.riskLevel)}`}>
                      {pa.riskLevel}
                    </span>
                    {(pa.criticalRiskCount > 0 || pa.highRiskCount > 0) && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({pa.criticalRiskCount}C / {pa.highRiskCount}H)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      {getTrendIcon(pa.increasingCount, pa.decreasingCount)}
                      <span className="text-red-600">{pa.increasingCount}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-green-600">{pa.decreasingCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-blue-700">{pa.suggestedOfficers}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${pa.currentOfficers > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {pa.currentOfficers || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {diff(pa.suggestedOfficers, pa.currentOfficers)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => applySuggestion(pa)}
                      disabled={applying === pa.precinctName || !pa.precinctGuid}
                      className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
                    >
                      {applying === pa.precinctName ? '...' : 'Apply'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {precinctAllocations.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No forecast data</h3>
            <p className="text-gray-500">Generate a forecast first to see allocation suggestions.</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How allocation is calculated</p>
            <p>Each precinct gets a suggested officer count based on its overall forecast risk level and predicted crime volume. Critical-risk precincts start at {rules.find(r => r.riskLevel === 'critical')?.officers || 20} officers, with adjustments based on crime count. Apply a suggestion to create allocations across all three shifts (Morning, Evening, Night). Fine-tune individual allocations on the Precincts page.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(ManpowerAllocationPage);
