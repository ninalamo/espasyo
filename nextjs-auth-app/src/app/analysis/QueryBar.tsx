import { useState } from "react";
import FeatureSelect from "./FeatureSelect";

export interface QueryBarProps {
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  numberOfClusters: number;
  setNumberOfClusters: (num: number) => void;
  numberOfRuns: number;
  setNumberOfRuns: (num: number) => void;
  selectedFeatures: string[];
  setSelectedFeatures: (feature: string[]) => void;
}

const QueryBar = ({
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  numberOfClusters, setNumberOfClusters,
  numberOfRuns, setNumberOfRuns,
  selectedFeatures, setSelectedFeatures
}: QueryBarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper function to format display of selected features
  const displaySelected = (arr: string[]) => {
    // Remove duplicates
    const uniqueItems = Array.from(new Set(arr));

    // Check if Latitude & Longitude appear together and merge them
    if (uniqueItems.includes("Latitude") && uniqueItems.includes("Longitude")) {
      return uniqueItems
        .filter((item) => item !== "Latitude" && item !== "Longitude")
        .concat("Latitude & Longitude")
        .join(", ");
    }

    return uniqueItems.length > 0 ? uniqueItems.join(", ") : "All";
  };


  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full">
      {/* Heading and toggle button */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">Cluster Features & Settings</h2>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 transition text-xs focus:outline-none"
        >
          {isExpanded ? "Hide Query Parameters ▲" : "Show Query Parameters ▼"}
        </button>
      </div>

{/* Always visible summary of selected query parameters */}
<div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md shadow-sm">
  <h3 className="text-sm font-semibold text-gray-800 mb-2">Query Summary</h3>
  <div className="flex flex-wrap gap-2 text-xs text-gray-700">
    <div className="px-2 py-1 bg-white rounded border border-gray-300">
      <span className="font-semibold">Included Features:</span> {displaySelected(selectedFeatures)}
    </div>
    <div className="px-2 py-1 bg-white rounded border border-gray-300">
      <span className="font-semibold">Date Range:</span> {dateFrom} - {dateTo}
    </div>
    <div className="px-2 py-1 bg-white rounded border border-gray-300">
      <span className="font-semibold">Clusters:</span> {numberOfClusters} <span className="mx-1">|</span> <span className="font-semibold">Runs:</span> {numberOfRuns}
    </div>
  </div>
</div>



      {/* Collapsible Query Parameters */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
        }`}
      >
        {/* Feature Select */}
        <div className="col-span-2 mb-4">
          <FeatureSelect
            selectedFeatures={selectedFeatures}
            setSelectedFeatures={setSelectedFeatures}
          />
        </div>

        <div className="grid grid-cols-8 gap-2 items-end">
          {/* Date Pickers */}
          <div className="col-span-2">
            <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              id="dateFrom"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="col-span-2">
            <label htmlFor="dateTo" className="block text-xs font-medium text-gray-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              id="dateTo"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Clusters & Runs */}
          <div className="col-span-1">
            <label htmlFor="numberOfClusters" className="block text-xs font-medium text-gray-600 mb-1">
              Clusters
            </label>
            <input
              type="number"
              id="numberOfClusters"
              value={numberOfClusters}
              onChange={(e) =>
                setNumberOfClusters(Math.min(10, Math.max(3, Number(e.target.value))))
              }
              className="border border-gray-300 p-2 rounded-md w-full text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="numberOfRuns" className="block text-xs font-medium text-gray-600 mb-1">
              Runs
            </label>
            <input
              type="number"
              id="numberOfRuns"
              value={numberOfRuns}
              onChange={(e) =>
                setNumberOfRuns(Math.min(10, Math.max(1, Number(e.target.value))))
              }
              className="border border-gray-300 p-2 rounded-md w-full text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueryBar;
