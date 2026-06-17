'use client';

import { useForecast } from '../../ForecastContext';
import ForecastDocumentation from '../../ForecastDocumentation';

export default function DocsPage() {
  const { historicalData, forecastData, forecastMetrics } = useForecast();

  return (
    <ForecastDocumentation
      historicalData={historicalData}
      forecastData={forecastData}
      metrics={forecastMetrics}
    />
  );
}
