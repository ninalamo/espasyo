import InfoModal from '../../../components/InfoModal';

interface CalculationMethodologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  manpowerSettings?: any;
  historicalDataLength: number;
}

const CalculationMethodologyModal: React.FC<CalculationMethodologyModalProps> = ({
  isOpen,
  onClose,
  manpowerSettings,
  historicalDataLength
}) => {
  return (
    <InfoModal
      isOpen={isOpen}
      onClose={onClose}
      title="How These Numbers Are Calculated"
      size="xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-3">Risk Level Classification</h4>
            <div className="bg-gray-50 p-4 rounded border space-y-2 text-sm">
              <div className="font-medium text-gray-800">Formula: Risk Ratio = Predicted Cases ÷ Historical Average</div>
              <div className="space-y-1 text-gray-700">
                <div>• <strong className="text-green-600">Low Risk:</strong> Ratio ≤ {manpowerSettings?.riskThresholds.lowMax || 0.8} ({((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}% of historical average)</div>
                <div>• <strong className="text-yellow-600">Medium Risk:</strong> Ratio {(manpowerSettings?.riskThresholds.lowMax || 0.8).toFixed(1)} - {(manpowerSettings?.riskThresholds.mediumMax || 1.2).toFixed(1)} ({((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}%)</div>
                <div>• <strong className="text-orange-600">High Risk:</strong> Ratio {(manpowerSettings?.riskThresholds.mediumMax || 1.2).toFixed(1)} - {(manpowerSettings?.riskThresholds.highMax || 1.5).toFixed(1)} ({((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}%)</div>
                <div>• <strong className="text-red-600">Critical Risk:</strong> Ratio &gt; {(manpowerSettings?.riskThresholds.highMax || 1.5).toFixed(1)} (&gt;{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}% of historical average)</div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-700 mb-3">Trend Classification</h4>
            <div className="bg-gray-50 p-4 rounded border space-y-2 text-sm">
              <div className="font-medium text-gray-800">Based on 6-Month Rolling Average Comparison</div>
              <div className="space-y-1 text-gray-700">
                <div>• <strong className="text-red-600">Increasing:</strong> Predicted &gt; 110% of recent 6-month average</div>
                <div>• <strong className="text-yellow-600">Stable:</strong> Predicted within 90-110% of recent average</div>
                <div>• <strong className="text-green-600">Decreasing:</strong> Predicted &lt; 90% of recent average</div>
              </div>
              <div className="pt-2 border-t text-xs text-gray-600">
                <strong>Historical Baseline:</strong> Average of last {historicalDataLength} crime incident records
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-blue-700 mb-3">Statistical Methods Used</h4>
          <div className="bg-gray-50 p-4 rounded space-y-2 text-sm text-gray-700">
            <div><strong>Baseline Calculation:</strong></div>
            <ul className="ml-4 space-y-1">
              <li>• 6-month rolling average for recent trends</li>
              <li>• Historical variance analysis for stability</li>
              <li>• Seasonal pattern identification</li>
            </ul>
            <div className="mt-3"><strong>Risk Assessment:</strong></div>
            <ul className="ml-4 space-y-1">
              <li>• Comparative analysis vs. historical averages</li>
              <li>• Confidence interval weighting</li>
              <li>• Geographic and temporal clustering</li>
            </ul>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Important Note</p>
              <p className="text-amber-700">These calculations are based on historical patterns and statistical models. Results should be used as guidance alongside expert judgment and local knowledge.</p>
            </div>
          </div>
        </div>
      </div>
    </InfoModal>
  );
};

export default CalculationMethodologyModal;