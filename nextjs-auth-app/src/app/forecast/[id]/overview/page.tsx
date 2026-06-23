'use client';

import { useEffect, useState } from 'react';
import { useForecast } from '../../ForecastContext';
import ForecastSummary from '../../ForecastSummary';
import TrendAnalysis from '../../TrendAnalysis';
import { forecastApi } from '../../../api/utils/forecastApi';
import type { ForecastEvaluationResult } from '../../../../types/forecast/ForecastBaseTypes';

export default function OverviewPage() {
  const { forecastData, filteredForecastData, forecastParams, historicalData, forecastMetrics, forecastId, forecast } = useForecast();
  const [evaluation, setEvaluation] = useState<ForecastEvaluationResult | null>(null);

  useEffect(() => {
    if (forecastId && !forecastId.startsWith('local-')) {
      forecastApi.evaluate(forecastId)
        .then(setEvaluation)
        .catch(() => {});
    }
  }, [forecastId]);

  if (forecastData.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No forecast data available.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ForecastSummary
        historicalData={historicalData}
        forecastData={forecastData}
        params={forecastParams}
        createdAt={forecast?.createdAt}
        metrics={forecastMetrics}
        evaluation={evaluation}
      />
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Trend Analysis</h2>
        <TrendAnalysis
          historicalData={historicalData}
          forecastData={filteredForecastData}
          forecastId={forecastId}
        />
      </div>
    </div>
  );
}
