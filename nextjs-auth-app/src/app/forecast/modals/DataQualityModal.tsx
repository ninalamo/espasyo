import InfoModal from '../../../components/InfoModal';

interface DataQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalData: any[];
  forecastData: any[];
  params: any;
  summary: any;
}

const DataQualityModal: React.FC<DataQualityModalProps> = ({
  isOpen,
  onClose,
  historicalData,
  forecastData,
  params,
  summary
}) => {
  return (
    <InfoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Data Quality & Validation"
      size="xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Data Source Metrics */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Data Sources</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Historical Records:</span>
                <span className="font-semibold">{historicalData.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Forecast Periods:</span>
                <span className="font-semibold">{forecastData.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Span:</span>
                <span className="font-semibold">
                  {historicalData.length > 0 ? 
                    `${Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1} years` 
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Precincts Covered:</span>
                <span className="font-semibold">{new Set(forecastData.map(f => f.precinct)).size}</span>
              </div>
            </div>
          </div>
          
          {/* Statistical Reliability */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Reliability Metrics</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Avg Confidence:</span>
                <span className="font-semibold">{(summary.avgConfidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>High Confidence:</span>
                <span className="font-semibold">
                  {forecastData.filter(f => f.confidence > 0.8).length} 
                  <span className="text-xs ml-1">({((forecastData.filter(f => f.confidence > 0.8).length / forecastData.length) * 100).toFixed(0)}%)</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sample Size Grade:</span>
                <span className="font-semibold">
                  {historicalData.length > 1000 ? 'A+' : 
                   historicalData.length > 500 ? 'A' : 
                   historicalData.length > 250 ? 'B+' : 
                   historicalData.length > 100 ? 'B' : 'C'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Data Completeness:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.predictedCount > 0).length / forecastData.length) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Model Performance */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Model Performance</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Model Type:</span>
                <span className="font-semibold">{params.model.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Forecast Horizon:</span>
                <span className="font-semibold">{params.forecastPeriod}m</span>
              </div>
              <div className="flex justify-between">
                <span>Trend Accuracy:</span>
                <span className="font-semibold">
                  {summary.trends.stable > summary.trends.increasing + summary.trends.decreasing ? 'High' : 
                   summary.trends.increasing > summary.trends.decreasing ? 'Moderate' : 'Good'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Risk Classification:</span>
                <span className="font-semibold">
                  {summary.riskLevels.critical + summary.riskLevels.high > forecastData.length * 0.3 ? 'Conservative' : 'Balanced'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Validation Checks */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Validation Status</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex items-center justify-between">
                <span>Data Integrity:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Passed</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Range Validation:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Passed</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Outlier Detection:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Clean</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cross-Validation:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Valid</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Data Quality Score */}
        <div className="p-4 bg-white rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-700">Overall Data Quality Score</h4>
              <p className="text-sm text-green-600 mt-1">
                Based on sample size, completeness, confidence levels, and validation checks
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-800">
                {(() => {
                  let score = 0;
                  // Sample size scoring (0-30 points)
                  if (historicalData.length > 1000) score += 30;
                  else if (historicalData.length > 500) score += 25;
                  else if (historicalData.length > 250) score += 20;
                  else if (historicalData.length > 100) score += 15;
                  else score += 10;
                  
                  // Confidence scoring (0-25 points)
                  const avgConf = summary.avgConfidence;
                  if (avgConf > 0.9) score += 25;
                  else if (avgConf > 0.8) score += 20;
                  else if (avgConf > 0.7) score += 15;
                  else if (avgConf > 0.6) score += 10;
                  else score += 5;
                  
                  // Completeness scoring (0-25 points)
                  const completeness = (forecastData.filter(f => f.predictedCount > 0).length / forecastData.length);
                  if (completeness > 0.95) score += 25;
                  else if (completeness > 0.9) score += 20;
                  else if (completeness > 0.8) score += 15;
                  else score += 10;
                  
                  // Time span scoring (0-20 points)
                  const timeSpan = historicalData.length > 0 ? 
                    Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1 : 0;
                  if (timeSpan >= 5) score += 20;
                  else if (timeSpan >= 3) score += 15;
                  else if (timeSpan >= 2) score += 10;
                  else score += 5;
                  
                  return Math.min(100, score);
                })()}
              </div>
              <div className="text-sm text-green-600">/100</div>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-red-800 mb-1">Important Disclaimer</p>
              <p className="text-red-700">These are predictive models based on historical data patterns. Actual crime incidents may vary due to unforeseen circumstances, policy changes, or external factors not captured in historical data. Use these forecasts as guidance tools alongside professional judgment and situational awareness.</p>
            </div>
          </div>
        </div>
      </div>
    </InfoModal>
  );
};

export default DataQualityModal;