'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
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
  '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFE8A1', '#E8BAFF',
  '#FFD9BA', '#A1FFE8', '#FFC3E0', '#D4BAFF',
];

const Map: React.FC<MapProps> = ({ center, zoom, clusters, clusterColorsMapping }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayersRef = useRef<L.LayerGroup | null>(null);
  const precinctLayerRef = useRef<L.GeoJSON | null>(null);
  const precinctLabelLayerRef = useRef<L.LayerGroup | null>(null);

  const crimeTypeEnum = CrimeTypesDictionary;

  const [viewMode, setViewMode] = useState<ViewMode>('both');
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

    if (stepwise && uniqueSteps.length > 0) {
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
  }, [clusters, stepwise, currentStep, selectedMonths, selectedYears, selectedCrimeTypes, uniqueSteps]);

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
    if (!mapRef.current) return;
    const observer = new ResizeObserver(() => {
      if (leafletMap.current) {
        leafletMap.current.invalidateSize();
      }
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

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
            color: '#666',
            weight: 2,
            fillColor: PRECINCT_COLORS[feature?.properties?.id ?? 0] ?? '#2c3e50',
            fillOpacity: 0.35,
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
      leafletMap.current = L.map(mapRef.current, {
        attributionControl: false,
      }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
      heatLayersRef.current = L.layerGroup().addTo(leafletMap.current);
      precinctLabelLayerRef.current = L.layerGroup();
      setMapReady(true);
    }

    markersLayerRef.current?.clearLayers();
    heatLayersRef.current?.clearLayers();

    const showPointsLayer = viewMode === 'points' || viewMode === 'both';
    const showHeatLayer = viewMode === 'heatmap' || viewMode === 'both';

    filteredClusters.forEach(cluster => {
      const clusterColor = clusterColorsMapping[cluster.clusterId] || "#D3D3D3";

      if (showHeatLayer && cluster.clusterItems.length > 3) {
        try {
          const container = leafletMap.current?.getContainer();
          if (container && (container.offsetWidth === 0 || container.offsetHeight === 0)) return;
          const heatData = cluster.clusterItems.map(i => [i.latitude, i.longitude, 1]);
          const heatLayer = (L as any).heatLayer(heatData, {
            radius: 25, blur: 20, maxZoom: zoom,
            gradient: {
              0.2: "rgba(0,255,0,0.2)", 0.4: "rgba(173,255,47,0.5)",
              0.6: "rgba(255,255,0,0.7)", 0.8: "rgba(255,165,0,0.85)", 1.0: "rgba(255,0,0,1.0)"
            }
          });
          heatLayersRef.current!.addLayer(heatLayer);
        } catch (e) {
          console.warn('Failed to render heatmap for cluster', cluster.clusterId, e);
        }
      }

      if (showPointsLayer) {
        const markerMap: Record<string, L.CircleMarker> = {};
        cluster.clusterItems.forEach(item => {
          const key = `${item.latitude.toFixed(6)}_${item.longitude.toFixed(6)}`;
          if (!markerMap[key]) {
            const marker = L.circleMarker([item.latitude, item.longitude], {
              color: "#AAA",
              weight: 1,
              fillColor: clusterColor,
              fillOpacity: 0.8,
              radius: 5
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
  }, [filteredClusters, center, zoom, viewMode, clusterColorsMapping, crimeTypeEnum]);

  const [showFilters, setShowFilters] = useState(true);

  const crimeTypeEntries = useMemo(
    () => Object.entries(crimeTypeEnum).filter(([id]) => parseInt(id) >= 0),
    [crimeTypeEnum]
  );

  const displaySummary = useMemo(() => {
    if (!filteredClusters.length) return null;
    const allItems = filteredClusters.flatMap(c => c.clusterItems);
    const totalItems = allItems.length;
    const precincts = new Set(allItems.map(i => i.precinct));
    const crimeTypes = new Set(allItems.map(i => i.crimeType));

    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    allItems.forEach(i => {
      const d = new Date(i.year, i.month - 1, i.day);
      if (isNaN(d.getTime())) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });

    const crimeTypeBreakdown: Record<string, number> = {};
    allItems.forEach(i => {
      const label = crimeTypeEnum[i.crimeType] || `Type ${i.crimeType}`;
      crimeTypeBreakdown[label] = (crimeTypeBreakdown[label] || 0) + 1;
    });
    const topCrimes = Object.entries(crimeTypeBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const totalClusters = filteredClusters.length;
    const parts: string[] = [
      `Currently displaying ${totalItems.toLocaleString()} incident${totalItems !== 1 ? 's' : ''} across ${totalClusters} cluster${totalClusters !== 1 ? 's' : ''} and ${precincts.size} barangay${precincts.size !== 1 ? 's' : ''}.`
    ];
    if (minDate && maxDate) {
      const minStr = format(minDate, 'MMM dd, yyyy');
      const maxStr = format(maxDate, 'MMM dd, yyyy');
      parts.push(`Date range: ${minStr} — ${maxStr}.`);
    }
    if (topCrimes.length > 0) {
      const crimeStr = topCrimes.map(([name, count]) => `${name} (${count})`).join(', ');
      parts.push(`Top crime type${topCrimes.length > 1 ? 's' : ''}: ${crimeStr}.`);
    }

    return parts.join(' ');
  }, [filteredClusters, crimeTypeEnum]);

  const hasData = clusters && clusters.length > 0;

  const mapEl = (
    <>
      {hasData ? (
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
                Post-Analysis Filters
              </button>
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                {(['points', 'heatmap', 'both'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2 py-1 text-xs rounded border transition ${
                      viewMode === mode
                        ? 'bg-ubuntu-500 text-white border-ubuntu-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'points' ? '📍Pts' : mode === 'heatmap' ? '🔥Heat' : 'Both'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={showPrecincts} onChange={e => setShowPrecincts(e.target.checked)} className="accent-blue-600" />
                  Precincts
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input type="checkbox" checked={stepwise} onChange={e => { setStepwise(e.target.checked); setPlay(false); }} className="accent-blue-600" />
                  Trends
                </label>
              </div>
              </div>
            </div>

          {showFilters && (
            <div className="space-y-3">
              {stepwise && (
                <div className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setPlay(!play)} className="px-3 py-1 text-xs font-medium bg-ubuntu-500 text-white rounded hover:bg-ubuntu-700">{play ? '⏸' : '▶'} {play ? 'Pause' : 'Play'}</button>
                    <button onClick={() => setCurrentStep(p => Math.max(p - 1, 0))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">◀</button>
                    <button onClick={() => setCurrentStep(p => Math.min(p + 1, uniqueSteps.length - 1))} className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50">▶</button>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-ubuntu-700 text-xs font-semibold">
                    {(() => { const [y, m] = uniqueSteps[currentStep].split('-').map(Number); return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(new Date(y, m - 1)); })()}
                  </span>
                </div>
              )}

              {!stepwise && (
                <div className="p-2.5 bg-gray-50 rounded-lg border space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">Month:</span>
                    {[...Array(12)].map((_, i) => {
                      const m = i + 1;
                      return (
                        <button key={m} onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                          className={`px-2 py-0.5 border rounded text-xs ${selectedMonths.includes(m) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                        >{m}</button>
                      );
                    })}
                    <span className="text-xs font-medium text-gray-600 ml-1">Year:</span>
                    {uniqueYears.map(y => (
                      <button key={y} onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                        className={`px-2 py-0.5 border rounded text-xs ${selectedYears.includes(y) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
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
                            className={`px-2 py-0.5 border rounded text-xs whitespace-nowrap ${selectedCrimeTypes.includes(crimeId) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
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

          {displaySummary && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 leading-relaxed">
              {displaySummary}
            </div>
          )}

          <div id="map" ref={mapRef} style={{ height: '500px', width: '100%' }} className="rounded-lg border border-gray-200 z-0" />

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

  return <div className="space-y-4">{mapEl}</div>;


};

export default Map;
