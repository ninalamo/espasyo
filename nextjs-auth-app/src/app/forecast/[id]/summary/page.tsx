'use client';

import { useForecast } from '../../ForecastContext';
import ForecastSummary from '../../ForecastSummary';

export default function SummaryPage() {
  const { forecastData, forecastParams, manpowerSettings, historicalData } = useForecast();

  return (
    <ForecastSummary
      historicalData={historicalData}
      forecastData={forecastData}
      params={forecastParams}
      manpowerSettings={manpowerSettings}
    />
  );
}
