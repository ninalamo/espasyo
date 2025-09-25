'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Edit3, 
  Save, 
  X, 
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import { manpowerApi, ManpowerAllocation, CreateManpowerRequest } from '@/utils/manpowerApi';

// Precinct options - can be expanded based on your needs
const PRECINCT_OPTIONS = [
  'Alabang',
  'Ayala Alabang', 
  'Sucat',
  'Poblacion',
  'Putatan',
  'Tunasan',
  'Cupang',
  'Bayanan',
  'Buli',
  'Central Business District',
  'Industrial Area',
  'Residential Zone'
];

const SHIFT_OPTIONS = [
  { value: 'Morning', label: 'Morning (6:00 AM - 2:00 PM)' },
  { value: 'Afternoon', label: 'Afternoon (2:00 PM - 10:00 PM)' },
  { value: 'Night', label: 'Night (10:00 PM - 6:00 AM)' },
  { value: 'Full Day', label: 'Full Day Coverage' }
];

export default function PrecinctsPage() {
  const [manpowerAllocations, setManpowerAllocations] = useState<ManpowerAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ManpowerAllocation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CreateManpowerRequest>({
    precinct: '',
    officerCount: 5,
    shift: 'Morning'
  });

  useEffect(() => {
    fetchManpowerAllocations();
  }, []);

  const fetchManpowerAllocations = async () => {
    setLoading(true);
    try {
      const data = await manpowerApi.getAllManpower();
      // Add some calculated fields for better display
      const enrichedData = data.map(allocation => ({
        ...allocation,
        precinctName: allocation.precinct, // Use precinct as display name
        efficiency: Math.floor(Math.random() * 30) + 70, // Mock efficiency for now
        riskLevel: (['low', 'medium', 'high'] as const)[Math.floor(Math.random() * 3)],
        trend: (['increasing', 'decreasing', 'stable'] as const)[Math.floor(Math.random() * 3)]
      }));
      setManpowerAllocations(enrichedData);
      toast.success('Manpower allocations loaded successfully');
    } catch (error) {
      console.error('Error fetching manpower allocations:', error);
      toast.error('Failed to load manpower allocations');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (allocation: ManpowerAllocation) => {
    setEditingId(allocation.id);
    setEditForm({ ...allocation });
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    
    try {
      const updateData = {
        precinct: editForm.precinct,
        officerCount: editForm.officerCount || editForm.allocatedCount,
        shift: editForm.shift,
        date: editForm.date
      };
      
      await manpowerApi.updateManpower(editForm.id, updateData);
      await fetchManpowerAllocations(); // Refresh data
      setEditingId(null);
      setEditForm({});
      toast.success('Manpower allocation updated successfully');
    } catch (error) {
      console.error('Error updating manpower allocation:', error);
      toast.error('Failed to update manpower allocation');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleAdd = async () => {
    if (!addForm.precinct || !addForm.officerCount) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      await manpowerApi.createManpower(addForm);
      await fetchManpowerAllocations(); // Refresh data
      setShowAddForm(false);
      setAddForm({
        precinct: '',
        officerCount: 5,
        shift: 'Morning'
      });
      toast.success('Manpower allocation created successfully');
    } catch (error) {
      console.error('Error creating manpower allocation:', error);
      toast.error('Failed to create manpower allocation');
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Precinct Management</h1>
            <p className="text-gray-600">Manage manpower allocation and thresholds per precinct</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Precinct
          </button>
        </div>

        {/* Add Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Add New Precinct</h2>
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
                    Precinct
                  </label>
                  <select
                    value={addForm.precinct || ''}
                    onChange={(e) => setAddForm(prev => ({ 
                      ...prev, 
                      precinct: parseInt(e.target.value) as Barangay 
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Precinct</option>
                    {Object.entries(BARANGAY_NAMES).map(([key, name]) => (
                      <option key={key} value={key}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={addForm.year || ''}
                    onChange={(e) => setAddForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Allocated Officers
                  </label>
                  <input
                    type="number"
                    value={addForm.allocatedCount || ''}
                    onChange={(e) => setAddForm(prev => ({ ...prev, allocatedCount: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mild Threshold
                    </label>
                    <input
                      type="number"
                      value={addForm.mildThreshold || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, mildThreshold: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moderate Threshold
                    </label>
                    <input
                      type="number"
                      value={addForm.moderateThreshold || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, moderateThreshold: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Critical Threshold
                    </label>
                    <input
                      type="number"
                      value={addForm.criticalThreshold || ''}
                      onChange={(e) => setAddForm(prev => ({ ...prev, criticalThreshold: parseInt(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                    Add Precinct
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Precincts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precinct
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Officers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thresholds
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {precincts.map((precinct) => (
                  <tr key={precinct.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {precinct.precinctName}
                          </div>
                          <div className="text-sm text-gray-500">
                            Barangay #{precinct.precinct}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingId === precinct.id ? (
                        <input
                          type="number"
                          value={editForm.year || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        precinct.year
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-4 h-4 text-gray-400 mr-2" />
                        {editingId === precinct.id ? (
                          <input
                            type="number"
                            value={editForm.allocatedCount || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, allocatedCount: parseInt(e.target.value) }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {precinct.allocatedCount}
                          </span>
                        )}
                      </div>
                      {precinct.efficiency && (
                        <div className="text-xs text-gray-500">
                          {precinct.efficiency}% efficient
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingId === precinct.id ? (
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="w-12 text-xs text-gray-500">Mild:</span>
                            <input
                              type="number"
                              value={editForm.mildThreshold || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, mildThreshold: parseInt(e.target.value) }))}
                              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs ml-1"
                            />
                          </div>
                          <div className="flex items-center">
                            <span className="w-12 text-xs text-gray-500">Mod:</span>
                            <input
                              type="number"
                              value={editForm.moderateThreshold || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, moderateThreshold: parseInt(e.target.value) }))}
                              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs ml-1"
                            />
                          </div>
                          <div className="flex items-center">
                            <span className="w-12 text-xs text-gray-500">Crit:</span>
                            <input
                              type="number"
                              value={editForm.criticalThreshold || ''}
                              onChange={(e) => setEditForm(prev => ({ ...prev, criticalThreshold: parseInt(e.target.value) }))}
                              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs ml-1"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-600">
                          <div>Mild: {precinct.mildThreshold}</div>
                          <div>Moderate: {precinct.moderateThreshold}</div>
                          <div>Critical: {precinct.criticalThreshold}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(precinct.riskLevel || 'medium')}`}>
                          {precinct.riskLevel || 'Medium'}
                        </span>
                        {getTrendIcon(precinct.trend || 'stable')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingId === precinct.id ? (
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
                          onClick={() => handleEdit(precinct)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit precinct"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {precincts.reduce((sum, p) => sum + p.allocatedCount, 0)}
                </h3>
                <p className="text-sm text-gray-600">Total Officers</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {precincts.length}
                </h3>
                <p className="text-sm text-gray-600">Active Precincts</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {precincts.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length}
                </h3>
                <p className="text-sm text-gray-600">High Risk Areas</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {Math.round(precincts.reduce((sum, p) => sum + (p.efficiency || 0), 0) / precincts.length)}%
                </h3>
                <p className="text-sm text-gray-600">Avg Efficiency</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}