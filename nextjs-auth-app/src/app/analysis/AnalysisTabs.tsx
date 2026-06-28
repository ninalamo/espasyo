'use client';

import dynamic from 'next/dynamic';
import 'react-toastify/dist/ReactToastify.css';
import { useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Cluster } from '../../types/analysis/ClusterDto';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import { BarangayMonthlyChart } from '../../components/BarangayMonthlyChart';
import { CrimeTrendChart } from '../../components/CrimeTrendChart';

const parseCsvRow = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current.trim());
    return values;
};

const csvToClusters = (text: string): Cluster[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');
    const headers = parseCsvRow(lines[0]);
    const rows = lines.slice(1).map(parseCsvRow);
    const groups = new Map<number, Cluster>();

    const getNum = (vals: string[], idx: number): number => {
        const v = vals[idx]?.trim();
        return v ? Number(v) : 0;
    };

    rows.forEach(vals => {
        if (vals.length < headers.length) return;
        const clusterId = getNum(vals, headers.indexOf('ClusterId'));
        if (!groups.has(clusterId)) {
            groups.set(clusterId, {
                clusterId,
                centroids: [0, 0],
                clusterItems: [],
                clusterCount: 0,
            });
        }
        const group = groups.get(clusterId)!;
        const item: any = {
            caseId: vals[headers.indexOf('CaseId')] || '',
            latitude: getNum(vals, headers.indexOf('Latitude')),
            longitude: getNum(vals, headers.indexOf('Longitude')),
            month: getNum(vals, headers.indexOf('Month')),
            year: getNum(vals, headers.indexOf('Year')),
            day: 1,
            timeOfDay: 'Morning',
            precinct: getNum(vals, headers.indexOf('Precinct')),
            crimeType: getNum(vals, headers.indexOf('CrimeType')),
        };
        group.clusterItems.push(item);
    });

    groups.forEach(g => {
        g.clusterCount = g.clusterItems.length;
        const avgLat = g.clusterItems.reduce((s, i) => s + i.latitude, 0) / g.clusterCount;
        const avgLng = g.clusterItems.reduce((s, i) => s + i.longitude, 0) / g.clusterCount;
        g.centroids = [avgLat, avgLng];
    });

    return [...groups.values()];
};

const MapComponent = dynamic(() => import('../../components/Map'), { ssr: false });

interface Props {
    clusters: Cluster[];
    mapKey: number;
    analysisParams?: any;
    onImport?: (data: any) => void;
}

const AnalysisTabs: React.FC<Props> = ({ clusters, mapKey, analysisParams, onImport }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const isJson = file.name.endsWith('.json');
        const isCsv = file.name.endsWith('.csv');
        if (!isJson && !isCsv) {
            toast.error('Please select a JSON or CSV file');
            return;
        }
        try {
            const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target?.result as string);
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            });
            if (isJson) {
                const data = JSON.parse(content);
                onImport?.(data);
            } else {
                const clusters = csvToClusters(content);
                onImport?.({ clusters });
            }
        } catch (err: any) {
            toast.error(`Failed to import file: ${err.message}`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [onImport]);
    if (!clusters || clusters.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Data</h3>
                    <p className="text-gray-500 mb-4">Configure your analysis parameters above and click &quot;Run Analysis&quot; to generate insights.</p>
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
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        Data Visualizations
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition flex items-center gap-1.5" title="Import analysis data from JSON file">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                            </svg>
                            Import
                        </button>
                        <input type="file" accept=".json,application/json,.csv,text/csv" ref={fileInputRef} onChange={handleFileSelected} className="hidden" />
                    </div>
                </div>
                
                <TabList className="flex border-b border-gray-200 bg-gray-50">
                    {[
                        { key: 'Map', label: 'Spatial', icon: '🗺️' },
                        { key: 'Trend Chart', label: 'Temporal', icon: '📈' },
                        { key: 'Monthly Chart', label: 'Seasonal', icon: '🌙' },
                    ].map(tab => (
                        <Tab
                            key={tab.key}
                            className={({ selected }) =>
                                selected
                                    ? 'flex-1 py-3 px-4 text-sm font-medium text-ubuntu-700 bg-white border-b-2 border-ubuntu-500 focus:outline-none'
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
                        <MapComponent
                            key={mapKey}
                            center={[14.4081, 121.0415]}
                            zoom={14}
                            clusters={clusters}
                            clusterColorsMapping={clusterColorsMapping}
                        />
                    </TabPanel>
                    
                    <TabPanel className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h3 className="font-medium text-gray-800 mb-2">Crime Trends Over Time</h3>
                            <p className="text-sm text-gray-600">Line chart showing incident counts per crime type over time. Filter by date range, crime type, time of day, and barangay. Aggregate by daily, weekly, monthly, or yearly intervals.</p>
                        </div>
                        <CrimeTrendChart clusters={clusters} dateFrom={analysisParams?.dateFrom} dateTo={analysisParams?.dateTo} />
                    </TabPanel>
                    
                    <TabPanel className="p-6">
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h3 className="font-medium text-gray-800 mb-2">Seasonal Pattern Analysis</h3>
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
                </TabPanels>
            </TabGroup>
        </div>
    );
};

export default AnalysisTabs;
