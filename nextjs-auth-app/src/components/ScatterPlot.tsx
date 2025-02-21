import React from 'react';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto';

interface ScatterPlotProps {
  data: { clusterId: number;[key: string]: any }[];
  clusterColorsMapping: { [key: number]: string };
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, clusterColorsMapping }) => {
  // Get distinct cluster IDs from the data and sort them in ascending order.
  const distinctClusters = Array.from(new Set(data.map(d => d.clusterId))).sort((a, b) => a - b);

  // Create a dataset for each distinct cluster using the passed-in mapping.
  const datasets = distinctClusters.map((clusterId) => ({
    label: `Cluster ${clusterId}`,
    data: data.filter(d => d.clusterId === clusterId),
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
    }
  };

  const chartData = {
    datasets
  };

  return <Scatter data={chartData} options={options} />;
};

export default ScatterPlot;
