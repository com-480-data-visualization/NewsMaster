export const importColorRangeWhite: [string, string] = ["#cce5ff", "#004db3"];
export const importColorRangeDark: [string, string] =  ["#0f2942", "#7cb3fb"];

export const exportColorRangeWhite: [string, string] = ["#e6fff0", "#2a8c57"];
export const exportColorRangeDark: [string, string] = ["#e6fff0", "#2a8c57"];

export const strokeColorWhite = "white";
export const strokeColorDark = "#2d3748";

export const highlightColorWhite = "#0066cc";
export const highlightColorDark = "#90cdf4";

// Color schemes for light and dark modes
export const importColorRange = [importColorRangeWhite,importColorRangeDark ]
export const exportColorRange =  [exportColorRangeWhite, exportColorRangeDark ]
export const strokeColor = [strokeColorWhite, strokeColorDark]
export const highlightColor = [highlightColorWhite, highlightColorDark]

// Simple color interpolation
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function interpolateColor(color1: string, color2: string, t: number) {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return color1;
  
  const r = rgb1.r + (rgb2.r - rgb1.r) * t;
  const g = rgb1.g + (rgb2.g - rgb1.g) * t;
  const b = rgb1.b + (rgb2.b - rgb1.b) * t;
  
  return rgbToHex(r, g, b);
}

// Theme-aware color scale functions - now stateless
export function createImportColorScale(isDark: boolean = false, domain: [number, number] = [0, 1]) {
  const range = isDark ? importColorRangeDark : importColorRangeWhite;
  
  return (value: number) => {
    const [min, max] = domain;
    const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    return interpolateColor(range[0], range[1], t);
  };
}

export function createExportColorScale(isDark: boolean = false, domain: [number, number] = [0, 1]) {
  const range = isDark ? exportColorRangeDark : exportColorRangeWhite;
  
  return (value: number) => {
    const [min, max] = domain;
    const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    return interpolateColor(range[0], range[1], t);
  };
}

// Helper functions to get color ranges (for legends)
export function getImportColorRange(isDark: boolean = false): [string, string] {
  return isDark ? importColorRangeDark : importColorRangeWhite;
}

export function getExportColorRange(isDark: boolean = false): [string, string] {
  return isDark ? exportColorRangeDark : exportColorRangeWhite;
}