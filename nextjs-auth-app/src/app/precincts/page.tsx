'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, 
  MapPin, 
  Edit3, 
  Save, 
  X, 
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { manpowerApi, ManpowerAllocation } from '../../utils/manpowerApi';
import { forecastApi } from '../api/utils/forecastApi';
import { PrecinctGuidToNumberMap } from '../../constants/consts';
import { Skeleton, CardSkeleton, TableSkeleton } from '../../components/ui/skeleton';

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

function getOverallRisk(avgPerMonth: number): string {
  if (avgPerMonth >= 50) return 'critical';
  if (avgPerMonth >= 25) return 'high';
  if (avgPerMonth >= 10) return 'medium';
  return 'low';
}

const HARDCODED_SHIFT = 'Morning';

export default function PrecinctsPage() {
  const [manpowerAllocations, setManpowerAllocations] = useState<ManpowerAllocation[]>([]);
  const [precincts, setPrecincts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [forecasts, setForecasts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedForecastId, setSelectedForecastId] = useState('');
  const [suggestedByPrecinct, setSuggestedByPrecinct] = useState<Map<string, number>>(new Map());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [precinctAreas, setPrecinctAreas] = useState<Map<number, number>>(new Map());

  const fetchPrecincts = useCallback(async () => {
    try {
      const data = await manpowerApi.getPrecincts();
      setPrecincts(data);
    } catch (error) {
      console.error('Error fetching precincts:', error);
      toast.error('Failed to load precincts');
    }
  }, []);

  const fetchManpowerAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await manpowerApi.getAllManpowerWithShifts();
      setManpowerAllocations(data);
      if (!refreshing) {
        toast.success('Data loaded successfully');
      }
    } catch (error) {
      console.error('Error fetching manpower allocations:', error);
      toast.error('Failed to load data. Please check if the API is running.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchPrecincts();
    fetchManpowerAllocations();
    forecastApi.list().then(list => setForecasts(list)).catch(() => {});
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
  }, [fetchPrecincts, fetchManpowerAllocations]);

  const precinctNumberToId = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, num] of Object.entries(PrecinctGuidToNumberMap)) {
      map.set(num, id);
    }
    return map;
  }, []);

  useEffect(() => {
    if (!selectedForecastId) return;
    setLoadingSuggestions(true);
    (async () => {
      try {
        const snapshot = await forecastApi.getById(selectedForecastId);
        const predictions = snapshot.predictions || [];
        const byPrecinct = new Map<number, typeof predictions>();
        for (const p of predictions) {
          const existing = byPrecinct.get(p.precinct) || [];
          existing.push(p);
          byPrecinct.set(p.precinct, existing);
        }
        const monthCount = new Set(predictions.map((p: any) => `${p.year}-${p.month}`)).size;
        const suggested = new Map<string, number>();
        byPrecinct.forEach((items, num) => {
          const totalPredicted = items.reduce((s: number, i: any) => s + i.predictedCount, 0);
          const avgPerMonth = totalPredicted / monthCount;
          const riskLevel = getOverallRisk(avgPerMonth);
          const areaSqKm = precinctAreas.get(num) || 0;
          const weightedScore = items.reduce((s: number, i: any) =>
            s + i.predictedCount * (CRIME_SEVERITY_WEIGHTS[i.crimeType] ?? 1), 0);
          const monthlyWeighted = weightedScore / monthCount;
          const patrolUnits = monthlyWeighted / PATROL_DEMAND;
          const areaUnits = areaSqKm * OFFICERS_PER_SQKM;
          const suggestedOfficers = Math.max(RISK_BASELINE[riskLevel], Math.round(patrolUnits + areaUnits));
          const precId = precinctNumberToId.get(num);
          if (precId) suggested.set(precId, suggestedOfficers);
        });
        setSuggestedByPrecinct(suggested);
        toast.success(`Suggestions loaded from "${snapshot.name}"`);
      } catch {
        toast.error('Failed to load forecast suggestions');
      } finally {
        setLoadingSuggestions(false);
      }
    })();
  }, [selectedForecastId, precinctAreas, precinctNumberToId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchManpowerAllocations();
    toast.success('Data refreshed');
  };

  const handleEdit = (precinctId: string, currentHeadCount: number) => {
    setEditingId(precinctId);
    setEditValue(currentHeadCount);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (editValue <= 0) {
      toast.error('Please enter a valid number of officers (greater than 0)');
      return;
    }
    try {
      await manpowerApi.createOrUpdateManpowerWithShift({
        precinctId: editingId,
        headCount: editValue,
        shift: HARDCODED_SHIFT,
      });
      await fetchManpowerAllocations();
      const precinctName = getPrecinctNameById(editingId);
      toast.success(`✏️ Updated ${precinctName} — ${editValue} officers`);
      setEditingId(null);
      setEditValue(0);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save allocation');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue(0);
  };

  const getTotalOfficers = () => {
    return manpowerAllocations.reduce((sum, allocation) => 
      sum + (allocation.headCount || 0), 0
    );
  };

  const getPrecinctNameById = (precinctId: string): string => {
    const precinct = precincts.find(p => p.id === precinctId);
    return precinct ? `${precinct.name} (${precinct.code})` : precinctId;
  };

  const getHeadcountForPrecinct = (precinctId: string): number => {
    return manpowerAllocations
      .filter(a => a.precinctId === precinctId)
      .reduce((sum, a) => sum + (a.headCount || 0), 0);
  };

  const getPrecinctCountWithAllocations = (): number => {
    return precincts.filter(p => getHeadcountForPrecinct(p.id) > 0).length;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={10} />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Precinct Manpower Management</h1>
          <p className="text-gray-600">Edit officer allocations inline. Load forecast suggestions to compare recommended vs actual staffing.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <select
              value={selectedForecastId}
              onChange={(e) => setSelectedForecastId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No forecast selected</option>
              {forecasts.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {loadingSuggestions && <span className="text-xs text-gray-500 animate-pulse">Loading...</span>}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{getTotalOfficers()}</h3>
              <p className="text-sm text-gray-600">Total Officers Allocated</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <MapPin className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{getPrecinctCountWithAllocations()}</h3>
              <p className="text-sm text-gray-600">Precincts with Allocations</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <MapPin className="w-8 h-8 text-orange-600" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{precincts.length}</h3>
              <p className="text-sm text-gray-600">Total Precincts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Manpower Allocations Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precinct
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Officers
                </th>
                {selectedForecastId && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggested
                  </th>
                )}
                {selectedForecastId && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gap
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {precincts.map((precinct) => {
                const headCount = getHeadcountForPrecinct(precinct.id);
                const isEditing = editingId === precinct.id;
                const suggested = selectedForecastId
                  ? (suggestedByPrecinct.get(precinct.id) ?? null)
                  : null;
                const gap = suggested !== null ? headCount - suggested : null;
                return (
                  <tr key={precinct.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="w-5 h-5 text-blue-600 mr-2 shrink-0" />
                        <div className="text-sm font-medium text-gray-900">
                          {precinct.name} ({precinct.code})
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Users className="w-4 h-4 text-gray-400 shrink-0" />
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            value={editValue || ''}
                            onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            autoFocus
                          />
                        ) : headCount > 0 ? (
                          <span className="text-sm font-semibold text-gray-900">{headCount}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Unset</span>
                        )}
                      </div>
                    </td>
                    {selectedForecastId && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {suggested !== null ? suggested : <span className="text-gray-400">—</span>}
                      </td>
                    )}
                    {selectedForecastId && (
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                        gap === null ? 'text-gray-400' :
                        gap === 0 ? 'text-gray-500' :
                        gap > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {gap === null ? '—' : gap === 0 ? 'OK' : gap > 0 ? `+${gap}` : `${gap}`}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="text-green-600 hover:text-green-900"
                            title="Save changes"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-red-600 hover:text-red-900"
                            title="Cancel edit"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEdit(precinct.id, headCount)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit allocation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {precincts.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No precincts found</h3>
            <p className="text-gray-500 mb-4">Precinct data could not be loaded. Check that the API is running.</p>
          </div>
        )}
      </div>
    </div>
  );
}