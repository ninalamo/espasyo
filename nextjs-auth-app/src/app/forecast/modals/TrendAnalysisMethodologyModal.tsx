import InfoModal from '../../../components/InfoModal';

interface TrendAnalysisMethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  historicalData: any[];
  overallStats: any;
}

const TrendAnalysisMethodologyModal: React.FC<TrendAnalysisMethodologyModalProps> = ({
  isOpen,
  onClose,
  historicalData,
  overallStats
}) => {
  return (
    <InfoModal
      isOpen={isOpen}
      onClose={onClose}
      title="Trend Analysis Methodology"
      size="xl"
    >
      <div className="space-y-6">
        {/* Trend Indicators Legend */}
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Understanding Trend Indicators
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-blue-700 mb-3">Symbol Meanings</h5>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <span className="text-red-600 font-bold text-lg mr-3">↗</span>
                    <span><strong>Increasing Trend</strong></span>
                  </div>
                  <span className="text-gray-600">Predicted cases &gt; 110% of recent average</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <span className="text-yellow-600 font-bold text-lg mr-3">→</span>
                    <span><strong>Stable Trend</strong></span>
                  </div>
                  <span className="text-gray-600">Predicted cases within 90-110% of recent average</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <span className="text-green-600 font-bold text-lg mr-3">↘</span>
                    <span><strong>Decreasing Trend</strong></span>
                  </div>
                  <span className="text-gray-600">Predicted cases &lt; 90% of recent average</span>
                </div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-blue-700 mb-3">Number Interpretation</h5>
              <div className="bg-white p-4 rounded border">
                <div className="text-sm space-y-2">
                  <div className="font-medium text-gray-800">Example: ↗ 36•→ 46•↘ 38</div>
                  <div className="pl-4 space-y-1 text-gray-700">
                    <div>• <strong>36</strong> forecast periods show <span className="text-red-600">increasing</span> crime trends</div>
                    <div>• <strong>46</strong> forecast periods show <span className="text-yellow-600">stable</span> crime trends</div>
                    <div>• <strong>38</strong> forecast periods show <span className="text-green-600">decreasing</span> crime trends</div>
                    <div className="pt-1 text-xs text-gray-600">Total: 120 forecast data points across all months and crime types for this precinct</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Validation and Transparency */}
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Data Validation & Methodology
          </h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <h5 className="font-medium text-green-700 mb-2">Data Sources</h5>
              <ul className="space-y-1 text-green-800">
                <li>• Historical crime incident records</li>
                <li>• Clustering analysis results</li>
                <li>• Temporal pattern analysis</li>
                <li>• Geographic crime distribution</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium text-green-700 mb-2">Calculation Method</h5>
              <ul className="space-y-1 text-green-800">
                <li>• 6-month rolling average baseline</li>
                <li>• SSA trend analysis</li>
                <li>• Seasonal adjustment factors</li>
                <li>• Confidence interval weighting</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium text-green-700 mb-2">Validation Metrics</h5>
              <div className="space-y-1 text-green-800">
                <div>• <strong>Avg Confidence:</strong> {overallStats?.avgConfidence ? (overallStats.avgConfidence * 100).toFixed(1) : 'N/A'}%</div>
                <div>• <strong>Data Points:</strong> {overallStats?.totalForecasts || 0}</div>
                <div>• <strong>Time Horizon:</strong> {historicalData.length > 0 ? Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1 : 0} years</div>
                <div>• <strong>Reliability:</strong> Based on sample size and historical variance</div>
              </div>
            </div>
          </div>
        </div>

        {/* Limitations and Disclaimers */}
        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Important Limitations & Disclaimers
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-yellow-800">
            <div>
              <h5 className="font-medium mb-2">Forecast Limitations</h5>
              <ul className="space-y-1">
                <li>• Predictions based on historical patterns only</li>
                <li>• Cannot account for unforeseeable events</li>
                <li>• Accuracy decreases for longer time horizons</li>
                <li>• Requires minimum 2+ years of historical data</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium mb-2">External Factors Not Included</h5>
              <ul className="space-y-1">
                <li>• Policy changes or new legislation</li>
                <li>• Economic conditions and unemployment</li>
                <li>• Social events and demographic changes</li>
                <li>• Weather patterns and seasonal variations</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 rounded border-l-4 border-yellow-400">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ <strong>Use Advisory:</strong> These forecasts are statistical predictions based on historical data. 
              They should be used as one input among many for decision-making, not as absolute predictions. 
              Always combine with expert judgment and real-time intelligence.
            </p>
          </div>
        </div>
      </div>
    </InfoModal>
  );
};

export default TrendAnalysisMethodologyModal;