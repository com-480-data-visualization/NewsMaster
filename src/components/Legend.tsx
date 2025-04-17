import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  importData, exportData, 
  importColorScale, exportColorScale, 
  countryNameMap 
} from '../data/mapData';

type Props = {
  mode: 'import' | 'export';
};

const Legend: React.FC<Props> = ({ mode }) => {
  const gradientRef = useRef<HTMLDivElement>(null);
  
  // Create the gradient legend
  useEffect(() => {
    if (!gradientRef.current) return;
    
    // Clear previous content
    d3.select(gradientRef.current).html("");
    
    const colorScale = mode === 'import' ? importColorScale : exportColorScale;
    
    // Create CSS gradient for legend
    const stops = d3.range(0, 1.01, 0.1).map(d => {
      return {
        offset: d * 100 + "%",
        color: colorScale(d)
      };
    });
    
    const gradientStyle = `background: linear-gradient(to right, ${stops.map(s => `${s.color} ${s.offset}`).join(", ")});`;
    
    // Create container
    const container = d3.select(gradientRef.current)
      .append("div")
      .attr("class", "relative h-6 rounded-md overflow-hidden mb-1");
    
    // Add gradient
    container.append("div")
      .attr("class", "w-full h-full")
      .attr("style", gradientStyle);
    
  }, [mode]);
  
  // Get data and top countries
  const data = mode === 'import' ? importData : exportData;
  const topCountries = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm w-full">
      <h3 className="font-bold text-lg mb-3 text-foreground">Media Attention</h3>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 mt-1">
          <div className="text-xs text-muted-foreground mb-2">
            <span className="font-medium block mb-1">
              {mode === 'import' ? 'Media Coverage Received' : 'Foreign News Coverage'}
            </span>
            <span>
              The color intensity shows the percentage of global media {mode}s.
              Darker colors indicate higher media attention {mode === 'import' ? 'received from' : 'directed towards'} other countries.
            </span>
          </div>
          
          {/* Gradient legend */}
          <div ref={gradientRef}></div>
          
          {/* Ticks */}
          <div className="flex justify-between w-full">
            {[0, 25, 50, 75, 100].map(value => (
              <div key={value} className="text-xs text-muted-foreground">
                {value}%
              </div>
            ))}
          </div>
        </div>
        
        {/* Top countries */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {topCountries.map(([id, value]) => (
            <div key={id} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-sm" 
                style={{ backgroundColor: mode === 'import' ? 
                  importColorScale(value) : exportColorScale(value) 
                }}
              ></div>
              <div className="text-sm text-foreground">
                {countryNameMap[id] || id} ({(value * 100).toFixed(0)}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Legend; 