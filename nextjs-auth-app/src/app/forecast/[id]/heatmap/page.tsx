'use client';

import { useForecast } from '../../ForecastContext';
import RiskHeatmap from '../../RiskHeatmap';

export default function HeatmapPage() {
  const { forecastData, dataQuality } = useForecast();

  return (
    <RiskHeatmap
      forecastData={forecastData}
      dataQuality={dataQuality}
    />
  );
}
