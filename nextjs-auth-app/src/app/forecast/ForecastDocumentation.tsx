'use client';

import { useState } from 'react';

const sections = [
  { id: 'overview', title: 'Overview', icon: '📊' },
  { id: 'methodology', title: 'Methodology', icon: '🔬' },
  { id: 'validation', title: 'Validation & Accuracy', icon: '✅' },
  { id: 'limitations', title: 'Limitations', icon: '⚠️' },
  { id: 'interpretation', title: 'How to Use', icon: '📖' },
];

const ForecastDocumentation: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-xl font-semibold text-blue-800 mb-4">Crime Forecasting System Overview</h3>
              <p className="text-blue-700 mb-4">
                This forecasting system predicts future crime patterns by analyzing trends in historical incident data.
                The system uses Singular Spectrum Analysis (SSA) — a time series decomposition method — combined with
                K-Means clustering to identify crime hotspots and generate risk assessments.
              </p>

              <div>
                <h4 className="font-medium text-blue-800 mb-3">Key Capabilities</h4>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li>• Predicts crime patterns up to 12 months ahead</li>
                  <li>• Analyzes trends by precinct and crime type</li>
                  <li>• Identifies high-risk areas and forecast periods</li>
                  <li>• Provides prediction ranges for each forecast</li>
                  <li>• Validates accuracy using holdout testing</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'methodology':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Statistical Forecasting Methodology</h3>

              <div className="space-y-8">
                {/* Data Processing Pipeline */}
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-4">1. Data Processing Pipeline</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { title: 'Data Collection', desc: 'Historical crime incident records aggregated by precinct, time, and type' },
                      { title: 'Preprocessing', desc: 'Data cleaning and validation before analysis' },
                      { title: 'Clustering', desc: 'K-Means grouping of similar incidents by location and time' },
                      { title: 'Forecast Generation', desc: 'SSA time series decomposition and trend projection' }
                    ].map(step => (
                      <div key={step.title} className="bg-white p-4 rounded border">
                        <h5 className="font-medium text-gray-800 mb-2">{step.title}</h5>
                        <p className="text-sm text-gray-600">{step.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Forecast Model */}
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-4">2. Forecast Model</h4>
                  <div className="bg-white p-6 rounded border space-y-4">
                    <div>
                      <h5 className="font-medium text-gray-800">Singular Spectrum Analysis (SSA)</h5>
                      <p className="text-sm text-gray-600 mt-2">
                        Primary forecasting method. SSA decomposes historical crime data into three components:
                      </p>
                      <ul className="mt-2 text-sm text-gray-600 ml-4 space-y-1">
                        <li>• <strong>Trend</strong> — long-term direction of crime patterns</li>
                        <li>• <strong>Seasonal</strong> — recurring monthly patterns</li>
                        <li>• <strong>Residual</strong> — random fluctuations not explained by trend or season</li>
                      </ul>
                      <p className="text-sm text-gray-600 mt-2">
                        The model then reconstructs these components to generate predictions with lower/upper bounds (95% confidence interval by default).
                      </p>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-800">Baseline Calculation</h5>
                      <p className="text-sm text-gray-600 mt-2">
                        6-month rolling average used as reference point for trend and risk classification.
                      </p>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-800">Risk Assessment</h5>
                      <p className="text-sm text-gray-600 mt-2">
                        Risk = predicted count ÷ historical average. Higher ratios indicate greater expected increase.
                      </p>
                      <div className="mt-2 text-sm text-gray-600">
                        <div>Risk Levels: Low (≤0.8), Medium (0.8-1.2), High (1.2-1.5), Critical (&gt;1.5)</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction Intervals */}
                <div>
                  <h4 className="text-lg font-medium text-gray-700 mb-4">3. Prediction Intervals</h4>
                  <div className="bg-white p-6 rounded border">
                    <div className="space-y-3 text-sm text-gray-600">
                      <div><strong>Source:</strong> Prediction ranges come from the ML.NET SSA model based on the spread of historical data around the trend.</div>
                      <div><strong>Interval width:</strong> Wider intervals indicate more uncertainty — typical when historical patterns are irregular.</div>
                      <div><strong>Confidence level:</strong> Set at request time (default 95%). The model generates lower and upper bounds at this level.</div>
                      <div><strong>Note:</strong> These bounds show the expected range, not a guarantee. Actual values may fall outside the range.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'validation':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-xl font-semibold text-green-800 mb-4">Model Validation & Accuracy Assessment</h3>

              <div className="space-y-6">
                {/* Validation Methods */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-700 mb-4">Validation Methods</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-gray-800 mb-3">Holdout Validation</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Train/Test Split:</strong> Last 3 months of data held out as test set</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Out-of-Sample:</strong> Predictions checked against held-out data the model has never seen</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Error Metrics:</strong> MAE, RMSE, and MAPE computed on test data</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-800 mb-3">Model Diagnostics</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Residual Analysis:</strong> Forecast errors checked for systematic bias</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Seasonal Decomposition:</strong> Recurring patterns are captured by SSA</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span><strong>Confidence Calibration:</strong> Prediction intervals verified against holdout spread</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Metrics */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-700 mb-4">Expected Accuracy Ranges</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                      <span className="font-medium">1-3 Month Forecasts:</span>
                      <span className="text-green-700 font-semibold">±15-25% typical error range</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                      <span className="font-medium">4-6 Month Forecasts:</span>
                      <span className="text-yellow-700 font-semibold">±25-35% typical error range</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                      <span className="font-medium">7-12 Month Forecasts:</span>
                      <span className="text-orange-700 font-semibold">±35-50% typical error range</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-4">
                    <strong>Note:</strong> Error ranges are estimates based on historical model performance.
                    Actual accuracy may vary depending on data quality, external factors, and local conditions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'limitations':
        return (
          <div className="space-y-6">
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <h3 className="text-xl font-semibold text-red-800 mb-4">Important Limitations & Constraints</h3>

              <div className="space-y-6">
                {/* Data Limitations */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Data & Methodology Limitations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-red-700 mb-3">Historical Dependence</h5>
                      <ul className="space-y-2 text-sm text-red-800">
                        <li>• Predictions based entirely on past patterns</li>
                        <li>• Cannot predict unprecedented events</li>
                        <li>• Assumes future follows historical trends</li>
                        <li>• Limited to available historical data quality</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-medium text-red-700 mb-3">External Factors Not Included</h5>
                      <ul className="space-y-2 text-sm text-red-800">
                        <li>• Policy changes and new legislation</li>
                        <li>• Economic conditions and unemployment rates</li>
                        <li>• Social events and demographic shifts</li>
                        <li>• Weather patterns and seasonal variations</li>
                        <li>• Major community events or infrastructure changes</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Technical Limitations */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Technical & Statistical Limitations</h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                      <h5 className="font-medium text-yellow-800 mb-2">Temporal Accuracy Degradation</h5>
                      <p className="text-sm text-yellow-700">
                        Forecast accuracy decreases significantly with longer time horizons. Predictions beyond 6 months
                        should be used only for high-level strategic planning, not operational decisions.
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                      <h5 className="font-medium text-yellow-800 mb-2">Spatial Resolution Limits</h5>
                      <p className="text-sm text-yellow-700">
                        Predictions are aggregated at the precinct level. Micro-geographic patterns within precincts
                        cannot be captured, potentially missing localized crime hotspots.
                      </p>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                      <h5 className="font-medium text-yellow-800 mb-2">Model Assumptions</h5>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Crime patterns repeat in recognizable ways</li>
                        <li>• Historical relationships remain relevant</li>
                        <li>• Data quality is consistent across time periods</li>
                        <li>• Reporting patterns remain unchanged</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Risk Factors */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">High-Impact Risk Factors</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        title: 'Black Swan Events',
                        desc: 'Rare, unpredictable events that can dramatically alter crime patterns',
                        examples: ['Natural disasters', 'Major policy changes', 'Economic crises']
                      },
                      {
                        title: 'Seasonal Anomalies',
                        desc: 'Unusual seasonal patterns that deviate from historical norms',
                        examples: ['Extreme weather', 'Holiday disruptions', 'Event-driven changes']
                      },
                      {
                        title: 'Reporting Changes',
                        desc: 'Changes in crime reporting or classification procedures',
                        examples: ['New reporting systems', 'Policy updates', 'Jurisdiction changes']
                      }
                    ].map(factor => (
                      <div key={factor.title} className="p-4 bg-red-50 rounded border border-red-200">
                        <h5 className="font-medium text-red-800 mb-2">{factor.title}</h5>
                        <p className="text-sm text-red-700 mb-3">{factor.desc}</p>
                        <ul className="text-xs text-red-600 space-y-1">
                          {factor.examples.map(example => (
                            <li key={example}>• {example}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'interpretation':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-xl font-semibold text-blue-800 mb-4">How to Interpret and Use Forecasts</h3>

              <div className="space-y-6">
                {/* Confidence Levels */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Understanding Confidence Levels</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-blue-700 mb-3">Confidence Interpretation Guide</h5>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                          <span className="font-medium">90%+ Confidence</span>
                          <span className="text-green-700 text-sm">High reliability - suitable for operational planning</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                          <span className="font-medium">70-89% Confidence</span>
                          <span className="text-yellow-700 text-sm">Moderate reliability - good for strategic planning</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                          <span className="font-medium">50-69% Confidence</span>
                          <span className="text-orange-700 text-sm">Lower reliability - use with caution</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded">
                          <span className="font-medium">&lt;50% Confidence</span>
                          <span className="text-red-700 text-sm">Unreliable - not recommended for decisions</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-blue-700 mb-3">Recommended Use Cases</h5>
                      <div className="space-y-3 text-sm">
                        <div className="p-3 bg-blue-50 rounded">
                          <strong>Strategic Planning (6-12 months):</strong>
                          <br />Budget allocation, resource planning, policy development
                        </div>
                        <div className="p-3 bg-blue-50 rounded">
                          <strong>Tactical Planning (3-6 months):</strong>
                          <br />Shift scheduling, patrol routes, equipment deployment
                        </div>
                        <div className="p-3 bg-blue-50 rounded">
                          <strong>Operational Planning (1-3 months):</strong>
                          <br />Daily operations, immediate resource allocation, crisis response
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Best Practices */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Best Practices for Using Forecasts</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-green-700 mb-3">Do&apos;s</h5>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Combine forecasts with expert judgment and local knowledge
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Use confidence levels to assess prediction reliability
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Regularly validate predictions against actual outcomes
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Consider multiple forecast scenarios for planning
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Update forecasts regularly with new data
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-medium text-red-700 mb-3">Don&apos;ts</h5>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Don&apos;t rely solely on forecasts for critical decisions
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Don&apos;t ignore low confidence warnings
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Don&apos;t assume forecasts account for all variables
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Don&apos;t use long-term forecasts for immediate tactical decisions
                        </li>
                        <li className="flex items-start">
                          <svg className="w-4 h-4 text-red-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Don&apos;t forget to consider external factors not in the model
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Decision Framework */}
                <div className="bg-white p-6 rounded border">
                  <h4 className="text-lg font-medium text-gray-800 mb-4">Decision-Making Framework</h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded">
                      <h5 className="font-medium text-blue-800 mb-2">Step 1: Assess Data Quality</h5>
                      <p className="text-sm text-blue-700">
                        Check the data quality score, sample size, and time coverage. Scores above 80 indicate high reliability.
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded">
                      <h5 className="font-medium text-blue-800 mb-2">Step 2: Evaluate Confidence Levels</h5>
                      <p className="text-sm text-blue-700">
                        Focus on predictions with confidence levels appropriate for your decision timeline and risk tolerance.
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded">
                      <h5 className="font-medium text-blue-800 mb-2">Step 3: Consider External Factors</h5>
                      <p className="text-sm text-blue-700">
                        Identify any external factors not captured by the model that might affect future crime patterns.
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded">
                      <h5 className="font-medium text-blue-800 mb-2">Step 4: Plan for Uncertainty</h5>
                      <p className="text-sm text-blue-700">
                        Build flexibility into plans to account for forecast uncertainty and unexpected changes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-800 mb-4">Documentation Sections</h3>
            <nav className="space-y-2">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-100 text-blue-800'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.title}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ForecastDocumentation;
