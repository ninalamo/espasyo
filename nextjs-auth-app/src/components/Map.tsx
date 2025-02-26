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
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(leafletMap.current);

      markersLayerRef.current = L.layerGroup().addTo(leafletMap.current);
    }

    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    if (leafletMap.current && markersLayerRef.current) {
      clusters.forEach((cluster) => {
        const color = clusterColorsMapping[cluster.clusterId] || '#D3D3D3';

        // Render cluster item markers
        cluster.clusterItems.forEach((item) => {
          L.circleMarker([item.latitude, item.longitude], {
            color: '#FFF',
            fillColor: color,
            fillOpacity: 1,
            radius: 8,
          })
            .addTo(markersLayerRef.current!)
            .bindPopup(`
              <div>
                <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
                <p><strong>Case ID:</strong> ${item.caseId}</p>
              </div>
            `);
        });
        console.log(cluster.centroids);
        // Render centroid marker if available (using a distinct icon or style)
        if (cluster.centroids && cluster.centroids.length === 2) {
          L.marker([cluster.centroids[0], cluster.centroids[1]], {
            icon: L.icon({
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', // Change to your custom centroid icon if desired
            iconSize: [30, 41],
            iconAnchor: [15, 41],
            popupAnchor: [0, -41]
          })
        })
        .addTo(markersLayerRef.current!)
        .bindPopup(`
          <div>
            <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
            <p><strong>Centroid</strong></p>
          </div>
        `);
        }
      });
    }
  }, [center, zoom, clusters, clusterColorsMapping]);

  return <div id="map" ref={mapRef} style={{ height: '500px', width: '100%' }} />;
};

export default Map;
