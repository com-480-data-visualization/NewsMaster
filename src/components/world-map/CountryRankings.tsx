import React from 'react';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

type Props = {
  rankings: Array<{ countryCode: string; totalCoverage?: number; totalCovering?: number }>;
  selectedCountry: string | null;
  onCountrySelect: (countryCode: string) => void;
  isLoading?: boolean;
  mode: 'featured' | 'covering';
};

const CountryRankings: React.FC<Props> = ({ 
  rankings, 
  selectedCountry, 
  onCountrySelect, 
  isLoading = false,
  mode
}) => {

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

  const modeDescription = mode === 'featured'
    ? 'Click on a country to see which countries are talking about it'
    : 'Click on a country to see which countries it covers in its media';

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
   
        <p className="text-sm text-muted-foreground mb-3">Loading rankings...</p>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!rankings || rankings.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    );
  }

  const topRankings = rankings.slice(0, 25); 
  const maxValue = Math.max(...topRankings.map(r => 
    mode === 'featured' ? (r.totalCoverage || 0) : (r.totalCovering || 0)
  ));

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm flex flex-col" style={{ height: '600px' }}>
      
      <p className="text-sm text-muted-foreground mb-4">
        {modeDescription}
      </p>
      <div className="overflow-hidden flex-1 overflow-y-auto pr-2">
        <div className="space-y-1 mr-2">
          {topRankings.map((ranking, index) => {
            const value = mode === 'featured' ? ranking.totalCoverage : ranking.totalCovering;
            return (
              <div
                key={ranking.countryCode}
                onClick={() => onCountrySelect(ranking.countryCode)}
                className={`p-2 rounded-md cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
                  selectedCountry === ranking.countryCode 
                    ? 'bg-primary/10 border border-primary/20 shadow-sm' 
                    : 'hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-6 text-xs flex items-center justify-center rounded font-semibold ${
                      selectedCountry === ranking.countryCode 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-medium text-sm ${
                        selectedCountry === ranking.countryCode ? 'text-primary' : 'text-foreground'
                      }`}>
                        {getCountryName(ranking.countryCode)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ranking.countryCode}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className={`${
                          selectedCountry === ranking.countryCode ? 'bg-primary' : 'bg-blue-500'
                        } h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${((value || 0) / maxValue) * 100}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-medium min-w-[3rem] text-right ${
                      selectedCountry === ranking.countryCode ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {((value || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CountryRankings; 