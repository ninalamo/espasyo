'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ToastContainer } from 'react-toastify';
import { ForecastProvider, useForecast } from '../ForecastContext';

const TAB_NAV = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'map', label: 'Forecast Map', icon: '🗺️' },
] as const;

function ForecastDetailInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const forecastCtx = useForecast();
  const { forecastData, loading } = forecastCtx;

  const currentTab = TAB_NAV.find(t => pathname.includes(`/${t.key}`))?.key || 'overview';
  const forecastId = params.id as string;

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />

      <div className="flex items-center justify-between mb-2">
        <Link href="/forecast" className="text-blue-600 hover:text-blue-800 text-sm flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Forecasts
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {TAB_NAV.map(tab => {
            const isActive = currentTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={`/forecast/${forecastId}/${tab.key}`}
                className={`flex-1 py-3 px-4 text-sm font-medium text-center transition ${
                  isActive
                    ? 'text-blue-700 bg-white border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForecastDetailLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const forecastId = params.id as string;

  return (
    <ForecastProvider forecastId={forecastId}>
      <ForecastDetailInner>
        {children}
      </ForecastDetailInner>
    </ForecastProvider>
  );
}
