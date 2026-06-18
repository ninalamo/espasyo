'use client';

import { useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import Link from 'next/link';
import { format } from 'date-fns';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { forecastApi } from '../api/utils/forecastApi';
import type { ForecastSummaryCard } from '../../types/forecast/ForecastBaseTypes';

function ForecastDashboard() {
  const [savedForecasts, setSavedForecasts] = useState<ForecastSummaryCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const apiForecasts = await forecastApi.list();
      setSavedForecasts(apiForecasts);
      setLoading(false);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await forecastApi.delete(id);
      setSavedForecasts(prev => prev.filter(f => f.id !== id));
    } catch {
      setSavedForecasts(prev => prev.filter(f => f.id !== id));
    }
  };

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Forecasting</h1>
          <p className="text-gray-600">Predict future crime patterns based on historical analysis</p>
        </div>
        <Link
          href="/forecast/new"
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition flex items-center font-medium shadow-lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Forecast
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : savedForecasts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Forecasts Yet</h3>
            <p className="text-gray-500 mb-6">Generate your first forecast from clustering analysis data to predict future crime patterns.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/forecast/new"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Forecast
              </Link>
              <Link
                href="/analysis"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Run Analysis First
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {savedForecasts.map(f => (
            <div key={f.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">{f.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {f.createdAt ? format(new Date(f.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown'} &middot;
                    {f.forecastPeriod}mo forecast &middot;
                    {f.totalPredictions} predictions &middot;
                    {f.precinctCount} precincts &middot;
                    {f.crimeTypeCount} crime types
                  </p>
                  <span className="inline-block mt-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                    {f.activeModel}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/forecast/${f.id}/summary`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="text-gray-400 hover:text-red-600 transition p-2"
                    title="Delete forecast"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default withAuth(ForecastDashboard);
