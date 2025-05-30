import React from 'react';
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
  entity: string;
  nerData: Record<string, number>;
  totalMentions: number;
};

const NERTooltip: React.FC<Props> = ({ 
  hoveredCountry, 
  entity,
  nerData,
  totalMentions
}) => {
  // Debug positioning
  console.log('NERTooltip positioning debug:', {
    mousePosition: hoveredCountry.position,
    countryId: hoveredCountry.id,
    windowSize: { width: window.innerWidth, height: window.innerHeight }
  });

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

  const mentionCount = nerData[hoveredCountry.id] || 0;
  const mentionPercentage = totalMentions > 0 ? (mentionCount / totalMentions) * 100 : 0;

  // Calculate tooltip position with better positioning
  const tooltipWidth = 300;
  const tooltipHeight = 200;
  
  // Get the map container dimensions for bounds checking
  const mapContainer = document.getElementById('world-map-container');
  const containerWidth = mapContainer ? mapContainer.offsetWidth : 800;
  const containerHeight = mapContainer ? mapContainer.offsetHeight : 600;
  
  const offset = 15; // Small offset from cursor
  
  // Determine if tooltip should be shown to the right or left of cursor
  const showToLeft = hoveredCountry.position.x + tooltipWidth + offset > containerWidth;
  const leftPosition = showToLeft 
    ? Math.max(10, hoveredCountry.position.x - tooltipWidth - offset)
    : Math.min(containerWidth - tooltipWidth - 10, hoveredCountry.position.x + offset);
  
  // Determine if tooltip should be shown above or below cursor
  const showAbove = hoveredCountry.position.y + tooltipHeight + offset > containerHeight;
  const topPosition = showAbove
    ? Math.max(10, hoveredCountry.position.y - tooltipHeight - offset)
    : Math.min(containerHeight - tooltipHeight - 10, hoveredCountry.position.y + offset);

  return (
    <div 
      className="absolute z-50 bg-card border rounded-lg shadow-lg p-3 pointer-events-none"
      style={{
        left: `${leftPosition}px`,
        top: `${topPosition}px`,
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
        
        <div className="border-t pt-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entity}</span> mentions:
          </p>
          {mentionCount > 0 ? (
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between mx-auto ">
                <span className="text-sm text-muted-foreground">
                  {mentionPercentage.toFixed(1)}% of total
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(mentionPercentage * 2, 100)}%` }}
                ></div>
              </div>
            
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              No significant mentions found
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NERTooltip; 