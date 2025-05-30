import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(enLocale);

// Define data point structure
interface TrendDataPoint {
  date: string;
  featured: number;
  covering: number;
}

type Props = {
  selectedCountry: string | null;
  trendData: TrendDataPoint[];
  isLoading?: boolean;
};

const CountryTrendChart: React.FC<Props> = ({ 
  selectedCountry, 
  trendData, 
  isLoading = false 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = React.useState<boolean>(false);

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

  const getCountryName = (code: string): string => {
    if (!code || code.length !== 3) return code;
    
    try {
      // Convert alpha-3 to alpha-2 for compatibility with the library
      const alpha2 = countries.alpha3ToAlpha2(code);
      if (alpha2) {
        return countries.getName(alpha2, 'en') || code;
      }
      return code;
    } catch (error) {
      console.warn(`Could not find country name for code: ${code}`);
      return code;
    }
  };

  useEffect(() => {
    if (!chartRef.current || !selectedCountry || trendData.length === 0) return;
    
    d3.select(chartRef.current).html("");
    
    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    const svg = d3.select(chartRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);
    
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Parse dates and sort data
    const parseDate = d3.timeParse("%Y-%m-%d");
    const data = trendData
      .map(d => ({
        date: parseDate(d.date),
        featured: d.featured,
        covering: d.covering
      }))
      .filter(d => d.date !== null)
      .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));
    
    if (data.length === 0) return;
    
    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date!) as [Date, Date])
      .range([0, width]);
    
    const maxY = Math.max(
      d3.max(data, d => d.featured) || 0,
      d3.max(data, d => d.covering) || 0
    );
    
    const yScale = d3.scaleLinear()
      .domain([0, maxY * 1.1])
      .range([height, 0]);
    
    // Lines
    const featuredLine = d3.line<any>()
      .x(d => xScale(d.date!))
      .y(d => yScale(d.featured))
      .curve(d3.curveMonotoneX);
    
    const coveringLine = d3.line<any>()
      .x(d => xScale(d.date!))
      .y(d => yScale(d.covering))
      .curve(d3.curveMonotoneX);
    
    // Colors based on theme
    const featuredColor = isDarkMode ? "#60a5fa" : "#3b82f6"; // blue
    const coveringColor = isDarkMode ? "#f97316" : "#ea580c"; // orange
    const gridColor = isDarkMode ? "#374151" : "#e5e7eb";
    const textColor = isDarkMode ? "#d1d5db" : "#6b7280";
    
    // Grid lines
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat("%m/%d") as any);
    
    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${((d as number) * 100).toFixed(1)}%`);
    
    // Add grid
    g.selectAll(".grid-line-x")
      .data(xScale.ticks(6))
      .enter()
      .append("line")
      .attr("class", "grid-line-x")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", gridColor)
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.3);
    
    g.selectAll(".grid-line-y")
      .data(yScale.ticks(5))
      .enter()
      .append("line")
      .attr("class", "grid-line-y")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", gridColor)
      .attr("stroke-width", 0.5)
      .attr("opacity", 0.3);
    
    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .selectAll("text")
      .attr("fill", textColor);
    
    g.append("g")
      .call(yAxis)
      .selectAll("text")
      .attr("fill", textColor);
    
    // Add axis labels
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x", 0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .attr("fill", textColor)
      .style("font-size", "12px")
      .text("Share (%)");
    
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + margin.bottom - 5})`)
      .style("text-anchor", "middle")
      .attr("fill", textColor)
      .style("font-size", "12px")
      .text("Date");
    
    // Add featured line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", featuredColor)
      .attr("stroke-width", 2)
      .attr("d", featuredLine);
    
    // Add covering line
    g.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", coveringColor)
      .attr("stroke-width", 2)
      .attr("d", coveringLine);
    
    // Add dots for featured
    g.selectAll(".dot-featured")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-featured")
      .attr("cx", d => xScale(d.date!))
      .attr("cy", d => yScale(d.featured))
      .attr("r", 3)
      .attr("fill", featuredColor);
    
    // Add dots for covering
    g.selectAll(".dot-covering")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "dot-covering")
      .attr("cx", d => xScale(d.date!))
      .attr("cy", d => yScale(d.covering))
      .attr("r", 3)
      .attr("fill", coveringColor);
    
    // Add legend
    const legend = g.append("g")
      .attr("transform", `translate(${width - 70}, 20)`);
    
    legend.append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", featuredColor)
      .attr("stroke-width", 2);
    
    legend.append("text")
      .attr("x", 20)
      .attr("y", 0)
      .attr("dy", "0.35em")
      .attr("fill", textColor)
      .style("font-size", "12px")
      .text("Featured");
    
    legend.append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 20)
      .attr("y2", 20)
      .attr("stroke", coveringColor)
      .attr("stroke-width", 2);
    
    legend.append("text")
      .attr("x", 20)
      .attr("y", 20)
      .attr("dy", "0.35em")
      .attr("fill", textColor)
      .style("font-size", "12px")
      .text("Covering");
    
  }, [selectedCountry, trendData, isDarkMode]);

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Country Trend Analysis
        </h3>
        <p className="text-sm text-muted-foreground mb-3">Loading trend data...</p>
        <div className="w-full h-64 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  // If no country is selected, show instruction
  if (!selectedCountry) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Click a country
        </h3>
       
      </div>
    );
  }

  // If no trend data available
  if (trendData.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-card shadow-sm">
        <h3 className="font-bold text-lg mb-2 text-foreground">
          Trend Analysis for {getCountryName(selectedCountry)}
        </h3>
        <p className="text-sm text-muted-foreground">
          No trend data available for {getCountryName(selectedCountry)} over the last 14 days.
        </p>
      </div>
    );
  }

  // Display chart for selected country
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-bold text-lg mb-2 text-foreground">
        14-Day Trend for {getCountryName(selectedCountry)}
      </h3>
      
      <div ref={chartRef} className="w-full"></div>
      
      <div className="mt-3 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
        <p className="mb-1">
          <span className="text-blue-600 font-medium">Featured</span>: How much {getCountryName(selectedCountry)} is covered by foreign media.
        </p>
        <p>
          <span className="text-orange-600 font-medium">Covering</span>: How much {getCountryName(selectedCountry)} covers overseas events.
        </p>
      </div>
    </div>
  );
};

export default CountryTrendChart; 