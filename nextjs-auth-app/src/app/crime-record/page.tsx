// CrimeList.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import withAuth from '../hoc/withAuth';
import { apiService } from '../api/utils/apiService'; // Import apiService
import CrimeTable from './CrimeTable'; // Import the CrimeTable component
import { IncidentDto } from './IncidentDto';
import { CrimeListItemDto } from './CrimeListItemDto';

const CrimeList = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [crimeRecords, setCrimeRecords] = useState<IncidentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Redirect to login if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  // Fetch crime records using apiService with pagination
  useEffect(() => {
    apiService
      .get<{ items: IncidentDto[]; totalPages: number }>('/incident?pageNumber=' + currentPage + '&pageSize=10')
      .then((response) => {
        if (response && response.items) {
          setCrimeRecords(response.items);
          setTotalPages(response.totalPages); // Set total pages from response
        } else {
          setError('No crime records available');
        }
      })
      .catch(() => setError('Failed to load crime records'))
      .finally(() => setIsLoading(false));
  }, [currentPage]); // Re-fetch data when page changes

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crime Records</h1>

      {/* Navigation to Add New Crime and Bulk Upload Pages */}
      <div className="mb-4 flex space-x-4">
        <Link href="/crime-record/add">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            Add New Entry
          </button>
        </Link>

        <Link href="/crime-record/bulk-upload">
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
            Bulk Upload
          </button>
        </Link>
      </div>

      {/* Crime Table and Pagination */}
      <CrimeTable
        crimeRecords={crimeRecords}
        isLoading={isLoading}
        error={error}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
};

export default withAuth(CrimeList);
