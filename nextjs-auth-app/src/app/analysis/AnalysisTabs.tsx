'use client';

import dynamic from 'next/dynamic';
import 'react-toastify/dist/ReactToastify.css';
import { Cluster } from '../../types/analysis/ClusterDto';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import { BarangayMonthlyChart } from '../../components/BarangayMonthlyChart';
import ClusterDataTable from '../../components/ClusterDataTable';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

interface Props {
    clusters: Cluster[];
    mapKey: number;
    analysisParams?: any;
}

const AnalysisTabs: React.FC<Props> = ({ clusters, mapKey, analysisParams }) => {
    if (!clusters || clusters.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Data</h3>
                    <p className="text-gray-500 mb-4">Configure your analysis parameters above and click "Run Analysis" to generate insights.</p>
                    <div className="text-sm text-gray-400">
                        <p>💡 Select features like Crime Type, Severity, and Location coordinates</p>
                        <p>📅 Choose a date range for your analysis</p>
                        <p>🎯 Set the number of clusters to identify patterns</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <TabGroup>
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Data Visualizations
                    </h2>
                </div>
                
                <TabList className="flex border-b border-gray-200 bg-gray-50">
                    {[
                        { key: 'Map', label: 'Interactive Map', icon: '🗺️' },
                        { key: 'Monthly Chart', label: 'Time Analysis', icon: '📊' },
                        { key: 'Table', label: 'Data Table', icon: '📋' }
                    ].map(tab => (
                        <Tab
                            key={tab.key}
                            className={({ selected }) =>
                                selected
                                    ? 'flex-1 py-3 px-4 text-sm font-medium text-blue-700 bg-white border-b-2 border-blue-600 focus:outline-none'
                                    : 'flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none'
                            }
                        >
                            <span className="flex items-center justify-center">
                                <span className="mr-2">{tab.icon}</span>
                                {tab.label}
                            </span>
                        </Tab>
                    ))}
                </TabList>

                <TabPanels>
                    <TabPanel className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h3 className="font-medium text-gray-800 mb-2">Geospatial Cluster Visualization</h3>
                            <p className="text-sm text-gray-600">Interactive map showing cluster distribution with heatmaps, point markers, and convex hulls.</p>
                        </div>
                        <Map
                            key={mapKey}
                            center={[14.4081, 121.0415]}
                            zoom={14}
                            clusters={clusters}
                            clusterColorsMapping={clusterColorsMapping}
                        />
                    </TabPanel>
                    
                    <TabPanel className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h3 className="font-medium text-gray-800 mb-2">Temporal Pattern Analysis</h3>
                            <p className="text-sm text-gray-600">Monthly crime distribution by barangay and time of day. Click individual charts to focus.</p>
                        </div>
                        <BarangayMonthlyChart
                            clusters={clusters}
                            timeOfDayColors={{
                                Morning: '#FFCE56',
                                Afternoon: '#36A2EB',
                                Evening: '#FF6384',
                            }}
                        />
                    </TabPanel>
                    
                    <TabPanel className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium text-gray-800 mb-2">Detailed Data Table</h3>
                                    <p className="text-sm text-gray-600">Comprehensive view of all clustered data points with filtering and export options.</p>
                                </div>
                                <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                    {clusters.reduce((sum, c) => sum + (c.clusterCount || 0), 0)} total records
                                </div>
                            </div>
                        </div>
                        <ClusterDataTable clusters={clusters} />
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </div>
    );
};

export default AnalysisTabs;
