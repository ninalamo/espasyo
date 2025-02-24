import Select from "react-select";

const FeatureSelect = ({ selectedFeature, setSelectedFeature }) => {
  const features = [
    { value: "CrimeType", label: "Crime Type" },
    { value: "Severity", label: "Severity" },
    { value: "PoliceDistrict", label: "Police District" },
    { value: "Weather", label: "Weather" },
    { value: "CrimeMotive", label: "Crime Motive" }
  ];

  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Feature</label>
      <Select
        options={features}
        value={features.find((f) => f.value === selectedFeature)}
        onChange={(selectedOption) => setSelectedFeature(selectedOption?.value)}
        isSearchable
        className="w-full"
        classNamePrefix="select"
      />
    </div>
  );
};

export default FeatureSelect;
