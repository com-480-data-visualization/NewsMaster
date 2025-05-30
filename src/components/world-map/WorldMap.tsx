import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GeoJSON } from 'geojson';

// Legend configuration type
export type LegendConfig = {
  title: string;
  colorRange: [string, string]; // [start color, end color]
  valueRange: [number, number]; // [min value, max value]
  unit?: string; // e.g., '%', 'articles', etc.
};

// Map size configuration
export type MapSize = {
  width: number;
  height: number;
  scale: number;
};

type Props = {
  colorScale: (value: number) => string;
  strokeColor: string;
  highlightColor: string;
  data: Record<string, number>;
  setSelectedCountry: (country: string | null) => void;
  setHoveredCountry: (country: { id: string; name: string; position: { x: number; y: number } } | null) => void;
  legend?: LegendConfig; // Optional legend configuration
  mapSize?: MapSize; // Optional map size configuration
};

const WorldMap: React.FC<Props> = ({ 
  colorScale, 
  strokeColor, 
  highlightColor, 
  data, 
  setSelectedCountry, 
  setHoveredCountry,
  legend,
  mapSize = { width: 960, height: 500, scale: 160 } // Default values
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Stable references to avoid re-initialization
  const stableSetSelectedCountry = useCallback(setSelectedCountry, [setSelectedCountry]);
  const stableSetHoveredCountry = useCallback(setHoveredCountry, [setHoveredCountry]);

  // Helper function to update map colors - memoized to prevent recreation
  const updateMapColors = useCallback((
    mapGroup: d3.Selection<any, unknown, null, undefined>, 
    colorFunction: (value: number) => string, 
    currentData: Record<string, number>
  ) => {
    mapGroup.selectAll("path")
      .attr("fill", (d: any) => {
        const id = d.id;
        return colorFunction(currentData[id] || 0);
      });
  }, []);

  // Initialize map ONCE when component mounts (no dependencies on changing props)
  useEffect(() => {
    if (!svgRef.current || mapInitialized) return;

    const { width, height, scale } = mapSize;
    const svg = d3.select(svgRef.current);
    
    const projection = d3.geoNaturalEarth1()
      .scale(scale)
      .translate([width / 2, height / 2]);
    
    const path = d3.geoPath().projection(projection);
    
    // Add zoom capability
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        svg.selectAll("g").attr("transform", event.transform.toString());
      })
      .filter((event) => {
        // Only allow zoom on drag (left mouse button), not on wheel
        return event.type === "mousedown" && event.button === 0;
      });

    svg.call(zoom as any);
    
    // Create a group for all map elements
    const mapGroup = svg.append("g");
    
    // Load map data
    d3.json<GeoJSON>("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson").then(function(world) {
      if (!world || !('features' in world)) return;
      
      // Filter out Antarctica
      const filteredFeatures = world.features.filter((f: any) => 
        f.id !== 'ATA' && f.properties.name !== 'Antarctica'
      );
      
      // Draw map
      mapGroup.selectAll("path")
        .data(filteredFeatures)
        .join("path")
        .attr("d", (d) => {
          // Explicitly cast d to any and ensure a string is returned
          return path(d as any) || '';
        })
        .attr("class", "country")
        .style("cursor", "pointer")
        .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))")
        .on("mouseover", function(event, d) {
          const countryId = (d as any).id;
          const countryName = (d as any).properties.name;
          
          // Highlight country - use current stroke color from closure
          d3.select(this)
            .style("stroke-width", 1.5)
            .style("filter", "drop-shadow(0px 0px 5px rgba(0, 102, 204, 0.3))");
          
          // Get mouse position relative to the map container
          const mapContainer = document.getElementById('world-map-container');
          if (mapContainer) {
            const containerRect = mapContainer.getBoundingClientRect();
            const x = event.clientX - containerRect.left;
            const y = event.clientY - containerRect.top;
            
            stableSetHoveredCountry({
              id: countryId,
              name: countryName,
              position: { 
                x: x, 
                y: y 
              }
            });
          } else {
            // Fallback to viewport coordinates
            stableSetHoveredCountry({
              id: countryId,
              name: countryName,
              position: { 
                x: event.clientX, 
                y: event.clientY 
              }
            });
          }
        })
        .on("mouseout", function() {
          d3.select(this)
            .style("stroke-width", 0.5)
            .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))");
          
          stableSetHoveredCountry(null);
        })
        .on("click", function(_, d) {
          const id = (d as any).id;
          
          // Highlight clicked country with stronger effect
          mapGroup.selectAll("path")
            .style("stroke-width", 0.5)
            .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))");
          
          d3.select(this)
            .style("stroke-width", 2)
            .style("filter", "drop-shadow(0px 0px 8px rgba(0, 102, 204, 0.5))");
          
          stableSetSelectedCountry(id);
        });
      
      setMapInitialized(true);
    });
    
  }, [mapSize]); // Add mapSize as dependency

  // Update stroke and highlight colors when they change
  useEffect(() => {
    if (!mapInitialized) return;
    
    const svg = d3.select(svgRef.current);
    const mapGroup = svg.select("g");
    
    mapGroup.selectAll("path")
      .style("stroke", strokeColor)
      .style("stroke-width", 0.5);
      
    // Update hover effects to use current highlight color
    mapGroup.selectAll("path")
      .on("mouseover", function(event, d) {
        const countryId = (d as any).id;
        const countryName = (d as any).properties.name;
        
        d3.select(this)
          .style("stroke", highlightColor)
          .style("stroke-width", 1.5)
          .style("filter", "drop-shadow(0px 0px 5px rgba(0, 102, 204, 0.3))");
        
        // Get mouse position relative to the map container
        const mapContainer = document.getElementById('world-map-container');
        if (mapContainer) {
          const containerRect = mapContainer.getBoundingClientRect();
          const x = event.clientX - containerRect.left;
          const y = event.clientY - containerRect.top;
          
          stableSetHoveredCountry({
            id: countryId,
            name: countryName,
            position: { 
              x: x, 
              y: y 
            }
          });
        } else {
          // Fallback to viewport coordinates
          stableSetHoveredCountry({
            id: countryId,
            name: countryName,
            position: { 
              x: event.clientX, 
              y: event.clientY 
            }
          });
        }
      })
      .on("mouseout", function() {
        d3.select(this)
          .style("stroke", strokeColor)
          .style("stroke-width", 0.5)
          .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))");
        
        stableSetHoveredCountry(null);
      });
    
  }, [mapInitialized, strokeColor, highlightColor, stableSetHoveredCountry]);

  // Update map colors when colorScale or data changes (separate from initialization)
  useEffect(() => {
    if (!mapInitialized) return;
    
    const svg = d3.select(svgRef.current);
    const mapGroup = svg.select("g");
    updateMapColors(mapGroup, colorScale, data);
    
  }, [colorScale, data, mapInitialized, updateMapColors]);

  return (
    <div className="relative w-full h-full">
      <svg 
        ref={svgRef} 
        width="100%" 
        height={mapSize.height} 
        viewBox={`0 0 ${mapSize.width} ${mapSize.height}`} 
        className="mx-auto"
      />
      
      {/* Optional Legend - positioned at bottom center where Antarctica would be */}
      {legend && (
        <div 
          className="absolute bg-card/90 backdrop-blur-sm p-3 rounded-lg border shadow-lg transform -translate-x-1/2"
          style={{ 
            left: '50%', 
            bottom: `${Math.max(20, mapSize.height * 0.08)}px` // Y offset relative to map size
          }}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground text-center">
              {legend.title}
            </p>
            <div 
              className="w-32 h-3 rounded-sm overflow-hidden" 
              style={{ 
                background: `linear-gradient(to right, ${legend.colorRange[0]}, ${legend.colorRange[1]})`
              }}
            />
            <div className="flex justify-between w-32">
              <span className="text-xs text-muted-foreground">
                {legend.valueRange[0]}{legend.unit || ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {legend.valueRange[1]}{legend.unit || ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(WorldMap); 