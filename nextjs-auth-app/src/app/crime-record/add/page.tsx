'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddCrimeDto } from "./AddCrimeDto";
import withAuth from "../../hoc/withAuth";

const AddCrimePage = () => {
  const router = useRouter();
  const [newRecord, setNewRecord] = useState<AddCrimeDto>({
    crimeType: "",
    address: "",
    severity: "",
    datetime: "",
    motive: "",
    status: "",
  });

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewRecord({ ...newRecord, [e.target.name]: e.target.value });
  };

  // Submit the form and navigate back
  const handleSubmit = async () => {
    const { crimeType, address, severity, datetime, motive, status } = newRecord;
    if (!crimeType || !address || !severity || !datetime || !motive || !status) return;

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Save to local storage (temporary for testing, replace with API call)
    const existingRecords = JSON.parse(localStorage.getItem("crimeRecords") || "[]");
    localStorage.setItem("crimeRecords", JSON.stringify([...existingRecords, newRecord]));

    // Navigate back to crime list
    router.push("/crimes");
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Add New Crime Record</h1>
      <div className="space-y-2">
        <input type="datetime-local" name="datetime" value={newRecord.datetime} onChange={handleInputChange} className="w-full border p-2 rounded" placeholder="Date & Time" />
        <input type="text" name="crimeType" value={newRecord.crimeType} onChange={handleInputChange} className="w-full border p-2 rounded" placeholder="Crime Type" />
        <input type="text" name="address" value={newRecord.address} onChange={handleInputChange} className="w-full border p-2 rounded" placeholder="Location" />
        <input type="text" name="motive" value={newRecord.motive} onChange={handleInputChange} className="w-full border p-2 rounded" placeholder="Motive" />
        <select name="severity" value={newRecord.severity} onChange={handleInputChange} className="w-full border p-2 rounded">
          <option value="">Select Severity</option>
          <option value="Low">Low</option>
          <option value="Moderate">Moderate</option>
          <option value="High">High</option>
          <option value="Severe">Severe</option>
        </select>
        <select name="status" value={newRecord.status} onChange={handleInputChange} className="w-full border p-2 rounded">
          <option value="">Select Status</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Buttons for actions */}
      <div className="flex justify-end mt-4">
        <button className="bg-gray-400 text-white px-4 py-2 rounded-md mr-2 hover:bg-gray-500 transition" onClick={() => router.push("/crime-record")}>
          Cancel
        </button>
        <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition" onClick={handleSubmit}>
          Save
        </button>
      </div>
    </div>
  );
}

export default withAuth(AddCrimePage);