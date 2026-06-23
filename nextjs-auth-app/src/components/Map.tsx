'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import * as turf from '@turf/turf';
import { Cluster } from '../types/analysis/ClusterDto';
import { CrimeTypesDictionary } from '../constants/consts';
import MapModal from './MapModal';

interface MapProps {
  center: [number, number];
  zoom: number;
  clusters: Cluster[];
  clusterColorsMapping: Record<number, string>;
}

type ViewMode = 'points' | 'heatmap' | 'both';

const PRECINCT_COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
];

const Map: React.FC<MapProps> = ({ center, zoom, clusters, clusterColorsMapping }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayersRef = useRef<L.LayerGroup | null>(null);
  const envelopeLayersRef = useRef<L.LayerGroup | null>(null);
  const precinctLayerRef = useRef<L.GeoJSON | null>(null);
  const precinctLabelLayerRef = useRef<L.LayerGroup | null>(null);

  const crimeTypeEnum = CrimeTypesDictionary;

  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [showPrecincts, setShowPrecincts] = useState(false);

  const [stepwise, setStepwise] = useState(false);
  const [play, setPlay] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<number[]>([]);
  const [modalCases, setModalCases] = useState<{
    lat: number;
    lng: number;
    clusterId: number;
    items: Cluster['clusterItems'];
  } | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [periodAYears, setPeriodAYears] = useState<number[]>([]);
  const [periodBYears, setPeriodBYears] = useState<number[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const uniqueSteps = useMemo(
    () => Array.from(
      new Set(
        clusters.flatMap(c =>
          c.clusterItems.map(i => `${i.year}-${i.month.toString().padStart(2, '0')}`)
        )
      )
    ).sort(),
    [clusters]
  );

  const uniqueYears = useMemo(
    () => Array.from(
      new Set(clusters.flatMap(c => c.clusterItems.map(i => i.year)))
    ).sort(),
    [clusters]
  );

  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    let filtered = clusters;

    if (compareMode) {
      filtered = filtered.map(c => ({
        ...c,
        clusterItems: c.clusterItems.filter(i =>
          (periodAYears.length === 0 && periodBYears.length === 0) ||
          periodAYears.includes(i.year) || periodBYears.includes(i.year)
        )
      })).filter(c => c.clusterItems.length > 0);
    } else if (stepwise && uniqueSteps.length > 0) {
      const [y, m] = uniqueSteps[currentStep].split('-').map(Number);
      filtered = filtered.map(c => ({
        ...c,
        clusterItems: c.clusterItems.filter(i =>
          i.year === y && i.month === m &&
          (selectedCrimeTypes.length === 0 || selectedCrimeTypes.includes(i.crimeType))
        )
      })).filter(c => c.clusterItems.length > 0);
    } else {
      filtered = filtered.map(c => ({
        ...c,
        clusterItems: c.clusterItems.filter(i =>
          (selectedMonths.length === 0 || selectedMonths.includes(i.month)) &&
          (selectedYears.length === 0 || selectedYears.includes(i.year)) &&
          (selectedCrimeTypes.length === 0 || selectedCrimeTypes.includes(i.crimeType))
        )
      })).filter(c => c.clusterItems.length > 0);
    }

    setFilteredClusters(filtered);
  }, [clusters, stepwise, currentStep, selectedMonths, selectedYears, selectedCrimeTypes, compareMode, periodAYears, periodBYears, uniqueSteps]);

  useEffect(() => {
    if (play && stepwise && uniqueSteps.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % uniqueSteps.length);
      }, 2000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [play, stepwise, uniqueSteps]);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;

    if (!document.getElementById('precinct-label-style')) {
      const style = document.createElement('style');
      style.id = 'precinct-label-style';
      style.textContent = `
      .precinct-label {
        background: rgba(255,255,255,0.85);
        border: none;
        box-shadow: none;
        font-size: 11px;
        font-weight: 700;
        color: #1a1a2e;
        text-shadow: 0 0 3px #fff, 0 0 3px #fff;
        padding: 2px 6px;
        border-radius: 3px;
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
        precinctLayerRef.current = L.geoJSON(data, {
          style: (feature) => ({
            color: PRECINCT_COLORS[feature?.properties?.id ?? 0] ?? '#2c3e50',
            weight: 2.5,
            fill: false,
          }),
        });

        precinctLabelLayerRef.current?.clearLayers();
        data.features.forEach((feature: any) => {
          if (feature.geometry.type !== 'Polygon') return;
          const coords = feature.geometry.coordinates[0];
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const centroid: [number, number] = [
            lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
            lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
          ];
          const icon = L.divIcon({
            className: 'precinct-label',
            html: feature.properties.name,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          L.marker(centroid, { icon, interactive: false }).addTo(precinctLabelLayerRef.current!);
        });
      })
      .catch(() => {
      });
  }, [mapReady]);

  useEffect(() => {
    if (!precinctLayerRef.current || !precinctLabelLayerRef.current || !leafletMap.current) return;
    if (showPrecincts) {
      leafletMap.current.addLayer(precinctLayerRef.current);
      leafletMap.current.addLayer(precinctLabelLayerRef.current);
    } else {
      leafletMap.current.removeLayer(precinctLayerRef.current);
      leafletMap.current.removeLayer(precinctLabelLayerRef.current);
    }
  }, [showPrecincts, mapReady]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
      heatLayersRef.current = L.layerGroup().addTo(leafletMap.current);
      envelopeLayersRef.current = L.layerGroup().addTo(leafletMap.current);
      precinctLabelLayerRef.current = L.layerGroup();
      setMapReady(true);
    }

    markersLayerRef.current?.clearLayers();
    heatLayersRef.current?.clearLayers();
    envelopeLayersRef.current?.clearLayers();

    const showPointsLayer = viewMode === 'points' || viewMode === 'both';
    const showHeatLayer = viewMode === 'heatmap' || viewMode === 'both';

    filteredClusters.forEach(cluster => {
      const clusterColor = clusterColorsMapping[cluster.clusterId] || "#D3D3D3";

      if (showEnvelope && cluster.clusterItems.length > 2) {
        const points = cluster.clusterItems.map(i => [i.latitude, i.longitude] as [number, number]);
        const fc = turf.featureCollection(points.map(pt => turf.point([pt[1], pt[0]])));
        const hull = turf.convex(fc) || turf.bboxPolygon(turf.bbox(fc));
        const buffered = turf.buffer(hull, 0.3, { units: 'kilometers' });
        if (!buffered) return;
        const coords = buffered.geometry.coordinates[0];
        const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
        L.polygon(latLngs, { stroke: false, fillColor: clusterColor, fillOpacity: 0.3 }).addTo(envelopeLayersRef.current!);
      }

      if (showHeatLayer && cluster.clusterItems.length > 3) {
        const heatData = cluster.clusterItems.map(i => [i.latitude, i.longitude, 1]);
        const heatLayer = (L as any).heatLayer(heatData, {
          radius: 25, blur: 20, maxZoom: zoom,
          gradient: {
            0.2: "rgba(0,255,0,0.2)", 0.4: "rgba(173,255,47,0.5)",
            0.6: "rgba(255,255,0,0.7)", 0.8: "rgba(255,165,0,0.85)", 1.0: "rgba(255,0,0,1.0)"
          }
        });
        heatLayersRef.current!.addLayer(heatLayer);
      }

      if (showPointsLayer) {
        const markerMap: Record<string, L.CircleMarker> = {};
        cluster.clusterItems.forEach(item => {
          const key = `${item.latitude.toFixed(6)}_${item.longitude.toFixed(6)}`;
          if (!markerMap[key]) {
            const isPeriodB = compareMode && periodBYears.includes(item.year);
            const markerColor = isPeriodB ? '#E74C3C' : clusterColor;
            const marker = L.circleMarker([item.latitude, item.longitude], {
              color: isPeriodB ? '#C0392B' : "#AAA",
              weight: 1,
              fillColor: markerColor,
              fillOpacity: 0.8,
              radius: isPeriodB ? 6 : 5
            }).addTo(markersLayerRef.current!);

            const allItems = cluster.clusterItems.filter(
              i =>
                i.latitude.toFixed(6) === item.latitude.toFixed(6) &&
                i.longitude.toFixed(6) === item.longitude.toFixed(6)
            );

            const crimeBreakdown = allItems.reduce<Record<string, number>>((acc, i) => {
              const label = crimeTypeEnum[i.crimeType] || `Type ${i.crimeType}`;
              acc[label] = (acc[label] || 0) + 1;
              return acc;
            }, {});

            const popupLines = [
              `<b>${allItems.length} incident${allItems.length > 1 ? 's' : ''} at this location</b>`,
              ...Object.entries(crimeBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([label, count]) => `${label}: ${count}`),
              allItems.length > 1
                ? `<span style="font-size:0.85em;color:#666">Earliest: ${Math.min(...allItems.map(i => i.year))}-${Math.min(...allItems.map(i => i.month)).toString().padStart(2, '0')}</span>`
                : '',
              allItems.length > 1
                ? `<span style="font-size:0.85em;color:#666">Latest: ${Math.max(...allItems.map(i => i.year))}-${Math.max(...allItems.map(i => i.month)).toString().padStart(2, '0')}</span>`
                : '',
              '<span style="font-size:0.85em;color:#3498db">Click for details</span>'
            ].filter(s => s !== '').join('<br>');

            marker.bindPopup(popupLines);

            marker.on('click', () => {
              setModalCases({
                lat: item.latitude,
                lng: item.longitude,
                clusterId: cluster.clusterId,
                items: allItems,
              });
            });

            markerMap[key] = marker;
          }
        });
      }
    });
  }, [filteredClusters, center, zoom, viewMode, showEnvelope, compareMode, periodBYears, clusterColorsMapping, crimeTypeEnum]);

  const [fullscreen, setFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const toggleFullscreen = useCallback(() => {
    setFullscreen(prev => !prev);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const retry = () => {
      const el = mapRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
        requestAnimationFrame(retry);
        return;
      }
      leafletMap.current?.invalidateSize();
    };
    requestAnimationFrame(() => requestAnimationFrame(retry));
  }, [fullscreen, mapReady]);

  const crimeTypeEntries = useMemo(() => Object.entries(crimeTypeEnum), [crimeTypeEnum]);

  const handleCompareToggle = useCallback(() => {
    if (!compareMode) {
      const sortedYears = [...uniqueYears];
      const mid = Math.floor(sortedYears.length / 2);
      setPeriodAYears(sortedYears.slice(0, mid));
      setPeriodBYears(sortedYears.slice(mid));
    } else {
      setPeriodAYears([]);
      setPeriodBYears([]);
    }
    setCompareMode(!compareMode);
  }, [compareMode, uniqueYears]);

  const hasData = clusters && clusters.length > 0;

  const mapEl = (
    <>
      {hasData ? (
          <div className={`space-y-4 ${fullscreen ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(prev => !prev)}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-1.5"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Filters
              </button>
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                {(['points', 'heatmap', 'both'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2 py-1 text-xs rounded border transition ${
                      viewMode === mode
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'points' ? '📍Pts' : mode === 'heatmap' ? '🔥Heat' : 'Both'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={showEnvelope} onChange={e => setShowEnvelope(e.target.checked)} className="accent-blue-600" />
                  Env
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={showPrecincts} onChange={e => setShowPrecincts(e.target.checked)} className="accent-blue-600" />
                  Precincts
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={stepwise} onChange={e => { setStepwise(e.target.checked); setPlay(false); }} className="accent-blue-600" />
                  Trends
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={compareMode} onChange={handleCompareToggle} className="accent-purple-600" />
                  Compare
                </label>
              </div>
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex-shrink-0"
              title="Fullscreen"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>

          {showFilters && (
            <div className={`space-y-3 ${fullscreen ? 'flex-shrink-0 overflow-y-auto max-h-[40vh]' : ''}`}>
              {compareMode && (
                <div className="flex gap-4 p-2.5 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-blue-700">Period A (Blue)</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {uniqueYears.map(y => (
                        <button
                          key={y}
                          onClick={() => setPeriodAYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                          className={`px-2 py-0.5 border rounded text-xs ${periodAYears.includes(y) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                        >{y}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-medium text-red-700">Period B (Red)</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {uniqueYears.map(y => (
                        <button
                          key={y}
                          onClick={() => setPeriodBYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                          className={`px-2 py-0.5 border rounded text-xs ${periodBYears.includes(y) ? 'bg-red-600 text-white' : 'bg-white'}`}
                        >{y}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {stepwise && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPlay(!play)} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">{play ? '⏸' : '▶'} {play ? 'Pause' : 'Play'}</button>
                    <button onClick={() => setCurrentStep(p => Math.max(p - 1, 0))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">◀</button>
                    <button onClick={() => setCurrentStep(p => Math.min(p + 1, uniqueSteps.length - 1))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">▶</button>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    {(() => { const [y, m] = uniqueSteps[currentStep].split('-').map(Number); return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(new Date(y, m - 1)); })()}
                  </span>
                </div>
              )}

              {!stepwise && !compareMode && (
                <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">Month:</span>
                    {[...Array(12)].map((_, i) => {
                      const m = i + 1;
                      return (
                        <button key={m} onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                          className={`px-2 py-0.5 border rounded text-xs ${selectedMonths.includes(m) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                        >{m}</button>
                      );
                    })}
                    <span className="text-xs font-medium text-gray-600 ml-1">Year:</span>
                    {uniqueYears.map(y => (
                      <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                        className={`px-2 py-0.5 border rounded text-xs ${selectedYears.includes(y) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                      >{y}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600">Crime:</span>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {crimeTypeEntries.map(([id, label]) => {
                        const crimeId = parseInt(id);
                        return (
                          <button key={id} onClick={() => setSelectedCrimeTypes(prev => prev.includes(crimeId) ? prev.filter(x => x !== crimeId) : [...prev, crimeId])}
                            className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedCrimeTypes.includes(crimeId) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                          >{label}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => { setSelectedMonths([]); setSelectedYears([]); setSelectedCrimeTypes([]); }}
                      className="px-2 py-0.5 text-xs bg-gray-200 rounded hover:bg-gray-300"
                    >Reset</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div id="map" ref={mapRef} style={{ height: fullscreen ? undefined : '500px', width: '100%' }} className={`rounded-lg border border-gray-200 z-0 ${fullscreen ? 'flex-1 min-h-0' : ''}`} />

          {modalCases && (
            <MapModal
              onClose={() => setModalCases(null)}
              clusterId={modalCases.clusterId}
              items={modalCases.items}
              lat={modalCases.lat}
              lng={modalCases.lng}
            >
              <h2 className="text-lg font-semibold mb-3">Cluster at [{modalCases.lat}, {modalCases.lng}]</h2>
              <p className="text-sm mb-2"><strong>Cluster ID:</strong> {modalCases.clusterId}</p>
              {modalCases.items.length === 1 ? (
                <ul className="space-y-1 text-sm">
                  <li><strong>Case ID:</strong> {modalCases.items[0].caseId}</li>
                  <li><strong>Crime Type:</strong> {crimeTypeEnum[modalCases.items[0].crimeType]}</li>
                  <li><strong>Month:</strong> {modalCases.items[0].month}</li>
                  <li><strong>Year:</strong> {modalCases.items[0].year}</li>
                  <li><strong>Time of Day:</strong> {modalCases.items[0].timeOfDay}</li>
                  <li><strong>Precinct:</strong> {modalCases.items[0].precinct}</li>
                </ul>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-auto text-sm border border-gray-300 mt-2">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1">Case ID</th>
                        <th className="border px-2 py-1">Crime Type</th>
                        <th className="border px-2 py-1">Month</th>
                        <th className="border px-2 py-1">Year</th>
                        <th className="border px-2 py-1">Time of Day</th>
                        <th className="border px-2 py-1">Precinct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalCases.items.map((i) => (
                        <tr key={i.caseId}>
                          <td className="border px-2 py-1">{i.caseId}</td>
                          <td className="border px-2 py-1">{crimeTypeEnum[i.crimeType]}</td>
                          <td className="border px-2 py-1">{i.month}</td>
                          <td className="border px-2 py-1">{i.year}</td>
                          <td className="border px-2 py-1">{i.timeOfDay}</td>
                          <td className="border px-2 py-1">{i.precinct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </MapModal>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 italic py-12">
          No clusters to display. Please run analysis or adjust filters.
        </div>
      )}
    </>
  );

  const content = (
    <div className={fullscreen && hasData ? 'fixed inset-0 z-50 bg-white flex flex-col' : ''}>
      {fullscreen && hasData && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {(['points', 'heatmap', 'both'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-2 py-1 text-xs rounded border transition ${viewMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >{mode === 'points' ? '📍Pts' : mode === 'heatmap' ? '🔥Heat' : 'Both'}</button>
            ))}
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none"><input type="checkbox" checked={showEnvelope} onChange={e => setShowEnvelope(e.target.checked)} className="accent-blue-600" /> Env</label>
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none"><input type="checkbox" checked={showPrecincts} onChange={e => setShowPrecincts(e.target.checked)} className="accent-blue-600" /> Precincts</label>
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none"><input type="checkbox" checked={stepwise} onChange={e => { setStepwise(e.target.checked); setPlay(false); }} className="accent-blue-600" /> Trends</label>
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none"><input type="checkbox" checked={compareMode} onChange={handleCompareToggle} className="accent-purple-600" /> Compare</label>
          </div>
          <button onClick={toggleFullscreen} className="p-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50" title="Exit fullscreen">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {fullscreen && hasData ? mapEl : <div className="space-y-4">{mapEl}</div>}
    </div>
  );

  return content;


};

export default Map;
