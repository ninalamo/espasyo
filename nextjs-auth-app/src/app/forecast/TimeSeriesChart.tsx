'use client';

import { useMemo } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format, startOfMonth } from 'date-fns';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
}

interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ForecastParams {
  model: string;
  forecastPeriod: number;
}

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  params: ForecastParams;
}

const TimeSeriesChart: React.FC<Props> = ({ historicalData, forecastData, params }) => {
  const chartData = useMemo(() => {
    if (historicalData.length === 0 && forecastData.length === 0) {
      return null;
    }

    // Aggregate historical data by month
    const historicalByMonth = historicalData.reduce((acc, item) => {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key] += item.count;
      return acc;
    }, {} as Record<string, number>);

    // Aggregate forecast data by month
    const forecastByMonth = forecastData.reduce((acc, item) => {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      if (!acc[key]) {
        acc[key] = { total: 0, confidence: 0, count: 0 };
      }
      acc[key].total += item.predictedCount;
      acc[key].confidence += item.confidence;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { total: number; confidence: number; count: number }>);

    // Create combined timeline
    const allDates = new Set([
      ...Object.keys(historicalByMonth),
      ...Object.keys(forecastByMonth)
    ]);

    const sortedDates = Array.from(allDates).sort();

    // Separate historical and forecast data
    const historicalValues: (number | null)[] = [];
    const forecastValues: (number | null)[] = [];
    const confidenceUpper: (number | null)[] = [];
    const confidenceLower: (number | null)[] = [];

    sortedDates.forEach(date => {
      const historical = historicalByMonth[date];
      const forecast = forecastByMonth[date];

      if (historical !== undefined) {
        historicalValues.push(historical);
        forecastValues.push(null);
        confidenceUpper.push(null);
        confidenceLower.push(null);
      } else if (forecast !== undefined) {
        const avgConfidence = forecast.confidence / forecast.count;
        const margin = forecast.total * (1 - avgConfidence) * 0.5;
        
        historicalValues.push(null);
        forecastValues.push(forecast.total);
        confidenceUpper.push(forecast.total + margin);
        confidenceLower.push(forecast.total - margin);
      } else {
        historicalValues.push(null);
        forecastValues.push(null);
        confidenceUpper.push(null);
        confidenceLower.push(null);
      }
    });

    // Format labels
    const labels = sortedDates.map(date => {
      const [year, month] = date.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy');
    });

    return {
      labels,
      datasets: [
        {
          label: 'Historical Data',
          data: historicalValues,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Forecast',
          data: forecastValues,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
        {
          label: 'Confidence Upper',
          data: confidenceUpper,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1,
          fill: '+1',
          tension: 0.1,
          pointRadius: 0,
          borderDash: [2, 2],
        },
        {
          label: 'Confidence Lower',
          data: confidenceLower,
          borderColor: 'rgba(239, 68, 68, 0.3)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1,
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderDash: [2, 2],
        },
      ],
    };
  }, [historicalData, forecastData]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: (legendItem: any) => {
            // Hide confidence bound labels in legend
            return !legendItem.text.includes('Confidence');
          },
        },
      },
      title: {
        display: true,
        text: `Crime Forecast Time Series (${params.model.toUpperCase()} Model)`,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (context: any) => {
            return `Period: ${context[0]?.label}`;
          },
          label: (context: any) => {
            const label = context.dataset.label;
            const value = context.parsed.y;
            
            if (label.includes('Confidence')) {
              return null; // Hide confidence bounds in tooltip
            }
            
            if (value === null) return null;
            
            return `${label}: ${Math.round(value)} cases`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Period',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Number of Cases',
          font: {
            size: 14,
            weight: 'bold',
          },
        },
        beginAtZero: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  if (!chartData) {
    return (
      <div className="text-center text-gray-500 py-8">
        No time series data available for visualization.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-800 mb-2">Historical vs Predicted Crime Trends</h3>
        <p className="text-sm text-gray-600">
          This chart shows historical crime data (blue solid line) compared with future predictions (red dashed line). 
          The shaded area represents the confidence interval of the forecast.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div style={{ height: '400px' }}>
          <Line data={chartData} options={options} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-500 rounded mr-3"></div>
            <div>
              <p className="font-medium text-blue-900">Historical Data</p>
              <p className="text-sm text-blue-700">Actual recorded crime incidents</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center">
            <div className="w-4 h-1 bg-red-500 mr-3" style={{ borderStyle: 'dashed', borderWidth: '1px 0' }}></div>
            <div>
              <p className="font-medium text-red-900">Forecast Prediction</p>
              <p className="text-sm text-red-700">Predicted future crime incidents</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-200 rounded mr-3"></div>
            <div>
              <p className="font-medium text-gray-900">Confidence Interval</p>
              <p className="text-sm text-gray-700">Range of prediction uncertainty</p>
            </div>
          </div>
        </div>
      </div>

      {forecastData.length > 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="font-medium text-yellow-800 mb-1">Model Information</p>
              <p className="text-sm text-yellow-700">
                Predictions are generated using the {params.model.toUpperCase()} model. 
                Confidence decreases with longer prediction horizons. 
                Results should be used as guidance alongside other factors for decision-making.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeSeriesChart;
