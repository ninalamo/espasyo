import { format } from 'date-fns';
import { useState } from 'react';
import { IncidentDto } from "../../types/crime-record/IncidentDto";
import CrimeDetailModal from '../../components/CrimeDetailModal';

interface CrimeTableProps {
  crimeRecords: IncidentDto[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const CrimeTable: React.FC<CrimeTableProps> = ({
  crimeRecords,
  isLoading,
  error,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<IncidentDto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewDetails = (incident: IncidentDto) => {
    setSelectedIncident(incident);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedIncident(null);
  };
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 mt-6 text-lg">{error}</div>;
  }

  if (crimeRecords.length === 0) {
    return <div className="text-center text-gray-500 mt-6 text-lg">Nothing to display</div>;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'MMM-dd-yyyy hh:mm a');
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2">Case ID</th>
              <th className="border p-2">Crime Type</th>
              <th className="border p-2">Address</th>
              <th className="border p-2">Severity</th>
              <th className="border p-2">Date & Time</th>
              <th className="border p-2">Motive</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {crimeRecords.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="border p-2">{record.caseId ?? 'N/A'}</td>
                <td className="border p-2">{record.crimeTypeText}</td>
                <td className="border p-2">{record.address}</td>
                <td className="border p-2">{record.severityText}</td>
                <td className="border p-2">{formatDate(record.timeStamp)}</td>
                <td className="border p-2">{record.motiveText}</td>
                <td className="border p-2">
                  <button 
                    onClick={() => handleViewDetails(record)}
                    className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls with First and Last Buttons */}
      <div className="flex justify-center items-center mt-4 space-x-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 transition disabled:opacity-50"
        >
          First
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 transition disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-gray-700">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 transition disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 transition disabled:opacity-50"
        >
          Last
        </button>
      </div>

      {/* Crime Detail Modal */}
      <CrimeDetailModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        incident={selectedIncident}
      />
    </div>
  );
};

export default CrimeTable;
