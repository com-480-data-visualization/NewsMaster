import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, GeoJSON } from 'geojson';
import { importData, exportData, importColorScale, exportColorScale, strokeColor, highlightColor } from '../data/mapData';

type Country = {
  id: string;
  name: string;
  properties: any;
};

type Props = {
  mode: 'import' | 'export';
  setSelectedCountry: (country: string | null) => void;
  setHoveredCountry: (country: { id: string; name: string; position: { x: number; y: number } } | null) => void;
};

// Type for GeoJSON feature properties
interface CountryFeature extends Feature {
  id: string;
  properties: {
    name: string;
    [key: string]: any;
  };
}

const WorldMap: React.FC<Props> = ({ mode, setSelectedCountry, setHoveredCountry }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Initialize map when component mounts
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
        .style("stroke", strokeColor)
        .style("stroke-width", 0.5)
        .style("cursor", "pointer")
        .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))")
        .on("mouseover", function(event, d) {
          const countryId = (d as any).id;
          const countryName = (d as any).properties.name;
          
          // Highlight country
          d3.select(this)
            .style("stroke", highlightColor)
            .style("stroke-width", 1.5)
            .style("filter", "drop-shadow(0px 0px 5px rgba(0, 102, 204, 0.3))");
          
          // Update hovered country
          setHoveredCountry({
            id: countryId,
            name: countryName,
            position: { x: event.clientX, y: event.clientY }
          });
        })
        .on("mouseout", function() {
          d3.select(this)
            .style("stroke", strokeColor)
            .style("stroke-width", 0.5)
            .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))");
          
          setHoveredCountry(null);
        })
        .on("click", function(_, d) {
          const id = (d as any).id;
          // Not using name, so removing the unused variable
          // const name = (d as any).properties.name;
          
          // Highlight clicked country with stronger effect
          mapGroup.selectAll("path")
            .style("stroke", strokeColor)
            .style("stroke-width", 0.5)
            .style("filter", "drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.15))");
          
          d3.select(this)
            .style("stroke", highlightColor)
            .style("stroke-width", 2)
            .style("filter", "drop-shadow(0px 0px 8px rgba(0, 102, 204, 0.5))");
          
          setSelectedCountry(id);
        });
      
      // Initial coloring of countries
      updateMapColors(mapGroup, mode);
      setMapInitialized(true);
    });
    
  }, [mapInitialized, setHoveredCountry, setSelectedCountry]);

  // Update map colors when mode changes
  useEffect(() => {
    if (!mapInitialized) return;
    
    const svg = d3.select(svgRef.current);
    const mapGroup = svg.select("g");
    updateMapColors(mapGroup, mode);
    
  }, [mode, mapInitialized]);

  // Helper function to update map colors
  const updateMapColors = (mapGroup: d3.Selection<any, unknown, null, undefined>, mode: 'import' | 'export') => {
    const colorScale = mode === 'import' ? importColorScale : exportColorScale;
    const data = mode === 'import' ? importData : exportData;
    
    mapGroup.selectAll("path")
      .attr("fill", (d: any) => {
        const id = d.id;
        return colorScale(data[id] || 0);
      });
  };

  return (
    <svg 
      ref={svgRef} 
      width="100%" 
      height="650" 
      viewBox="0 0 960 500" 
      className="mx-auto"
    />
  );
};

export default WorldMap; 