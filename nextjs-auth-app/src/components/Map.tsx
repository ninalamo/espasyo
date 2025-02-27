import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat"; // Heatmap plugin
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

  // Toggle states for independent layer visibility
  const [showPoints, setShowPoints] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [showEnvelope, setShowEnvelope] = useState(true);

  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(leafletMap.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
      heatLayersRef.current = L.layerGroup().addTo(leafletMap.current);
      envelopeLayersRef.current = L.layerGroup().addTo(leafletMap.current);
    }

    // Clear all layers before redrawing
    markersLayerRef.current?.clearLayers();
    heatLayersRef.current?.clearLayers();
    envelopeLayersRef.current?.clearLayers();

    // **Modern Tesla Coil Icon (SVG)**
    const teslaCoilSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><title>circle</title><circle cx="512" cy="512" r="256" fill="#fafafa" fill-rule="evenodd"></circle></g></svg>
    `;

    // Process each cluster group independently
    clusters.forEach((cluster) => {
      const clusterColor = clusterColorsMapping[cluster.clusterId] || "#D3D3D3";

      // **Envelope Layer (Convex Hull)**
      if (showEnvelope && cluster.clusterItems.length > 2) {
        const points: [number, number][] = cluster.clusterItems.map(
          (item) => [item.latitude, item.longitude]
        );
        const turfPoints = points.map((pt) => turf.point([pt[1], pt[0]]));
        const fc = turf.featureCollection(turfPoints);
        let hull = turf.convex(fc);
        if (!hull) {
          const bbox = turf.bbox(fc);
          hull = turf.bboxPolygon(bbox);
        }
        const bufferedHull = turf.buffer(hull, 0.3, { units: "kilometers" });
        if (bufferedHull && bufferedHull.geometry.type === "Polygon") {
          const coordinates = bufferedHull.geometry.coordinates[0];
          const latLngs = coordinates.map(
            (coord) => [coord[1], coord[0]] as [number, number]
          );
          L.polygon(latLngs, {
            stroke: false,
            fillColor: clusterColor,
            fillOpacity: 0.3,
          }).addTo(envelopeLayersRef.current!);
        }
      }

      // **Heatmap Layer**
      if (showHeat && cluster.clusterItems.length > 3) {
        const heatData: [number, number, number][] = cluster.clusterItems.map(
          (item) => [item.latitude, item.longitude, 1]
        );
        const heatLayer = (L as any).heatLayer(heatData, {
          radius: 25,
          blur: 20,
          maxZoom: zoom,
          gradient: {
            0.2: "rgba(0,255,0,0.2)",
            0.4: "rgba(173,255,47,0.5)",
            0.6: "rgba(255,255,0,0.7)",
            0.8: "rgba(255,165,0,0.85)",
            1.0: "rgba(255,0,0,1.0)",
          },
        });
        heatLayersRef.current!.addLayer(heatLayer);
      }

      // **Points Layer**
      if (showPoints) {
        cluster.clusterItems.forEach((item) => {
          L.circleMarker([item.latitude, item.longitude], {
            color: "#AAA",
            weight: 1,
            fillColor: clusterColor,
            fillOpacity: 0.8,
            radius: 5,
          })
            .addTo(markersLayerRef.current!)
            .bindPopup(`
              <div>
                <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
                <p><strong>Case ID:</strong> ${item.caseId}</p>
              </div>
            `);
        });

        // **Tesla Coil Marker for Centroids**
        if (cluster.centroids && cluster.centroids.length === 2) {
          const teslaCoilIcon = L.divIcon({
            className: "tesla-coil-icon",
            html: teslaCoilSvg,
            iconSize: [40, 60],
            iconAnchor: [20, 60],
            popupAnchor: [0, -50],
          });

          // L.marker([cluster.centroids[0], cluster.centroids[1]], { icon: teslaCoilIcon })
          //   .addTo(markersLayerRef.current!)
          //   .bindPopup(`
          //     <div>
          //       <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
          //       <p><strong>Centroid</strong></p>
          //     </div>
          //   `);
        }
      }
    });
  }, [center, zoom, clusters, clusterColorsMapping, showPoints, showHeat, showEnvelope]);

  return (
    <div>
      <div className="flex justify-end space-x-4 mb-2">
        <label className="flex items-center space-x-1">
          <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />
          <span>Show Points</span>
        </label>
        <label className="flex items-center space-x-1">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          <span>Show Heatmap</span>
        </label>
        <label className="flex items-center space-x-1">
          <input type="checkbox" checked={showEnvelope} onChange={(e) => setShowEnvelope(e.target.checked)} />
          <span>Show Envelope</span>
        </label>
      </div>
      <div id="map" ref={mapRef} style={{ height: "500px", width: "100%" }} />
    </div>
  );
};

export default Map;
