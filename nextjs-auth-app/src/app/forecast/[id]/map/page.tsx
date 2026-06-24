'use client';

import dynamic from 'next/dynamic';
import { useForecast } from '../../ForecastContext';

const ForecastMap = dynamic(() => import('../../ForecastMap'), { ssr: false });

export default function MapPage() {
  const { forecastMapPoints, loading } = useForecast();

  return (
    <ForecastMap
      center={[14.4081, 121.0415]}
      zoom={13}
      forecastPoints={forecastMapPoints}
      loading={loading}
    />
  );
}
