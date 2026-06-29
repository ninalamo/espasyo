'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { GetPrecinctsDictionary } from '../constants/consts';

interface ForecastSpatialRow {
  precinct: number;
  clusterId: number;
  latitude?: number | null;
  longitude?: number | null;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  trend: string;
  riskLevel: string;
  timestamp?: string;
}

interface ForecastMapProps {
  center: [number, number];
  zoom: number;
  spatialData: ForecastSpatialRow[];
  dateRange?: string;
}

const TREND_COLORS: Record<string, string> = {
  increasing: '#EF4444',
  decreasing: '#22C55E',
  stable: '#EAB308',
};

const TREND_LABELS: Record<string, string> = {
  increasing: 'Increasing',
  decreasing: 'Decreasing',
  stable: 'Stable',
};

const ALL_PRECINCTS = Array.from({ length: 9 }, (_, i) => i);

const ForecastMap: React.FC<ForecastMapProps> = ({ center, zoom, spatialData, dateRange }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const precinctLayerRef = useRef<L.GeoJSON | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [showPrecincts, setShowPrecincts] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);

  const filteredData = useMemo(() => {
    let data = spatialData;
    if (selectedRiskLevels.length > 0) data = data.filter(s => selectedRiskLevels.includes(s.riskLevel));
    return data;
  }, [spatialData, selectedRiskLevels]);

  const precinctAggregates = useMemo(() => {
    const map = new Map<number, {
      totalForecast: number;
      rows: ForecastSpatialRow[];
    }>();
    for (const row of filteredData) {
      if (!map.has(row.precinct)) map.set(row.precinct, { totalForecast: 0, rows: [] });
      const entry = map.get(row.precinct)!;
      entry.totalForecast += row.forecast;
      entry.rows.push(row);
    }
    return ALL_PRECINCTS.map(p => {
      const entry = map.get(p);
      if (!entry || entry.rows.length === 0) return null;
      const trendTotals: Record<string, number> = {};
      for (const r of entry.rows) {
        trendTotals[r.trend] = (trendTotals[r.trend] || 0) + r.forecast;
      }
      const dominantTrend = Object.entries(trendTotals).sort((a, b) => b[1] - a[1])[0][0];
      const avgConfidence = entry.rows.reduce((s, r) => s + r.confidence, 0) / entry.rows.length;
      return {
        precinct: p,
        totalForecast: entry.totalForecast,
        dominantTrend,
        avgForecast: entry.totalForecast / entry.rows.length,
        avgConfidence,
        rowCount: entry.rows.length,
      };
    });
  }, [filteredData]);

  const heatPoints = useMemo(() => {
    const centroids: Record<number, { lat: number; lng: number; weight: number }> = {};
    for (const row of filteredData) {
      if (row.latitude == null || row.longitude == null) continue;
      if (!centroids[row.precinct]) {
        centroids[row.precinct] = { lat: row.latitude, lng: row.longitude, weight: 0 };
      }
      centroids[row.precinct].weight += row.forecast;
    }
    return Object.values(centroids).map(c => [c.lat, c.lng, Math.min(1, c.weight / 30)] as [number, number, number]);
  }, [filteredData]);

  useEffect(() => {
    if (!mapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (leafletMap.current) leafletMap.current.invalidateSize();
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current, {
        attributionControl: false,
      }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(leafletMap.current);
      labelLayerRef.current = L.layerGroup();
      setMapReady(true);
    }
  }, [center, zoom]);

  useEffect(() => {
    if (!leafletMap.current) return;
    if (heatLayerRef.current) { leafletMap.current.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (heatPoints.length === 0) return;
    try {
      heatLayerRef.current = (L as any).heatLayer(heatPoints, {
        radius: 60,
        blur: 40,
        maxZoom: zoom + 2,
        gradient: {
          0.2: "rgba(16,185,129,0.2)",
          0.4: "rgba(245,158,11,0.4)",
          0.6: "rgba(239,68,68,0.6)",
          0.8: "rgba(220,38,38,0.8)",
          1.0: "rgba(153,27,27,1.0)",
        },
      });
      leafletMap.current.addLayer(heatLayerRef.current);
    } catch (e) {
      console.warn('Failed to render forecast heatmap', e);
    }
  }, [heatPoints, zoom, mapReady]);

  useEffect(() => {
    if (!mapReady || !leafletMap.current || !showPrecincts) return;

    if (!document.getElementById('forecast-label-style')) {
      const style = document.createElement('style');
      style.id = 'forecast-label-style';
      style.textContent = `
      .forecast-label {
        background: rgba(255,255,255,0.88);
        border: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        font-size: 11px;
        font-weight: 700;
        color: #1a1a2e;
        padding: 2px 8px;
        border-radius: 4px;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      `;
      document.head.appendChild(style);
    }

    fetch('/data/precincts.geojson')
      .then(res => res.json())
      .then(data => {
        if (precinctLayerRef.current) leafletMap.current?.removeLayer(precinctLayerRef.current);
        if (labelLayerRef.current) leafletMap.current?.removeLayer(labelLayerRef.current);

        precinctLayerRef.current = L.geoJSON(data, {
          style: (feature) => {
            const pid = feature?.properties?.id;
            const agg = precinctAggregates[pid];
            if (!agg) return { color: '#999', weight: 1.5, fillColor: '#e5e7eb', fillOpacity: 0.15 };
            return {
              color: '#666',
              weight: 2,
              fillColor: TREND_COLORS[agg.dominantTrend] || '#9CA3AF',
              fillOpacity: 0.2,
            };
          },
          onEachFeature: (feature, layer) => {
            const pid = feature?.properties?.id;
            const agg = precinctAggregates[pid];
            if (agg) {
              layer.bindPopup(`
                <b>${GetPrecinctsDictionary[pid] || 'Precinct ' + pid}</b><br>
                Predicted cases: <b>${Math.round(agg.totalForecast)}</b><br>
                Dominant trend: ${TREND_LABELS[agg.dominantTrend] || agg.dominantTrend}<br>
                Avg confidence: ${(agg.avgConfidence * 100).toFixed(0)}%
              `);
            }
          },
        });

        labelLayerRef.current?.clearLayers();
        precinctLayerRef.current.eachLayer((layer: any) => {
          const feature = (layer as any).feature;
          if (!feature || feature.geometry.type !== 'Polygon') return;
          const center = layer.getBounds().getCenter();
          const pid = feature.properties.id;
          const agg = precinctAggregates[pid];
          const icon = L.divIcon({
            className: 'forecast-label',
            html: agg
              ? `<b>${feature.properties.name}</b><br><span style="font-size:10px;color:${TREND_COLORS[agg.dominantTrend] || '#666'}">${Math.round(agg.totalForecast)} cases</span>`
              : `<b>${feature.properties.name}</b><br><span style="font-size:10px;color:#999">no data</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          L.marker(center, { icon, interactive: false }).addTo(labelLayerRef.current!);
        });

        leafletMap.current!.addLayer(precinctLayerRef.current);
        leafletMap.current!.addLayer(labelLayerRef.current!);
      })
      .catch(() => {});
  }, [mapReady, precinctAggregates, showPrecincts]);

  const resetFilters = () => setSelectedRiskLevels([]);
  const hasActiveFilters = selectedRiskLevels.length > 0;

  const allForecast = precinctAggregates.filter(a => a !== null);
  const totalPredicted = allForecast.reduce((s, a) => s + a.totalForecast, 0);
  const increasingPrecincts = allForecast.filter(a => a.dominantTrend === 'increasing');
  const decreasingPrecincts = allForecast.filter(a => a.dominantTrend === 'decreasing');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Prediction Filters
          </button>
          <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={showPrecincts} onChange={e => setShowPrecincts(e.target.checked)} className="accent-blue-600" />
              Boundaries
            </label>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="space-y-3">
          <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-gray-600">Risk Level:</span>
              {['low', 'medium', 'high', 'critical'].map(risk => (
                <button
                  key={risk}
                  onClick={() => setSelectedRiskLevels(prev =>
                    prev.includes(risk) ? prev.filter(x => x !== risk) : [...prev, risk]
                  )}
                  className={`px-2 py-0.5 border rounded text-xs capitalize ${
                    selectedRiskLevels.includes(risk) ? 'bg-ubuntu-500 text-white' : 'bg-white'
                  }`}
                >
                  {risk}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={resetFilters} className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300">Reset</button>
            </div>
          </div>
        </div>
      )}

      {allForecast.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-indigo-700">{Math.round(totalPredicted)}</div>
            <div className="text-xs text-indigo-600">Total Predicted Cases</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-700">{increasingPrecincts.length}</div>
            <div className="text-xs text-red-600">Precincts Increasing</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-700">{decreasingPrecincts.length}</div>
            <div className="text-xs text-green-600">Precincts Decreasing</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-yellow-700">{allForecast.length - increasingPrecincts.length - decreasingPrecincts.length}</div>
            <div className="text-xs text-yellow-600">Precincts Stable</div>
          </div>
        </div>
      )}

      <div id="forecast-map" ref={mapRef} style={{ height: '500px', width: '100%' }} className="rounded-lg border border-gray-200 z-0" />

      <div className="text-xs text-gray-500 space-y-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> Heat intensity = predicted volume</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-400">Broader glow = wider area of estimated risk</span>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
          <strong>How to read this map:</strong> The heatmap shows where future incidents are predicted to concentrate within {dateRange || 'the forecast period'}. Brighter, larger hotspots indicate precincts with higher predicted case volumes. Use this to prioritize patrol deployment — precincts with increasing trends (filled red) need more resources, while decreasing areas (green) may need fewer. The heat spreads across each precinct boundary to show the estimated area of influence, not a precise point.
        </div>
      </div>
    </div>
  );
};

export default ForecastMap;
