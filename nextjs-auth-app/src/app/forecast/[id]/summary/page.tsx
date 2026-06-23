'use client';

import { useEffect, useState } from 'react';
import { useForecast } from '../../ForecastContext';
import ForecastSummary from '../../ForecastSummary';
import { forecastApi } from '../../../api/utils/forecastApi';
import type { ForecastEvaluationResult } from '../../../../types/forecast/ForecastBaseTypes';

export default function SummaryPage() {
  const { forecastData, forecastParams, historicalData, forecastMetrics, forecastId, forecast } = useForecast();
  const [evaluation, setEvaluation] = useState<ForecastEvaluationResult | null>(null);

  useEffect(() => {
    if (forecastId && !forecastId.startsWith('local-')) {
      forecastApi.evaluate(forecastId)
        .then(setEvaluation)
        .catch(() => {});
    }
  }, [forecastId]);

  return (
    <ForecastSummary
      historicalData={historicalData}
      forecastData={forecastData}
      params={forecastParams}
      createdAt={forecast?.createdAt}
      metrics={forecastMetrics}
      evaluation={evaluation}
    />
  );
}
