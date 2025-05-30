import React from 'react';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';


countries.registerLocale(enLocale);

// Define entity structure
interface EntityData {
  entity: string;
  count: number;
  share: number;
}

type Props = {
  selectedCountry: string | null;
  topEntitiesByCountry: Record<string, EntityData[]>;
  isLoading?: boolean;
};

const CountryTopEntities: React.FC<Props> = ({ 
  selectedCountry, 
  topEntitiesByCountry, 
  isLoading = false 
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

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Top Entities by Country
        </h3>
        <p className="text-sm text-muted-foreground mb-3">Loading entities...</p>
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

  // Get entities for selected country
  const entities = selectedCountry ? topEntitiesByCountry[selectedCountry] || [] : [];

  // If no country is selected, show instruction
  if (!selectedCountry) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Click a country
        </h3>
  
      </div>
    );
  }

  // If selected country has no entities
  if (entities.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          {getCountryName(selectedCountry)} Top Entities
        </h3>
        <p className="text-sm text-muted-foreground">
          No significant entities found for {getCountryName(selectedCountry)} in the foreign press coverage data.
        </p>
      </div>
    );
  }

  // Display entities for selected country
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-bold text-lg mb-2 text-foreground">
        {getCountryName(selectedCountry)} Top Entities
      </h3>
     
      <div className="overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-muted">
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">#</th>
              <th className="text-left py-2 font-medium text-sm text-muted-foreground">Entity</th>
              <th className="text-right py-2 font-medium text-sm text-muted-foreground">Share</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity, index) => (
              <tr key={`${entity.entity}-${index}`} className="border-b border-muted last:border-0">
                <td className="py-2 text-sm">{index + 1}</td>
                <td className="py-2 text-sm max-w-xs truncate" title={entity.entity}>
                  {entity.entity}
                </td>
                <td className="py-2 text-sm text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-muted rounded-full h-1.5">
                      <div 
                        className="bg-purple-500 h-1.5 rounded-full"
                        style={{ width: `${entity.share * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-muted-foreground min-w-[3rem] text-right">
                      {(entity.share * 100).toFixed(1)}%
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

export default CountryTopEntities; 