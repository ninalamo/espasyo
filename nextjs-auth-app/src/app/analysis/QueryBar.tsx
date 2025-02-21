import { useState } from 'react';
import { toast } from 'react-toastify';

const features = ["CrimeType", "Severity", "PoliceDistrict", "Weather", "CrimeMotive"];

interface QueryBarProps {
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  numberOfClusters: number;
  setNumberOfClusters: (num: number) => void;
  numberOfRuns: number;
  setNumberOfRuns: (num: number) => void;
  selectedFeature: string;
  setSelectedFeature: (feature: string) => void;
  loading: boolean;
  handleFilter: () => void;
}

const QueryBar = ({
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  numberOfClusters, setNumberOfClusters,
  numberOfRuns, setNumberOfRuns,
  selectedFeature, setSelectedFeature,
  loading, handleFilter
}: QueryBarProps) => {

  return (
    <div className="mb-4 flex flex-col items-end space-y-2">
      <div className="flex space-x-4 items-end">
        <div>
          <label htmlFor="dateFrom" className="block mb-2">Start Date:</label>
          <input
            type="date"
            id="dateFrom"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="dateTo" className="block mb-2">End Date:</label>
          <input
            type="date"
            id="dateTo"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="numberOfClusters" className="block mb-2">Number of Clusters:</label>
          <input
            type="number"
            id="numberOfClusters"
            value={numberOfClusters}
            onChange={(e) => setNumberOfClusters(Math.min(10, Math.max(3, Number(e.target.value))))}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="numberOfRuns" className="block mb-2">Number of Runs:</label>
          <input
            type="number"
            id="numberOfRuns"
            value={numberOfRuns}
            onChange={(e) => setNumberOfRuns(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <button
          onClick={handleFilter}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition h-10"
          disabled={loading}
        >
          {loading ? "Processing..." : "Process"}
        </button>
      </div>

      {/* Radio Button Selection */}
      <div className="flex space-x-4 items-center">
        <span>Select Feature:</span>
        {features.map(feature => (
          <div key={feature} className="flex items-center">
            <input
              type="radio"
              id={feature}
              name="selectedFeature"
              value={feature}
              checked={selectedFeature === feature}
              onChange={() => setSelectedFeature(feature)}
              className="mr-2"
            />
            <label htmlFor={feature}>{feature}</label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueryBar;
