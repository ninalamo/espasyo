'use client';

import React, { useState } from 'react';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../constants/consts';
import { ClusterItem } from '../types/analysis/ClusterDto';


export interface ModalProps {
    onClose: () => void;
    clusterId: number;
    items: ClusterItem[];
    lat: number;
    lng: number;
    children?: React.ReactNode;
}


const crimeTypeEnum = CrimeTypesDictionary;
const precinctNames = GetPrecinctsDictionary;

const MapModal: React.FC<ModalProps> = ({ onClose, clusterId, items, lat, lng }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = items.filter(item =>
        item.caseId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black bg-opacity-50 p-4">

            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                >
                    ✖
                </button>

                <h2 className="text-lg font-semibold mb-2">Cluster #{clusterId} at ({lat.toFixed(5)}, {lng.toFixed(5)})</h2>

                {items.length > 1 && (
                    <input
                        type="text"
                        placeholder="Search by Case ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="mb-3 w-full px-3 py-1 border rounded"
                    />
                )}

                {filteredItems.length > 1 ? (
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-sm table-auto border border-gray-300">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border px-2 py-1">Case ID</th>
                                    <th className="border px-2 py-1">Crime Type</th>
                                    <th className="border px-2 py-1">Month</th>
                                    <th className="border px-2 py-1">Year</th>
                                    <th className="border px-2 py-1">Time of Day</th>
                                    <th className="border px-2 py-1">Precinct</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, i) => (
                                    <tr key={i}>
                                        <td className="border px-2 py-1">{item.caseId}</td>
                                        <td className="border px-2 py-1">{crimeTypeEnum[item.crimeType]}</td>
                                        <td className="border px-2 py-1">{item.month}</td>
                                        <td className="border px-2 py-1">{item.year}</td>
                                        <td className="border px-2 py-1">{item.timeOfDay}</td>
                                        <td className="border px-2 py-1">{precinctNames[item.precinct] || `Precinct ${item.precinct}`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <ul className="text-sm space-y-1">
                        <li><strong>Case ID:</strong> {items[0].caseId}</li>
                        <li><strong>Crime Type:</strong> {crimeTypeEnum[items[0].crimeType]}</li>
                        <li><strong>Month:</strong> {items[0].month}</li>
                        <li><strong>Year:</strong> {items[0].year}</li>
                        <li><strong>Time of Day:</strong> {items[0].timeOfDay}</li>
                        <li><strong>Precinct:</strong> {precinctNames[items[0].precinct] || `Precinct ${items[0].precinct}`}</li>

                    </ul>
                )}
            </div>
        </div>
    );
};

export default MapModal;
