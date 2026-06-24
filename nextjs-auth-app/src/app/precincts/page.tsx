'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, 
  MapPin, 
  Edit3, 
  Save, 
  X, 
  Plus,
  RefreshCw,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { manpowerApi, ManpowerAllocation, CreateManpowerRequest } from '../../utils/manpowerApi';
import { forecastApi } from '../api/utils/forecastApi';
import { GetPrecinctsDictionary, PrecinctGuidToNumberMap } from '../../constants/consts';
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

// Precinct options will be loaded from API

const SHIFT_OPTIONS = [
  { value: 'Morning', label: 'Morning (6:00 AM - 2:00 PM)' },
  { value: 'Evening', label: 'Evening (2:00 PM - 10:00 PM)' },
  { value: 'Night', label: 'Night (10:00 PM - 6:00 AM)' }
];

export default function PrecinctsPage() {
  const [manpowerAllocations, setManpowerAllocations] = useState<ManpowerAllocation[]>([]);
  const [precincts, setPrecincts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ManpowerAllocation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CreateManpowerRequest>({
    precinctId: '',
    headCount: 5,
    shift: 'Morning'
  });
  const [showPerShift, setShowPerShift] = useState(true);
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

  const handleEdit = (allocation: ManpowerAllocation) => {
    setEditingId(allocation.id);
    setEditForm({ 
      ...allocation,
      headCount: allocation.headCount 
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    
    // Enhanced validation for edit form
    if (!editForm.precinctId) {
      toast.error('Please select a precinct');
      return;
    }
    const headCount = editForm.headCount;
    if (!headCount || headCount <= 0) {
      toast.error('Please enter a valid number of officers (greater than 0)');
      return;
    }
    if (!editForm.shift) {
      toast.error('Please select a shift');
      return;
    }
    
    try {
      const updateData = {
        precinctId: editForm.precinctId,
        headCount: headCount,
        shift: editForm.shift
      };
      
      await manpowerApi.updateManpower(editForm.id, updateData);
      await fetchManpowerAllocations();
      
      const precinctName = getPrecinctNameById(editForm.precinctId!);
      toast.success(`✏️ Updated ${precinctName} - ${editForm.shift} shift (${headCount} officers)`);
      
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error('Error updating:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Show specific error messages
      if (errorMessage.includes('400')) {
        toast.error('❌ Invalid data provided. Please check your inputs.');
      } else if (errorMessage.includes('404')) {
        toast.error('❌ Allocation not found.');
      } else if (errorMessage.includes('500')) {
        toast.error('❌ Server error. Please try again later.');
      } else {
        toast.error(`❌ Failed to update allocation: ${errorMessage}`);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleAdd = async () => {
    // Enhanced validation with specific error messages
    if (!addForm.precinctId) {
      toast.error('Please select a precinct');
      return;
    }
    if (!addForm.headCount || addForm.headCount <= 0) {
      toast.error('Please enter a valid number of officers (greater than 0)');
      return;
    }
    if (!addForm.shift) {
      toast.error('Please select a shift');
      return;
    }
    
    try {
      // Check if this precinct+shift combination already exists to determine if it's new or update
      const existingAllocation = manpowerAllocations.find(alloc => 
        alloc.precinctId === addForm.precinctId && 
        alloc.shift === addForm.shift
      );
      
      const result = await manpowerApi.createOrUpdateManpowerWithShift(addForm);
      await fetchManpowerAllocations();
      setShowAddForm(false);
      setAddForm({
        precinctId: '',
        headCount: 5,
        shift: 'Morning'
      });
      
      // Show different toast messages based on operation
      const precinctName = getPrecinctNameById(addForm.precinctId);
      if (existingAllocation) {
        toast.success(`✏️ Updated ${precinctName} - ${addForm.shift} shift (${addForm.headCount} officers)`);
      } else {
        toast.success(`✅ Created new allocation for ${precinctName} - ${addForm.shift} shift (${addForm.headCount} officers)`);
      }
    } catch (error) {
      console.error('Error with allocation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Show specific error messages
      if (errorMessage.includes('400')) {
        toast.error('❌ Invalid data provided. Please check your inputs.');
      } else if (errorMessage.includes('404')) {
        toast.error('❌ Precinct not found. Please select a valid precinct.');
      } else if (errorMessage.includes('500')) {
        toast.error('❌ Server error. Please try again later.');
      } else {
        toast.error(`❌ Failed to save allocation: ${errorMessage}`);
      }
    }
  };

  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getTotalOfficers = () => {
    return manpowerAllocations.reduce((sum, allocation) => 
      sum + (allocation.headCount || 0), 0
    );
  };

  const getUniquePrecincts = () => {
    const precincts = new Set(manpowerAllocations.map(a => a.precinctName || a.precinctId));
    return precincts.size;
  };

  const getPrecinctNameById = (precinctId: string): string => {
    const precinct = precincts.find(p => p.id === precinctId);
    return precinct ? `${precinct.name} (${precinct.code})` : precinctId;
  };

  // Process allocations based on view toggle
  const getDisplayAllocations = () => {
    if (showPerShift) {
      return manpowerAllocations; // Show all individual shift allocations
    }
    
    // Group by precinct and sum headcount
    const groupedByPrecinct = new Map<string, ManpowerAllocation>();
    
    manpowerAllocations.forEach(allocation => {
      const precinctKey = allocation.precinctId;
      const precinctName = allocation.precinctName || 'Unknown';
      
      if (groupedByPrecinct.has(precinctKey)) {
        const existing = groupedByPrecinct.get(precinctKey)!;
        existing.headCount = (existing.headCount || 0) + (allocation.headCount || 0);
        
        // Combine shifts in display
        const existingShifts = existing.shift ? existing.shift.split(', ') : [];
        const newShift = allocation.shift || 'Unknown';
        if (!existingShifts.includes(newShift)) {
          existing.shift = [...existingShifts, newShift].join(', ');
        }
      } else {
        groupedByPrecinct.set(precinctKey, {
          ...allocation,
          shift: allocation.shift || 'All Shifts'
        });
      }
    });
    
    return Array.from(groupedByPrecinct.values());
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
          <p className="text-gray-600">View, add, and edit actual officer allocations per shift. Load forecast suggestions to compare recommended vs actual staffing.</p>
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
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="viewToggle"
              checked={showPerShift}
              onChange={(e) => setShowPerShift(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="viewToggle" className="text-sm text-gray-700 cursor-pointer">
              Show per shift
            </label>
            <span className="text-xs text-gray-500 ml-1">
              ({showPerShift ? 'Individual shifts' : 'Totaled by precinct'})
            </span>
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
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Allocation
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
              <h3 className="text-lg font-semibold text-gray-900">{getUniquePrecincts()}</h3>
              <p className="text-sm text-gray-600">Precincts with Allocations</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-orange-600" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{manpowerAllocations.length}</h3>
              <p className="text-sm text-gray-600">Total Allocations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Manpower Allocation</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precinct <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.precinctId}
                  onChange={(e) => setAddForm(prev => ({ ...prev, precinctId: e.target.value }))}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                    !addForm.precinctId 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  required
                >
                  <option value="">Select Precinct</option>
                  {precincts.map((precinct) => (
                    <option key={precinct.id} value={precinct.id}>{precinct.name} ({precinct.code})</option>
                  ))}
                </select>
                {!addForm.precinctId && (
                  <p className="mt-1 text-sm text-red-600">Please select a precinct</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Officers <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={addForm.headCount || ''}
                  onChange={(e) => setAddForm(prev => ({ ...prev, headCount: parseInt(e.target.value) || 0 }))}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                    !addForm.headCount || addForm.headCount <= 0
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="Enter number of officers"
                  required
                />
                {(!addForm.headCount || addForm.headCount <= 0) && (
                  <p className="mt-1 text-sm text-red-600">Please enter a valid number greater than 0</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.shift || ''}
                  onChange={(e) => setAddForm(prev => ({ ...prev, shift: e.target.value }))}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 ${
                    !addForm.shift
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                >
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift.value} value={shift.value}>{shift.label}</option>
                  ))}
                </select>
                {!addForm.shift && (
                  <p className="mt-1 text-sm text-red-600">Please select a shift</p>
                )}
              </div>


              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Actual
                </th>
                {!showPerShift && selectedForecastId && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suggested
                  </th>
                )}
                {!showPerShift && selectedForecastId && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gap
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {showPerShift ? 'Shift' : 'Shifts'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getDisplayAllocations().map((allocation) => (
                <tr key={allocation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                      <div>
                        {editingId === allocation.id ? (
                          <select
                            value={editForm.precinctId || allocation.precinctId}
                            onChange={(e) => setEditForm(prev => ({ ...prev, precinctId: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
                          >
                            {precincts.map((precinct) => (
                              <option key={precinct.id} value={precinct.id}>{precinct.name} ({precinct.code})</option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {allocation.precinctName || 'Unknown Precinct'}
                            </div>
                            {allocation.precinctId && (
                              <div className="text-sm text-gray-500">
                                ID: {allocation.precinctId}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end">
                      <Users className="w-4 h-4 text-gray-400 mr-2" />
                      {editingId === allocation.id ? (
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editForm.headCount || ''}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            headCount: parseInt(e.target.value) 
                          }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">
                          {allocation.headCount}
                        </span>
                      )}
                    </div>
                  </td>
                  {!showPerShift && selectedForecastId && (() => {
                    const suggested = suggestedByPrecinct.get(allocation.precinctId) ?? null;
                    return (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                        {suggested !== null ? suggested : <span className="text-gray-400">—</span>}
                      </td>
                    );
                  })()}
                  {!showPerShift && selectedForecastId && (() => {
                    const suggested = suggestedByPrecinct.get(allocation.precinctId) ?? null;
                    const actual = allocation.headCount || 0;
                    const gap = suggested !== null ? actual - suggested : null;
                    if (gap === null) {
                      return <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">—</td>;
                    }
                    const color = gap === 0 ? 'text-gray-500' : gap > 0 ? 'text-green-600' : 'text-red-600';
                    const label = gap === 0 ? 'OK' : gap > 0 ? `+${gap}` : `${gap}`;
                    return (
                      <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${color}`}>
                        {label}
                      </td>
                    );
                  })()}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingId === allocation.id ? (
                      <select
                        value={editForm.shift || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, shift: e.target.value }))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {SHIFT_OPTIONS.map((shift) => (
                          <option key={shift.value} value={shift.value}>{shift.value}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-1" />
                        {allocation.shift || 'Not specified'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {showPerShift ? (
                      editingId === allocation.id ? (
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
                          onClick={() => handleEdit(allocation)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit allocation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <span className="text-gray-400 text-xs" title="Switch to 'Show per shift' to edit individual allocations">
                        View only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {getDisplayAllocations().length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No allocations found</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first manpower allocation.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add First Allocation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}