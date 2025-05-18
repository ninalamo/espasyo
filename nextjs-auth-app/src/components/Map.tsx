'use client';

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import * as turf from "@turf/turf";
import { Cluster } from "../types/analysis/ClusterDto";

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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const uniqueSteps = Array.from(
    new Set(
      clusters.flatMap(c =>
        c.clusterItems.map(i => `${i.year}-${i.month.toString().padStart(2, '0')}`)
      )
    )
  ).sort();

  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    const updateFilteredClusters = () => {
      let activeClusters = clusters;

      if (stepwise && uniqueSteps.length > 0) {
        const [y, m] = uniqueSteps[currentStep].split('-').map(Number);
        activeClusters = clusters.map(c => ({
          ...c,
          clusterItems: c.clusterItems.filter(i => i.year === y && i.month === m)
        })).filter(c => c.clusterItems.length > 0);
      } else if (selectedMonths.length || selectedYears.length) {
        activeClusters = clusters.map(c => ({
          ...c,
          clusterItems: c.clusterItems.filter(i =>
            (selectedMonths.length === 0 || selectedMonths.includes(i.month)) &&
            (selectedYears.length === 0 || selectedYears.includes(i.year))
          )
        })).filter(c => c.clusterItems.length > 0);
      }

      setFilteredClusters(activeClusters);
    };

    updateFilteredClusters();
  }, [clusters, stepwise, currentStep, selectedMonths, selectedYears]);

  useEffect(() => {
    if (play && stepwise && uniqueSteps.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % uniqueSteps.length);
      }, 2000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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


    filteredClusters.forEach(cluster => {
      const clusterColor = clusterColorsMapping[cluster.clusterId] || "#D3D3D3";

      if (showEnvelope && cluster.clusterItems.length > 2) {
        const points = cluster.clusterItems.map(i => [i.latitude, i.longitude] as [number, number]);
        const fc = turf.featureCollection(points.map(pt => turf.point([pt[1], pt[0]])));
        const hull = turf.convex(fc) || turf.bboxPolygon(turf.bbox(fc));
        const buffered = turf.buffer(hull, 0.3, { units: 'kilometers' });
        if (buffered.geometry.type === "Polygon") {
          const coords = buffered.geometry.coordinates[0];
          const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
          L.polygon(latLngs, { stroke: false, fillColor: clusterColor, fillOpacity: 0.3 }).addTo(envelopeLayersRef.current!);
        }
      }

      if (showHeat && cluster.clusterItems.length > 3) {
        const heatData = cluster.clusterItems.map(i => [i.latitude, i.longitude, 1]);
        const heatLayer = (L as any).heatLayer(heatData, {
          radius: 25, blur: 20, maxZoom: zoom,
          gradient: {
            0.2: "rgba(0,255,0,0.2)", 0.4: "rgba(173,255,47,0.5)",
            0.6: "rgba(255,255,0,0.7)", 0.8: "rgba(255,165,0,0.85)",
            1.0: "rgba(255,0,0,1.0)",
          }
        });
        heatLayersRef.current!.addLayer(heatLayer);
      }

      if (showPoints) {
        const markerMap: Record<string, L.CircleMarker> = {};
        cluster.clusterItems.forEach(item => {
          const key = `${item.latitude.toFixed(6)}_${item.longitude.toFixed(6)}`;
          if (markerMap[key]) {
            const existing = markerMap[key];
            const popup = existing.getPopup();
            const content = `<p><strong>Case ID:</strong> ${item.caseId}</p>`;
            if (popup) {
              existing.setPopupContent(popup.getContent() + content);
            } else {
              existing.bindPopup(content);
            }
          } else {
            const marker = L.circleMarker([item.latitude, item.longitude], {
              color: "#AAA", weight: 1, fillColor: clusterColor, fillOpacity: 0.8, radius: 5,
            })
              .addTo(markersLayerRef.current!)
              .bindPopup(`
                <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
                <p><strong>Case ID:</strong> ${item.caseId}</p>
              `);
            markerMap[key] = marker;
          }
        });
      }
    });
  }, [filteredClusters, center, zoom, showPoints, showHeat, showEnvelope]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-2">
        <label><input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} /> Show Points</label>
        <label><input type="checkbox" checked={showHeat} onChange={e => setShowHeat(e.target.checked)} /> Show Heatmap</label>
        <label><input type="checkbox" checked={showEnvelope} onChange={e => setShowEnvelope(e.target.checked)} /> Show Envelope</label>
        <label><input type="checkbox" checked={stepwise} onChange={e => {
          setStepwise(e.target.checked);
          setPlay(false);
        }} /> Step-wise</label>
        {stepwise ? (
          <>
            <button onClick={() => setPlay(!play)} className="px-2 py-1 bg-blue-600 text-white rounded">{play ? "Pause" : "Play"}</button>
            <button onClick={() => setCurrentStep(p => Math.max(p - 1, 0))} className="px-2 py-1 bg-gray-200 rounded">Previous</button>
            <button onClick={() => setCurrentStep(p => Math.min(p + 1, uniqueSteps.length - 1))} className="px-2 py-1 bg-gray-200 rounded">Next</button>
            <span>Step: {uniqueSteps[currentStep]}</span>
          </>
        ) : (
          <>
            <hr/>
            <div className="flex gap-2">
              <label>Filter Month:</label>
              {[...Array(12)].map((_, i) => {
                const m = i + 1;
                return (
                  <button
                    key={m}
                    onClick={() => setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                    className={`px-2 py-1 border rounded ${selectedMonths.includes(m) ? 'bg-blue-600 text-white' : ''}`}
                  >{m}</button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <label>Filter Year:</label>
              {Array.from(new Set(clusters.flatMap(c => c.clusterItems.map(i => i.year)))).sort().map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y])}
                  className={`px-2 py-1 border rounded ${selectedYears.includes(y) ? 'bg-blue-600 text-white' : ''}`}
                >{y}</button>
              ))}
            </div>
            <button onClick={() => { setSelectedMonths([]); setSelectedYears([]); }} className="px-2 py-1 bg-gray-300 rounded">Show All</button>
          </>
        )}
      </div>
      <div id="map" ref={mapRef} style={{ height: "500px", width: "100%" }} />
    </div>
  );
};

export default Map;
