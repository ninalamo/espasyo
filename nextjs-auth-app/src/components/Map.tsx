import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cluster } from '../types/analysis/ClusterDto';

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

  useEffect(() => {
    // Initialize map if not already initialized
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(leafletMap.current);

      // Create a layer group for markers and add it to the map
      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
    }

    // Clear existing markers
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    // Add markers for each cluster
    if (leafletMap.current && markersLayerRef.current) {
      clusters.forEach((cluster) => {
        const color = clusterColorsMapping[cluster.clusterId] || '#D3D3D3';
        console.log("Cluster ID: ", cluster.clusterId);
        console.log("Color: ", color);

        cluster.clusterItems.forEach((clusterItem) => {
          L.circleMarker([clusterItem.latitude, clusterItem.longitude], {
            color: '#FFF',
            fillColor: color,
            fillOpacity: 1,
            radius: 8,
          })
            .addTo(markersLayerRef.current!)
            .bindPopup(`
              <div>
                <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
                <p><strong>Case ID:</strong> ${clusterItem.caseId}</p>
              </div>
            `);
        });
      });
    }
  }, [center, zoom, clusters, clusterColorsMapping]);

  return <div id="map" ref={mapRef} style={{ height: '500px', width: '100%' }} />;
};

export default Map;
