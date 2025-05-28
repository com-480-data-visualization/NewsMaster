import React, { useState, useEffect } from 'react';
import WorldMap from './WorldMap';
import CountryTooltip from './CountryTooltip';
import GlobalRankings from './GlobalRankings';
import { ImportExportToggle } from './ImportExportToggle';

import TimeRangeToggle, { type TimeRange } from './TimeRangeToggle';
import { createImportColorScale, createExportColorScale, getImportColorRange, getExportColorRange, strokeColor, highlightColor } from '../../data/mapStyle';
import { loadAggregatedData, type MapData } from '../../data/dataLoader';
import { alpha3ToAlpha2, getName } from 'i18n-iso-countries';

const WorldMapPage: React.FC = () => {
  // State management
  const [mode, setMode] = useState<'import' | 'export'>('import');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [mapData, setMapData] = useState<MapData | null>(null); // State for loaded data
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [hoveredCountry, setHoveredCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null>(null);

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

  // Calculate domains and create color scales using useMemo for performance
  const { importColorScale, exportColorScale, currentDomain, currentRange } = React.useMemo(() => {
    if (!mapData) {
      return {
        importColorScale: createImportColorScale(isDarkMode, [0, 0.001]),
        exportColorScale: createExportColorScale(isDarkMode, [0, 0.001]),
        currentDomain: [0, 0.001] as [number, number],
        currentRange: isDarkMode ? getImportColorRange(true) : getImportColorRange(false)
      };
    }

    const maxImport = Math.max(...Object.values(mapData.importData), 0);
    const maxExport = Math.max(...Object.values(mapData.exportData), 0);
    const importDomain: [number, number] = [0, maxImport || 0.001];
    const exportDomain: [number, number] = [0, maxExport || 0.001];

    return {
      importColorScale: createImportColorScale(isDarkMode, importDomain),
      exportColorScale: createExportColorScale(isDarkMode, exportDomain),
      currentDomain: mode === 'import' ? importDomain : exportDomain,
      currentRange: mode === 'import' 
        ? getImportColorRange(isDarkMode) 
        : getExportColorRange(isDarkMode)
    };
  }, [mapData, isDarkMode, mode]);

  // Get country name from ISO code - memoized
  const getCountryName = React.useCallback((code: string): string => {
    if (!code || code.length !== 3) return code;
    
    try {
      // Convert alpha-3 to alpha-2 for compatibility with the library
      const alpha2 = alpha3ToAlpha2(code);
      if (alpha2) {
        return getName(alpha2, 'en') || code;
      }
      return code;
    } catch (error) {
      console.warn(`Could not find country name for code: ${code}`);
      return code;
    }
  }, []);

  // Get highest and lowest media attention countries - memoized
  const getExtremeCountries = React.useCallback((data: Record<string, number>) => {
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
    const lowest = entries.reduce((min, current) => 
      current[1] < min[1] ? current : min, entries[0]);
    
    return {
      highest: { id: getCountryName(highest[0]), value: highest[1] },
      lowest: { id: getCountryName(lowest[0]), value: lowest[1] }
    };
  }, [getCountryName]);

  // Memoize current data to prevent unnecessary recalculations
  const currentData = React.useMemo(() => {
    return mapData ? (mode === 'import' ? mapData.importData : mapData.exportData) : {};
  }, [mapData, mode]);
  
  // Memoize extreme countries calculation
  const { highest, lowest } = React.useMemo(() => 
    getExtremeCountries(currentData), 
    [currentData, getExtremeCountries]
  );

  // Stable callback references to prevent WorldMap re-renders
  const handleSetSelectedCountry = React.useCallback((country: string | null) => {
    setSelectedCountry(country);
  }, []);

  const handleSetHoveredCountry = React.useCallback((country: {
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null) => {
    setHoveredCountry(country);
  }, []);

  // Effect to load data when timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await loadAggregatedData(timeRange);
        setMapData(data);
      } catch (error) {
        console.error("Error loading map data:", error);
        setMapData(null); // Set to null or some error state
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [timeRange]); // Dependency array ensures this runs when timeRange changes

  // Display loading indicator or error message
  if (isLoading) {
    return <div className="text-center p-10">Loading map data...</div>;
  }
  if (!mapData) {
    return <div className="text-center p-10 text-red-600">Failed to load map data. Please try again later.</div>;
  }

  return (
    <div className="max-w-7xl w-full mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold">World Media Attention Map</h1>
        
        <div className="flex items-center mt-2 md:mt-0 gap-2">
          <div className="flex items-center bg-card p-2 rounded-md border">
            <span className="text-sm mr-2 md:block hidden">Media Type:</span>
            <ImportExportToggle mode={mode} setMode={setMode} />
          </div>
          <TimeRangeToggle selectedRange={timeRange} onRangeChange={setTimeRange} />
        </div>
      </div>
      
      {/* Quick Media Attention Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card p-4 border rounded-lg shadow-sm col-span-1 md:col-span-2">
          <p className="text-sm">
            <span className="font-medium">Media {mode === 'import' ? 'Import' : 'Export'}</span>: 
            {mode === 'import' 
              ? ' How much a country is featured in foreign news' 
              : ' How much a country\'s media covers foreign events'}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Highest Coverage</span>
              <div className="flex items-center mt-1">
                <div 
                  className="w-3 h-3 rounded-sm mr-2" 
                  style={{ backgroundColor: highest.id ? (mode === 'import' 
                    ? importColorScale(highest.value) 
                    : exportColorScale(highest.value)) : 'transparent' // Handle no highest country
                  }}
                ></div>
                <span className="font-medium">{highest.id || 'N/A'}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {highest.id ? `(${(highest.value * 100).toFixed(1)}%)` : ''} {/* Assuming value is proportion 0-1 */}
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Lowest Coverage</span>
              <div className="flex items-center mt-1">
                <div 
                  className="w-3 h-3 rounded-sm mr-2" 
                  style={{ backgroundColor: lowest.id ? (mode === 'import' 
                    ? importColorScale(lowest.value) 
                    : exportColorScale(lowest.value)) : 'transparent' // Handle no lowest country
                  }}
                ></div>
                <span className="font-medium">{lowest.id || 'N/A'}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {lowest.id ? `(${(lowest.value * 100).toFixed(1)}%)` : ''} {/* Assuming value is proportion 0-1 */}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 border rounded-lg shadow-sm hidden md:block">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Color intensity</span>: Proportion of global media {mode}s
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
                {(currentDomain[1] * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* World Map - Full Width */}
      <div className="mb-8">
        <div className="p-4 border rounded-lg bg-card shadow-lg">
          <div className="relative">
            <WorldMap 
              colorScale={mode === 'import' ? importColorScale : exportColorScale}
              strokeColor={strokeColor[isDarkMode ? 1 : 0]} // Dynamic theme-based stroke color
              highlightColor={highlightColor[isDarkMode ? 1 : 0]} // Dynamic theme-based highlight color
              setSelectedCountry={handleSetSelectedCountry} 
              setHoveredCountry={handleSetHoveredCountry} 
              data={currentData} // Pass the dynamically loaded data
            />
            {hoveredCountry && mapData && (
              <CountryTooltip 
                hoveredCountry={hoveredCountry} 
                mode={mode} 
                data={mapData} // Pass combined data to tooltip
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Top 10 Exporters and Importers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlobalRankings mode="import" data={mapData.importData} /> 
        <GlobalRankings mode="export" data={mapData.exportData} /> 
      </div>
    </div>
  );
};

export default WorldMapPage; 