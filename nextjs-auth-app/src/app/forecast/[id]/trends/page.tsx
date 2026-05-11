'use client';

import { useForecast } from '../../ForecastContext';
import TrendAnalysis from '../../TrendAnalysis';

export default function TrendsPage() {
  const { historicalData, forecastData } = useForecast();

  return (
    <TrendAnalysis
      historicalData={historicalData}
      forecastData={forecastData}
    />
  );
}
