'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AddIncidentDto } from "./AddIncidentDto";
import withAuth from "../../hoc/withAuth";
import { apiService } from '../../api/utils/apiService';

const precinctZipCodes: { [key: number]: string } = {
  1: "1799",
  2: "1772",
  3: "1771",
  4: "1776",
  5: "1772",
  7: "1773",
  8: "1780",
};

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
    precinct: 0,
    additionalInfo: "" // New field
  });

  const [location, setLocation] = useState("");
  const [crimeTypes, setCrimeTypes] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [weathers, setWeathers] = useState<string[]>([]);
  const [precincts, setPrecincts] = useState<string[]>([]);
  const [motives, setMotives] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);  // New state for submit loading

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        setCrimeTypes(Object.values(await apiService.get("/Incident/enums?name=type")));
        setWeathers(Object.values(await apiService.get("/Incident/enums?name=weather")));
        setPrecincts(Object.values(await apiService.get("/Incident/enums?name=precinct")));
        setMotives(Object.values(await apiService.get("/Incident/enums?name=motive")));
        setSeverities(Object.values(await apiService.get("/Incident/enums?name=severity")));
      } catch (err) {
        setError("Failed to load dropdown data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDropdownData();
  }, []);

  const updateAddress = (newLocation: string, precinctIndex: number) => {
    const precinctName = precincts[precinctIndex - 1] || "";
    const zipCode = precinctZipCodes[precinctIndex] || "Unknown";
    const formattedAddress = `${newLocation} ${precinctName} Muntinlupa City, NCR, Philippines`;
    setIncident((prev) => ({ ...prev, address: formattedAddress.replace('_', ' ') }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "location") {
      setLocation(value);
      updateAddress(value, incident.precinct);
    } else if (name === "precinct") {
      setIncident((prev) => {
        const updatedIncident = { ...prev, [name]: Number(value) };
        updateAddress(location, Number(value));
        return updatedIncident;
      });
    } else {
      setIncident({ ...incident, [name]: value });
    }
  };

  const handleSubmit = async () => {
    const { caseId, crimeType, severity, timeStamp, motive, weather, precinct, additionalInfo } = incident;
    const errors: { [key: string]: string } = {};

    if (!caseId) errors.caseId = "Case ID is required";
    if (!crimeType) errors.crimeType = "Crime type is required";
    if (!location) errors.address = "Street address is required";
    if (!severity) errors.severity = "Severity is required";
    if (!timeStamp) errors.timeStamp = "Timestamp is required";
    if (!motive) errors.motive = "Motive is required";
    if (!weather) errors.weather = "Weather is required";
    if (!precinct) errors.precinct = "Precinct is required";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);  // Set submitting state to true

    try {
      await apiService.post("/incident", incident);
      router.push("/crime-record");
    } catch (err) {
      setError("Failed to save crime record");
    } finally {
      setIsSubmitting(false);  // Set submitting state back to false
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-4">Add New Crime Record</h1>

      {isLoading ? (
        <div>Loading dropdown options...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="space-y-4">
          {/* Case ID & Timestamp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <input type="text" name="caseId" value={incident.caseId} onChange={handleInputChange} className="border p-2 rounded w-full" placeholder="Case ID" />
              {validationErrors.caseId && <p className="text-red-500 text-sm">{validationErrors.caseId}</p>}
            </div>
            <div>
              <input type="datetime-local" name="timeStamp" value={incident.timeStamp} onChange={handleInputChange} className="border p-2 rounded w-full" />
              {validationErrors.timeStamp && <p className="text-red-500 text-sm">{validationErrors.timeStamp}</p>}
            </div>
          </div>

          {/* Address & Precinct */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <input type="text" name="location" value={location} onChange={handleInputChange} className="border p-2 rounded w-full" placeholder="Street Address" />
              {validationErrors.address && <p className="text-red-500 text-sm">{validationErrors.address}</p>}
            </div>
            <div>
              <select name="precinct" value={incident.precinct} onChange={handleInputChange} className="border p-2 rounded w-full">
                <option value="">Select Precinct</option>
                {precincts.map((precinct, index) => (
                  <option key={index} value={index + 1}>{precinct}</option>
                ))}
              </select>
              {validationErrors.precinct && <p className="text-red-500 text-sm">{validationErrors.precinct}</p>}
            </div>
          </div>
          <p className="text-gray-600 text-sm">Generated Address: {incident.address}</p>

          {/* Crime Type & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <select name="crimeType" value={incident.crimeType} onChange={handleInputChange} className="border p-2 rounded w-full">
                <option value="">Select Crime Type</option>
                {crimeTypes.map((type, index) => (
                  <option key={index} value={index + 1}>{type}</option>
                ))}
              </select>
              {validationErrors.crimeType && <p className="text-red-500 text-sm">{validationErrors.crimeType}</p>}
            </div>
            <div>
              <select name="severity" value={incident.severity} onChange={handleInputChange} className="border p-2 rounded w-full">
                <option value="">Select Severity</option>
                {severities.map((severity, index) => (
                  <option key={index} value={index + 1}>{severity}</option>
                ))}
              </select>
              {validationErrors.severity && <p className="text-red-500 text-sm">{validationErrors.severity}</p>}
            </div>
          </div>

          {/* Motive & Weather */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <select name="motive" value={incident.motive} onChange={handleInputChange} className="border p-2 rounded w-full">
                <option value="">Select Motive</option>
                {motives.map((motive, index) => (
                  <option key={index} value={index + 1}>{motive}</option>
                ))}
              </select>
              {validationErrors.motive && <p className="text-red-500 text-sm">{validationErrors.motive}</p>}
            </div>
            <div>
              <select name="weather" value={incident.weather} onChange={handleInputChange} className="border p-2 rounded w-full">
                <option value="">Select Weather</option>
                {weathers.map((weather, index) => (
                  <option key={index} value={index + 1}>{weather}</option>
                ))}
              </select>
              {validationErrors.weather && <p className="text-red-500 text-sm">{validationErrors.weather}</p>}
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <textarea name="additionalInfo" value={incident.additionalInfo} onChange={handleInputChange} className="border p-2 rounded w-full h-24" placeholder="Additional Information (optional)" />
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-2">
            <button className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500" onClick={() => router.push("/crime-record")}>Cancel</button>
            <button
              className={`bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default withAuth(AddCrimePage);
