import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Cluster {
  clusterId: number;
  caseId: string;
  crimeType: number;
  timeStamp: string;
  address: string;
  latitude: number;
  longitude: number;
  severity: number;
  policeDistrict: number;
  weather: number;
  crimeMotive: number;
}

interface MapProps {
  center: [number, number];
  zoom: number;
  clusters: Cluster[];
  clusterColorsMapping: Record<number, string>;
}

const Map: React.FC<MapProps> = ({ center, zoom, clusters, clusterColorsMapping }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && !leafletMap.current) {
      leafletMap.current = L.map(mapRef.current).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(leafletMap.current);
    }

    if (leafletMap.current) {
      clusters.forEach((cluster) => {
        const color = clusterColorsMapping[cluster.clusterId] || '#D3D3D3';

        L.circleMarker([cluster.latitude, cluster.longitude], {
          color: '#FFF',
          fillColor: color,
          fillOpacity: 1,
          radius: 8,
        })
          .addTo(leafletMap.current)
          .bindPopup(`
            <div>
              <p><strong>Cluster ID:</strong> ${cluster.clusterId}</p>
              <p><strong>Case ID:</strong> ${cluster.caseId}</p>
              <p><strong>Crime Type:</strong> ${cluster.crimeType}</p>
              <p><strong>Severity:</strong> ${cluster.severity}</p>
              <p><strong>Address:</strong> ${cluster.address}</p>
            </div>
          `);
      });
    }
  }, [center, zoom, clusters, clusterColorsMapping]);

  return <div id="map" ref={mapRef} style={{ height: '500px', width: '100%' }} />;
};

export default Map;
