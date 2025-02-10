"use client";

import { useState } from "react";

interface AddCrimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newRecord: { date: string; type: string; location: string; status: string }) => void;
}

export default function AddCrimeModal({ isOpen, onClose, onSave }: AddCrimeModalProps) {
  const [newRecord, setNewRecord] = useState({ date: "", type: "", location: "", status: "" });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewRecord({ ...newRecord, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    if (!newRecord.date || !newRecord.type || !newRecord.location || !newRecord.status) return;
    onSave(newRecord);
    setNewRecord({ date: "", type: "", location: "", status: "" }); // Reset form
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Add New Crime Record</h2>

        <div className="space-y-2">
          <input
            type="date"
            name="date"
            value={newRecord.date}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Date"
          />
          <input
            type="text"
            name="type"
            value={newRecord.type}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Crime Type"
          />
          <input
            type="text"
            name="location"
            value={newRecord.location}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
            placeholder="Location"
          />
          <select
            name="status"
            value={newRecord.status}
            onChange={handleInputChange}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Status</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <div className="flex justify-end mt-4">
          <button className="bg-gray-400 text-white px-4 py-2 rounded-md mr-2" onClick={onClose}>
            Cancel
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md" onClick={handleSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
