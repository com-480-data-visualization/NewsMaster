import React from 'react';
import countries from 'i18n-iso-countries';
// Import English locale data
import enLocale from 'i18n-iso-countries/langs/en.json';

// Initialize the countries library with English locale
countries.registerLocale(enLocale);

type Props = {
  mode: 'import' | 'export';
  data: Record<string, number>;
};

const GlobalRankings: React.FC<Props> = ({ mode, data }) => {
  if (!data) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Top 10 {mode === 'import' ? 'Importers' : 'Exporters'}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">Loading rankings...</p>
      </div>
    );
  }

  // Sort countries by value (descending) and take top 10
  const topCountries = Object.entries(data)
    .sort(([, valueA], [, valueB]) => valueB - valueA)
    .slice(0, 10);

  // Get country name from ISO code
  const getCountryName = (code: string): string => {
    if (!code || code.length !== 3) return code;
    
    try {
      // Convert alpha-3 to alpha-2 for compatibility with the library
      const alpha2 = countries.alpha3ToAlpha2(code);
      if (alpha2) {
        return countries.getName(alpha2, 'en') || code;
      }
      return code;
    } catch (error) {
      console.warn(`Could not find country name for code: ${code}`);
      return code;
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-bold text-lg mb-2 text-foreground">
        Top 10 {mode === 'import' ? 'Importers' : 'Exporters'}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">
        {mode === 'import' 
          ? 'Countries that receive the most coverage in foreign media' 
          : 'Countries whose media provides the most coverage of foreign events'}
      </p>
      <div className="overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-muted">
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">#</th>
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">Country</th>
              <th className="text-right py-2 font-medium text-sm text-muted-foreground">Share</th>
            </tr>
          </thead>
          <tbody>
            {topCountries.map(([id, value], index) => (
              <tr key={id} className="border-b border-muted last:border-0">
                <td className="py-2 text-sm">{index + 1}</td>
                <td className="py-2 text-sm">{getCountryName(id)}</td>
                <td className="py-2 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div 
                        className={`${mode === 'import' ? 'bg-blue-500' : 'bg-green-500'} h-1.5 rounded-full`}
                        style={{ width: `${(value / topCountries[0][1]) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-muted-foreground">
                      {(value * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GlobalRankings; 