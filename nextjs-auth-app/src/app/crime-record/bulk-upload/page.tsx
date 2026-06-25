'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import withAuth from '../../hoc/withAuth';
import { processCsvFile, uploadIncidents, BulkUploadResult, ProcessingResult } from '../../../services/csvProcessingService';

interface UploadProgress {
  step: 'idle' | 'processing' | 'uploading' | 'complete';
  message: string;
  progress: number;
}

const BulkUploadPage = () => {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    step: 'idle',
    message: '',
    progress: 0
  });
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('Please select a valid CSV file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setProcessingResult(null);
      setUploadResult(null);
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/incident-upload-template.csv';
    link.download = 'incident-upload-template.csv';
    link.click();
  };

  const processAndUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploadProgress({
        step: 'processing',
        message: 'Reading and validating CSV file...',
        progress: 10
      });

      // Read file content
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(selectedFile);
      });

      setUploadProgress({
        step: 'processing',
        message: 'Processing CSV data...',
        progress: 30
      });

      // Process CSV
      const processingResult = await processCsvFile(fileContent);
      setProcessingResult(processingResult);

      if (!processingResult.success || !processingResult.data || processingResult.data.length === 0) {
        setError('No valid data found in CSV file');
        setUploadProgress({
          step: 'idle',
          message: '',
          progress: 0
        });
        return;
      }

      setUploadProgress({
        step: 'uploading',
        message: `Uploading ${processingResult.data.length} incidents...`,
        progress: 50
      });

      // Upload to backend
      const uploadResult = await uploadIncidents(processingResult.data);
      setUploadResult(uploadResult);

      setUploadProgress({
        step: 'complete',
        message: `Upload complete! ${uploadResult.successCount} successful, ${uploadResult.failureCount} failed`,
        progress: 100
      });

    } catch (error) {
      setError(`Upload failed: ${error}`);
      setUploadProgress({
        step: 'idle',
        message: '',
        progress: 0
      });
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setProcessingResult(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress({
      step: 'idle',
      message: '',
      progress: 0
    });
  };

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Bulk Upload Crime Records</h1>

        {/* Instructions */}
        <div className="bg-ubuntu-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-blue-800 mb-3">Instructions</h2>
          <div className="space-y-2 text-ubuntu-700">
            <p>1. Download the CSV template and fill in your incident data</p>
            <p>2. Ensure all required fields are filled (address, severity, crimeType, motive, policeDistrict, weather, timeStamp)</p>
            <p>3. CASE-ID will be generated automatically - do not include it</p>
            <p>4. Upload your completed CSV file</p>
            <p>5. Review the results and any errors</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="mt-4 bg-ubuntu-500 text-white px-4 py-2 rounded-md hover:bg-ubuntu-700 transition"
          >
            Download CSV Template
          </button>
        </div>

        {/* File Upload Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Upload CSV File</h2>
          
          <div className="space-y-4">
            <div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-ubuntu-50 file:text-ubuntu-700 hover:file:bg-blue-100"
                disabled={uploadProgress.step === 'processing' || uploadProgress.step === 'uploading'}
              />
            </div>

            {selectedFile && (
              <div className="text-sm text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-3">
                {error}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={processAndUpload}
                disabled={!selectedFile || uploadProgress.step === 'processing' || uploadProgress.step === 'uploading'}
                className={`px-6 py-2 rounded-md font-medium ${
                  !selectedFile || uploadProgress.step === 'processing' || uploadProgress.step === 'uploading'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {uploadProgress.step === 'processing' ? 'Processing...' : 
                 uploadProgress.step === 'uploading' ? 'Uploading...' : 
                 'Process & Upload'}
              </button>

              {uploadProgress.step === 'complete' && (
                <button
                  onClick={reset}
                  className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Upload Another File
                </button>
              )}

              <button
                onClick={() => router.push('/crime-record')}
                className="px-6 py-2 bg-ubuntu-500 text-white rounded-md hover:bg-ubuntu-700"
              >
                Back to Records
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {uploadProgress.step !== 'idle' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{uploadProgress.message}</span>
              <span className="text-sm text-gray-500">{uploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-ubuntu-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Processing Results */}
        {processingResult && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Processing Results</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <div className="text-2xl font-bold text-green-600">{processingResult.processedCount}</div>
                <div className="text-sm text-green-700">Valid Records</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <div className="text-2xl font-bold text-red-600">{processingResult.skippedCount}</div>
                <div className="text-sm text-red-700">Invalid Records</div>
              </div>
            </div>

            {processingResult.errors.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Validation Errors:</h3>
                <div className="bg-red-50 border border-red-200 rounded p-4 max-h-40 overflow-y-auto">
                  {processingResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700 mb-1">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Results */}
        {uploadResult && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Upload Results</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <div className="text-2xl font-bold text-green-600">{uploadResult.successCount}</div>
                <div className="text-sm text-green-700">Successfully Uploaded</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <div className="text-2xl font-bold text-red-600">{uploadResult.failureCount}</div>
                <div className="text-sm text-red-700">Failed Uploads</div>
              </div>
            </div>

            {uploadResult.failureCount > 0 && (
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Upload Errors:</h3>
                <div className="bg-red-50 border border-red-200 rounded p-4 max-h-40 overflow-y-auto">
                  {uploadResult.results
                    .filter(r => !r.success)
                    .slice(0, 10) // Show first 10 errors
                    .map((result, index) => (
                      <div key={index} className="text-sm text-red-700 mb-1">
                        {result.errors?.join(', ') || 'Unknown error'}
                      </div>
                    ))}
                  {uploadResult.results.filter(r => !r.success).length > 10 && (
                    <div className="text-sm text-red-600 mt-2">
                      ... and {uploadResult.results.filter(r => !r.success).length - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            {uploadResult.successCount > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                <p className="text-green-700 font-medium">
                  Success! {uploadResult.successCount} incident(s) have been uploaded and will appear in your crime records.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default withAuth(BulkUploadPage);