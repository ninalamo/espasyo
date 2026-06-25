'use client';

import { IncidentDto } from '../types/crime-record/IncidentDto';
import { format } from 'date-fns';

interface CrimeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentDto | null;
}

const CrimeDetailModal: React.FC<CrimeDetailModalProps> = ({ isOpen, onClose, incident }) => {
  if (!isOpen || !incident) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 1: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 2: return 'bg-orange-100 text-orange-800 border-orange-300';
      case 3: return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCrimeTypeColor = (crimeType: number) => {
    switch (crimeType) {
      case 1: return 'bg-red-100 text-red-800 border-red-300'; // Assault
      case 2: return 'bg-purple-100 text-purple-800 border-purple-300'; // Burglary
      case 3: return 'bg-blue-100 text-blue-800 border-blue-300'; // Corruption
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getWeatherColor = (weather: number) => {
    switch (weather) {
      case 1: return 'bg-blue-100 text-blue-800 border-blue-300'; // Partly Cloudy
      case 2: return 'bg-gray-100 text-gray-800 border-gray-300'; // Cloudy
      case 3: return 'bg-slate-100 text-slate-800 border-slate-300'; // Overcast
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Crime Record Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Case ID and Timestamp */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case ID</label>
              <div className="text-lg font-mono bg-gray-50 p-3 rounded-md border">
                {incident.caseId}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
              <div className="text-lg bg-gray-50 p-3 rounded-md border">
                {format(new Date(incident.timeStamp), 'PPP p')}
              </div>
            </div>
          </div>

          {/* Crime Classification */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Crime Type</label>
              <div className={`inline-flex px-3 py-2 rounded-md text-sm font-medium border ${getCrimeTypeColor(incident.crimeType)}`}>
                {incident.crimeTypeText}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
              <div className={`inline-flex px-3 py-2 rounded-md text-sm font-medium border ${getSeverityColor(incident.severity)}`}>
                {incident.severityText}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motive</label>
              <div className="inline-flex px-3 py-2 rounded-md text-sm font-medium border bg-indigo-100 text-indigo-800 border-indigo-300">
                {incident.motiveText}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <div className="bg-gray-50 p-4 rounded-md border">
              <div className="text-lg mb-2">{incident.address}</div>
              <div className="text-sm text-gray-600">
                Police District: <span className="font-medium">{incident.policeDistrictText}</span>
              </div>
            </div>
          </div>

          {/* Environmental Conditions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weather Conditions</label>
              <div className={`inline-flex px-3 py-2 rounded-md text-sm font-medium border ${getWeatherColor(incident.weather)}`}>
                {incident.weatherText}
              </div>
            </div>
          </div>

          {/* Additional Information */}
          {incident.otherMotive && incident.otherMotive !== 'string' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional Information</label>
              <div className="bg-gray-50 p-4 rounded-md border">
                {incident.otherMotive}
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Record ID:</span> {incident.id}
              </div>
              <div>
                <span className="font-medium">Created:</span> {format(new Date(incident.timeStamp), 'PPP')}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-ubuntu-500 text-white rounded-md hover:bg-ubuntu-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrimeDetailModal;