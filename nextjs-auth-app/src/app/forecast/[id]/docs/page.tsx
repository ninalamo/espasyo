'use client';

import { useForecast } from '../../ForecastContext';
import ForecastDocumentation from '../../ForecastDocumentation';

export default function DocsPage() {
  const { historicalData, forecastData } = useForecast();

  return (
    <ForecastDocumentation
      historicalData={historicalData}
      forecastData={forecastData}
    />
  );
}
