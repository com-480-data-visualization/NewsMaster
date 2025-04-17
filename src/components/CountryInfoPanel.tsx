import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  importData, exportData, 
  importColorScale, exportColorScale, 
  timeSeriesData, calculateGlobalAverage,
  countryNameMap
} from '../data/mapData';

type Props = {
  selectedCountry: string | null;
  mode: 'import' | 'export';
};

const CountryInfoPanel: React.FC<Props> = ({ selectedCountry, mode }) => {
  const trendChartRef = useRef<HTMLDivElement>(null);
  
  // Create detailed trend chart when country changes
  useEffect(() => {
    if (!selectedCountry || !trendChartRef.current) return;
    
    // Clear previous chart
    d3.select(trendChartRef.current).html("");
    
    // Get global average for comparison
    const globalImportAvg = calculateGlobalAverage('import');
    const globalExportAvg = calculateGlobalAverage('export');
    
    const countryData = timeSeriesData[selectedCountry] || { 
      import: Array(30).fill(0), 
      export: Array(30).fill(0) 
    };
    
    const chartSvg = d3.select(trendChartRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
    
    const margin = { top: 30, right: 10, bottom: 30, left: 50 };
    const boundingRect = trendChartRef.current.getBoundingClientRect();
    const chartWidth = boundingRect.width - margin.left - margin.right;
    const chartHeight = boundingRect.height - margin.top - margin.bottom;
    
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
    
    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(
        d3.axisBottom(x)
          .ticks(6)
          .tickSize(-chartHeight)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "rgba(0,0,0,0.1)");
    
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickSize(-chartWidth)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "rgba(0,0,0,0.1)");
    
    // Add X axis
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${30 - Number(d)}d`))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground")
      .attr("dy", "1em");
    
    // Add Y axis
    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${(Number(d) * 100).toFixed(0)}%`))
      .selectAll("text")
      .attr("class", "text-xs text-muted-foreground")
      .attr("dx", "-0.5em");
      
    // Ensure axis lines are visible
    g.selectAll(".domain")
      .attr("stroke", "rgba(0,0,0,0.3)")
      .attr("stroke-width", 1);
    
    // Add a dashed line for global import average
    g.append("path")
      .datum(Array(30).fill(globalImportAvg))
      .attr("fill", "none")
      .attr("stroke", importColorScale(0.7))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
      
    // Add a dashed line for global export average
    g.append("path")
      .datum(Array(30).fill(globalExportAvg))
      .attr("fill", "none")
      .attr("stroke", exportColorScale(0.7))
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Add area fill under the import line
    g.append("path")
      .datum(countryData.import)
      .attr("fill", importColorScale(0.7))
      .attr("fill-opacity", 0.1)
      .attr("d", d3.area<number>()
        .x((_, i) => x(i))
        .y0(chartHeight)
        .y1(d => y(d))
      );
    
    // Add area fill under the export line
    g.append("path")
      .datum(countryData.export)
      .attr("fill", exportColorScale(0.7))
      .attr("fill-opacity", 0.1)
      .attr("d", d3.area<number>()
        .x((_, i) => x(i))
        .y0(chartHeight)
        .y1(d => y(d))
      );
    
    // Add country import line
    g.append("path")
      .datum(countryData.import)
      .attr("fill", "none")
      .attr("stroke", importColorScale(0.7))
      .attr("stroke-width", 2)
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Add country export line
    g.append("path")
      .datum(countryData.export)
      .attr("fill", "none")
      .attr("stroke", exportColorScale(0.7))
      .attr("stroke-width", 2)
      .attr("d", d3.line<number>()
        .x((_, i) => x(i))
        .y(d => y(d))
      );
    
    // Add dots for current values
    g.append("circle")
      .attr("cx", x(29))
      .attr("cy", y(countryData.import[29]))
      .attr("r", 4)
      .attr("fill", importColorScale(0.7));
    
    g.append("circle")
      .attr("cx", x(29))
      .attr("cy", y(countryData.export[29]))
      .attr("r", 4)
      .attr("fill", exportColorScale(0.7));
    
    // Add legend at the top of the chart with plenty of vertical space
    const legend = g.append("g")
      .attr("transform", `translate(0, -20)`);
    
    // Import legend - horizontal layout
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
    
    // Export legend
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
    
    // Global average legend
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
    
  }, [selectedCountry]);

  if (!selectedCountry) return (
    <div className="p-4 border rounded-lg bg-card shadow-sm hidden md:block w-full">
      <h3 className="font-bold text-lg mb-2 text-foreground">Country Details</h3>
      <p className="text-muted-foreground">Select a country on the map to view details</p>
    </div>
  );

  const countryName = countryNameMap[selectedCountry] || selectedCountry;
  const importValue = importData[selectedCountry] || 0;
  const exportValue = exportData[selectedCountry] || 0;

  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm w-full">
      <h3 className="font-bold text-lg mb-2 text-foreground">Country Details</h3>
      <p className="text-xl font-medium text-primary mb-1">{countryName}</p>
      
      <div className="text-sm text-muted-foreground mb-3">
        Media attention metrics showing how much {countryName} is covered in international news (import) 
        and how much its own media covers foreign events (export).
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Import</p>
          <div className="flex items-center gap-2">
            <div className="w-full bg-muted rounded-full h-2.5">
              <div 
                className="bg-blue-500 h-2.5 rounded-full" 
                style={{width: `${importValue * 100}%`}}
              ></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground min-w-16">
              {(importValue * 100).toFixed(1)}%
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Export</p>
          <div className="flex items-center gap-2">
            <div className="w-full bg-muted rounded-full h-2.5">
              <div 
                className="bg-green-500 h-2.5 rounded-full" 
                style={{width: `${exportValue * 100}%`}}
              ></div>
            </div>
            <p className="text-sm font-medium text-muted-foreground min-w-16">
              {(exportValue * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="text-sm font-medium text-muted-foreground mb-2">Performance (last 30 days)</p>
        <div ref={trendChartRef} className="h-36 w-full"></div>
      </div>
    </div>
  );
};

export default CountryInfoPanel; 