import React, { useState } from 'react';
import WorldMap from '../components/WorldMap';
import CountryTooltip from '../components/CountryTooltip';
import CountryInfoPanel from '../components/CountryInfoPanel';
import GlobalRankings from '../components/GlobalRankings';
import { ModeToggle } from '../components/ModeToggle';
import { ImportExportToggle } from '../components/ImportExportToggle';
import Legend from '../components/Legend';
import { importData, exportData, importColorScale, exportColorScale, countryNameMap } from '../data/mapData';

const WorldMapPage: React.FC = () => {
  // State management
  const [mode, setMode] = useState<'import' | 'export'>('import');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<{
    id: string;
    name: string;
    position: { x: number; y: number }
  } | null>(null);

  // Get highest and lowest media attention countries
  const getExtremeCountries = (data: Record<string, number>) => {
    const entries = Object.entries(data);
    const highest = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max, entries[0]);
    const lowest = entries.reduce((min, current) => 
      current[1] < min[1] ? current : min, entries[0]);
    
    return {
      highest: { id: highest[0], value: highest[1] },
      lowest: { id: lowest[0], value: lowest[1] }
    };
  };

  const currentData = mode === 'import' ? importData : exportData;
  const { highest, lowest } = getExtremeCountries(currentData);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-3xl font-bold">World Media Attention Map</h1>
        
        <div className="flex items-center mt-2 md:mt-0 gap-2">
          <div className="mr-2 flex items-center bg-card p-2 rounded-md border">
            <span className="text-sm mr-2 md:block hidden">Media Type:</span>
            <ImportExportToggle mode={mode} setMode={setMode} />
          </div>
          <ModeToggle />
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
                  style={{ backgroundColor: mode === 'import' 
                    ? importColorScale(highest.value) 
                    : exportColorScale(highest.value) 
                  }}
                ></div>
                <span className="font-medium">{countryNameMap[highest.id] || highest.id}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({(highest.value * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Lowest Coverage</span>
              <div className="flex items-center mt-1">
                <div 
                  className="w-3 h-3 rounded-sm mr-2" 
                  style={{ backgroundColor: mode === 'import' 
                    ? importColorScale(lowest.value) 
                    : exportColorScale(lowest.value) 
                  }}
                ></div>
                <span className="font-medium">{countryNameMap[lowest.id] || lowest.id}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  ({(lowest.value * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-card p-4 border rounded-lg shadow-sm hidden md:block">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Color intensity</span>: Percentage of global media {mode}s
            </div>
            
            {/* Mini gradient legend */}
            <div className="w-full h-3 mt-2 rounded-sm overflow-hidden" 
              style={{ 
                background: `linear-gradient(to right, 
                  ${mode === 'import' 
                    ? `${importColorScale(0)}, ${importColorScale(1)}` 
                    : `${exportColorScale(0)}, ${exportColorScale(1)}`
                  })`
              }}>
            </div>
            <div className="flex justify-between w-full mt-1">
              <div className="text-xs text-muted-foreground">0%</div>
              <div className="text-xs text-muted-foreground">100%</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* World Map - Full Width */}
      <div className="mb-8">
        <div className="p-4 border rounded-lg bg-card shadow-lg">
          <div className="relative">
            <WorldMap 
              mode={mode} 
              setSelectedCountry={setSelectedCountry} 
              setHoveredCountry={setHoveredCountry} 
            />
            {hoveredCountry && (
              <CountryTooltip hoveredCountry={hoveredCountry} mode={mode} />
            )}
          </div>
        </div>
      </div>
      
      {/* Top 10 Exporters and Importers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlobalRankings mode="import" />
        <GlobalRankings mode="export" />
      </div>
    </div>
  );
};

export default WorldMapPage; 