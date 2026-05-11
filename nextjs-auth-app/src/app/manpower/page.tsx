'use client';

import { useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import type { HistoricalData, ForecastData } from '../../types/forecast/ForecastBaseTypes';
import type { ManpowerAllocation } from '../../types/forecast/ExtendedForecastTypes';
import { DEFAULT_MANPOWER_ALLOCATION } from '../../types/forecast/ExtendedForecastTypes';
import ManpowerAllocationComponent from '../forecast/ManpowerAllocation';
import { loadForecastFromLocal } from '../api/utils/forecastApi';

function ManpowerPage() {
  const [manpowerSettings, setManpowerSettings] = useState<ManpowerAllocation>(DEFAULT_MANPOWER_ALLOCATION);
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Manpower Allocation</h1>
        <p className="text-gray-600">Manage and optimize police officer deployment across precincts and shifts</p>
      </div>

      <ManpowerAllocationComponent
        historicalData={historicalData}
        forecastData={forecastData}
        manpowerSettings={manpowerSettings}
        onSettingsChange={setManpowerSettings}
      />
    </div>
  );
}

export default withAuth(ManpowerPage);
