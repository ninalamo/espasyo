'use client';

import { useMemo } from 'react';
import type { ForecastData, RiskScoringConfig } from '../../types/forecast/ForecastBaseTypes';
import { CrimeTypesDictionary } from '../../constants/consts';
import { GetPrecinctsDictionary } from '../../constants/consts';

interface Props {
  forecastData: ForecastData[];
  averageCompositeRiskScore: number;
  maxCompositeRiskScore: number;
  riskScoringConfig?: RiskScoringConfig;
}

export default function RiskExplanation({
  forecastData,
  averageCompositeRiskScore,
  maxCompositeRiskScore,
  riskScoringConfig,
}: Props) {
  const analysis = useMemo(() => {
    const heinousIds = riskScoringConfig?.heinousCrimeTypeIds ?? [7, 11, 12, 14, 15, 16];
    const heinousNames = heinousIds.map(id => CrimeTypesDictionary[id]).filter(Boolean);

    const rowsWithScore = forecastData.filter(f => f.compositeRiskScore != null);
    if (rowsWithScore.length === 0) return null;

    const maxRow = rowsWithScore.reduce((a, b) =>
      (a.compositeRiskScore ?? 0) > (b.compositeRiskScore ?? 0) ? a : b
    );

    const topByScore = [...rowsWithScore]
      .sort((a, b) => (b.compositeRiskScore ?? 0) - (a.compositeRiskScore ?? 0))
      .slice(0, 5);

    const highScoreRows = rowsWithScore.filter(f => (f.compositeRiskScore ?? 0) >= 1.5);
    const moderateScoreRows = rowsWithScore.filter(
      f => (f.compositeRiskScore ?? 0) >= 1.0 && (f.compositeRiskScore ?? 0) < 1.5
    );

    const scoreDistribution =
      averageCompositeRiskScore >= 1.5
        ? 'high'
        : averageCompositeRiskScore >= 1.0
          ? 'moderate'
          : 'low';

    const heinousCount = rowsWithScore.filter(f => heinousIds.includes(f.crimeType)).length;
    const heinousPresent = heinousCount > 0;

    return {
      heinousNames,
      maxRow,
      topByScore,
      highScoreRows: highScoreRows.length,
      moderateScoreRows: moderateScoreRows.length,
      scoreDistribution,
      heinousCount,
      heinousPresent,
      heinousBoost: riskScoringConfig?.heinousBoostFactor ?? 1.5,
      presenceBoost: riskScoringConfig?.heinousPresenceFactor ?? 1.2,
    };
  }, [forecastData, riskScoringConfig, averageCompositeRiskScore, maxCompositeRiskScore]);

  if (!analysis) return null;

  const scoreColor =
    analysis.scoreDistribution === 'high'
      ? 'text-red-700 bg-red-50 border-red-200'
      : analysis.scoreDistribution === 'moderate'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-green-700 bg-green-50 border-green-200';

  return (
    <div className="mt-4 space-y-3">
      <div className={`p-3 rounded border ${scoreColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <strong>Why These Risk Scores?</strong>
        </div>

        <div className="text-sm space-y-1.5">
          <p>
            The <strong>Composite Risk Score</strong> (avg: <strong>{averageCompositeRiskScore.toFixed(3)}</strong>,
            max: <strong>{maxCompositeRiskScore.toFixed(3)}</strong>) measures predicted crime impact using three factors:
          </p>

          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>
              <strong>Crime Severity</strong> — each crime type has a baseline severity score (1–10).
              {analysis.maxRow && (
                <span>
                  {' '}The top contributor is <em>{CrimeTypesDictionary[analysis.maxRow.crimeType] ?? `type ${analysis.maxRow.crimeType}`}</em>
                  {' '}in <em>{GetPrecinctsDictionary[analysis.maxRow.precinct] ?? `Precinct ${analysis.maxRow.precinct}`}</em>.
                </span>
              )}
            </li>
            <li>
              <strong>Geographic Risk</strong> — precincts have different baseline crime risk factors (0.5–1.8).
            </li>
            <li>
              <strong>Heinous {analysis.heinousPresent ? 'Boost Active' : 'Multiplier'}</strong>
              {analysis.heinousPresent
                ? ` — ${analysis.heinousCount} heinous prediction(s) present (${analysis.heinousNames.join(', ')}). Heinous crimes get ×${analysis.heinousBoost.toFixed(1)} boost; all other crimes get ×${analysis.presenceBoost.toFixed(1)} presence factor.`
                : ` — no heinous crime types (${analysis.heinousNames.join(', ')}) are in the prediction set, so the multiplier is 1.0.`}
            </li>
          </ul>

          {analysis.highScoreRows > 0 && (
            <p className="mt-2">
              <strong>{analysis.highScoreRows}</strong> prediction(s) have a high composite score (≥1.5),
              <strong> {analysis.moderateScoreRows}</strong> are moderate (1.0–1.5).
            </p>
          )}
        </div>
      </div>

      {analysis.topByScore.length > 0 && (
        <details className="border border-gray-200 rounded">
          <summary className="px-3 py-2 bg-gray-50 cursor-pointer text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">
            Top {analysis.topByScore.length} Predictions by Composite Risk Score
          </summary>
          <div className="p-2">
            <table className="w-full text-xs text-gray-700">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="px-2 py-1 font-medium">Precinct</th>
                  <th className="px-2 py-1 font-medium">Crime Type</th>
                  <th className="px-2 py-1 font-medium">Period</th>
                  <th className="px-2 py-1 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {analysis.topByScore.map((f, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-1">{GetPrecinctsDictionary[f.precinct] ?? `P${f.precinct}`}</td>
                    <td className="px-2 py-1">{CrimeTypesDictionary[f.crimeType] ?? `T${f.crimeType}`}</td>
                    <td className="px-2 py-1">{f.year}-{String(f.month).padStart(2, '0')}</td>
                    <td className="px-2 py-1 text-right font-medium">{f.compositeRiskScore?.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
