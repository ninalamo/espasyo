'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Edit3, 
  Save, 
  X, 
  Plus,
  RefreshCw,
  Clock,
  Calendar
} from 'lucide-react';
import { toast } from 'react-toastify';
import { manpowerApi, ManpowerAllocation, CreateManpowerRequest } from '../../utils/manpowerApi';

// Precinct options will be loaded from API

const SHIFT_OPTIONS = [
  { value: 'Morning', label: 'Morning (6:00 AM - 2:00 PM)' },
  { value: 'Afternoon', label: 'Afternoon (2:00 PM - 10:00 PM)' },
  { value: 'Night', label: 'Night (10:00 PM - 6:00 AM)' },
  { value: 'Full Day', label: 'Full Day Coverage' }
];

export default function PrecinctsPage() {
  const [manpowerAllocations, setManpowerAllocations] = useState<ManpowerAllocation[]>([]);
  const [precincts, setPrecincts] = useState<Array<{ value: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ManpowerAllocation>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CreateManpowerRequest>({
    precinct: '',
    officerCount: 5,
    shift: 'Morning'
  });

  useEffect(() => {
    fetchPrecincts();
    fetchManpowerAllocations();
  }, []);

  const fetchPrecincts = async () => {
    try {
      const data = await manpowerApi.getPrecincts();
      setPrecincts(data);
    } catch (error) {
      console.error('Error fetching precincts:', error);
      toast.error('Failed to load precincts');
    }
  };

  const fetchManpowerAllocations = async () => {
    setLoading(true);
    try {
      const data = await manpowerApi.getAllManpower();
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
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchManpowerAllocations();
    toast.success('Data refreshed');
  };

  const handleEdit = (allocation: ManpowerAllocation) => {
    setEditingId(allocation.id);
    setEditForm({ 
      ...allocation,
      officerCount: allocation.officerCount || allocation.allocatedCount 
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    
    try {
      const updateData = {
        precinct: editForm.precinct,
        officerCount: editForm.officerCount || editForm.allocatedCount,
        shift: editForm.shift
      };
      
      await manpowerApi.updateManpower(editForm.id, updateData);
      await fetchManpowerAllocations();
      setEditingId(null);
      setEditForm({});
      toast.success('Updated successfully');
    } catch (error) {
      console.error('Error updating:', error);
      toast.error('Update failed');
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
      await fetchManpowerAllocations();
      setShowAddForm(false);
      setAddForm({
        precinct: '',
        officerCount: 5,
        shift: 'Morning'
      });
      toast.success('Created successfully');
    } catch (error) {
      console.error('Error creating:', error);
      toast.error('Creation failed');
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
      sum + (allocation.officerCount || allocation.allocatedCount || 0), 0
    );
  };

  const getUniquePrecincts = () => {
    const precincts = new Set(manpowerAllocations.map(a => a.precinct));
    return precincts.size;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Precinct Manpower Management</h1>
          <p className="text-gray-600">Manage officer allocations across precincts</p>
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
              <p className="text-sm text-gray-600">Active Precincts</p>
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
                  Precinct *
                </label>
                <select
                  value={addForm.precinct}
                  onChange={(e) => setAddForm(prev => ({ ...prev, precinct: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Precinct</option>
                  {precincts.map((precinct) => (
                    <option key={precinct.value} value={precinct.name}>{precinct.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Officers *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={addForm.officerCount}
                  onChange={(e) => setAddForm(prev => ({ ...prev, officerCount: parseInt(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift
                </label>
                <select
                  value={addForm.shift}
                  onChange={(e) => setAddForm(prev => ({ ...prev, shift: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SHIFT_OPTIONS.map((shift) => (
                    <option key={shift.value} value={shift.value}>{shift.label}</option>
                  ))}
                </select>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Officers
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shift
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {manpowerAllocations.map((allocation) => (
                <tr key={allocation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                      <div>
                        {editingId === allocation.id ? (
                          <select
                            value={editForm.precinct || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, precinct: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {precincts.map((precinct) => (
                              <option key={precinct.value} value={precinct.name}>{precinct.name}</option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {allocation.precinct}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {allocation.id.substring(0, 8)}...
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-gray-400 mr-2" />
                      {editingId === allocation.id ? (
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={editForm.officerCount || editForm.allocatedCount || ''}
                          onChange={(e) => setEditForm(prev => ({ 
                            ...prev, 
                            officerCount: parseInt(e.target.value) 
                          }))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {allocation.officerCount || allocation.allocatedCount}
                        </span>
                      )}
                    </div>
                  </td>
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
                    {editingId === allocation.id ? (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {manpowerAllocations.length === 0 && (
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