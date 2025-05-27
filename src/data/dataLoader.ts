import { countryNameMap } from './mapData'; // Assuming mapData.ts is in the same directory or path is adjusted

// Define a simplified provider structure as read from providers.json
interface Provider {
  id: string;
  country: string; // e.g., "US", "FR"
}

// Define the structure of an article from articles.json
interface Article {
  id: string;
  providerId: string;
  ner: { entity: string; label: string }[];
}

// Define the structure of the daily data file
interface DailyData {
  data: Article[];
}

export type TimeRange = 'today' | '7days' | '30days';

// --- Helper: Country Code Mapping ---
// Create an inverse map from full country name to 3-letter code
const nameToCodeMap: Record<string, string> = {};
for (const [code, name] of Object.entries(countryNameMap)) {
  nameToCodeMap[name.toLowerCase()] = code; // Store lowercase for case-insensitive matching
}


// --- Helper: Date Calculations ---
function getDatesForRange(timeRange: TimeRange): string[] {
  const dates: string[] = [];
  const today = new Date();
  let daysToFetch = 1;

  if (timeRange === '7days') daysToFetch = 7;
  if (timeRange === '30days') daysToFetch = 30;

  for (let i = 0; i < daysToFetch; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // Format as DD.MM.YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = date.getFullYear();
    dates.push(`${day}.${month}.${year}`);
  }
  return dates;
}

// --- Simplified Data Fetching Function ---
export async function loadAggregatedData(timeRange: TimeRange): Promise<{ importData: Record<string, number>; exportData: Record<string, number> }> {
  
  // Construct the path to the pre-aggregated JSON file
  const dataUrl = `/data/world_map/map_data_${timeRange}.json`; 
  // Assumes files are served from public/data/
  // The initial / makes it relative to the domain root.

  console.log(`Fetching pre-aggregated map data from: ${dataUrl}`);

  try {
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Failed to load ${dataUrl}: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Optional: Add some validation here to ensure data has importData/exportData keys
    if (!data || typeof data.importData !== 'object' || typeof data.exportData !== 'object') {
        throw new Error(`Invalid data format received from ${dataUrl}`);
    }

    return data;

  } catch (error) {
    console.error("Error fetching or parsing pre-aggregated map data:", error);
    // Return empty data structure on error so the map doesn't crash
    // WorldMapPage already handles the error display via isLoading/!mapData state
    return {
      importData: {},
      exportData: {}
    };
  }
} 