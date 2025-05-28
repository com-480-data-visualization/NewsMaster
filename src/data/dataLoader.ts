export type TimeRange = 'today' | '7days' | '30days';

// Define structure for country entities
export interface CountryEntity {
  entity: string;
  count: number;
  share: number;
}

// Define structure for daily map data (matches the new format)
export interface DailyMapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  nerData: Record<string, number>;
  TopEntitiesByCountry: Record<string, CountryEntity[]>;
  topNer: string;
}

// Define structure for aggregated map data (updated to include new fields)
export interface MapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  nerData: Record<string, number>;
  TopEntitiesByCountry: Record<string, CountryEntity[]>;
  topNer: string[];
  dateRange: string[];
}

// Define structure for NER-specific data
export interface NERMapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  entityMentions: Record<string, number>; // Total mentions per country
  totalArticles: number; // Total articles mentioning the entity
}

// --- Helper: Date Calculation ---
function getDatesForRange(timeRange: TimeRange): string[] {
  const dates: string[] = [];
  const today = new Date();
  let daysToFetch = 0;

  switch (timeRange) {
    case 'today':
      daysToFetch = 1;
      break;
    case '7days':
      daysToFetch = 7;
      break;
    case '30days':
      daysToFetch = 30;
      break;
  }

  for (let i = 0; i < daysToFetch; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

// --- Helper: Load Single Daily File ---
async function loadDailyData(date: string): Promise<DailyMapData | null> {
  const dataUrl = `/data/world_map/map_${date}.json`;
  
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`No data found for date ${date}`);
        return null;
      }
      throw new Error(`Failed to load ${dataUrl}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate data structure
    if (!data || typeof data.importData !== 'object' || typeof data.exportData !== 'object') {
      throw new Error(`Invalid data format received from ${dataUrl}`);
    }

    return {
      importData: data.importData || {},
      exportData: data.exportData || {},
      nerData: data.nerData || {},
      TopEntitiesByCountry: data.TopEntitiesByCountry || {},
      topNer: data.topNer || ""
    };

  } catch (error) {
    console.error(`Error loading data for ${date}:`, error);
    return null;
  }
}

// --- Helper: Aggregate Multiple Daily Data ---
function aggregateDailyData(dailyDataList: DailyMapData[]): MapData {
  const aggregated: MapData = {
    importData: {},
    exportData: {},
    nerData: {},
    TopEntitiesByCountry: {},
    topNer: [],
    dateRange: []
  };

  // Collect all unique country codes
  const allCountries = new Set<string>();
  const topNerList: string[] = [];

  dailyDataList.forEach(dayData => {
    // Collect country codes
    Object.keys(dayData.importData).forEach(code => allCountries.add(code));
    Object.keys(dayData.exportData).forEach(code => allCountries.add(code));
    Object.keys(dayData.nerData).forEach(code => allCountries.add(code));
    
    // Collect top NER entities
    if (dayData.topNer) {
      topNerList.push(dayData.topNer);
    }
  });

  // Initialize all countries with 0
  allCountries.forEach(country => {
    aggregated.importData[country] = 0;
    aggregated.exportData[country] = 0;
    aggregated.nerData[country] = 0;
  });

  // Sum up values from all days
  dailyDataList.forEach(dayData => {
    // Sum import/export/ner data
    Object.entries(dayData.importData).forEach(([country, value]) => {
      aggregated.importData[country] = (aggregated.importData[country] || 0) + value;
    });
    
    Object.entries(dayData.exportData).forEach(([country, value]) => {
      aggregated.exportData[country] = (aggregated.exportData[country] || 0) + value;
    });
    
    Object.entries(dayData.nerData).forEach(([country, value]) => {
      aggregated.nerData[country] = (aggregated.nerData[country] || 0) + value;
    });

    // Merge TopEntitiesByCountry (combine and re-rank)
    Object.entries(dayData.TopEntitiesByCountry).forEach(([country, entities]) => {
      if (!aggregated.TopEntitiesByCountry[country]) {
        aggregated.TopEntitiesByCountry[country] = [];
      }
      // For now, just take the latest day's data per country (can be improved to merge)
      aggregated.TopEntitiesByCountry[country] = entities;
    });
  });

  // Normalize the aggregated values (divide by number of days with data)
  const numDays = dailyDataList.length;
  if (numDays > 0) {
    Object.keys(aggregated.importData).forEach(country => {
      aggregated.importData[country] /= numDays;
    });
    Object.keys(aggregated.exportData).forEach(country => {
      aggregated.exportData[country] /= numDays;
    });
    Object.keys(aggregated.nerData).forEach(country => {
      aggregated.nerData[country] /= numDays;
    });
  }

  // Get unique top NER entities
  aggregated.topNer = Array.from(new Set(topNerList));

  return aggregated;
}

// --- Main Data Loading Function ---
export async function loadAggregatedData(timeRange: TimeRange): Promise<MapData> {
  console.log(`Loading aggregated map data for time range: ${timeRange}`);

  try {
    // Get dates to load
    const dates = getDatesForRange(timeRange);
    console.log(`Loading data for dates: ${dates.join(', ')}`);

    // Load all daily data files
    const dailyDataPromises = dates.map(date => loadDailyData(date));
    const dailyDataResults = await Promise.all(dailyDataPromises);

    // Filter out null results (failed/missing data)
    const validDailyData = dailyDataResults.filter((data): data is DailyMapData => data !== null);

    if (validDailyData.length === 0) {
      console.warn(`No valid data found for time range: ${timeRange}`);
      return {
        importData: {},
        exportData: {},
        nerData: {},
        TopEntitiesByCountry: {},
        topNer: [],
        dateRange: dates
      };
    }

    console.log(`Successfully loaded ${validDailyData.length} days of data out of ${dates.length} requested`);

    // Aggregate the daily data
    const aggregatedData = aggregateDailyData(validDailyData);
    aggregatedData.dateRange = dates;

    return aggregatedData;

  } catch (error) {
    console.error("Error loading aggregated map data:", error);
    return {
      importData: {},
      exportData: {},
      nerData: {},
      TopEntitiesByCountry: {},
      topNer: [],
      dateRange: []
    };
  }
}

// --- NER-specific Data Fetching Function (Updated to work with daily files) ---
export async function loadNERData(entity: string, timeRange: TimeRange): Promise<NERMapData> {
  console.log(`Loading NER data for entity: ${entity}, time range: ${timeRange}`);

  try {
    // Load aggregated data and extract nerData for the specific entity
    const aggregatedData = await loadAggregatedData(timeRange);
    
    // For now, we'll use nerData from the aggregated result
    // In the future, you might want to filter by specific entity
    return {
      importData: aggregatedData.importData,
      exportData: aggregatedData.exportData,
      entityMentions: aggregatedData.nerData,
      totalArticles: Object.values(aggregatedData.nerData).reduce((sum, count) => sum + count, 0)
    };

  } catch (error) {
    console.error("Error loading NER-specific map data:", error);
    return {
      importData: {},
      exportData: {},
      entityMentions: {},
      totalArticles: 0
    };
  }
} 