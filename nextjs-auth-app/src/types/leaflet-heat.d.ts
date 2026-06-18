declare module 'leaflet.heat' {
  import * as L from 'leaflet';

  interface HeatLatLngTuple extends Array<number> {
    0: number;
    1: number;
    2?: number;
  }

  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  function heatLayer(latlngs: HeatLatLngTuple[], options?: HeatLayerOptions): L.Layer;

  export = heatLayer;
}
