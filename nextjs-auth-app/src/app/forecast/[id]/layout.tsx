'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ToastContainer } from 'react-toastify';
import { ForecastProvider, useForecast } from '../ForecastContext';

const TAB_NAV = [
  { key: 'overview', label: 'Overview', icon: '📊' },
] as const;

function ForecastDetailInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  useForecast();

  const currentTab = TAB_NAV.find(t => pathname.includes(`/${t.key}`))?.key || 'overview';
  const forecastId = params.id as string;

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />

      <div className="flex items-center justify-between mb-2">
        <Link href="/forecast" className="text-ubuntu-600 hover:text-blue-800 text-sm flex items-center">
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
                    ? 'text-ubuntu-700 bg-white border-b-2 border-ubuntu-500'
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
          {children}
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
