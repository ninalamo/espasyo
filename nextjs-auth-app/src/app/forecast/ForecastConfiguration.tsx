'use client';

import { useState } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';

interface ForecastParams {
  dateFrom: string;
  dateTo: string;
  forecastPeriod: number;
  precincts: number[];
  crimeTypes: number[];
  timeOfDay: string[];
  model: 'linear' | 'polynomial' | 'seasonal' | 'arima';
  confidence: number;
}

interface Props {
  params: ForecastParams;
  onParamsChange: (params: ForecastParams) => void;
  onGenerate: () => void;
  loading: boolean;
}

const ForecastConfiguration: React.FC<Props> = ({ params, onParamsChange, onGenerate, loading }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleParamChange = (key: keyof ForecastParams, value: any) => {
    onParamsChange({ ...params, [key]: value });
  };

  const modelDescriptions = {
    linear: 'Simple linear regression trend - good for steady trends',
    polynomial: 'Quadratic trend analysis - captures acceleration/deceleration',
    seasonal: 'Monthly pattern-based - leverages seasonal crime patterns',
    arima: 'Auto-regressive model - considers recent data patterns'
  };

  const timeOfDayOptions = ['Morning', 'Afternoon', 'Evening'];
  const precinctOptions = Object.entries(GetPrecinctsDictionary).map(([key, value]) => ({ 
    value: parseInt(key), 
    label: value 
  }));
  const crimeTypeOptions = Object.entries(CrimeTypesDictionary).map(([key, value]) => ({ 
    value: parseInt(key), 
    label: value 
  }));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            Forecast Configuration
          </h2>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {isExpanded ? 'Hide Settings' : 'Show Settings'}
          </button>
        </div>
      </div>

      {/* Always visible summary */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Period:</span>
            <span className="font-semibold ml-2">{params.dateFrom} to {params.dateTo}</span>
          </div>
          <div>
            <span className="text-gray-600">Forecast:</span>
            <span className="font-semibold ml-2">{params.forecastPeriod} months ahead</span>
          </div>
          <div>
            <span className="text-gray-600">Model:</span>
            <span className="font-semibold ml-2">{params.model.toUpperCase()}</span>
          </div>
          <div>
            <span className="text-gray-600">Confidence:</span>
            <span className="font-semibold ml-2">{(params.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Expandable configuration */}
      <div className={`overflow-hidden transition-all duration-300 ${
        isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-6 space-y-6">
          {/* Date Range & Forecast Period */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Historical Data Start
              </label>
              <input
                type="date"
                value={params.dateFrom}
                onChange={(e) => handleParamChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Historical Data End
              </label>
              <input
                type="date"
                value={params.dateTo}
                onChange={(e) => handleParamChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forecast Period (Months)
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={params.forecastPeriod}
                onChange={(e) => handleParamChange('forecastPeriod', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Prediction Model
            </label>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {Object.entries(modelDescriptions).map(([model, description]) => (
                <div
                  key={model}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    params.model === model
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onClick={() => handleParamChange('model', model as any)}
                >
                  <div className="flex items-start">
                    <input
                      type="radio"
                      checked={params.model === model}
                      onChange={() => handleParamChange('model', model as any)}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 capitalize">
                        {model === 'arima' ? 'ARIMA' : model}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Confidence Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Level: {(params.confidence * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0.7"
              max="0.99"
              step="0.01"
              value={params.confidence}
              onChange={(e) => handleParamChange('confidence', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>70%</span>
              <span>85%</span>
              <span>99%</span>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precincts (Optional)
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {precinctOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={params.precincts.includes(option.value)}
                      onChange={(e) => {
                        const newPrecincts = e.target.checked
                          ? [...params.precincts, option.value]
                          : params.precincts.filter(p => p !== option.value);
                        handleParamChange('precincts', newPrecincts);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Crime Types (Optional)
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {crimeTypeOptions.slice(0, 8).map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={params.crimeTypes.includes(option.value)}
                      onChange={(e) => {
                        const newTypes = e.target.checked
                          ? [...params.crimeTypes, option.value]
                          : params.crimeTypes.filter(t => t !== option.value);
                        handleParamChange('crimeTypes', newTypes);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time of Day (Optional)
              </label>
              <div className="space-y-2">
                {timeOfDayOptions.map(option => (
                  <label key={option} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={params.timeOfDay.includes(option)}
                      onChange={(e) => {
                        const newTimes = e.target.checked
                          ? [...params.timeOfDay, option]
                          : params.timeOfDay.filter(t => t !== option);
                        handleParamChange('timeOfDay', newTimes);
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <button
          onClick={onGenerate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Forecast...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Forecast
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 mt-2 text-center">
          Analysis will use historical data to predict crime patterns for the specified future period
        </p>
      </div>
    </div>
  );
};

export default ForecastConfiguration;
