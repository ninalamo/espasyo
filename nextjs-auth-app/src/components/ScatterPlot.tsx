import React from 'react';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto';

const ScatterPlot = ({ data }) => {
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
    datasets: [
      {
        label: 'Cluster 1',
        data: data.filter(d => d.clusterId === 1),
        backgroundColor: 'rgba(75, 192, 192, 0.6)'
      },
      {
        label: 'Cluster 2',
        data: data.filter(d => d.clusterId === 2),
        backgroundColor: 'rgba(153, 102, 255, 0.6)'
      },
      {
        label: 'Cluster 3',
        data: data.filter(d => d.clusterId === 3),
        backgroundColor: 'rgba(255, 159, 64, 0.6)'
      }
    ]
  };

  return <Scatter data={chartData} options={options} />;
};

export default ScatterPlot;
