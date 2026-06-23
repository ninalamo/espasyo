'use client';

import { useState, useCallback, useMemo } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import StaticMultiSelectDropdown from '../../components/StaticMultiSelectDropdown';
import type { ForecastData, ForecastFilterState } from '../../types/forecast/ForecastBaseTypes';
import { initialForecastFilterState } from '../../types/forecast/ForecastBaseTypes';

export type { ForecastFilterState };
export { initialForecastFilterState };

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
  onFilteredDataChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

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
  const uniquePrecincts = useMemo(() =>
    [...new Set(forecastData.map(f => f.precinct))].sort((a, b) => a - b),
  [forecastData]);
  const uniqueCrimeTypes = useMemo(() =>
    [...new Set(forecastData.map(f => f.crimeType))].sort((a, b) => a - b),
  [forecastData]);
  
  // Create options for dropdowns
  const precinctOptions = useMemo(() => uniquePrecincts.map(precinct => ({
    value: precinct,
    label: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`
  })), [uniquePrecincts]);
  
  const crimeTypeOptions = useMemo(() => uniqueCrimeTypes.map(crimeType => ({
    value: crimeType,
    label: CrimeTypesDictionary[crimeType] || `Crime Type ${crimeType}`
  })), [uniqueCrimeTypes]);
  
  const riskLevelOptions = useMemo(() => [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ], []);
  
  const trendOptions = useMemo(() => [
    { value: 'increasing', label: 'Increasing ↗' },
    { value: 'stable', label: 'Stable →' },
    { value: 'decreasing', label: 'Decreasing ↘' }
  ], []);
  
  // Get data ranges
  const confidenceRange = useMemo(() => forecastData.length > 0 ? {
    min: Math.min(...forecastData.map(f => f.confidence)),
    max: Math.max(...forecastData.map(f => f.confidence))
  } : { min: 0, max: 1 }, [forecastData]);

  const countRange = useMemo(() => forecastData.length > 0 ? {
    min: Math.min(...forecastData.map(f => f.predictedCount)),
    max: Math.max(...forecastData.map(f => f.predictedCount))
  } : { min: 0, max: 1000 }, [forecastData]);

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


        </div>
      )}
    </div>
  );
};

export default ForecastFilters;