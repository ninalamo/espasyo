'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../../constants/consts';
import { 
  ForecastMapPoint, 
  ForecastMapFilters, 
  MapForecastSummary,
  DEFAULT_FORECAST_FILTERS,
  RISK_LEVEL_COLORS,
  TIME_OF_DAY_COLORS,
  RELIABILITY_THRESHOLDS
} from '../../types/forecast/ExtendedForecastTypes';

interface ForecastMapProps {
  center: [number, number];
  zoom: number;
  forecastPoints: ForecastMapPoint[];
  loading: boolean;
}

const ForecastMap: React.FC<ForecastMapProps> = ({ 
  center, 
  zoom, 
  forecastPoints, 
  loading 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  // Filter state
  const [filters, setFilters] = useState<ForecastMapFilters>(DEFAULT_FORECAST_FILTERS);
  const [showPoints, setShowPoints] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [colorBy, setColorBy] = useState<'risk' | 'reliability' | 'timeOfDay'>('risk');
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<string[]>(['morning', 'afternoon', 'evening', 'night']);
  
  // Modal state for showing forecast details
  const [selectedPoint, setSelectedPoint] = useState<ForecastMapPoint | null>(null);

  // Filter forecast points based on current filters
  const filteredPoints = useMemo(() => {
    return forecastPoints.filter(point => {
      // Reliability filter
      if (point.reliability < filters.minReliability || point.reliability > filters.maxReliability) {
        return false;
      }
      
      // Confidence filter
      if (point.confidence < filters.minConfidence || point.confidence > filters.maxConfidence) {
        return false;
      }
      
      // Risk level filter
      if (!filters.riskLevels.includes(point.risk)) {
        return false;
      }
      
      // Time of day filter
      if (!filters.timeOfDay.includes(point.primaryTimeOfDay)) {
        return false;
      }
      
      // Precinct filter (if any selected)
      if (filters.precincts.length > 0 && !filters.precincts.includes(point.precinct)) {
        return false;
      }
      
      // Crime type filter (if any selected)
      if (filters.crimeTypes.length > 0 && !filters.crimeTypes.includes(point.crimeType)) {
        return false;
      }
      
      // Forecast period filter (if any selected)
      if (filters.forecastPeriods.length > 0 && !filters.forecastPeriods.includes(point.forecastPeriod)) {
        return false;
      }
      
      return true;
    });
  }, [forecastPoints, filters]);

  // Calculate summary statistics
  const summary: MapForecastSummary = useMemo(() => {
    const totalPoints = filteredPoints.length;
    const averageReliability = totalPoints > 0 
      ? filteredPoints.reduce((sum, p) => sum + p.reliability, 0) / totalPoints 
      : 0;
    const highRiskPoints = filteredPoints.filter(p => p.risk === 'high' || p.risk === 'critical').length;
    
    const timeOfDayDistribution = filteredPoints.reduce(
      (acc, p) => {
        acc.morning += p.timeOfDayBreakdown.morning;
        acc.afternoon += p.timeOfDayBreakdown.afternoon;
        acc.evening += p.timeOfDayBreakdown.evening;
        acc.night += p.timeOfDayBreakdown.night;
        return acc;
      },
      { morning: 0, afternoon: 0, evening: 0, night: 0 }
    );
    
    const riskLevelDistribution = filteredPoints.reduce(
      (acc, p) => {
        acc[p.risk]++;
        return acc;
      },
      { low: 0, medium: 0, high: 0, critical: 0 }
    );
    
    const precinctCoverage = Array.from(new Set(filteredPoints.map(p => p.precinct)));
    const crimeTypeCoverage = Array.from(new Set(filteredPoints.map(p => p.crimeType)));
    
    return {
      totalPoints,
      averageReliability,
      highRiskPoints,
      filteredPoints: totalPoints,
      timeOfDayDistribution,
      riskLevelDistribution,
      precinctCoverage,
      crimeTypeCoverage
    };
  }, [filteredPoints]);

  // Get color for a point based on current color scheme
  const getPointColor = (point: ForecastMapPoint): string => {
    switch (colorBy) {
      case 'risk':
        return RISK_LEVEL_COLORS[point.risk];
      case 'reliability':
        if (point.reliability >= RELIABILITY_THRESHOLDS.excellent) return '#10B981';
        if (point.reliability >= RELIABILITY_THRESHOLDS.good) return '#F59E0B';
        if (point.reliability >= RELIABILITY_THRESHOLDS.fair) return '#EF4444';
        return '#9CA3AF';
      case 'timeOfDay':
        return TIME_OF_DAY_COLORS[point.primaryTimeOfDay];
      default:
        return RISK_LEVEL_COLORS[point.risk];
    }
  };

  // Get radius for a point based on predicted count
  const getPointRadius = (point: ForecastMapPoint): number => {
    const baseRadius = 6;
    const scaleFactor = Math.log(Math.max(1, point.predictedCount)) * 2;
    return Math.min(baseRadius + scaleFactor, 20);
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
    }

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  // Update map markers when filtered points or display settings change
  useEffect(() => {
    if (!leafletMap.current || !markersLayerRef.current) return;

    // Clear existing layers
    markersLayerRef.current.clearLayers();
    if (heatLayerRef.current) {
      leafletMap.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (loading) return;

    // Add heatmap layer if enabled
    if (showHeatmap && filteredPoints.length > 0) {
      const heatData = filteredPoints.map(point => [
        point.latitude, 
        point.longitude, 
        Math.log(point.predictedCount + 1) * point.reliability
      ] as [number, number, number]);

      heatLayerRef.current = (L as any).heatLayer(heatData, {
        radius: 20,
        blur: 15,
        maxZoom: zoom,
        gradient: {
          0.2: "rgba(0,255,0,0.3)",
          0.4: "rgba(173,255,47,0.4)", 
          0.6: "rgba(255,255,0,0.5)",
          0.8: "rgba(255,165,0,0.7)",
          1.0: "rgba(255,0,0,0.9)"
        }
      });
      
      leafletMap.current.addLayer(heatLayerRef.current);
    }

    // Add point markers if enabled
    if (showPoints) {
      filteredPoints.forEach(point => {
        const color = getPointColor(point);
        const radius = getPointRadius(point);
        
        const marker = L.circleMarker([point.latitude, point.longitude], {
          color: '#000',
          weight: 1,
          fillColor: color,
          fillOpacity: 0.8,
          radius: radius
        });

        // Add click handler to show details
        marker.on('click', () => {
          setSelectedPoint(point);
        });

        // Add hover tooltip
        const crimeTypeName = CrimeTypesDictionary[point.crimeType] || `Crime Type ${point.crimeType}`;
        const precinctName = GetPrecinctsDictionary[point.precinct] || `Precinct ${point.precinct}`;
        
        marker.bindTooltip(
          `<div style="font-size: 12px;">
            <strong>${point.forecastPeriod}</strong><br/>
            ${crimeTypeName}<br/>
            ${precinctName}<br/>
            Predicted: ${point.predictedCount}<br/>
            Risk: ${point.risk}<br/>
            Reliability: ${(point.reliability * 100).toFixed(0)}%
          </div>`,
          { offset: [0, -radius] }
        );

        markersLayerRef.current!.addLayer(marker);
      });
    }
  }, [filteredPoints, showPoints, showHeatmap, colorBy, loading]);

  // Reset filters
  const resetFilters = () => {
    setFilters(DEFAULT_FORECAST_FILTERS);
    setSelectedTimeOfDay(['morning', 'afternoon', 'evening', 'night']);
  };

  // Update filter function
  const updateFilter = <K extends keyof ForecastMapFilters>(
    key: K, 
    value: ForecastMapFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading forecast map...</p>
        </div>
      </div>
    );
  }

  if (forecastPoints.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reliable Forecast Data Available</h3>
        <div className="text-gray-500 space-y-2">
          <p>No forecasts meet the minimum reliability threshold (30%) for map display.</p>
          <div className="text-sm bg-gray-50 p-3 rounded border">
            <p className="font-medium text-gray-700 mb-2">📊 To improve forecast reliability:</p>
            <ul className="text-left space-y-1 text-xs text-gray-600">
              <li>• Ensure at least <strong>25+ incidents</strong> per precinct/crime type combination</li>
              <li>• Use data spanning <strong>2+ years</strong> for temporal pattern detection</li>
              <li>• Include multiple precincts and crime types for better coverage</li>
              <li>• Check console output for detailed quality metrics</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">Total Points</p>
              <p className="text-xl font-bold text-blue-900">{summary.totalPoints}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">Avg Reliability</p>
              <p className="text-xl font-bold text-green-900">{(summary.averageReliability * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">High Risk</p>
              <p className="text-xl font-bold text-red-900">{summary.highRiskPoints}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-600 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-800">Coverage</p>
              <p className="text-xl font-bold text-purple-900">{summary.precinctCoverage.length}P</p>
            </div>
          </div>
        </div>
      </div>

      {/* Display Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showPoints}
                onChange={(e) => setShowPoints(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Show Points</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm font-medium">Show Heatmap</span>
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Color by:</span>
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="risk">Risk Level</option>
              <option value="reliability">Reliability</option>
              <option value="timeOfDay">Time of Day</option>
            </select>
          </div>

          <button
            onClick={resetFilters}
            className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
          >
            Reset Filters
          </button>
        </div>

        {/* Reliability Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Min Reliability: {(filters.minReliability * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={filters.minReliability}
              onChange={(e) => updateFilter('minReliability', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Min Confidence: {(filters.minConfidence * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={filters.minConfidence}
              onChange={(e) => updateFilter('minConfidence', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Risk Levels</label>
            <div className="flex flex-wrap gap-1">
              {(['low', 'medium', 'high', 'critical'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => {
                    const newLevels = filters.riskLevels.includes(level)
                      ? filters.riskLevels.filter(l => l !== level)
                      : [...filters.riskLevels, level];
                    updateFilter('riskLevels', newLevels);
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    filters.riskLevels.includes(level)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Time of Day</label>
            <div className="flex flex-wrap gap-1">
              {(['morning', 'afternoon', 'evening', 'night'] as const).map(time => (
                <button
                  key={time}
                  onClick={() => {
                    const newTimes = filters.timeOfDay.includes(time)
                      ? filters.timeOfDay.filter(t => t !== time)
                      : [...filters.timeOfDay, time];
                    updateFilter('timeOfDay', newTimes);
                  }}
                  className={`text-xs px-2 py-1 rounded border ${
                    filters.timeOfDay.includes(time)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div id="forecast-map" ref={mapRef} style={{ height: '500px', width: '100%' }} />
      
      {/* Map Legend & Info */}
      <div className="mt-4 bg-gray-50 rounded-lg p-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">🗺️ Map Legend:</h4>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>• <strong>Point Size</strong>: Predicted crime count</li>
              <li>• <strong>Colors</strong>: {colorBy === 'risk' ? 'Risk levels' : colorBy === 'reliability' ? 'Reliability scores' : 'Time of day patterns'}</li>
              <li>• <strong>Heatmap</strong>: Weighted by prediction × reliability</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">🎯 Reliability:</h4>
            <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Only forecasts &ge;30% reliability shown</li>
              <li>• Based on sample size, variance, time span</li>
              <li>• Click points for detailed reliability metrics</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">⚠️ Usage Guidelines:</h4>
            <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Use high-reliability (&gt;60%) for planning</li>
              <li>• Supplement with expert knowledge</li>
              <li>• Consider as one factor in decision-making</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Point Details Modal */}
      {selectedPoint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Forecast Details</h3>
              <button
                onClick={() => setSelectedPoint(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-600">Period:</span>
                  <p>{selectedPoint.forecastPeriod}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Predicted Count:</span>
                  <p className="text-lg font-bold">{selectedPoint.predictedCount}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-600">Risk Level:</span>
                  <p className={`capitalize font-medium ${
                    selectedPoint.risk === 'critical' ? 'text-red-600' :
                    selectedPoint.risk === 'high' ? 'text-orange-600' :
                    selectedPoint.risk === 'medium' ? 'text-yellow-600' : 'text-green-600'
                  }`}>{selectedPoint.risk}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Reliability:</span>
                  <p className="font-medium">{(selectedPoint.reliability * 100).toFixed(0)}%</p>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Location:</span>
                <p>{GetPrecinctsDictionary[selectedPoint.precinct] || `Precinct ${selectedPoint.precinct}`}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Crime Type:</span>
                <p>{CrimeTypesDictionary[selectedPoint.crimeType] || `Crime Type ${selectedPoint.crimeType}`}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-600">Time of Day Distribution:</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(selectedPoint.timeOfDayBreakdown).map(([time, count]) => (
                    <div key={time} className="flex justify-between text-xs">
                      <span className="capitalize">{time}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-600">Trend:</span>
                  <p className="capitalize">{selectedPoint.trend}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Confidence:</span>
                  <p>{(selectedPoint.confidence * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForecastMap;
