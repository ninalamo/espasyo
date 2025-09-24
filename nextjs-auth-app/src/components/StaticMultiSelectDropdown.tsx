import Select from "react-select";

interface Option {
  value: string | number;
  label: string;
}

interface StaticMultiSelectDropdownProps {
  options: Option[];
  selected: (string | number)[];
  setSelected: (selected: (string | number)[]) => void;
  label: string;
  placeholder?: string;
  isLoading?: boolean;
}

const StaticMultiSelectDropdown = ({ 
  options, 
  selected, 
  setSelected, 
  label, 
  placeholder = "All",
  isLoading = false
}: StaticMultiSelectDropdownProps) => {
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
          placeholder={isLoading ? "Loading..." : placeholder}
          isLoading={isLoading}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            control: (base) => ({
              ...base,
              minHeight: '32px',
              fontSize: '14px'
            }),
            menu: (base) => ({
              ...base,
              fontSize: '14px'
            })
          }}
          isSearchable
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

export default StaticMultiSelectDropdown;