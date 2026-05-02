import { useState } from "react";

interface FeatureSelectProps {
  selectedFeatures: string[];
  setSelectedFeatures: (features: string[]) => void;
}

// Demographic features the user may choose ONE of.
// Lat/Long are always included and cannot be removed.
const DEMOGRAPHIC_OPTIONS = [
  { value: "CrimeType", label: "Crime Type" },
  { value: "Severity", label: "Severity" },
  { value: "PoliceDistrict", label: "Police District" },
  { value: "Weather", label: "Weather" },
  { value: "Motive", label: "Crime Motive" }
];

const FIXED_FEATURES = ["Latitude", "Longitude"];

const FeatureSelect = ({ selectedFeatures, setSelectedFeatures }: FeatureSelectProps) => {
  // Derive which demographic is currently selected (if any)
  const currentDemographic = selectedFeatures.find(
    (f) => !FIXED_FEATURES.includes(f)
  ) ?? "";

  const handleDemographicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosen = e.target.value;
    // Always include Lat/Long + the one chosen demographic
    setSelectedFeatures(chosen ? [...FIXED_FEATURES, chosen] : [...FIXED_FEATURES]);
  };

  return (
    <div className="mb-4">
      {/* Base features — always locked */}
      <div className="mb-3">
        <div className="flex items-center gap-1 mb-1">
          <label className="block text-sm font-medium text-gray-600">
            Base Features
          </label>
          {/* Tooltip explaining why these are locked */}
          <div className="relative group">
            <svg
              className="w-4 h-4 text-gray-400 cursor-help"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="absolute left-5 top-0 z-50 hidden group-hover:block w-64 p-3 text-xs text-white bg-gray-800 rounded-lg shadow-lg">
              <p className="font-semibold mb-1">Why are these locked?</p>
              <p>
                Latitude and Longitude are always included to ensure clusters are
                formed by geographic proximity first. Adding too many demographic
                features (e.g., weather, severity) without spatial grounding
                causes the <span className="italic">curse of dimensionality</span>
                — distance calculations lose meaning and clusters become arbitrary.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {FIXED_FEATURES.map((f) => (
            <span
              key={f}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300"
            >
              🔒 {f}
            </span>
          ))}
        </div>
      </div>

      {/* One optional demographic feature */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <label htmlFor="demographicFeature" className="block text-sm font-medium text-gray-600">
            Additional Feature <span className="text-gray-400 font-normal">(choose one)</span>
          </label>
        </div>
        <select
          id="demographicFeature"
          value={currentDemographic}
          onChange={handleDemographicChange}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">— None (geographic only) —</option>
          {DEMOGRAPHIC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Limiting to one additional feature keeps clustering geographically meaningful.
        </p>
      </div>
    </div>
  );
};

export default FeatureSelect;
