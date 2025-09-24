'use client';

import { useState, useCallback } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import StaticMultiSelectDropdown from '../../components/StaticMultiSelectDropdown';

export interface ForecastFilterState {
  selectedPrecincts: number[];
  selectedCrimeTypes: number[];
  selectedRiskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  selectedTrends: ('increasing' | 'decreasing' | 'stable')[];
  minConfidence: number;
  maxConfidence: number;
  minPredictedCount: number;
  maxPredictedCount: number;
  dateFrom: string; // '2024-01' format
  dateTo: string; // '2024-12' format
  showOnlyHighRisk: boolean;
  groupBy: 'precinct' | 'crimeType' | 'month' | 'risk';
}

export const initialForecastFilterState: ForecastFilterState = {
  selectedPrecincts: [],
  selectedCrimeTypes: [],
  selectedRiskLevels: ['low', 'medium', 'high', 'critical'],
  selectedTrends: ['increasing', 'decreasing', 'stable'],
  minConfidence: 0.0,
  maxConfidence: 1.0,
  minPredictedCount: 0,
  maxPredictedCount: 1000,
  dateFrom: '',
  dateTo: '',
  showOnlyHighRisk: false,
  groupBy: 'precinct'
};

interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ForecastFiltersProps {
  forecastData: ForecastData[];
  filters: ForecastFilterState;
  onFiltersChange: (filters: ForecastFilterState) => void;
  onFilteredDataChange: (filteredData: ForecastData[]) => void;
}

const ForecastFilters: React.FC<ForecastFiltersProps> = ({ 
  forecastData, 
  filters, 
  onFiltersChange, 
  onFilteredDataChange 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Apply filters to forecast data
  const applyFilters = useCallback((filterState: ForecastFilterState, data: ForecastData[]) => {
    return data.filter(forecast => {
      // Precinct filter
      if (filterState.selectedPrecincts.length > 0 && 
          !filterState.selectedPrecincts.includes(forecast.precinct)) {
        return false;
      }

      // Crime type filter
      if (filterState.selectedCrimeTypes.length > 0 && 
          !filterState.selectedCrimeTypes.includes(forecast.crimeType)) {
        return false;
      }

      // Risk level filter
      if (!filterState.selectedRiskLevels.includes(forecast.riskLevel)) {
        return false;
      }

      // Trend filter
      if (!filterState.selectedTrends.includes(forecast.trend)) {
        return false;
      }

      // Confidence range filter
      if (forecast.confidence < filterState.minConfidence || 
          forecast.confidence > filterState.maxConfidence) {
        return false;
      }

      // Predicted count range filter
      if (forecast.predictedCount < filterState.minPredictedCount || 
          forecast.predictedCount > filterState.maxPredictedCount) {
        return false;
      }

      // Date range filter
      const forecastMonth = `${forecast.year}-${forecast.month.toString().padStart(2, '0')}`;
      if (filterState.dateFrom && forecastMonth < filterState.dateFrom) {
        return false;
      }
      if (filterState.dateTo && forecastMonth > filterState.dateTo) {
        return false;
      }

      // High risk only filter
      if (filterState.showOnlyHighRisk && 
          !['high', 'critical'].includes(forecast.riskLevel)) {
        return false;
      }

      return true;
    });
  }, []);

  // Handle filter changes and apply them
  const handleFilterChange = useCallback((newFilters: Partial<ForecastFilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    onFiltersChange(updatedFilters);
    const filteredData = applyFilters(updatedFilters, forecastData);
    onFilteredDataChange(filteredData);
  }, [filters, forecastData, onFiltersChange, onFilteredDataChange, applyFilters]);

  // Get unique values for dropdowns
  const uniquePrecincts = [...new Set(forecastData.map(f => f.precinct))].sort((a, b) => a - b);
  const uniqueCrimeTypes = [...new Set(forecastData.map(f => f.crimeType))].sort((a, b) => a - b);
  
  // Create options for dropdowns
  const precinctOptions = uniquePrecincts.map(precinct => ({
    value: precinct,
    label: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`
  }));
  
  const crimeTypeOptions = uniqueCrimeTypes.map(crimeType => ({
    value: crimeType,
    label: CrimeTypesDictionary[crimeType] || `Crime Type ${crimeType}`
  }));
  
  const riskLevelOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];
  
  const trendOptions = [
    { value: 'increasing', label: 'Increasing ↗' },
    { value: 'stable', label: 'Stable →' },
    { value: 'decreasing', label: 'Decreasing ↘' }
  ];
  
  // Get date range for inputs
  const dateRange = forecastData.length > 0 ? (() => {
    const dates = forecastData.map(f => `${f.year}-${f.month.toString().padStart(2, '0')}`);
    const sortedDates = [...new Set(dates)].sort();
    return {
      min: sortedDates[0],
      max: sortedDates[sortedDates.length - 1]
    };
  })() : { min: '', max: '' };

  // Get data ranges
  const confidenceRange = forecastData.length > 0 ? {
    min: Math.min(...forecastData.map(f => f.confidence)),
    max: Math.max(...forecastData.map(f => f.confidence))
  } : { min: 0, max: 1 };

  const countRange = forecastData.length > 0 ? {
    min: Math.min(...forecastData.map(f => f.predictedCount)),
    max: Math.max(...forecastData.map(f => f.predictedCount))
  } : { min: 0, max: 1000 };

  const filteredCount = applyFilters(filters, forecastData).length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-800">Forecast Filters</h3>
          <div className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {filteredCount} / {forecastData.length} forecasts
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          {isExpanded ? 'Hide Filters' : 'Show Filters'}
          <svg className={`w-4 h-4 ml-1 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>


      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border-t pt-4 space-y-4">
          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange({ showOnlyHighRisk: !filters.showOnlyHighRisk })}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                filters.showOnlyHighRisk 
                  ? 'bg-red-100 text-red-800 border border-red-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              High Risk Only
            </button>
            <button
              onClick={() => handleFilterChange({ 
                selectedRiskLevels: ['critical'],
                selectedTrends: ['increasing']
              })}
              className="px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-300 hover:bg-orange-200"
            >
              Critical + Increasing
            </button>
            <button
              onClick={() => handleFilterChange(initialForecastFilterState)}
              className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
            >
              Reset All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Precincts */}
            <StaticMultiSelectDropdown
              options={precinctOptions}
              selected={filters.selectedPrecincts}
              setSelected={(selected) => handleFilterChange({ selectedPrecincts: selected as number[] })}
              label="Precincts"
              placeholder="Select precincts..."
            />

            {/* Crime Types */}
            <StaticMultiSelectDropdown
              options={crimeTypeOptions}
              selected={filters.selectedCrimeTypes}
              setSelected={(selected) => handleFilterChange({ selectedCrimeTypes: selected as number[] })}
              label="Crime Types"
              placeholder="Select crime types..."
            />

            {/* Risk Levels */}
            <StaticMultiSelectDropdown
              options={riskLevelOptions}
              selected={filters.selectedRiskLevels}
              setSelected={(selected) => handleFilterChange({ selectedRiskLevels: selected as ('low' | 'medium' | 'high' | 'critical')[] })}
              label="Risk Levels"
              placeholder="Select risk levels..."
            />

            {/* Trends */}
            <StaticMultiSelectDropdown
              options={trendOptions}
              selected={filters.selectedTrends}
              setSelected={(selected) => handleFilterChange({ selectedTrends: selected as ('increasing' | 'decreasing' | 'stable')[] })}
              label="Trends"
              placeholder="Select trends..."
            />

            {/* Confidence Range */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Confidence Range: {(filters.minConfidence * 100).toFixed(0)}% - {(filters.maxConfidence * 100).toFixed(0)}%
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={confidenceRange.min}
                  max={confidenceRange.max}
                  step="0.05"
                  value={filters.minConfidence}
                  onChange={(e) => handleFilterChange({ minConfidence: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="range"
                  min={confidenceRange.min}
                  max={confidenceRange.max}
                  step="0.05"
                  value={filters.maxConfidence}
                  onChange={(e) => handleFilterChange({ maxConfidence: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Predicted Count Range */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Predicted Count: {filters.minPredictedCount} - {filters.maxPredictedCount}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min={countRange.min}
                  max={countRange.max}
                  step="1"
                  value={filters.minPredictedCount}
                  onChange={(e) => handleFilterChange({ minPredictedCount: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="range"
                  min={countRange.min}
                  max={countRange.max}
                  step="1"
                  value={filters.maxPredictedCount}
                  onChange={(e) => handleFilterChange({ maxPredictedCount: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="col-span-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Date Range</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From (YYYY-MM)</label>
                <input
                  type="month"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  min={dateRange.min}
                  max={dateRange.max}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To (YYYY-MM)</label>
                <input
                  type="month"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  min={filters.dateFrom || dateRange.min}
                  max={dateRange.max}
                />
              </div>
            </div>
            {dateRange.min && (
              <div className="mt-2 text-xs text-gray-500">
                Available range: {dateRange.min} to {dateRange.max}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ForecastFilters;