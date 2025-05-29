import React from 'react';
import { type MapData } from '../../lib/worldMapHelper.ts';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Initialize the countries library with English locale
countries.registerLocale(enLocale);

type Props = {
  hoveredCountry: {
    id: string;
    name: string;
    position: { x: number; y: number }
  };
  selectedCountry: string | null;
  data: MapData;
  mode: 'featured' | 'covering';
};

const ForeignPressTooltip: React.FC<Props> = ({ 
  hoveredCountry, 
  selectedCountry, 
  data,
  mode 
}) => {
  // Get country name from ISO code
  const getCountryName = (code: string): string => {
    if (!code || code.length !== 3) return code;
    
    try {
      const alpha2 = countries.alpha3ToAlpha2(code);
      if (alpha2) {
        return countries.getName(alpha2, 'en') || code;
      }
      return code;
    } catch (error) {
      return code;
    }
  };

  // Get coverage value based on mode and selection
  const getCoverageValue = () => {
    if (!selectedCountry) return 0;
    
    if (mode === 'featured') {
      // Featured mode: showing who covers the selected country
      return data.foreignPressData.countryCoverage[selectedCountry]?.coveredBy[hoveredCountry.id] || 0;
    } else {
      // Covering mode: showing who the selected country covers
      return data.foreignPressData.countryCovering[selectedCountry]?.covering[hoveredCountry.id] || 0;
    }
  };

  const coverageValue = getCoverageValue();
  
  // Get the hovered country's own stats
  const hoveredCountryFeaturedData = data.foreignPressData.countryCoverage[hoveredCountry.id];
  const hoveredCountryCoveringData = data.foreignPressData.countryCovering[hoveredCountry.id];
  const hoveredCountryFeaturedRank = data.foreignPressData.featuredRankings.findIndex(r => r.countryCode === hoveredCountry.id) + 1;
  const hoveredCountryCoveringRank = data.foreignPressData.coveringRankings.findIndex(r => r.countryCode === hoveredCountry.id) + 1;

  // Calculate tooltip position with proper bounds checking
  const tooltipWidth = 300;
  const tooltipHeight = 200;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Determine if tooltip should be shown to the right or left of cursor
  const showToLeft = hoveredCountry.position.x + tooltipWidth + 20 > windowWidth;
  const leftPosition = showToLeft 
    ? hoveredCountry.position.x - tooltipWidth - 10
    : hoveredCountry.position.x + 20;
  
  // Determine if tooltip should be shown above or below cursor
  const showAbove = hoveredCountry.position.y + tooltipHeight + 20 > windowHeight;
  const topPosition = showAbove
    ? hoveredCountry.position.y - tooltipHeight - 10
    : hoveredCountry.position.y + 20;

  return (
    <div 
      className="fixed z-50 bg-card border rounded-lg shadow-lg p-3 pointer-events-none"
      style={{
        left: `${Math.max(10, leftPosition)}px`,
        top: `${Math.max(10, topPosition)}px`,
        transition: 'top 0.1s ease, left 0.1s ease',
        width: `${tooltipWidth}px`
      }}
    >
      <div className="space-y-2">
        <div>
          <h4 className="font-semibold text-foreground">
            {getCountryName(hoveredCountry.id)}
          </h4>
          <p className="text-xs text-muted-foreground">{hoveredCountry.id}</p>
        </div>
        
        {selectedCountry ? (
          // Show coverage relationship with selected country
          <div className="border-t pt-2">
            <p className="text-sm text-muted-foreground">
              {mode === 'featured' 
                ? <>Coverage of <span className="font-medium text-foreground">{getCountryName(selectedCountry)}</span>:</>
                : <>Covered by <span className="font-medium text-foreground">{getCountryName(selectedCountry)}</span>:</>
              }
            </p>
            {coverageValue > 0 ? (
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-16 bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(coverageValue * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {(coverageValue * 100).toFixed(1)}%
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                No significant coverage
              </p>
            )}
          </div>
        ) : (
          // Show hovered country's overall stats
          <div className="border-t pt-2">
            {mode === 'featured' ? (
              // Featured mode stats
              hoveredCountryFeaturedData && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Total foreign press coverage:
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${Math.min(hoveredCountryFeaturedData.totalCoverage * 100 * 5, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {(hoveredCountryFeaturedData.totalCoverage * 100).toFixed(1)}%
                      </span>
                    </div>
                    {hoveredCountryFeaturedRank > 0 && (
                      <span className="text-xs text-muted-foreground">
                        #{hoveredCountryFeaturedRank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Covered by {Object.keys(hoveredCountryFeaturedData.coveredBy).length} countries
                  </p>
                </>
              )
            ) : (
              // Covering mode stats
              hoveredCountryCoveringData && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Total international coverage activity:
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div 
                          className="bg-orange-500 h-2 rounded-full"
                          style={{ width: `${Math.min(hoveredCountryCoveringData.totalCovering * 100 * 5, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {(hoveredCountryCoveringData.totalCovering * 100).toFixed(1)}%
                      </span>
                    </div>
                    {hoveredCountryCoveringRank > 0 && (
                      <span className="text-xs text-muted-foreground">
                        #{hoveredCountryCoveringRank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Covers {Object.keys(hoveredCountryCoveringData.covering).length} countries
                  </p>
                </>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForeignPressTooltip; 