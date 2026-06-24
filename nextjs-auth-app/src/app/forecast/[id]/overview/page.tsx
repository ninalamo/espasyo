'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forecast Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Review forecast results and build a manpower allocation plan</p>
        </div>
        <Link
          href={`/manpower?forecastId=${forecastId}`}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Build Manpower Plan
        </Link>
      </div>

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
