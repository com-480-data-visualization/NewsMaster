import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  createImportColorScale, createExportColorScale
} from '../../data/mapStyle';

// Define entity structure
interface EntityData {
  entity: string;
  count: number;
  share: number;
}

// Define structure for the data prop - matches the actual data structure
interface TooltipData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  TopEntitiesByCountry?: Record<string, EntityData[]>;
}

type Props = {
  hoveredCountry: { 
    id: string; 
    name: string; 
    position: { x: number; y: number } 
  } | null;
  mode: 'import' | 'export';
  data: TooltipData;
};

const CountryTooltip: React.FC<Props> = ({ hoveredCountry, mode, data }) => {
  const barChartRef = useRef<HTMLDivElement>(null);
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

  // Create color scales dynamically based on theme and current data
  const { importColorScale, exportColorScale } = React.useMemo(() => {
    if (!data) {
      return {
        importColorScale: createImportColorScale(isDarkMode, [0, 0.001]),
        exportColorScale: createExportColorScale(isDarkMode, [0, 0.001])
      };
    }

    const maxImport = Math.max(...Object.values(data.importData), 0);
    const maxExport = Math.max(...Object.values(data.exportData), 0);
    const importDomain: [number, number] = [0, maxImport || 0.001];
    const exportDomain: [number, number] = [0, maxExport || 0.001];

    return {
      importColorScale: createImportColorScale(isDarkMode, importDomain),
      exportColorScale: createExportColorScale(isDarkMode, exportDomain)
    };
  }, [data, isDarkMode]);

  // Create the bar chart when country or data changes
  useEffect(() => {
    if (!hoveredCountry || !barChartRef.current || !data) return;
    
    const countryId = hoveredCountry.id;
    const importValue = data.importData[countryId] || 0;
    const exportValue = data.exportData[countryId] || 0;
    
    // Clear previous chart
    d3.select(barChartRef.current).html("");
    
    const chartSvg = d3.select(barChartRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
    
    const margin = { top: 10, right: 10, bottom: 20, left: 40 };
    const chartWidth = 280 - margin.left - margin.right;
    const chartHeight = 100 - margin.top - margin.bottom;
    
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
        .ticks(4)
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
  }, [hoveredCountry?.id, data, importColorScale, exportColorScale]);

  // Render entities table
  const renderTopEntities = () => {
    if (!hoveredCountry || !data) return null;
    
    const countryId = hoveredCountry.id;
    
    // Debug logging
    console.log('Tooltip Debug:', {
      countryId,
      hasTopEntitiesByCountry: !!data.TopEntitiesByCountry,
      availableCountries: data.TopEntitiesByCountry ? Object.keys(data.TopEntitiesByCountry) : [],
      entitiesForCountry: data.TopEntitiesByCountry?.[countryId]
    });
    
    const entities = data.TopEntitiesByCountry?.[countryId] || [];
    
    if (entities.length === 0) {
      return (
        <div className="text-sm text-muted-foreground mt-3">
          <p>No significant entities found for this country.</p>
         
        </div>
      );
    }
    
    const displayColor = mode === 'import' ? 'bg-blue-500' : 'bg-green-500';
    
    return (
      <div className="overflow-hidden mt-3">
        <p className="text-sm text-muted-foreground mb-2">Top entities associated with {hoveredCountry.name}</p>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-muted">
              <th className="text-left py-1 font-medium text-xs text-muted-foreground">#</th>
              <th className="text-left py-1 font-medium text-xs text-muted-foreground">Entity</th>
              <th className="text-right py-1 font-medium text-xs text-muted-foreground">%</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((entity, index) => (
              <tr key={`${entity.entity}-${index}`} className="border-b border-muted last:border-0">
                <td className="py-1 text-xs">{index + 1}</td>
                <td className="py-1 text-xs">{entity.entity}</td>
                <td className="py-1 text-xs text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 bg-muted rounded-full h-1.5">
                      <div 
                        className={`${displayColor} h-1.5 rounded-full`}
                        style={{ width: `${entity.share * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {(entity.share * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (!hoveredCountry) return null;

  // Calculate tooltip position
  const tooltipWidth = 320;
  const tooltipHeight = 350; // Increased height for entities table
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Determine if tooltip should be shown to the right or left of cursor
  const showToLeft = hoveredCountry.position.x + tooltipWidth + 20 > windowWidth;
  const leftPosition = showToLeft 
    ? hoveredCountry.position.x - tooltipWidth - 10
    : hoveredCountry.position.x + 20;
  
  // Determine if tooltip should be shown above or below cursor
  const showAbove = hoveredCountry.position.y + tooltipHeight + 20 > windowHeight;
  const topPosition = showAbove
    ? hoveredCountry.position.y - tooltipHeight - 10
    : hoveredCountry.position.y + 20;

  return (
    <div 
      className="fixed bg-popover p-5 rounded-lg shadow-lg text-sm border border-border z-10 w-80"
      style={{
        left: `${Math.max(10, leftPosition)}px`,
        top: `${Math.max(10, topPosition)}px`,
        transition: 'top 0.1s ease, left 0.1s ease',
        pointerEvents: 'none'
      }}
    >
      <p className="font-bold text-lg text-foreground mb-3">{hoveredCountry.name}</p>
      <div ref={barChartRef} className="h-24 w-full mb-4"></div>
      {renderTopEntities()}
    </div>
  );
};

export default React.memo(CountryTooltip); 