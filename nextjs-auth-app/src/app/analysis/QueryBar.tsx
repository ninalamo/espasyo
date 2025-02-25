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
  loading: boolean;
  handleFilter: () => void;
}

const QueryBar = ({
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  numberOfClusters, setNumberOfClusters,
  numberOfRuns, setNumberOfRuns,
  selectedFeatures, setSelectedFeatures,
  loading, handleFilter
}: QueryBarProps) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full">
      <h2 className="text-sm font-semibold text-gray-800 mb-4">Query Parameters</h2>
  {/* Feature Select */}
  <div className="col-span-2">
          <FeatureSelect selectedFeatures={selectedFeatures} setSelectedFeatures={setSelectedFeatures} />
        </div>
      <div className="grid grid-cols-8 gap-2 items-end">

        {/* Date Pickers */}
        <div className="col-span-2">
          <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
          <input
            type="date"
            id="dateFrom"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="dateTo" className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
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
          <label htmlFor="numberOfClusters" className="block text-xs font-medium text-gray-600 mb-1">Clusters</label>
          <input
            type="number"
            id="numberOfClusters"
            value={numberOfClusters}
            onChange={(e) => setNumberOfClusters(Math.min(10, Math.max(3, Number(e.target.value))))}
            className="border border-gray-300 p-2 rounded-md w-full text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="col-span-1">
          <label htmlFor="numberOfRuns" className="block text-xs font-medium text-gray-600 mb-1">Runs</label>
          <input
            type="number"
            id="numberOfRuns"
            value={numberOfRuns}
            onChange={(e) => setNumberOfRuns(Math.min(10, Math.max(1, Number(e.target.value))))}
            className="border border-gray-300 p-2 rounded-md w-full text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {/* Process Button */}
        <div className="col-span-2">
          <button
            onClick={handleFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          >
            {loading ? "Processing..." : "Process"}
          </button>
        </div>


      </div>

    </div>
  );
};

export default QueryBar;
