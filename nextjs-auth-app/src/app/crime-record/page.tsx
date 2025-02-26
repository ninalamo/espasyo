'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import withAuth from '../hoc/withAuth';
import { apiService } from '../api/utils/apiService'; // API service to handle HTTP requests
import CrimeTable from './CrimeTable'; // Component that displays the crime records in a table
import { IncidentDto } from '../../types/crime-record/IncidentDto'; // Type definition for crime records
import debounce from 'lodash.debounce'; // Import debounce to limit rapid function calls

const CrimeList = () => {
  // Get session data and authentication status using NextAuth's useSession hook
  const { data: session, status } = useSession();
  const router = useRouter();

  // Local state for managing crime records, loading status, errors, and pagination
  const [crimeRecords, setCrimeRecords] = useState<IncidentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Local state for search input and debounced search query.
  // searchInput stores the immediate value from the input,
  // while searchQuery is updated after a debounce delay.
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Redirect to login if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // While the authentication status is loading, show a loading indicator
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-700">
        Loading...
      </div>
    );
  }

  // If there is no session (user not authenticated), return nothing
  if (!session) {
    return null;
  }

  // Debounced function to update the search query and reset the page to 1.
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
    }, 300),
    []
  );

  // Handler for search input changes. It updates the local searchInput state
  // immediately and uses the debounced function to update the searchQuery.
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSetSearchQuery(value);
  };

  // Fetch crime records from the API when the component mounts,
  // or when currentPage or searchQuery changes.
  // Pagination is applied via the query parameters pageNumber, pageSize, and search.
  useEffect(() => {
    setIsLoading(true);
    apiService
      .get<{ items: IncidentDto[]; totalPages: number }>(
        `/incident?search=${encodeURIComponent(searchQuery)}&pageNumber=${currentPage}&pageSize=10`
      )
      .then((response) => {
        if (response && response.items) {
          setCrimeRecords(response.items);
          setTotalPages(response.totalPages); // Update total pages based on API response
        } else {
          setError('No crime records available');
        }
      })
      .catch(() => setError('Failed to load crime records'))
      .finally(() => setIsLoading(false));
  }, [currentPage, searchQuery]);

  // Regular page change handler that updates the current page if within bounds.
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Create a debounced version of the page change handler to avoid rapid-fire API calls.
  // debounce delays the execution until 300ms have passed without a new call.
  const debouncedHandlePageChange = useCallback(
    debounce((page: number) => {
      handlePageChange(page);
    }, 300), // Adjust the delay as needed (300ms in this example)
    [totalPages]
  );

  // Clean up the debounced function when the component unmounts to avoid memory leaks.
  useEffect(() => {
    return () => {
      debouncedHandlePageChange.cancel();
    };
  }, [debouncedHandlePageChange]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crime Records</h1>

      {/* Container for navigation buttons and search input */}
      <div className="mb-4 flex items-center justify-between">
        {/* Navigation Buttons */}
        <div className="flex space-x-4">
          <Link href="/crime-record/add">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              Add Record
            </button>
          </Link>
          <Link href="/crime-record/bulk-upload">
            <button className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition" disabled title="Disabled">
              Bulk Upload
            </button>
          </Link>
        </div>

        {/* Search Input with Search Icon */}
        <div className="flex items-center">
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search crime records..."
            className="border p-2 rounded-md"
          />
          <button className="ml-2 p-2 bg-gray-200 rounded-md hover:bg-gray-300 transition">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3a6 6 0 100 12A6 6 0 009 3zM2 9a7 7 0 1112.452 4.391l3.328 3.329a1 1 0 01-1.414 1.414l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>


      {/* Pass down data and handlers to the CrimeTable component */}
      <CrimeTable
        crimeRecords={crimeRecords}
        isLoading={isLoading}
        error={error}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={debouncedHandlePageChange} // Use the debounced page change handler
      />
    </div>
  );
};

export default withAuth(CrimeList);
