import React, { useState, useEffect } from 'react';
import WorldMap, { type LegendConfig, type MapSize } from './WorldMap';
import ForeignPressTooltip from './WolrdMapTooltip';
import CountryRankings from './CountryRankings';
import CountryTopEntities from './CountryTopEntities';
import CountryTrendChart from './CountryTrendChart';
import TimeRangeToggle, { type TimeRange } from './TimeRangeToggle';
import { ForeignPressToggle, type ForeignPressMode } from './WolrdMapToggle';
import { createImportColorScale, getImportColorRange, strokeColor, highlightColor } from '../../lib/mapStyle';
import { loadAggregatedData, loadCountryTrendData, type MapData, type TrendDataPoint } from '../../lib/worldMapHelper.ts';

const ForeignPressPage: React.FC = () => {
  // State management
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [mode, setMode] = useState<ForeignPressMode>('featured');
  const [data, setData] = useState<MapData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [isTrendLoading, setIsTrendLoading] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [hoveredCountry, setHoveredCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null>(null);

  // Map size configuration for larger display
  const mapSize: MapSize = {
    width: 960,
    height: 560,
    scale: 200
  };

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Get current rankings and map data based on mode
  const { currentRankings, mapData, colorScale, legendConfig } = React.useMemo(() => {
    if (!data) {
      return {
        currentRankings: [],
        mapData: {},
        colorScale: createImportColorScale(isDarkMode, [0, 0.001]),
        maxValue: 0.001,
        legendConfig: undefined
      };
    }

    const rankings = mode === 'featured' ? data.foreignPressData.featuredRankings : data.foreignPressData.coveringRankings;
    
    if (!selectedCountry) {
      // No country selected - show overall data
      const overallData: Record<string, number> = {};
      
      if (mode === 'featured') {
        Object.entries(data.foreignPressData.countryCoverage).forEach(([countryCode, coverage]) => {
          overallData[countryCode] = coverage.totalCoverage;
        });
      } else {
        Object.entries(data.foreignPressData.countryCovering).forEach(([countryCode, covering]) => {
          overallData[countryCode] = covering.totalCovering;
        });
      }
      
      const max = Math.max(...Object.values(overallData), 0.001);
      const currentRange = getImportColorRange(isDarkMode);
      
      return {
        currentRankings: rankings,
        mapData: overallData,
        colorScale: createImportColorScale(isDarkMode, [0, max]),
        maxValue: max,
        legendConfig: {
          title: mode === 'featured' ? 'Total Foreign Coverage' : 'Total Coverage Activity',
          colorRange: currentRange,
          valueRange: [0, Math.round(max * 100)],
          unit: '%'
        } as LegendConfig
      };
    }

    // Country selected - show specific relationships
    let relationshipData: Record<string, number> = {};
    
    if (mode === 'featured') {
      // Featured mode: show who covers the selected country
      relationshipData = data.foreignPressData.countryCoverage[selectedCountry]?.coveredBy || {};
    } else {
      // Covering mode: show who the selected country covers
      relationshipData = data.foreignPressData.countryCovering[selectedCountry]?.covering || {};
    }
    
    const max = Math.max(...Object.values(relationshipData), 0.001);
    const currentRange = getImportColorRange(isDarkMode);
    
    return {
      currentRankings: rankings,
      mapData: relationshipData,
      colorScale: createImportColorScale(isDarkMode, [0, max]),
      maxValue: max,
      legendConfig: {
        title: 'Coverage Intensity',
        colorRange: currentRange,
        valueRange: [0, Math.round(max * 100)],
        unit: '%'
      } as LegendConfig
    };
  }, [data, selectedCountry, mode, isDarkMode]);

  // Stable callback references
  const handleCountrySelect = React.useCallback((countryCode: string) => {
    setSelectedCountry(countryCode === selectedCountry ? null : countryCode);
  }, [selectedCountry]);

  const handleSetHoveredCountry = React.useCallback((country: {
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null) => {
    setHoveredCountry(country);
  }, []);

  // Reset selected country when mode changes
  useEffect(() => {
    setSelectedCountry(null);
  }, [mode]);

  // Load data when timeRange changes
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const foreignPressData = await loadAggregatedData(timeRange);
        setData(foreignPressData);
      } catch (error) {
        console.error("Error loading foreign press data:", error);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [timeRange]);

  // Load trend data when selected country changes
  useEffect(() => {
    const fetchTrendData = async () => {
      if (!selectedCountry) {
        setTrendData([]);
        return;
      }
      
      setIsTrendLoading(true);
      try {
        const countryTrendData = await loadCountryTrendData(selectedCountry);
        setTrendData(countryTrendData);
      } catch (error) {
        console.error("Error loading trend data:", error);
        setTrendData([]);
      } finally {
        setIsTrendLoading(false);
      }
    };
    fetchTrendData();
  }, [selectedCountry]);

  // Display loading or error states
  if (isLoading) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 py-8">
        <div className="text-center p-10">Loading foreign press data...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl w-full mx-auto px-4 py-8">
        <div className="text-center p-10 text-red-600">
          Failed to load foreign press data. Please try again later.
        </div>
      </div>
    );
  }

 


  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Foreign Press Coverage Analysis</h1>
          <p className="text-muted-foreground mt-1">
            {mode === 'featured' 
              ? 'Track how countries are featured in international media'
              : 'Track how countries cover overseas events'
            }
          </p>
        </div>
        
        <div className="flex items-center mt-2 md:mt-0 gap-2">
          <div className="flex items-center bg-card p-2 rounded-md border">
            <span className="text-sm mr-2 md:block hidden">Analysis Type:</span>
            <ForeignPressToggle mode={mode} setMode={setMode} />
          </div>
          <TimeRangeToggle selectedRange={timeRange} onRangeChange={setTimeRange} />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mb-6">
        {/* Left Side - Rankings */}
        <div className="lg:col-span-2">
          <CountryRankings
            rankings={currentRankings}
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelect}
            isLoading={isLoading}
            mode={mode}
          />
        </div>

        {/* Right Side - World Map */}
        <div className="lg:col-span-4">
          <div className="p-4 border rounded-lg bg-card shadow-lg" style={{ height: '600' }}>
      
            
            <div className=" flex-1">
              <WorldMap 
                colorScale={colorScale}
                strokeColor={strokeColor[isDarkMode ? 1 : 0]}
                highlightColor={highlightColor[isDarkMode ? 1 : 0]}
                setSelectedCountry={() => {}} // Disable map country selection
                setHoveredCountry={handleSetHoveredCountry}
                data={mapData}
                legend={legendConfig}
                mapSize={mapSize}
              />
              {hoveredCountry && (
                <ForeignPressTooltip 
                  hoveredCountry={hoveredCountry}
                  selectedCountry={selectedCountry}
                  data={data}
                  mode={mode}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Country Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CountryTopEntities
          selectedCountry={selectedCountry}
          topEntitiesByCountry={data.topEntitiesByCountry}
          isLoading={isLoading}
        />
        
        <CountryTrendChart
          selectedCountry={selectedCountry}
          trendData={trendData}
          isLoading={isTrendLoading}
        />
      </div>
    </div>
  );
};

export default ForeignPressPage; 