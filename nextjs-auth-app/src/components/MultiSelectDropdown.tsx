import { useEffect, useState } from "react";
import Select from "react-select";
import { apiService } from "../app/api/utils/apiService";

interface MultiSelectDropdownProps {
  name: string;
  selected: string[];
  setSelected: (selected: string[]) => void;
  label: string;
}

const MultiSelectDropdown = ({ name, selected, setSelected, label }: MultiSelectDropdownProps) => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const response = await apiService.get(`/incident/enums?name=${name}`);
        if (response && typeof response === "object") {
          const formattedOptions = Object.entries(response).map(([key, value]) => ({
            value: key,
            label: value as string,
          }));
          setOptions(formattedOptions);
        }
      } catch (error) {
        console.error(`Failed to fetch ${name} options:`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, [name]);

  return (
    <div className="flex items-center space-x-2 mb-2">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <Select
          options={options}
          isMulti
          value={options.filter((option) => selected.includes(option.value))}
          onChange={(selectedOptions) =>
            setSelected(selectedOptions ? selectedOptions.map((option) => option.value) : [])
          }
          classNamePrefix="react-select"
          placeholder={loading ? "Loading..." : "All"}
          isLoading={loading}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          }}
        />
      </div>
      <button
        onClick={() => setSelected([])}
        className="text-blue-600 underline hover:text-blue-800 text-xs"
      >
        Clear
      </button>
    </div>
  );
};

export default MultiSelectDropdown;
