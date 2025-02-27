import { useState } from "react";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

interface FilterSectionProps {
  selectedCrimeTypes?: string[];
  setSelectedCrimeTypes: (items: string[]) => void;
  selectedMotive?: string[];
  setSelectedMotive: (items: string[]) => void;
  selectedSeverity?: string[];
  setSelectedSeverity: (items: string[]) => void;
  selectedPrecinct?: string[];
  setSelectedPrecinct: (items: string[]) => void;
  selectedWeather?: string[];
  setSelectedWeather: (items: string[]) => void;
}

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
}: FilterSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Helper to display selected values or "All" if none are selected.
  const displaySelected = (arr: string[]) => (arr.length > 0 ? arr.join(", ") : "All");

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

      {/* Always visible selected filters summary */}
      <div className="mb-2">
        <p className="text-xs text-gray-700">
          Selected:
          <span className="ml-1">
            Crime Types: {displaySelected(selectedCrimeTypes)}
          </span>
          , <span className="ml-1">
            Motives: {displaySelected(selectedMotive)}
          </span>
          , <span className="ml-1">
            Severity: {displaySelected(selectedSeverity)}
          </span>
          , <span className="ml-1">
            Police Precincts: {displaySelected(selectedPrecinct)}
          </span>
          , <span className="ml-1">
            Weather: {displaySelected(selectedWeather)}
          </span>
        </p>
      </div>

      {/* Collapsible filters panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
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
