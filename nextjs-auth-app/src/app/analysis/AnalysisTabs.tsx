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
}

const AnalysisTabs: React.FC<Props> = ({ clusters, mapKey }) => {
    if (!clusters || clusters.length === 0) {
        return (
            <div className="text-center text-gray-500 mt-6">
                No data to display. Please run analysis to view results.
            </div>
        );
    }

    return (
        <TabGroup>
            <TabList className="flex p-1 space-x-1 bg-blue-900/20 rounded-xl">
                {['Map', 'Monthly Chart', 'Table'].map(tab => (
                    <Tab
                        key={tab}
                        className={({ selected }) =>
                            selected
                                ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg'
                                : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'
                        }
                    >
                        {tab}
                    </Tab>
                ))}
            </TabList>

            <TabPanels className="mt-2">
                <TabPanel>
                    <Map
                        key={mapKey}
                        center={[14.4081, 121.0415]}
                        zoom={14}
                        clusters={clusters}
                        clusterColorsMapping={clusterColorsMapping}
                    />
                </TabPanel>
                <TabPanel>
                    <BarangayMonthlyChart
                        clusters={clusters}
                        timeOfDayColors={{
                            Morning: '#FFCE56',
                            Afternoon: '#36A2EB',
                            Evening: '#FF6384',
                        }}
                    />
                </TabPanel>
                <TabPanel>
                    <ClusterDataTable clusters={clusters} />
                </TabPanel>
            </TabPanels>
        </TabGroup>
    );
};

export default AnalysisTabs;
