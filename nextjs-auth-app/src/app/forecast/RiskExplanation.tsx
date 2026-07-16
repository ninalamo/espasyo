'use client';

import { useMemo } from 'react';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';
import { CrimeTypesDictionary } from '../../constants/consts';
import { GetPrecinctsDictionary } from '../../constants/consts';

interface Props {
  forecastData: ForecastData[];
  averageCompositeRiskScore: number;
  maxCompositeRiskScore: number;
}

export default function RiskExplanation() {
  return null;
}
