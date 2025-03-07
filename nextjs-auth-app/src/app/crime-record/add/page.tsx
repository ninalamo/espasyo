'use client';

import { useEffect, useState } from "react"; // React hooks for side effects and local state
import { useRouter } from "next/navigation"; // Next.js router for navigation
import { useForm } from "react-hook-form"; // useForm hook from react-hook-form for form management
import { AddIncidentDto } from "../../../types/crime-record/AddIncidentDto"; // Import form data type/interface
import withAuth from "../../hoc/withAuth"; // Higher-order component for authentication
import { apiService } from "../../api/utils/apiService"; // API service for HTTP requests
import { validateIncident } from "../../api/utils/validators/createIncidentValidator"; // Custom validation function
import { fetchCachedData } from "../../api/utils/fetchCachedData";

// Define an interface for Street objects
interface Street {
  street: string;
  barangay: number;
}

// Extend AddIncidentDto with additional fields for our form
type FormData = AddIncidentDto & {
  location: string; // User-entered location (e.g., unit/house number)
  street: string;   // Selected street name
};


const AddCrimePage = () => {
  // Initialize Next.js router for navigation after form submission
  const router = useRouter();

  // Initialize react-hook-form with default values for all fields.
  // This hook manages our form state, validations, and submission.
  const {
    register,         // Registers an input field with RHF
    handleSubmit,     // Wraps our onSubmit handler
    watch,            // Watches form values for real-time updates
    setValue,         // Programmatically sets a form field value
    formState: { errors, isSubmitting } // Destructure errors and submission state
  } = useForm<FormData>({
    defaultValues: {
      caseId: "",
      crimeType: 0,
      address: "",         // This field will be auto-generated
      severity: 0,
      timeStamp: "",
      motive: 0,
      weather: 0,
      precinct: -1,        // -1 indicates no precinct selected
      additionalInfo: "",
      location: "",        // Additional location info (e.g., unit number)
      street: ""           // Selected street value
    }
  });

  // Local state to store dropdown options fetched from the API or localStorage
  const [crimeTypes, setCrimeTypes] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [weathers, setWeathers] = useState<string[]>([]);
  const [precincts, setPrecincts] = useState<string[]>([]);
  const [motives, setMotives] = useState<string[]>([]);

  // State for storing the list of streets from the API or localStorage
  const [streets, setStreets] = useState<Street[]>([]);

  // State to hold any error message from API calls or custom validation
  const [error, setError] = useState<string | null>(null);

  // Loading state to indicate if the dropdown data is still being fetched
  const [isLoading, setIsLoading] = useState(true);

  // useEffect to fetch all dropdown data and streets data on component mount.
  // Data is first checked in localStorage; if not present, it is fetched from the API.
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // --- Crime Types ---
        const fetchedCrimeTypes = await fetchCachedData<string[]>(
          "crimeTypes",
          "/Incident/enums?name=type",
          (data) => Object.values(data)
        );
        setCrimeTypes(fetchedCrimeTypes);

        // --- Weathers ---
        const fetchedWeathers = await fetchCachedData<string[]>(
          "weathers",
          "/Incident/enums?name=weather",
          (data) => Object.values(data)
        );
        setWeathers(fetchedWeathers);

        // --- Precincts ---
        const fetchedPrecincts = await fetchCachedData<string[]>(
          "precincts",
          "/Incident/enums?name=precinct",
          (data) => Object.values(data)
        );
        setPrecincts(fetchedPrecincts);

        // --- Motives ---
        const fetchedMotives = await fetchCachedData<string[]>(
          "motives",
          "/Incident/enums?name=motive",
          (data) => Object.values(data)
        );
        setMotives(fetchedMotives);

        // --- Severities ---
        const fetchedSeverities = await fetchCachedData<string[]>(
          "severities",
          "/Incident/enums?name=severity",
          (data) => Object.values(data)
        );
        setSeverities(fetchedSeverities);

        // --- Streets ---
        const fetchedStreets = await fetchCachedData<Street[]>(
          "streets",
          "/street",
          (data) => data.streets
        );
        setStreets(fetchedStreets);
      } catch (err) {
        // If any error occurs, set a general error message
        setError("Failed to load dropdown data");
      } finally {
        // End loading state regardless of success or error
        setIsLoading(false);
      }
    };

    fetchDropdownData();
  }, []); // Runs only once on mount

  // Use RHF's watch function to monitor specific form fields in real time.
  // These values are used to dynamically generate the full address.
  const watchLocation = watch("location");
  const watchPrecinct = watch("precinct");
  const watchStreet = watch("street");

  // useEffect to update the 'address' field whenever location, precinct, or street changes.
  useEffect(() => {
    // Determine the precinct name from the precincts array using the selected index.
    const precinctName =
      watchPrecinct !== -1 && precincts[Number(watchPrecinct)]
        ? precincts[Number(watchPrecinct)]
        : "";
    // If a street is selected, add it with a trailing comma.
    const streetPart = watchStreet ? watchStreet + ", " : "";
    // Construct the full formatted address string.
    const formattedAddress = `${watchLocation}, ${streetPart}${precinctName} Muntinlupa City, NCR, Philippines`;
    // Update the 'address' field in our form using setValue (this field is hidden from the user).
    setValue("address", formattedAddress.replace("_", " "));
  }, [watchLocation, watchPrecinct, watchStreet, precincts, setValue]);

  // onSubmit handler, executed when the form is submitted and validations pass.
  const onSubmit = async (data: FormData) => {
    // Run custom validation on the form data (in addition to RHF validations).
    const validationErrors = validateIncident(data, data.location);
    if (Object.keys(validationErrors).length > 0) {
      // If there are custom validation errors, iterate over them.
      // For simplicity, we set a general error message; you could also integrate these with RHF's setError.
      Object.entries(validationErrors).forEach(([field, message]) => {
        setError(`${field}: ${message}`);
      });
      return; // Stop submission if errors are present.
    }
    try {
      // Post the valid form data to the API.
      await apiService.post("/incident", data);
      // On success, navigate to the crime-record page.
      router.push("/crime-record");
    } catch (err) {
      // If API call fails, set an error message.
      setError("Failed to save crime record");
    }
  };

  // Filter the streets based on the selected precinct value.
  // This ensures only the streets matching the selected precinct (barangay) are shown.
  const filteredStreets =
    watchPrecinct !== -1
      ? streets.filter((s) => s.barangay === Number(watchPrecinct))
      : [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Page title */}
      <h1 className="text-2xl font-semibold mb-4">Add New Crime Record</h1>
      {/* Display a loading message, error message, or the form based on state */}
      {isLoading ? (
        <div>Loading dropdown options...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        // Form submission is handled by RHF's handleSubmit wrapper around our onSubmit function.
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            {/* Case ID & Timestamp Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {/* Register the input for caseId with a required validation */}
                <label htmlFor="caseId" className="block text-xs font-medium mb-1">
                  Case Id
                </label>
                <input
                  id="caseId"
                  type="text"
                  {...register("caseId", { required: "Case ID is required" })}
                  className="border p-2 rounded w-full"
                  placeholder="Case ID"
                />
                {errors.caseId && (
                  <p className="text-red-500 text-sm">{errors.caseId.message}</p>
                )}
              </div>
              <div>
                {/* Register the input for timeStamp with a required validation */}
                <label htmlFor="timeStamp" className="block text-xs font-medium mb-1">
                  Date Of Crime
                </label>
                <input
                  id="timeStamp"
                  type="datetime-local"
                  {...register("timeStamp", { required: "Timestamp is required" })}
                  className="border p-2 rounded w-full"
                />
                {errors.timeStamp && (
                  <p className="text-red-500 text-sm">{errors.timeStamp.message}</p>
                )}
              </div>
            </div>

            {/* Address, Street & Precinct Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                {/* Input for location with a label */}
                <label htmlFor="location" className="block text-xs font-medium mb-1">
                  Unit No. | House No. | Bldg. No
                </label>
                <input
                  type="text"
                  {...register("location", { required: "Location is required" })}
                  className="border p-2 rounded w-full"
                  placeholder="Street Address"
                  id="location"
                />
                {errors.location && (
                  <p className="text-red-500 text-sm">{errors.location.message}</p>
                )}
              </div>
              <div>
                {/* Dropdown for selecting a street, populated from filteredStreets */}
                <label htmlFor="street" className="block text-xs font-medium mb-1">
                  Street
                </label>
                <select id="street" {...register("street")} className="border p-2 rounded w-full">
                  <option value="">Select Street</option>
                  {filteredStreets.map((s, index) => (
                    <option key={index} value={s.street}>
                      {s.street}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {/* Dropdown for precinct selection */}
                <label htmlFor="precinct" className="block text-xs font-medium mb-1">
                  Precinct
                </label>
                <select
                  id="precinct"
                  {...register("precinct", {
                    valueAsNumber: true,
                    required: "Precinct is required"
                  })}
                  className="border p-2 rounded w-full"
                >
                  <option value={-1}>Select Precinct</option>
                  {precincts.map((precinct, index) => (
                    <option key={index} value={index}>
                      {precinct}
                    </option>
                  ))}
                </select>
                {errors.precinct && (
                  <p className="text-red-500 text-sm">{errors.precinct.message}</p>
                )}
              </div>
            </div>
            {/* Display the dynamically generated address */}
            <p className="text-gray-600 text-sm">
              Generated Address: {watch("address")}
            </p>

            {/* Crime Type & Severity Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="crimeType" className="block text-xs font-medium mb-1">
                  Crime Type
                </label>
                {/* Dropdown for crime type */}
                <select
                  id="crimeType"
                  {...register("crimeType", {
                    valueAsNumber: true,
                    required: "Crime Type is required"
                  })}
                  className="border p-2 rounded w-full"
                >
                  <option value="">Select Crime Type</option>
                  {crimeTypes.map((type, index) => (
                    <option key={index} value={index + 1}>
                      {type}
                    </option>
                  ))}
                </select>
                {errors.crimeType && (
                  <p className="text-red-500 text-sm">{errors.crimeType.message}</p>
                )}
              </div>
              <div>
                {/* Dropdown for severity */}
                <label htmlFor="severity" className="block text-xs font-medium mb-1">
                  Severity
                </label>
                <select
                  id="severity"
                  {...register("severity", {
                    valueAsNumber: true,
                    required: "Severity is required"
                  })}
                  className="border p-2 rounded w-full"
                >
                  <option value="">Select Severity</option>
                  {severities.map((severity, index) => (
                    <option key={index} value={index + 1}>
                      {severity}
                    </option>
                  ))}
                </select>
                {errors.severity && (
                  <p className="text-red-500 text-sm">{errors.severity.message}</p>
                )}
              </div>
            </div>

            {/* Motive & Weather Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {/* Dropdown for motive */}
                <label htmlFor="motive" className="block text-xs font-medium mb-1">
                  Motive
                </label>
                <select
                  id="motive"
                  {...register("motive", {
                    valueAsNumber: true,
                    required: "Motive is required"
                  })}
                  className="border p-2 rounded w-full"
                >
                  <option value="">Select Motive</option>
                  {motives.map((motive, index) => (
                    <option key={index} value={index + 1}>
                      {motive}
                    </option>
                  ))}
                </select>
                {errors.motive && (
                  <p className="text-red-500 text-sm">{errors.motive.message}</p>
                )}
              </div>
              <div>
                {/* Dropdown for weather */}
                <label htmlFor="weather" className="block text-xs font-medium mb-1">
                  Weather
                </label>
                <select
                  id="weather"
                  {...register("weather", {
                    valueAsNumber: true,
                    required: "Weather is required"
                  })}
                  className="border p-2 rounded w-full"
                >
                  <option value="">Select Weather</option>
                  {weathers.map((weather, index) => (
                    <option key={index} value={index + 1}>
                      {weather}
                    </option>
                  ))}
                </select>
                {errors.weather && (
                  <p className="text-red-500 text-sm">{errors.weather.message}</p>
                )}
              </div>
            </div>

            {/* Additional Information Section */}
            <div>
              <label htmlFor="additionalInfo" className="block text-xs font-medium mb-1">
                Additional Info
              </label>
              <textarea
                id="additionalInfo"
                {...register("additionalInfo")}
                className="border p-2 rounded w-full h-24"
                placeholder="Additional Information (optional)"
              />
            </div>

            {/* Form Buttons */}
            <div className="flex justify-end space-x-2">
              {/* Cancel button navigates back without submitting */}
              <button
                type="button"
                className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500"
                onClick={() => router.push("/crime-record")}
              >
                Cancel
              </button>
              {/* Submit button, disabled while form is submitting */}
              <button
                type="submit"
                className={`bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default withAuth(AddCrimePage);
