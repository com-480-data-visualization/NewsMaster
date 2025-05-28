import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GeoJSON } from 'geojson';

type Props = {
  colorScale: (value: number) => string;
  strokeColor: string;
  highlightColor: string;
  data: Record<string, number>;
  setSelectedCountry: (country: string | null) => void;
  setHoveredCountry: (country: { id: string; name: string; position: { x: number; y: number } } | null) => void;
};

const WorldMap: React.FC<Props> = ({ colorScale, strokeColor, highlightColor, data, setSelectedCountry, setHoveredCountry }) => {
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

    const width = 960, height = 500;
    const svg = d3.select(svgRef.current);
    
    const projection = d3.geoNaturalEarth1()
      .scale(160)
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
          
          // Get SVG element position
          const svgRect = svgRef.current?.getBoundingClientRect();
          
          // Highlight country - use current stroke color from closure
          d3.select(this)
            .style("stroke-width", 1.5)
            .style("filter", "drop-shadow(0px 0px 5px rgba(0, 102, 204, 0.3))");
          
          // Update hovered country
          stableSetHoveredCountry({
            id: countryId,
            name: countryName,
            position: { 
              x: event.pageX, 
              y: event.pageY 
            }
          });
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
    
  }, []); // Only run once on mount

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
        
        stableSetHoveredCountry({
          id: countryId,
          name: countryName,
          position: { 
            x: event.pageX, 
            y: event.pageY 
          }
        });
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
    <svg 
      ref={svgRef} 
      width="100%" 
      height="500" 
      viewBox="0 0 960 500" 
      className="mx-auto"
    />
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(WorldMap); 