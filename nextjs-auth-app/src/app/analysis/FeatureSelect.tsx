import Select from "react-select";

interface FeatureSelectProps {
  selectedFeatures: string[];
  setSelectedFeatures: (features: string[]) => void;
}

const FeatureSelect = ({ selectedFeatures, setSelectedFeatures }: FeatureSelectProps) => {
  const features = [
    { value: "CrimeType", label: "Crime Type" },
    { value: "Severity", label: "Severity" },
    { value: "PoliceDistrict", label: "Police District" },
    { value: "Weather", label: "Weather" },
    { value: "CrimeMotive", label: "Crime Motive" }
  ];

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">Select Features</label>
      <Select
        isMulti
        options={features}
        value={features.filter((f) => selectedFeatures.includes(f.value))}
        onChange={(selectedOptions) =>
          setSelectedFeatures(selectedOptions ? selectedOptions.map((option) => option.value) : [])
        }
        isSearchable
        className="w-full"
        classNamePrefix="select"
        placeholder="Select features..."
      />
    </div>
  );
};

export default FeatureSelect;
