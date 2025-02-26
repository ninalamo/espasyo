import { useState } from "react";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

const FilterSection = ({
  selectedCrimeTypes = [],
  setSelectedCrimeTypes,
  selectedMotive = [],
  setSelectedMotive,
  selectedSeverity = [],
  setSelectedSeverity,
  selectedPrecinct = [],
  setSelectedPrecinct,
  selectedWeather = [],
  setSelectedWeather,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 w-full mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 transition text-xs focus:outline-none"
          >
            {isExpanded ? "Hide Filters ▲" : "Show Filters ▼"}
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="text-blue-600 underline hover:text-blue-800 transition text-xs focus:outline-none"
          >
            Refresh
          </button>
        </div>
      </div>
      <div
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
          }`}
      >
        <MultiSelectDropdown
          key={`type-${refreshKey}`}
          name="type"
          selected={selectedCrimeTypes}
          setSelected={setSelectedCrimeTypes}
          label="Crime Types"
        />
        <MultiSelectDropdown
          key={`motive-${refreshKey}`}
          name="motive"
          selected={selectedMotive}
          setSelected={setSelectedMotive}
          label="Motives"
        />
        <MultiSelectDropdown
          key={`severity-${refreshKey}`}
          name="severity"
          selected={selectedSeverity}
          setSelected={setSelectedSeverity}
          label="Severity"
        />
        <MultiSelectDropdown
          key={`precinct-${refreshKey}`}
          name="precinct"
          selected={selectedPrecinct}
          setSelected={setSelectedPrecinct}
          label="Police Precincts"
        />
        <MultiSelectDropdown
          key={`weather-${refreshKey}`}
          name="weather"
          selected={selectedWeather}
          setSelected={setSelectedWeather}
          label="Weather Condition"
        />
      </div>
    </div>
  );
};

export default FilterSection;
