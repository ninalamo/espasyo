'use client';

import Link from 'next/link';

const faqs = [
  {
    q: 'How are officer counts calculated?',
    a: 'Officer allocation per precinct is based on three factors: (1) forecasted crime volume weighted by severity — violent crimes like murder and robbery carry higher weight than property crimes, (2) patrol capacity — how many weighted crime units one officer can handle per month, and (3) geographic area — a baseline coverage of 1.5 officers per km². Each precinct also receives a minimum baseline based on its risk level.',
  },
  {
    q: 'How are risk levels determined?',
    a: 'Precinct risk is derived from the forecasted monthly crime rate: ≥50 predicted crimes/month is critical, ≥25 is high, ≥10 is medium, and below 10 is low. Additionally, the SSA forecast model assigns independent risk scores to individual predictions based on deviation from historical averages.',
  },
  {
    q: 'How are shifts distributed?',
    a: 'Officers are split evenly across three 8-hour shifts: Morning (6:00 AM – 2:00 PM), Evening (2:00 PM – 10:00 PM), and Night (10:00 PM – 6:00 AM). The total is divided by three, with any remainder assigned to the night shift. This ensures 24/7 coverage across all precincts.',
  },
  {
    q: 'What is the patrol capacity assumption?',
    a: 'Each officer is assumed to handle 40 weighted crime units per month, working 8-hour patrols over 22 days per month (176 hours total). This is a planning estimate and has not been validated against historical patrol data.',
  },
  {
    q: 'How do crime severity weights work?',
    a: 'Crimes are weighted by severity to reflect the higher patrol demand of violent offenses. Homicide, robbery, sexual assault, kidnapping, human trafficking, and arson are weighted 5×. Assault, drug offenses, and extortion are weighted 4×. Property crimes like theft and fraud are weighted 2×. The weighted score determines patrol demand per precinct.',
  },
  {
    q: 'Where does the forecast data come from?',
    a: 'The manpower plan uses predictions from the SSA (Singular Spectrum Analysis) forecasting model. Historical crime data is analyzed for seasonal patterns and trends, then projected forward for the configured forecast period. The forecast is generated on the Forecasting page and passed to this page.',
  },
  {
    q: 'Can I adjust the allocation after it is generated?',
    a: 'Yes. Published proposals are saved locally. You can fine-tune individual allocations on the Precinct Management page, which stores records to the backend API.',
  },
];

export default function ManpowerFaqPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link href="/manpower" className="text-ubuntu-600 hover:text-blue-800 text-sm flex items-center">
        ← Back to Manpower Plan
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manpower Allocation — FAQ</h1>
        <p className="text-gray-500 mt-1">How the numbers are derived, what the assumptions mean, and where the data comes from.</p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden open:shadow-sm">
            <summary className="px-5 py-4 text-sm font-semibold text-gray-800 cursor-pointer hover:bg-gray-50 select-none">
              {faq.q}
            </summary>
            <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
              {faq.a}
            </div>
          </details>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center pt-4 border-t border-gray-200">
        These explanations describe the current planning model. All constants and thresholds are configurable.
      </div>
    </div>
  );
}
