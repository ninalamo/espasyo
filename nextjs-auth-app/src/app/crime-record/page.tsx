'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import AddCrimeModal from './AddCrimeModal';
import withAuth from '../hoc/withAuth';

function CrimeRecord() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login'); // Redirect to login page
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
  }

  if (!session) {
    return null; // Avoid rendering anything while redirecting
  }

  const [crimeRecords, setCrimeRecords] = useState<
    { id: number; date: string; type: string; location: string; status: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Simulate an API call
    setTimeout(() => {
      setCrimeRecords([
        { id: 1, date: '2024-02-10', type: 'Theft', location: 'Downtown', status: 'Ongoing' },
        { id: 2, date: '2024-02-09', type: 'Assault', location: 'City Park', status: 'Resolved' },
        { id: 3, date: '2024-02-08', type: 'Burglary', location: 'Suburb', status: 'Ongoing' },
      ]);
      setIsLoading(false);
    }, 1000);
  }, []);

  const addNewRecord = async (newRecord: { date: string; type: string; location: string; status: string }) => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
    setCrimeRecords((prev) => [...prev, { id: prev.length + 1, ...newRecord }]);
  };

  return (
    <>
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Crime Records</h1>

        {/* Add New Entry Button */}
        <div className="mb-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            onClick={() => setIsModalOpen(true)}
          >
            Add New Entry
          </button>
        </div>

        {/* Loader */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          </div>
        ) : crimeRecords.length === 0 ? (
          <div className="text-center text-gray-500 mt-6 text-lg">Nothing to display</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">ID</th>
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Type</th>
                  <th className="border p-2">Location</th>
                  <th className="border p-2">Status</th>
                  <th className="border p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {crimeRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="border p-2">{record.id}</td>
                    <td className="border p-2">{record.date}</td>
                    <td className="border p-2">{record.type}</td>
                    <td className="border p-2">{record.location}</td>
                    <td className="border p-2">{record.status}</td>
                    <td className="border p-2">
                      <button className="text-blue-600 hover:underline mr-2">Edit</button>
                      <button className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        <AddCrimeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={addNewRecord} />
      </div>
    </>
  );
}

export default withAuth(CrimeRecord);