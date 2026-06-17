'use client';

import { useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import type { HistoricalData, ForecastData } from '../../types/forecast/ForecastBaseTypes';
import ForecastSummaryReport from '../forecast/ManpowerAllocation';
import { loadForecastFromLocal } from '../api/utils/forecastApi';

function ManpowerPage() {
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);

  useEffect(() => {
    const local = loadForecastFromLocal();
    if (local) {
      setHistoricalData(local.historicalData || []);
      setForecastData(local.predictions || []);
    }
  }, []);

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />

      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Forecast Summary Report</h1>
        <p className="text-gray-600">Predicted crime counts by precinct with trend and risk analysis</p>
      </div>

      <ForecastSummaryReport
        historicalData={historicalData}
        forecastData={forecastData}
      />
    </div>
  );
}

export default withAuth(ManpowerPage);
