

import { useState, useEffect } from "react";
import Select from "react-select";

interface FeatureSelectProps {
  selectedFeatures: string[];
  setSelectedFeatures: (features: string[]) => void;
}

const FeatureSelect = ({ selectedFeatures, setSelectedFeatures }: FeatureSelectProps) => {
  // Base features available for selection.
  const baseFeatures = [
    { value: "CrimeType", label: "Crime Type" },
    { value: "Severity", label: "Severity" },
    { value: "PoliceDistrict", label: "Police District" },
    { value: "Weather", label: "Weather" },
    { value: "Motive", label: "Crime Motive" }
  ];

  // Fixed options for latitude and longitude.
  const latLongOptions = [
    { value: "Latitude", label: "Latitude", isFixed: true },
    { value: "Longitude", label: "Longitude", isFixed: true }
  ];

  // Local state for checkbox.
  const [includeLatLong, setIncludeLatLong] = useState(true);

  // Update selected features when the checkbox is toggled.
  useEffect(() => {
    if (includeLatLong) {
      // Add "Latitude" and "Longitude" if not already present.
      var temp = [...selectedFeatures, "Latitude", "Longitude"];
      setSelectedFeatures(temp);
    } else {
      // Remove "Latitude" and "Longitude" if checkbox is unchecked.
      var temp = selectedFeatures.filter((feature) => feature !== "Latitude" && feature !== "Longitude");
      setSelectedFeatures(temp);
    }
  }, [includeLatLong, setSelectedFeatures]);

  // If checkbox is enabled, include fixed options in the available options.
  const availableOptions = includeLatLong ? [...baseFeatures, ...latLongOptions] : baseFeatures;

  // Handle changes in the multi-select.
  const handleChange = (selectedOptions: any, actionMeta: any) => {
    // If user attempts to remove a fixed option, ignore the removal.
    if (actionMeta.action === "remove-value" || actionMeta.action === "pop-value") {
      if (actionMeta.removedValue?.isFixed) {
        return;
      }
    }
    let newSelected = selectedOptions ? selectedOptions.map((option: any) => option.value) : [];
    // Ensure fixed options remain if includeLatLong is true.
    if (includeLatLong) {
      if (!newSelected.includes("Latitude")) newSelected.push("Latitude");
      if (!newSelected.includes("Longitude")) newSelected.push("Longitude");
    }
    setSelectedFeatures(newSelected);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">Select Features</label>
      <Select
        isMulti
        options={availableOptions}
        value={availableOptions.filter((f) => selectedFeatures.includes(f.value))}
        onChange={handleChange}
        isSearchable
        className="w-full"
        classNamePrefix="select"
        placeholder="Select features..."
        menuPortalTarget={document.body}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
      />
      <div className="mt-2 flex items-center">
        <input
          type="checkbox"
          id="includeLatLong"
          checked={includeLatLong}
          onChange={(e) => setIncludeLatLong(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="includeLatLong" className="text-sm text-gray-600">
          Include Lat/Long
        </label>
      </div>
    </div>
  );
};

export default FeatureSelect;
