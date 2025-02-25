import React from 'react';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto';

interface ScatterPlotProps {
  data: { clusterId: number; x: number; y: number; caseId?: string; [key: string]: any }[];
  clusterColorsMapping: { [key: number]: string };
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, clusterColorsMapping }) => {
  // Ensure the x and y values are numbers
  const sanitizedData = data.map((point) => ({
    ...point,
    x: typeof point.x === 'number' ? point.x : parseFloat(point.x),
    y: typeof point.y === 'number' ? point.y : parseFloat(point.y)
  }));

  // Get distinct cluster IDs from the data and sort them in ascending order.
  const distinctClusters = Array.from(new Set(sanitizedData.map(d => d.clusterId))).sort((a, b) => a - b);

  // Create a dataset for each distinct cluster.
  const datasets = distinctClusters.map((clusterId) => ({
    label: `Cluster ${clusterId}`,
    data: sanitizedData.filter(d => d.clusterId === clusterId),
    backgroundColor: clusterColorsMapping[clusterId] || '#D3D3D3'
  }));

  const options = {
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const point = context.raw;
            // Format the x and y values to 6 decimal places for display
            const xFormatted = point.x.toFixed(6);
            const yFormatted = point.y.toFixed(6);
            let label = `Cluster ${point.clusterId}: (${xFormatted}, ${yFormatted})`;
            if (point.caseId) {
              label += ` - Case ID: ${point.caseId}`;
            }
            return label;
          }
        }
      }
    }
  };

  const chartData = { datasets };

  return <Scatter data={chartData} options={options} />;
};

export default ScatterPlot;
