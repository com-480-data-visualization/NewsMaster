import React, { useState, useEffect } from 'react';
import WorldMap from './WorldMap';
import { createImportColorScale, strokeColor, highlightColor } from '../../data/mapStyle';
import { loadNERData, type TimeRange } from '../../data/dataLoader';

// Define structure for loaded NER data state
interface NERMapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  entityMentions: Record<string, number>;
  totalArticles: number;
}

interface WorldMapPageProps {
  entity?: string;
}

const WorldMapPage: React.FC<WorldMapPageProps> = ({ entity = 'Ukraine' }) => {
  // State management
  const [mapData, setMapData] = useState<NERMapData | null>(null); // State for loaded NER data
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading state
  const [timeRange] = useState<TimeRange>('today'); // Default to today for NER view
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

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

  // Create theme-aware color scale
  const importColorScale = React.useMemo(() => {
    return createImportColorScale(isDarkMode);
  }, [isDarkMode]);

  // Effect to load NER data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const data = await loadNERData(entity, timeRange);
        setMapData(data);
      } catch (error) {
        console.error("Error loading NER map data:", error);
        setMapData(null);
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
    const lowest = entries.reduce((min, current) => 
      current[1] < min[1] ? current : min, entries[0]);
    
    return {
      highest: { id: highest[0], value: highest[1] },
      lowest: { id: lowest[0], value: lowest[1] }
    };
  };


  // Determine current data slice based on loaded data (always use import data for NER)
  const currentData = mapData ? mapData.importData : {};
  
  // Update color scale domains dynamically based on loaded data
  useEffect(() => {
    if (mapData) {
      const maxImport = Math.max(...Object.values(mapData.importData), 0);
      importColorScale.domain([0, maxImport || 0.001]);
    }
  }, [mapData, importColorScale]); // Update when mapData changes

  const { highest, lowest } = getExtremeCountries(currentData);

  // Display loading indicator or error message
  if (isLoading) {
    return <div className="text-center p-10">Loading NER map data for {entity}...</div>;
  }
  if (!mapData) {
    return <div className="text-center p-10 text-red-600">Failed to load NER map data for {entity}. Please try again later.</div>;
  }

  // Check if we have any data for this entity
  const hasData = mapData.totalArticles > 0;
  if (!hasData) {
    return (
      <div className="text-center p-10">
        <p className="text-muted-foreground">No articles found mentioning "{entity}" for the selected time range.</p>
        <p className="text-sm text-muted-foreground mt-2">This entity may not have been processed yet or may not appear in recent news.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-4">
      
      
      {/* Quick Media Attention Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-card p-4 border rounded-lg shadow-sm col-span-1 md:col-span-2">
          <p className="text-sm">
            <span className="font-medium">Who is talking about {entity}?</span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({mapData.totalArticles} articles found)
            </span>
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
                <span className="font-medium">{highest.id || 'N/A'}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {highest.id ? `(${(highest.value * 100).toFixed(1)}%)` : ''} {/* Assuming value is proportion 0-1 */}
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
              <span className="font-medium">Color intensity</span>: Presence of {entity} in the media
            </div>
            
            {/* Mini gradient legend - Uses color scales which are now dynamic */}
            <div className="w-full h-3 mt-2 rounded-sm overflow-hidden" 
              style={{ 
                background: `linear-gradient(to right, 
                  ${importColorScale.range()[0]}, ${importColorScale.range()[1]})`
              }}>
            </div>
            <div className="flex justify-between w-full mt-1">
              <div className="text-xs text-muted-foreground">0%</div>
              <div className="text-xs text-muted-foreground">
                {/* Display the max value from the current scale domain */}
                {(importColorScale.domain()[1] * 100).toFixed(1) }
                %
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* World Map - Full Width */}
      <div className="">
        <div className=" border rounded-lg bg-card shadow-lg">
          <div className="relative">
            <WorldMap 
              colorScale={importColorScale}
              strokeColor={strokeColor[isDarkMode ? 1 : 0]} // Dynamic theme-based stroke color
              highlightColor={highlightColor[isDarkMode ? 1 : 0]} // Dynamic theme-based highlight color
              setSelectedCountry={() => {}} 
              setHoveredCountry={() => {}} 
              data={currentData} // Pass the dynamically loaded NER data
            />
          </div>
        </div>
      </div>
    
    </div>
  );
};

export default WorldMapPage; 