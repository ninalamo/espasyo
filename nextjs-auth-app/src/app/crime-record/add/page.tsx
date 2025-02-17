'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddIncidentDto } from "./AddIncidentDto";
import withAuth from "../../hoc/withAuth";
import { apiService } from '../../api/utils/apiService'; // Import the apiService

const AddCrimePage = () => {
  const router = useRouter();
  const [incident, setIncident] = useState<AddIncidentDto>({
    caseId: "",
    crimeType: 0,
    address: "",
    severity: 0,
    timeStamp: "",
    motive: 0,
    weather: 0,
    precinct: 0
  });

  // State to store fetched dropdown values
  const [crimeTypes, setCrimeTypes] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [weathers, setWeathers] = useState<string[]>([]);
  const [precincts, setPrecincts] = useState<string[]>([]);
  const [motives, setMotives] = useState<string[]>([]);

  // State for loading and error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  // Fetch crime types and severity options
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch crime types from API
        const crimeTypeData = await apiService.get<{ [key: string]: string }>("/Incident/enums?name=type");
        setCrimeTypes(Object.values(crimeTypeData));

        // Fetch severity levels from API
        const weatherData = await apiService.get<{ [key: string]: string }>("/Incident/enums?name=weather");
        setWeathers(Object.values(weatherData));

        //fetch precincts
        const precincts = await apiService.get<{ [key: string]: string }>("/Incident/enums?name=precinct");
        setPrecincts(Object.values(precincts));

        //fetch motives
        const motiveData = await apiService.get<{ [key: string]: string }>("/Incident/enums?name=motive");
        setMotives(Object.values(motiveData));

        // Fetch severity levels from API
        const severityData = await apiService.get<{ [key: string]: string }>("/Incident/enums?name=severity");
        setSeverities(Object.values(severityData));
      } catch (err) {
        setError("Failed to load dropdown data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDropdownData();
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setIncident({ ...incident, [e.target.name]: e.target.value });
  };

  // Submit the form and navigate back
  const handleSubmit = async () => {
    const { crimeType, address, severity, timeStamp, motive, weather, precinct } = incident;
    const errors: { [key: string]: string } = {};

    if (!incident.caseId) errors.caseId = "Case ID is required";
    if (!crimeType) errors.crimeType = "Crime type is required";
    if (!address) errors.address = "Address is required";
    if (!severity) errors.severity = "Severity is required";
    if (!timeStamp) errors.timeStamp = "Timestamp is required";
    if (!motive) errors.motive = "Motive is required";
    if (!weather) errors.weather = "Weather is required";
    if (!precinct) errors.precinct = "Precinct is required";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      // Post to the API
      await apiService.post("/incident", incident);

      // Navigate back to crime list
      router.push("/crime-record");
    } catch (err) {
      setError("Failed to save crime record");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add New Crime Record</h1>

      {isLoading ? (
        <div>Loading dropdown options...</div> // Loading message
      ) : error ? (
        <div className="text-red-500">{error}</div> // Display error if any
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            name="caseId"
            value={incident.caseId}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Case ID"
          />
          {validationErrors.caseId && <div className="text-red-500">{validationErrors.caseId}</div>}

          <input
            type="datetime-local"
            name="timeStamp"
            value={incident.timeStamp}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Date & Time"
          />
          {validationErrors.timeStamp && <div className="text-red-500">{validationErrors.timeStamp}</div>}

          <input
            type="text"
            name="address"
            value={incident.address}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Location"
          />
          {validationErrors.address && <div className="text-red-500">{validationErrors.address}</div>}

          {/* Crime Type Dropdown */}
          <select
            name="crimeType"
            value={incident.crimeType}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Crime Type</option>
            {crimeTypes.map((type, index) => (
              <option key={index} value={index + 1}>{type}</option>
            ))}
          </select>
          {validationErrors.crimeType && <div className="text-red-500">{validationErrors.crimeType}</div>}

          {/* Severity Dropdown */}
          <select
            name="severity"
            value={incident.severity}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Severity</option>
            {severities.map((severity, index) => (
              <option key={index} value={index + 1}>{severity}</option>
            ))}
          </select>
          {validationErrors.severity && <div className="text-red-500">{validationErrors.severity}</div>}

          {/* Motive Dropdown */}
          <select
            name="motive"
            value={incident.motive}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Motive</option>
            {motives.map((motive, index) => (
              <option key={index} value={index + 1}>{motive}</option>
            ))}
          </select>
          {validationErrors.motive && <div className="text-red-500">{validationErrors.motive}</div>}

          {/* Precinct Dropdown */}
          <select
            name="precinct"
            value={incident.precinct}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Precinct</option>
            {precincts.map((precinct, index) => (
              <option key={index} value={index + 1}>{precinct}</option>
            ))}
          </select>
          {validationErrors.precinct && <div className="text-red-500">{validationErrors.precinct}</div>}

          {/* Weather Dropdown */}
          <select
            name="weather"
            value={incident.weather}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Weather</option>
            {weathers.map((weather, index) => (
              <option key={index} value={index + 1}>{weather}</option>
            ))}
          </select>
          {validationErrors.weather && <div className="text-red-500">{validationErrors.weather}</div>}
        </div>
      )}

      {/* Buttons for actions */}
      <div className="flex justify-end mt-4">
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded-md mr-2 hover:bg-gray-500 transition"
          onClick={() => router.push("/crime-record")}
        >
          Cancel
        </button>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
          onClick={handleSubmit}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default withAuth(AddCrimePage);
