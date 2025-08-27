'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Cluster } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../constants/consts';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

interface SimpleForecastMapProps {
  clusters: Cluster[];
  forecastData: ForecastData[];
}

const SimpleForecastMap: React.FC<SimpleForecastMapProps> = ({ clusters, forecastData }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView([14.4081, 121.0415], 13);
      
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap.current);

      // Set bounds to Muntinlupa area
      const bounds = L.latLngBounds(
        L.latLng(14.35, 121.01), // Southwest corner
        L.latLng(14.47, 121.07)  // Northeast corner
      );
      leafletMap.current.setMaxBounds(bounds);
    }

    // Clear existing layers
    leafletMap.current.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        leafletMap.current!.removeLayer(layer);
      }
    });

    // Add current cluster points (historical data)
    clusters.forEach((cluster) => {
      cluster.clusterItems.forEach((item) => {
        // Validate coordinates are within Muntinlupa bounds
        if (item.latitude >= 14.35 && item.latitude <= 14.47 && 
            item.longitude >= 121.01 && item.longitude <= 121.07) {
          
          const marker = L.circleMarker([item.latitude, item.longitude], {
            color: '#2563eb',
            weight: 2,
            fillColor: '#3b82f6',
            fillOpacity: 0.6,
            radius: 4
          }).addTo(leafletMap.current!);

          const precinctName = GetPrecinctsDictionary[item.precinct] || `Precinct ${item.precinct}`;
          const crimeTypeName = CrimeTypesDictionary[item.crimeType] || `Crime Type ${item.crimeType}`;

          marker.bindTooltip(
            `<div style="font-size: 12px;">
              <strong>Historical Crime</strong><br/>
              ${precinctName}<br/>
              ${crimeTypeName}<br/>
              ${item.month}/${item.year}<br/>
              Time: ${item.timeOfDay}
            </div>`,
            { offset: [0, -10] }
          );
        }
      });
    });

    // Add forecast prediction points
    const forecastLocationMap = new Map<string, { count: number; lat: number; lng: number; forecasts: ForecastData[] }>();

    forecastData.forEach((forecast) => {
      // Find corresponding cluster items to get coordinates
      const relevantItems = clusters.flatMap(cluster => 
        cluster.clusterItems.filter(item => 
          item.precinct === forecast.precinct && item.crimeType === forecast.crimeType
        )
      );

      if (relevantItems.length > 0) {
        // Calculate average coordinates for this precinct/crime type
        const avgLat = relevantItems.reduce((sum, item) => sum + item.latitude, 0) / relevantItems.length;
        const avgLng = relevantItems.reduce((sum, item) => sum + item.longitude, 0) / relevantItems.length;

        // Validate coordinates
        if (avgLat >= 14.35 && avgLat <= 14.47 && avgLng >= 121.01 && avgLng <= 121.07) {
          const key = `${forecast.precinct}-${forecast.crimeType}`;
          
          if (forecastLocationMap.has(key)) {
            const existing = forecastLocationMap.get(key)!;
            existing.count += forecast.predictedCount;
            existing.forecasts.push(forecast);
          } else {
            forecastLocationMap.set(key, {
              count: forecast.predictedCount,
              lat: avgLat,
              lng: avgLng,
              forecasts: [forecast]
            });
          }
        }
      }
    });

    // Add forecast markers
    forecastLocationMap.forEach(({ count, lat, lng, forecasts }) => {
      const totalRisk = forecasts.reduce((sum, f) => {
        const riskValue = f.riskLevel === 'critical' ? 4 : f.riskLevel === 'high' ? 3 : f.riskLevel === 'medium' ? 2 : 1;
        return sum + riskValue;
      }, 0);
      const avgRisk = totalRisk / forecasts.length;

      const color = avgRisk >= 3.5 ? '#dc2626' : avgRisk >= 2.5 ? '#ea580c' : avgRisk >= 1.5 ? '#ca8a04' : '#16a34a';
      const radius = Math.min(Math.max(count * 2, 8), 20);

      const marker = L.circleMarker([lat, lng], {
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.8,
        radius: radius
      }).addTo(leafletMap.current!);

      const precinctName = GetPrecinctsDictionary[forecasts[0].precinct] || `Precinct ${forecasts[0].precinct}`;
      const crimeTypeName = CrimeTypesDictionary[forecasts[0].crimeType] || `Crime Type ${forecasts[0].crimeType}`;

      const tooltipContent = `
        <div style="font-size: 12px;">
          <strong>📈 FORECAST PREDICTION</strong><br/>
          <strong>${precinctName}</strong><br/>
          ${crimeTypeName}<br/>
          Predicted: <strong>${count}</strong> incidents<br/>
          Risk: <strong style="color: ${color};">${forecasts[0].riskLevel.toUpperCase()}</strong><br/>
          Confidence: ${(forecasts[0].confidence * 100).toFixed(0)}%<br/>
          Trend: ${forecasts[0].trend === 'increasing' ? '↗️' : forecasts[0].trend === 'decreasing' ? '↘️' : '➡️'} ${forecasts[0].trend}
        </div>
      `;

      marker.bindTooltip(tooltipContent, { offset: [0, -radius] });
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [clusters, forecastData]);

  if (clusters.length === 0 && forecastData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data to Display</h3>
        <p className="text-gray-500">Run analysis and generate forecasts to see crime predictions on the map.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-800 mb-3">Map Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium text-blue-700 mb-2">Historical Crime Data</h5>
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-600"></div>
              <span>Past crime incidents (from analysis)</span>
            </div>
          </div>
          <div>
            <h5 className="font-medium text-red-700 mb-2">Forecast Predictions</h5>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-600 border-2 border-white"></div>
                <span>Critical/High Risk</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white"></div>
                <span>Medium Risk</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
                <span>Low Risk</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          💡 Larger circles indicate higher predicted crime counts. Click markers for details.
        </p>
      </div>

      {/* Map */}
      <div id="simple-forecast-map" ref={mapRef} style={{ height: '500px', width: '100%' }} className="rounded-lg border" />
    </div>
  );
};

export default SimpleForecastMap;
