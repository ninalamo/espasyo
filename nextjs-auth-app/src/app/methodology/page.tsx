import ForecastDocumentation from '../forecast/ForecastDocumentation';

export const metadata = {
  title: 'Methodology - Espasyo',
  description: 'Statistical forecasting methodology, data processing pipeline, and risk classification formulas.',
};

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <ForecastDocumentation />
      </div>
    </div>
  );
}
