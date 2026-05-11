'use client';

import { useForecast } from '../../ForecastContext';
import EnsembleView from '../../EnsembleView';
import HotspotTimeline from '../../HotspotTimeline';

export default function EnsemblePage() {
  const { modelRuns, ensembleSummary } = useForecast();

  const defaultSummary = {
    totalMonths: 0,
    modelAgreementRates: {} as any,
    overallAgreement: 0,
    months: [],
    modelRunLabels: {} as any,
  };

  return (
    <div className="space-y-8">
      <EnsembleView
        modelRuns={modelRuns}
        ensembleSummary={ensembleSummary ?? defaultSummary}
      />
      <div className="border-t border-gray-200 pt-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Hotspot Timeline</h3>
        <HotspotTimeline modelRuns={modelRuns} />
      </div>
    </div>
  );
}
