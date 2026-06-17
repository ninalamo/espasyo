'use client';

import ForecastSummary from './ForecastSummary';
import type { HistoricalData, ForecastData } from '../../types/forecast/ForecastBaseTypes';

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
}

const ForecastSummaryReport: React.FC<Props> = ({ historicalData, forecastData }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Forecast Summary Report</h2>
        <p className="text-gray-600 mb-6">
          Predicted crime counts by precinct, trend analysis, and risk assessment based on SSA forecasting.
        </p>
        <ForecastSummary
          historicalData={historicalData}
          forecastData={forecastData}
          params={{ forecastPeriod: 6, model: 'polynomial', confidence: 0.95, includeSeasonality: true, weightRecentData: true }}
        />
      </div>
    </div>
  );
};

export default ForecastSummaryReport;
