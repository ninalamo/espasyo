'use client';

import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import 'chart.js/auto';
import { ChartOptions } from 'chart.js';
import { ClusterItem } from '../types/analysis/ClusterDto';

const timeSlots: string[] = ['Morning', 'Afternoon', 'Evening'];

const timeOfDayColors: Record<string, string> = {
  Morning: '#FFCE56',
  Afternoon: '#36A2EB',
  Evening: '#FF6384',
};

interface Props {
  items: ClusterItem[];
}

export const TimeOfDayDistributionChart: React.FC<Props> = ({ items }) => {
  const counts = useMemo(() => {
    const tally: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0 };
    items?.forEach((item) => {
      const slot = item.timeOfDay;
      if (slot in tally) tally[slot] += 1;
    });
    return tally;
  }, [items]);

  if (!items || items.length === 0) return null;

  const data = {
    labels: timeSlots,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Incidents',
        data: timeSlots.map((slot) => counts[slot]),
        backgroundColor: timeSlots.map((slot) => timeOfDayColors[slot]),
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Incidents by Time of Day',
        font: { size: 14, weight: 600 },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Time of Day' } },
      y: { title: { display: true, text: 'Incident Count' }, beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  const total = items.length;

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Incidents by Time of Day</h3>
        <span className="text-sm text-gray-600">Total incidents: {total}</span>
      </div>
      <div style={{ height: 320 }}>
        <Chart type="bar" data={data} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        {timeSlots.map((slot) => (
          <div key={slot} className="flex items-center gap-2 p-2 rounded bg-gray-50">
            <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: timeOfDayColors[slot] }}></span>
            <span className="font-medium">{slot}</span>
            <span className="ml-auto font-semibold text-gray-800">{counts[slot]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
