import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  importData, exportData, 
  importColorScale, exportColorScale, 
  timeSeriesData, calculateGlobalAverage 
} from '../data/mapData';

type Props = {
  hoveredCountry: { 
    id: string; 
    name: string; 
    position: { x: number; y: number } 
  } | null;
  mode: 'import' | 'export';
};

const CountryTooltip: React.FC<Props> = ({ hoveredCountry, mode }) => {
  const barChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);

  // Create the bar chart when country changes
  useEffect(() => {
    if (!hoveredCountry || !barChartRef.current) return;
    
    const countryId = hoveredCountry.id;
    const importValue = importData[countryId] || 0;
    const exportValue = exportData[countryId] || 0;
    
    // Clear previous chart
    d3.select(barChartRef.current).html("");
    
    const chartSvg = d3.select(barChartRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
    
    const margin = { top: 10, right: 10, bottom: 20, left: 40 };
    const chartWidth = 220 - margin.left - margin.right;
    const chartHeight = 80 - margin.top - margin.bottom;
    
    const g = chartSvg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // X scale
    const x = d3.scaleBand()
      .domain(['Import', 'Export'])
      .range([0, chartWidth])
      .padding(0.3);
    
    // Y scale
    const y = d3.scaleLinear()
      .domain([0, Math.max(importValue, exportValue) * 1.2])
      .range([chartHeight, 0]);
    
    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground")
      .attr("dy", "0.5em")
      .attr("dx", "0.15em");
    
    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(y)
        .ticks(3)
        .tickFormat((d) => `${(Number(d) * 100).toFixed(0)}%`))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground");
    
    // Bars
    g.selectAll(".bar")
      .data([
        { name: 'Import', value: importValue, color: importColorScale(importValue) },
        { name: 'Export', value: exportValue, color: exportColorScale(exportValue) }
      ])
      .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.name) || 0)
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => chartHeight - y(d.value))
      .attr("fill", d => d.color);
  }, [hoveredCountry]);

  // Create the trend chart when country changes
  useEffect(() => {
    if (!hoveredCountry || !trendChartRef.current) return;
    
    const countryId = hoveredCountry.id;
    
    // Get global average for comparison
    const globalImportAvg = calculateGlobalAverage('import');
    const globalExportAvg = calculateGlobalAverage('export');
    
    const countryData = timeSeriesData[countryId] || { 
      import: Array(30).fill(0), 
      export: Array(30).fill(0) 
    };
    
    // Clear previous chart
    d3.select(trendChartRef.current).html("");
    
    const chartSvg = d3.select(trendChartRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
    
    const margin = { top: 15, right: 15, bottom: 20, left: 35 };
    const chartWidth = 220 - margin.left - margin.right;
    const chartHeight = 90 - margin.top - margin.bottom;
    
    const g = chartSvg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // X scale for days
    const x = d3.scaleLinear()
      .domain([0, 29])
      .range([0, chartWidth]);
    
    // Y scale for values
    const y = d3.scaleLinear()
      .domain([0, 1])
      .range([chartHeight, 0]);
    
    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).ticks(3).tickFormat(d => `${30 - Number(d)}d`))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground")
      .attr("dy", "0.7em");
    
    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(3).tickFormat(d => `${(Number(d) * 100).toFixed(0)}%`))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground")
      .attr("dx", "-0.5em");
    
    // Add lines
    // Global import average
    g.append("path")
      .datum(Array(30).fill(globalImportAvg))
      .attr("fill", "none")
      .attr("stroke", importColorScale(0.5))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Global export average  
    g.append("path")
      .datum(Array(30).fill(globalExportAvg))
      .attr("fill", "none")
      .attr("stroke", exportColorScale(0.5))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Country import line
    g.append("path")
      .datum(countryData.import)
      .attr("fill", "none")
      .attr("stroke", importColorScale(0.7))
      .attr("stroke-width", 1.5)
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Country export line
    g.append("path")
      .datum(countryData.export)
      .attr("fill", "none")
      .attr("stroke", exportColorScale(0.7))
      .attr("stroke-width", 1.5)
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
      
    // Add legend
    const legend = g.append("g")
      .attr("transform", `translate(0, -10)`);
      
    // Import
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 15)
      .attr("y2", 0)
      .attr("stroke", importColorScale(0.7))
      .attr("stroke-width", 2);
      
    legend.append("text")
      .attr("x", 20)
      .attr("y", 4)
      .attr("class", "text-xs")
      .style("fill", "#666")
      .text("Import");
      
    // Export  
    legend.append("line")
      .attr("x1", 70)
      .attr("y1", 0)
      .attr("x2", 85)
      .attr("y2", 0)
      .attr("stroke", exportColorScale(0.7))
      .attr("stroke-width", 2);
      
    legend.append("text")
      .attr("x", 90)
      .attr("y", 4)
      .attr("class", "text-xs")
      .style("fill", "#666")
      .text("Export");
      
    // Global Average
    legend.append("line")
      .attr("x1", 140)
      .attr("y1", 0)
      .attr("x2", 155)
      .attr("y2", 0)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");
      
    legend.append("text")
      .attr("x", 160)
      .attr("y", 4)
      .attr("class", "text-xs")
      .style("fill", "#666")
      .text("Global Avg");
  }, [hoveredCountry]);

  if (!hoveredCountry) return null;

  // Calculate tooltip position
  const tooltipHeight = 220;
  const windowHeight = window.innerHeight;
  const positionAbove = hoveredCountry.position.y + tooltipHeight + 20 > windowHeight;
  const topPosition = positionAbove 
    ? hoveredCountry.position.y - tooltipHeight - 5 
    : hoveredCountry.position.y + 5;

  return (
    <div 
      className="absolute bg-popover p-4 rounded-lg shadow-lg text-sm border border-border z-10 w-64"
      style={{
        left: `${hoveredCountry.position.x + 5}px`,
        top: `${topPosition}px`,
        transition: 'top 0.1s ease, left 0.1s ease',
        pointerEvents: 'none'
      }}
    >
      <p className="font-bold text-foreground mb-2">{hoveredCountry.name}</p>
      <div ref={barChartRef} className="h-20 w-full mb-4"></div>
      <p className="text-xs text-muted-foreground mb-1">Performance (last 30 days)</p>
      <div ref={trendChartRef} className="h-24 w-full"></div>
    </div>
  );
};

export default CountryTooltip; 