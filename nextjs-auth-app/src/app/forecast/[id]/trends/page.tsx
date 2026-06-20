'use client';

import { useForecast } from '../../ForecastContext';
import TrendAnalysis from '../../TrendAnalysis';

export default function TrendsPage() {
  const { historicalData, filteredForecastData, forecastData, forecastId } = useForecast();

  return (
    <TrendAnalysis
      historicalData={historicalData}
      forecastData={filteredForecastData}
      forecastId={forecastId}
    />
  );
}
