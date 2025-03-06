import { useState, useReducer, useEffect } from "react";
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

export type FilterState = {
  selectedCrimeTypes: string[];
  selectedMotive: string[];
  selectedSeverity: string[];
  selectedPrecinct: string[];
  selectedWeather: string[];
};

export const initialFilterState: FilterState = {
  selectedCrimeTypes: [],
  selectedMotive: [],
  selectedSeverity: [],
  selectedPrecinct: [],
  selectedWeather: [],
};

type FilterAction =
  | { type: "SET_CRIME_TYPES"; payload: string[] }
  | { type: "SET_MOTIVE"; payload: string[] }
  | { type: "SET_SEVERITY"; payload: string[] }
  | { type: "SET_PRECINCT"; payload: string[] }
  | { type: "SET_WEATHER"; payload: string[] }
  | { type: "RESET_ALL"; isFeatureSelected: (variants: string[]) => boolean };

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case "SET_CRIME_TYPES":
      return { ...state, selectedCrimeTypes: action.payload };
    case "SET_MOTIVE":
      return { ...state, selectedMotive: action.payload };
    case "SET_SEVERITY":
      return { ...state, selectedSeverity: action.payload };
    case "SET_PRECINCT":
      return { ...state, selectedPrecinct: action.payload };
    case "SET_WEATHER":
      return { ...state, selectedWeather: action.payload };
    case "RESET_ALL":
      return {
        selectedCrimeTypes: action.isFeatureSelected(["crimeTypes", "crime type"])
          ? state.selectedCrimeTypes
          : [],
        selectedMotive: action.isFeatureSelected(["motive", "motives"])
          ? state.selectedMotive
          : [],
        selectedSeverity: action.isFeatureSelected(["severity"])
          ? state.selectedSeverity
          : [],
        selectedPrecinct: action.isFeatureSelected([
          "precinct",
          "police precincts",
          "police district",
          "policedistrict",
        ])
          ? state.selectedPrecinct
          : [],
        selectedWeather: action.isFeatureSelected(["weather"])
          ? state.selectedWeather
          : [],
      };
    default:
      return state;
  }
};

interface FilterSectionProps {
  selectedFeatures: string[];
  onFilterChange: (filterState: FilterState) => void;
}

const FilterSection = ({ selectedFeatures, onFilterChange }: FilterSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filterState, dispatch] = useReducer(filterReducer, initialFilterState);

  // Notify parent whenever filter state changes.
  useEffect(() => {
    onFilterChange(filterState);
  }, [filterState, onFilterChange]);

  // Helper to display selected values or "All" if none are selected.
  const displaySelected = (arr: string[]) => (arr.length > 0 ? arr.join(", ") : "All");

  // Normalize selected features for flexible matching.
  const normalizedFeatures = selectedFeatures.map((feature) =>
    feature.toLowerCase().replace(/\s+/g, "")
  );

  // Helper function to check if a feature is selected (accepts multiple variants).
  const isFeatureSelected = (variants: string[]) =>
    variants.some((variant) =>
      normalizedFeatures.includes(variant.toLowerCase().replace(/\s+/g, ""))
    );

  // Reset filters when selectedFeatures change.
  useEffect(() => {
    dispatch({ type: "RESET_ALL", isFeatureSelected });
  }, [selectedFeatures]);

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 w-full mt-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-800">Feature Value(s) To Include</h3>
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
<div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md shadow-sm">
  <h3 className="text-sm font-semibold text-gray-800 mb-2">Selected Filter Values</h3>
  <div className="flex flex-wrap gap-2 text-xs text-gray-700">
    {isFeatureSelected(["crimeTypes", "crime type"]) && (
      <div className="px-2 py-1 bg-white rounded border border-gray-300">
        <span className="font-semibold">Crime Types:</span> {displaySelected(filterState.selectedCrimeTypes)}
      </div>
    )}
    {isFeatureSelected(["motive", "motives"]) && (
      <div className="px-2 py-1 bg-white rounded border border-gray-300">
        <span className="font-semibold">Motives:</span> {displaySelected(filterState.selectedMotive)}
      </div>
    )}
    {isFeatureSelected(["severity"]) && (
      <div className="px-2 py-1 bg-white rounded border border-gray-300">
        <span className="font-semibold">Severity:</span> {displaySelected(filterState.selectedSeverity)}
      </div>
    )}
    {isFeatureSelected(["precinct", "police precincts","policedistrict","police district"]) && (
      <div className="px-2 py-1 bg-white rounded border border-gray-300">
        <span className="font-semibold">Police Precincts:</span> {displaySelected(filterState.selectedPrecinct)}
      </div>
    )}
    {isFeatureSelected(["weather"]) && (
      <div className="px-2 py-1 bg-white rounded border border-gray-300">
        <span className="font-semibold">Weather:</span> {displaySelected(filterState.selectedWeather)}
      </div>
    )}
  </div>
</div>


      {/* Collapsible filters panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0 py-0"
        }`}
      >
        {isFeatureSelected(["crimeTypes", "crime type"]) && (
          <MultiSelectDropdown
            key={`type-${refreshKey}`}
            name="type"
            selected={filterState.selectedCrimeTypes}
            setSelected={(items) => dispatch({ type: "SET_CRIME_TYPES", payload: items })}
            label="Crime Types"
          />
        )}
        {isFeatureSelected(["motive", "motives"]) && (
          <MultiSelectDropdown
            key={`motive-${refreshKey}`}
            name="motive"
            selected={filterState.selectedMotive}
            setSelected={(items) => dispatch({ type: "SET_MOTIVE", payload: items })}
            label="Motives"
          />
        )}
        {isFeatureSelected(["severity"]) && (
          <MultiSelectDropdown
            key={`severity-${refreshKey}`}
            name="severity"
            selected={filterState.selectedSeverity}
            setSelected={(items) => dispatch({ type: "SET_SEVERITY", payload: items })}
            label="Severity"
          />
        )}
        {isFeatureSelected(["precinct", "police precincts", "police district", "policedistrict"]) && (
          <MultiSelectDropdown
            key={`precinct-${refreshKey}`}
            name="precinct"
            selected={filterState.selectedPrecinct}
            setSelected={(items) => dispatch({ type: "SET_PRECINCT", payload: items })}
            label="Police Precincts"
          />
        )}
        {isFeatureSelected(["weather"]) && (
          <MultiSelectDropdown
            key={`weather-${refreshKey}`}
            name="weather"
            selected={filterState.selectedWeather}
            setSelected={(items) => dispatch({ type: "SET_WEATHER", payload: items })}
            label="Weather Condition"
          />
        )}
      </div>
    </div>
  );
};

export default FilterSection;
