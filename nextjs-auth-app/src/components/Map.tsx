'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import * as turf from '@turf/turf';
import { Cluster } from '../types/analysis/ClusterDto';

const crimeTypeEnum: Record<number, string> = {
  0: "Arson", 1: "Assault", 2: "Burglary", 3: "Corruption", 4: "Counterfeiting",
  5: "CyberCrime", 6: "DomesticViolence", 7: "DrugTrafficking", 8: "Embezzlement", 9: "Extortion",
  10: "Fraud", 11: "HumanTrafficking", 12: "Homicide", 13: "IllegalPossessionOfFirearms", 14: "Kidnapping",
  15: "Murder", 16: "Rape", 17: "Robbery", 18: "Theft", 19: "Vandalism"
};

interface MapProps {
  center: [number, number];
  zoom: number;
  clusters: Cluster[];
  clusterColorsMapping: Record<number, string>;
}

const Map: React.FC<MapProps> = ({ center, zoom, clusters, clusterColorsMapping }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayersRef = useRef<L.LayerGroup | null>(null);
  const envelopeLayersRef = useRef<L.LayerGroup | null>(null);

  const [showPoints, setShowPoints] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);
  const [stepwise, setStepwise] = useState(false);
  const [play, setPlay] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<number[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const uniqueSteps = Array.from(
    new Set(
      clusters.flatMap(c =>
        c.clusterItems.map(i => `${i.year}-${i.month.toString().padStart(2, '0')}`)
      )
    )
  ).sort();

  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const hasData = filteredClusters.length > 0;

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
  }, [clusters, stepwise, currentStep, selectedMonths, selectedYears, selectedCrimeTypes]);

  useEffect(() => {
    if (play && stepwise && uniqueSteps.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % uniqueSteps.length);
      }, 2000);
    } else {
      clearInterval(intervalRef.current!);
    }
    return () => clearInterval(intervalRef.current!);
  }, [play, stepwise]);

  useEffect(() => {
    if (!mapRef.current || !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(leafletMap.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
      heatLayersRef.current = L.layerGroup().addTo(leafletMap.current);
      envelopeLayersRef.current = L.layerGroup().addTo(leafletMap.current);
    }

    markersLayerRef.current?.clearLayers();
    heatLayersRef.current?.clearLayers();
    envelopeLayersRef.current?.clearLayers();

    if (!hasData) return;

    filteredClusters.forEach(cluster => {
      const clusterColor = clusterColorsMapping[cluster.clusterId] || "#D3D3D3";

      if (showEnvelope && cluster.clusterItems.length > 2) {
        const points = cluster.clusterItems.map(i => [i.latitude, i.longitude] as [number, number]);
        const fc = turf.featureCollection(points.map(pt => turf.point([pt[1], pt[0]])));
        const hull = turf.convex(fc) || turf.bboxPolygon(turf.bbox(fc));
        const buffered = turf.buffer(hull, 0.3, { units: 'kilometers' });
        const coords = buffered.geometry.coordinates[0];
        const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
        L.polygon(latLngs, { stroke: false, fillColor: clusterColor, fillOpacity: 0.3 }).addTo(envelopeLayersRef.current!);
      }

      if (showHeat && cluster.clusterItems.length > 3) {
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

      if (showPoints) {
        const markerMap: Record<string, L.CircleMarker> = {};
        cluster.clusterItems.forEach(item => {
          const key = `${item.latitude.toFixed(6)}_${item.longitude.toFixed(6)}`;
          if (!markerMap[key]) {
            const marker = L.circleMarker([item.latitude, item.longitude], {
              color: "#AAA", weight: 1, fillColor: clusterColor, fillOpacity: 0.8, radius: 5
            })
              .addTo(markersLayerRef.current!)
              .bindPopup(`
                <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
                <p><strong>Case ID:</strong> ${item.caseId}</p>
              `);
            markerMap[key] = marker;
          } else {
            const existing = markerMap[key];
            const popup = existing.getPopup();
            const content = `<p><strong>Case ID:</strong> ${item.caseId}</p>`;
            if (popup) {
              existing.setPopupContent(popup.getContent() + content);
            }
          }
        });
      }
    });
  }, [filteredClusters, center, zoom, showPoints, showHeat, showEnvelope, hasData]);

  const uniqueYears = Array.from(new Set(clusters.flatMap(c => c.clusterItems.map(i => i.year)))).sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {[
          { label: "Show Points", state: showPoints, setState: setShowPoints },
          { label: "Show Heatmap", state: showHeat, setState: setShowHeat },
          { label: "Show Envelope", state: showEnvelope, setState: setShowEnvelope },
          {
            label: "Step-wise",
            state: stepwise,
            setState: (v: boolean) => {
              setStepwise(v);
              setPlay(false);
            }
          }
        ].map(({ label, state, setState }) => (
          <label key={label} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={state}
              onChange={e => setState(e.target.checked)}
              disabled={!hasData}
            />
            <span className={hasData ? "" : "text-gray-400"}>{label}</span>
          </label>
        ))}
      </div>

      {hasData && (
        <div className="space-y-2">
          {stepwise && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPlay(!play)} className="px-3 py-1 bg-blue-600 text-white rounded">{play ? "Pause" : "Play"}</button>
              <button onClick={() => setCurrentStep(p => Math.max(p - 1, 0))} className="px-3 py-1 bg-gray-200 rounded">Previous</button>
              <button onClick={() => setCurrentStep(p => Math.min(p + 1, uniqueSteps.length - 1))} className="px-3 py-1 bg-gray-200 rounded">Next</button>
              <span className="ml-2 text-sm text-gray-700">Step: {uniqueSteps[currentStep]}</span>
            </div>
          )}

          <div>
            <span className="font-medium text-sm">Filter by Crime Type:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(crimeTypeEnum).map(([id, label]) => {
                const crimeId = parseInt(id);
                return (
                  <button
                    key={id}
                    onClick={() =>
                      setSelectedCrimeTypes(prev =>
                        prev.includes(crimeId) ? prev.filter(x => x !== crimeId) : [...prev, crimeId]
                      )
                    }
                    className={`px-2 py-1 border rounded text-xs ${selectedCrimeTypes.includes(crimeId) ? 'bg-blue-600 text-white' : ''}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {!stepwise && (
            <>
              <div>
                <span className="font-medium text-sm">Filter by Month:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {[...Array(12)].map((_, i) => {
                    const m = i + 1;
                    return (
                      <button
                        key={m}
                        onClick={() =>
                          setSelectedMonths(prev =>
                            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                          )
                        }
                        className={`px-2 py-1 border rounded text-sm ${selectedMonths.includes(m) ? 'bg-blue-600 text-white' : ''}`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="font-medium text-sm">Filter by Year:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {uniqueYears.map(y => (
                    <button
                      key={y}
                      onClick={() =>
                        setSelectedYears(prev =>
                          prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]
                        )
                      }
                      className={`px-2 py-1 border rounded text-sm ${selectedYears.includes(y) ? 'bg-blue-600 text-white' : ''}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => {
              setSelectedMonths([]);
              setSelectedYears([]);
              setSelectedCrimeTypes([]);
            }}
            className="px-3 py-1 bg-gray-300 text-sm rounded"
          >
            Show All
          </button>
        </div>
      )}

      <div id="map" ref={mapRef} style={{ height: "500px", width: "100%" }} />
    </div>
  );
};

export default Map;
