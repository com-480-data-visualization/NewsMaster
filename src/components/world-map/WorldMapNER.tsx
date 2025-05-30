import React, { useState, useEffect } from 'react';
import WorldMap from './WorldMap';
import NERTooltip from './NERTooltip';
import { createImportColorScale, getImportColorRange, strokeColor, highlightColor } from '../../lib/mapStyle';
import { loadAggregatedData, createEntitySpecificNerData, type MapData, type TimeRange } from '../../lib/worldMapHelper.ts';
import countries from 'i18n-iso-countries';
// Initialize the countries library with English translations
import countriesEn from 'i18n-iso-countries/langs/en.json';
countries.registerLocale(countriesEn);

// Function to convert ISO 3-letter country code to country name
const getCountryName = (countryCode: string): string => {
  if (!countryCode) return 'N/A';
  return countries.getName(countryCode, 'en') || countryCode;
};

interface WorldMapPageProps {
  entity?: string;
}

const WorldMapPage: React.FC<WorldMapPageProps> = ({ entity = 'Ukraine' }) => {
  // State management
  const [mapData, setMapData] = useState<MapData | null>(null); // State for loaded map data
  const [entitySpecificData, setEntitySpecificData] = useState<Record<string, number>>({}); // Entity-specific filtered data
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [timeRange] = useState<TimeRange>('today'); // Default to today for NER view
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [hoveredCountry, setHoveredCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null>(null);

  const mapSize = {
    width: 960,
    height: 560,
    scale: 200
  };

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    // Check initial theme
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Calculate domain and create color scale using useMemo for performance
  const { importColorScale, currentDomain, currentRange } = React.useMemo(() => {
    if (!entitySpecificData || Object.keys(entitySpecificData).length === 0) {
      return {
        importColorScale: createImportColorScale(isDarkMode, [0, 0.001]),
        currentDomain: [0, 0.001] as [number, number],
        currentRange: getImportColorRange(isDarkMode)
      };
    }

    const maxEntityMentions = Math.max(...Object.values(entitySpecificData), 0);
    const domain: [number, number] = [0, maxEntityMentions || 0.001];

    return {
      importColorScale: createImportColorScale(isDarkMode, domain),
      currentDomain: domain,
      currentRange: getImportColorRange(isDarkMode)
    };
  }, [entitySpecificData, isDarkMode]);

  // Effect to load NER data and create entity-specific filtering
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const aggregatedData = await loadAggregatedData(timeRange);
        setMapData(aggregatedData);
        
        // Create entity-specific data using the new function
        const filteredData = createEntitySpecificNerData(aggregatedData, entity);
        setEntitySpecificData(filteredData);
      } catch (error) {
        console.error("Error loading NER map data:", error);
        setMapData(null);
        setEntitySpecificData({});
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [entity, timeRange]);

  // Get highest and lowest media attention countries
  const getExtremeCountries = (data: Record<string, number>) => {
    // Handle empty data case
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return {
        highest: { id: '', value: 0 },
        lowest: { id: '', value: 0 }
      };
    }

    const highest = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max, entries[0]);
    
    // Find lowest non-zero value
    const nonZeroEntries = entries.filter(entry => entry[1] > 0);
    const lowest = nonZeroEntries.length > 0 
      ? nonZeroEntries.reduce((min, current) => 
          current[1] < min[1] ? current : min, nonZeroEntries[0])
      : entries[0]; // Fallback to first entry if all are zero
    
    return {
      highest: { id: highest[0], value: highest[1] },
      lowest: { id: lowest[0], value: lowest[1] }
    };
  };

  // Stable callback reference for hover handling
  const handleSetHoveredCountry = React.useCallback((country: {
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null) => {
    setHoveredCountry(country);
  }, []);

  // Determine current data slice based on loaded data (use entitySpecificData for NER)
  const currentData = entitySpecificData;
  const totalArticles = Object.values(entitySpecificData).reduce((sum, count) => sum + count, 0);

  const { highest, lowest } = getExtremeCountries(currentData);

  // Display loading indicator or error message
  if (isLoading) {
    return <div className="text-center p-10">Loading NER map data for {entity}...</div>;
  }
  if (!mapData) {
    return <div className="text-center p-10 text-red-600">Failed to load NER map data for {entity}. Please try again later.</div>;
  }

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-4">
      
      
      {/* Quick Media Attention Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-card p-4 border rounded-lg shadow-sm col-span-1 md:col-span-2">
          <p className="text-sm">
            <span className="font-medium">Who is talking about {entity}?</span>
           
            </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Highest Coverage</span>
              <div className="flex items-center justify-center mt-1">
                <div 
                  className="w-3 h-3 rounded-sm mr-2" 
                  style={{ backgroundColor: highest.id ? importColorScale(highest.value) : 'transparent' 
                  }}
                ></div>
                <span className="font-medium">{highest.id ? getCountryName(highest.id) : 'N/A'}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {highest.id ? `(${(highest.value * 100).toFixed(1)}% relative)` : ''}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Lowest Coverage</span>
              <div className="flex items-center justify-center mt-1">
                <div 
                  className="w-3 h-3 rounded-sm mr-2" 
                  style={{ backgroundColor: lowest.id ? importColorScale(lowest.value) : 'transparent' 
                  }}
                ></div>
                <span className="font-medium">{lowest.id ? getCountryName(lowest.id) : 'N/A'}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {lowest.id ? `(${(lowest.value * 100).toFixed(1)}% relative)` : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 border rounded-lg shadow-sm hidden md:block">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              Presence of {entity} in the country's media
            </div>
            
            {/* Mini gradient legend - Uses color scales which are now dynamic */}
            <div className="w-full h-3 mt-2 rounded-sm overflow-hidden" 
              style={{ 
                background: `linear-gradient(to right, ${currentRange[0]}, ${currentRange[1]})`
              }}>
            </div>
            <div className="flex justify-between w-full mt-1">
              <div className="text-xs text-muted-foreground">0%</div>
              <div className="text-xs text-muted-foreground">
                100% (relative)
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* World Map - Full Width */}
      <div className="">
        <div 
          id="world-map-container" 
          className="relative p-4 border rounded-lg bg-card shadow-lg" 
          style={{ height: '600px' }}
        >
          <div className="flex-1">
            <WorldMap 
              colorScale={importColorScale}
              strokeColor={strokeColor[isDarkMode ? 1 : 0]} // Dynamic theme-based stroke color
              highlightColor={highlightColor[isDarkMode ? 1 : 0]} // Dynamic theme-based highlight color
              setSelectedCountry={() => {}} 
              setHoveredCountry={handleSetHoveredCountry} 
              data={currentData} // Pass the dynamically loaded NER data
              mapSize={mapSize}
            />
            {hoveredCountry && (
              <NERTooltip
                hoveredCountry={hoveredCountry}
                entity={entity}
                nerData={currentData}
                totalMentions={totalArticles}
              />
            )}
          </div>
        </div>
      </div>
    
    </div>
  );
};

export default WorldMapPage; 