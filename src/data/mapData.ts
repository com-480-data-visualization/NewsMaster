import * as d3 from 'd3';

// Determine dark mode
export const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

// Color schemes for light and dark modes
export const importColorRange = isDarkMode ? ["#0f2942", "#7cb3fb"] : ["#cce5ff", "#004db3"];
export const exportColorRange = isDarkMode ? ["#0f2b1e", "#5ecc8d"] : ["#e6fff0", "#2a8c57"];

// Color scales for import and export
export const importColorScale = d3.scaleSequential()
  .domain([0, 1])
  .interpolator(d3.interpolate(importColorRange[0], importColorRange[1]));

export const exportColorScale = d3.scaleSequential()
  .domain([0, 1])
  .interpolator(d3.interpolate(exportColorRange[0], exportColorRange[1]));

// Sample media attention import data
export const importData: Record<string, number> = {
  "USA": 0.8,
  "BRA": 0.5,
  "ZAF": 0.4, // South Africa
  "NGA": 0.4, // Nigeria
  "CHN": 0.7,
  "IND": 0.6,
  "RUS": 0.3,
  "GBR": 0.65, // United Kingdom
  "DEU": 0.55, // Germany
  "FRA": 0.5,  // France
  "JPN": 0.6,  // Japan
  "AUS": 0.45, // Australia
  "CAN": 0.5,  // Canada
  "ITA": 0.4,  // Italy
  "ESP": 0.35  // Spain
};

// Sample media attention export data
export const exportData: Record<string, number> = {
  "USA": 0.9,
  "BRA": 0.3,
  "ZAF": 0.2, // South Africa
  "NGA": 0.3, // Nigeria
  "CHN": 0.85,
  "IND": 0.4,
  "RUS": 0.5,
  "GBR": 0.7, // United Kingdom
  "DEU": 0.75, // Germany
  "FRA": 0.6,  // France
  "JPN": 0.7,  // Japan
  "AUS": 0.35, // Australia
  "CAN": 0.45,  // Canada
  "ITA": 0.55,  // Italy
  "ESP": 0.4  // Spain
};

// Sample time series data for the last 30 days (per country)
export const timeSeriesData: Record<string, { import: number[], export: number[] }> = {
  "USA": {
    import: generateTrendData(0.8, 30),
    export: generateTrendData(0.9, 30)
  },
  "BRA": {
    import: generateTrendData(0.5, 30),
    export: generateTrendData(0.3, 30)
  },
  "ZAF": {
    import: generateTrendData(0.4, 30),
    export: generateTrendData(0.2, 30)
  },
  "NGA": {
    import: generateTrendData(0.4, 30),
    export: generateTrendData(0.3, 30)
  },
  "CHN": {
    import: generateTrendData(0.7, 30),
    export: generateTrendData(0.85, 30)
  },
  "IND": {
    import: generateTrendData(0.6, 30),
    export: generateTrendData(0.4, 30)
  },
  "RUS": {
    import: generateTrendData(0.3, 30),
    export: generateTrendData(0.5, 30)
  },
  "GBR": {
    import: generateTrendData(0.65, 30),
    export: generateTrendData(0.7, 30)
  },
  "DEU": {
    import: generateTrendData(0.55, 30),
    export: generateTrendData(0.75, 30)
  },
  "FRA": {
    import: generateTrendData(0.5, 30),
    export: generateTrendData(0.6, 30)
  },
  "JPN": {
    import: generateTrendData(0.6, 30),
    export: generateTrendData(0.7, 30)
  },
  "AUS": {
    import: generateTrendData(0.45, 30),
    export: generateTrendData(0.35, 30)
  },
  "CAN": {
    import: generateTrendData(0.5, 30),
    export: generateTrendData(0.45, 30)
  },
  "ITA": {
    import: generateTrendData(0.4, 30),
    export: generateTrendData(0.55, 30)
  },
  "ESP": {
    import: generateTrendData(0.35, 30),
    export: generateTrendData(0.4, 30)
  }
};

// Country name mapping for readable labels
export const countryNameMap: Record<string, string> = {
  "USA": "United States",
  "BRA": "Brazil",
  "ZAF": "South Africa",
  "NGA": "Nigeria",
  "CHN": "China",
  "IND": "India",
  "RUS": "Russia",
  "GBR": "United Kingdom",
  "DEU": "Germany",
  "FRA": "France",
  "JPN": "Japan",
  "AUS": "Australia",
  "CAN": "Canada",
  "ITA": "Italy",
  "ESP": "Spain"
};

// Helper function to generate trend data with some random variation
function generateTrendData(baseValue: number, days: number): number[] {
  const result = [];
  let currentValue = baseValue;
  for (let i = 0; i < days; i++) {
    // Add some random variation (-5% to +5% of base value)
    const variation = baseValue * (Math.random() * 0.1 - 0.05);
    currentValue = Math.max(0, Math.min(1, currentValue + variation));
    result.push(currentValue);
  }
  return result;
}

// Helper function to calculate global averages
export function calculateGlobalAverage(type: 'import' | 'export'): number {
  const data = type === 'import' ? importData : exportData;
  const sum = Object.values(data).reduce((acc, val) => acc + val, 0);
  return sum / Object.keys(data).length;
}

// Get stroke colors based on theme
export const strokeColor = isDarkMode ? "#2d3748" : "white";
export const highlightColor = isDarkMode ? "#90cdf4" : "#0066cc"; 