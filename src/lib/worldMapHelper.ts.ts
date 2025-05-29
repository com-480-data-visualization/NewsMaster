const TIME_RANGE_CONFIG = {
  today: { days: 1, label: 'Today' },
  '7days': { days: 7, label: 'Last 7 Days' },
  '30days': { days: 30, label: 'Last 30 Days' }
} as const;


export type TimeRange = keyof typeof TIME_RANGE_CONFIG;

const CACHE_CONFIG = {
  MAX_SIZE: 100,
  TTL_MINUTES: 30
} as const;

const TREND_DATA_DAYS = 14;
const DEFAULT_TIME_RANGE: TimeRange = '7days';


export interface CountryEntity {
  entity: string;
  count: number;
  share: number;
}

export interface TrendDataPoint {
  date: string;
  featured: number;
  covering: number;
}

export interface CountryCoverage {
  coveredBy: Record<string, number>; // country code -> coverage percentage
  totalCoverage: number; // total coverage score
}

export interface CountryCovering {
  covering: Record<string, number>; // country code -> how much this country covers others
  totalCovering: number; // total coverage this country provides to others
}

export interface WorldMapData {
  // Featured mode: how much countries are featured in foreign press
  countryCoverage: Record<string, CountryCoverage>; // country code -> coverage data
  featuredRankings: Array<{ countryCode: string; totalCoverage: number }>;
  
  // Covering mode: how much countries cover overseas events
  countryCovering: Record<string, CountryCovering>; // country code -> covering data  
  coveringRankings: Array<{ countryCode: string; totalCovering: number }>;
}


export interface DailyMapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  nerData: Record<string, number>;
  topEntitiesByCountry: Record<string, CountryEntity[]>;
  topNer: string[];
  foreignPressData: WorldMapData;
}

export interface MapData {
  importData: Record<string, number>;
  exportData: Record<string, number>;
  nerData: Record<string, number>; // Total mentions per country (ISO-3 country codes)
  topEntitiesByCountry: Record<string, CountryEntity[]>;
  topNer: string[];
  dateRange: string[];
  foreignPressData: WorldMapData;
}

// Simple cache using Map - no memory bounds
const dailyDataCache = new Map<string, DailyMapData>();

function createEmptyWorldMapData(): WorldMapData {
  return {
    countryCoverage: {},
    countryCovering: {},
    featuredRankings: [],
    coveringRankings: []
  };
}

function createEmptyMapData(dateRange: string[] = []): MapData {
  return {
    importData: {},
    exportData: {},
    nerData: {},
    topEntitiesByCountry: {},
    topNer: [],
    dateRange,
    foreignPressData: createEmptyWorldMapData()
  };
}

interface RawDailyData {
  importData?: Record<string, number>;
  exportData?: Record<string, number>;
  nerData?: Record<string, number>;
  topEntitiesByCountry?: Record<string, CountryEntity[]>;
  topNer?: string;
  foreignPressData?: {
    countryCoverage?: Record<string, {
      coveredBy?: Record<string, number>;
      totalCoverage?: number;
    }>;
    countryCovering?: Record<string, {
      covering?: Record<string, number>;
      totalCovering?: number;
    }>;
    featuredRankings?: Array<{ countryCode: string; totalCoverage: number }>;
    coveringRankings?: Array<{ countryCode: string; totalCovering: number }>;
  };
}

function validateRawData(rawData: unknown): rawData is RawDailyData {
  if (!rawData || typeof rawData !== 'object') return false;
  
  const data = rawData as Record<string, unknown>;
  
  // Check required top-level structure
  if (typeof data.importData !== 'object' || data.importData === null ||
      typeof data.exportData !== 'object' || data.exportData === null) {
    return false;
  }
  
  // Validate that importData/exportData contain number values
  const importData = data.importData as Record<string, unknown>;
  const exportData = data.exportData as Record<string, unknown>;
  
  for (const value of Object.values(importData)) {
    if (typeof value !== 'number' || !isFinite(value)) return false;
  }
  
  for (const value of Object.values(exportData)) {
    if (typeof value !== 'number' || !isFinite(value)) return false;
  }
  
  // Validate nerData if present
  if (data.nerData !== undefined) {
    if (typeof data.nerData !== 'object' || data.nerData === null) return false;
    const nerData = data.nerData as Record<string, unknown>;
    for (const value of Object.values(nerData)) {
      if (typeof value !== 'number' || !isFinite(value)) return false;
    }
  }
  
  // Validate topEntitiesByCountry structure if present
  const entitiesData = data.topEntitiesByCountry || data.topEntitiesByCountry;
  if (entitiesData !== undefined) {
    if (typeof entitiesData !== 'object' || entitiesData === null) return false;
    const entities = entitiesData as Record<string, unknown>;
    for (const countryEntities of Object.values(entities)) {
      if (!Array.isArray(countryEntities)) return false;
      for (const entity of countryEntities) {
        if (typeof entity !== 'object' || entity === null) return false;
        const entityObj = entity as Record<string, unknown>;
        if (typeof entityObj.entity !== 'string' ||
            typeof entityObj.count !== 'number' ||
            typeof entityObj.share !== 'number' ||
            !isFinite(entityObj.count) ||
            !isFinite(entityObj.share)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

function transformRawDataToDailyMapData(rawData: unknown): DailyMapData {
  if (!validateRawData(rawData)) {
    throw new Error('Invalid raw data structure received');
  }

  return {
    importData: rawData.importData || {},
    exportData: rawData.exportData || {},
    nerData: rawData.nerData || {},
    topEntitiesByCountry: rawData.topEntitiesByCountry || {},
    topNer: rawData.topNer ? [rawData.topNer] : [],
    foreignPressData: transformForeignPressData(rawData.foreignPressData)
  };
}

// --- Helper: Transform Foreign Press Data ---
function transformForeignPressData(rawForeignPress: RawDailyData['foreignPressData']): WorldMapData {
  if (!rawForeignPress) {
    return createEmptyWorldMapData();
  }

  const countryCoverage: Record<string, CountryCoverage> = {};
  const countryCovering: Record<string, CountryCovering> = {};

  // Transform coverage data
  if (rawForeignPress.countryCoverage) {
    Object.entries(rawForeignPress.countryCoverage).forEach(([country, data]) => {
      countryCoverage[country] = {
        coveredBy: data?.coveredBy || {},
        totalCoverage: data?.totalCoverage || 0
      };
    });
  }

  // Transform covering data
  if (rawForeignPress.countryCovering) {
    Object.entries(rawForeignPress.countryCovering).forEach(([country, data]) => {
      countryCovering[country] = {
        covering: data?.covering || {},
        totalCovering: data?.totalCovering || 0
      };
    });
  }

  return {
    countryCoverage,
    countryCovering,
    featuredRankings: rawForeignPress.featuredRankings || [],
    coveringRankings: rawForeignPress.coveringRankings || []
  };
}

// --- Helper: Date Calculation ---
function generateDateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  
  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

function getDatesForRange(timeRange: TimeRange): string[] {
  const daysToFetch = TIME_RANGE_CONFIG[timeRange].days;
  
  if (!daysToFetch) {
    console.warn(`Unknown time range: ${timeRange}, defaulting to ${DEFAULT_TIME_RANGE} days`);
    return generateDateRange(TIME_RANGE_CONFIG[DEFAULT_TIME_RANGE].days);
  }

  return generateDateRange(daysToFetch);
}

// --- Concurrency Limiter ---
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent = 5) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.running++;
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      };

      if (this.running < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const fetchLimiter = new ConcurrencyLimiter(5);

// --- Helper: Load Single Daily File with Better Error Handling ---
async function loadDailyData(date: string): Promise<LoadResult<DailyMapData>> {
  const dataUrl = `/data/world_map/map_${date}.json`;
  
  // Check cache first
  const cached = dailyDataCache.get(date);
  if (cached) {
    return { success: true, data: cached };
  }
  
  return fetchLimiter.execute(async () => {
    try {
      const response = await fetch(dataUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'not_found' as const,
            message: `No data found for date ${date}`
          };
        }
        return {
          success: false,
          error: 'network_error' as const,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      
      const rawData = await response.json();
      
      // Enhanced validation
      if (!validateRawData(rawData)) {
        return {
          success: false,
          error: 'validation_error' as const,
          message: `Invalid data structure from ${dataUrl}`
        };
      }

      // Transform and cache the data
      const dailyData = transformRawDataToDailyMapData(rawData);
      dailyDataCache.set(date, dailyData);
      
      return { success: true, data: dailyData };

    } catch (error) {
      return {
        success: false,
        error: 'unknown_error' as const,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
}

// --- Helper: Aggregate Multiple Daily Data ---
function aggregateDailyData(dailyDataList: DailyMapData[]): MapData {
  const aggregated = createEmptyMapData();

  // Track day counts per country for proper averaging
  const importDayCounts: Record<string, number> = {};
  const exportDayCounts: Record<string, number> = {};
  const nerDayCounts: Record<string, number> = {};
  
  // Collect all unique country codes and count appearances
  const allCountries = new Set<string>();
  const topNerList: string[] = [];

  dailyDataList.forEach(dayData => {
    // Collect country codes and count their appearances
    Object.keys(dayData.importData).forEach(code => {
      allCountries.add(code);
      importDayCounts[code] = (importDayCounts[code] || 0) + 1;
    });
    Object.keys(dayData.exportData).forEach(code => {
      allCountries.add(code);
      exportDayCounts[code] = (exportDayCounts[code] || 0) + 1;
    });
    Object.keys(dayData.nerData).forEach(code => {
      allCountries.add(code);
      nerDayCounts[code] = (nerDayCounts[code] || 0) + 1;
    });
    
    // Collect top NER entities
    if (dayData.topNer && dayData.topNer.length > 0) {
      topNerList.push(...dayData.topNer);
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
  });

  // Properly aggregate topEntitiesByCountry across all days
  const entityAggregator: Record<string, Record<string, number>> = {}; // country -> entity -> total count
  
  dailyDataList.forEach(dayData => {
    Object.entries(dayData.topEntitiesByCountry).forEach(([country, entities]) => {
      if (!entityAggregator[country]) {
        entityAggregator[country] = {};
      }
      
      // Sum up entity counts across all days
      entities.forEach(entity => {
        entityAggregator[country][entity.entity] = 
          (entityAggregator[country][entity.entity] || 0) + entity.count;
      });
    });
  });

  // Convert aggregated counts back to ranked entity lists
  Object.entries(entityAggregator).forEach(([country, entityCounts]) => {
    const totalCount = Object.values(entityCounts).reduce((sum, count) => sum + count, 0);
    
    if (totalCount > 0) {
      // Create properly ranked entities with recalculated shares
      const rankedEntities: CountryEntity[] = Object.entries(entityCounts)
        .map(([entity, count]) => ({
          entity,
          count,
          share: count / totalCount
        }))
        .sort((a, b) => b.count - a.count) // Sort by count descending
        .slice(0, 10); // Keep top 10 entities per country
      
      aggregated.topEntitiesByCountry[country] = rankedEntities;
    }
  });

  // Normalize the aggregated values by actual day counts per country
  Object.keys(aggregated.importData).forEach(country => {
    const dayCount = importDayCounts[country] || 1;
    aggregated.importData[country] /= dayCount;
  });
  
  Object.keys(aggregated.exportData).forEach(country => {
    const dayCount = exportDayCounts[country] || 1;
    aggregated.exportData[country] /= dayCount;
  });
  
  Object.keys(aggregated.nerData).forEach(country => {
    const dayCount = nerDayCounts[country] || 1;
    aggregated.nerData[country] /= dayCount;
  });

  // Get unique top NER entities
  aggregated.topNer = Array.from(new Set(topNerList));

  // Aggregate foreign press data
  aggregated.foreignPressData = aggregateForeignPressData(dailyDataList);

  return aggregated;
}

// --- Helper: Aggregate Foreign Press Data ---
function aggregateForeignPressData(dailyDataList: DailyMapData[]): WorldMapData {
  const aggregatedCoverage: Record<string, CountryCoverage> = {};
  const aggregatedCovering: Record<string, CountryCovering> = {};
  
  // Track day counts per country for proper averaging
  const coverageDayCounts: Record<string, number> = {};
  const coveringDayCounts: Record<string, number> = {};
  
  if (dailyDataList.length === 0) {
    return {
      countryCoverage: {},
      countryCovering: {},
      featuredRankings: [],
      coveringRankings: []
    };
  }

  // Collect all countries and count their appearances
  const allCountries = new Set<string>();
  dailyDataList.forEach(dayData => {
    Object.keys(dayData.foreignPressData.countryCoverage).forEach(code => {
      allCountries.add(code);
      coverageDayCounts[code] = (coverageDayCounts[code] || 0) + 1;
    });
    Object.keys(dayData.foreignPressData.countryCovering).forEach(code => {
      allCountries.add(code);
      coveringDayCounts[code] = (coveringDayCounts[code] || 0) + 1;
    });
  });

  // Initialize aggregated data
  allCountries.forEach(country => {
    aggregatedCoverage[country] = { coveredBy: {}, totalCoverage: 0 };
    aggregatedCovering[country] = { covering: {}, totalCovering: 0 };
  });

  // Sum up values from all days
  dailyDataList.forEach(dayData => {
    // Aggregate coverage data
    Object.entries(dayData.foreignPressData.countryCoverage).forEach(([country, data]) => {
      if (aggregatedCoverage[country]) {
        aggregatedCoverage[country].totalCoverage += data.totalCoverage;
        Object.entries(data.coveredBy).forEach(([coveringCountry, value]) => {
          aggregatedCoverage[country].coveredBy[coveringCountry] = 
            (aggregatedCoverage[country].coveredBy[coveringCountry] || 0) + value;
        });
      }
    });

    // Aggregate covering data
    Object.entries(dayData.foreignPressData.countryCovering).forEach(([country, data]) => {
      if (aggregatedCovering[country]) {
        aggregatedCovering[country].totalCovering += data.totalCovering;
        Object.entries(data.covering).forEach(([coveredCountry, value]) => {
          aggregatedCovering[country].covering[coveredCountry] = 
            (aggregatedCovering[country].covering[coveredCountry] || 0) + value;
        });
      }
    });
  });

  // Normalize by actual day counts per country - but preserve the relative proportions
  Object.entries(aggregatedCoverage).forEach(([country, data]) => {
    const dayCount = coverageDayCounts[country] || 1;
    data.totalCoverage /= dayCount;
    
    // Renormalize coveredBy values to sum to 1.0 for each country
    const coveredByTotal = Object.values(data.coveredBy).reduce((sum, val) => sum + val, 0);
    if (coveredByTotal > 0) {
      Object.keys(data.coveredBy).forEach(coveringCountry => {
        data.coveredBy[coveringCountry] = data.coveredBy[coveringCountry] / coveredByTotal;
      });
    }
  });

  Object.entries(aggregatedCovering).forEach(([country, data]) => {
    const dayCount = coveringDayCounts[country] || 1;
    data.totalCovering /= dayCount;
    
    // Renormalize covering values to sum to 1.0 for each country
    const coveringTotal = Object.values(data.covering).reduce((sum, val) => sum + val, 0);
    if (coveringTotal > 0) {
      Object.keys(data.covering).forEach(coveredCountry => {
        data.covering[coveredCountry] = data.covering[coveredCountry] / coveringTotal;
      });
    }
  });

  // Generate rankings
  const featuredRankings = Object.entries(aggregatedCoverage)
    .map(([countryCode, data]) => ({
      countryCode,
      totalCoverage: data.totalCoverage
    }))
    .filter(item => item.totalCoverage > 0)
    .sort((a, b) => b.totalCoverage - a.totalCoverage);

  const coveringRankings = Object.entries(aggregatedCovering)
    .map(([countryCode, data]) => ({
      countryCode,
      totalCovering: data.totalCovering
    }))
    .filter(item => item.totalCovering > 0)
    .sort((a, b) => b.totalCovering - a.totalCovering);

  return {
    countryCoverage: aggregatedCoverage,
    countryCovering: aggregatedCovering,
    featuredRankings,
    coveringRankings
  };
}

// Helper function to clear cache (useful when time range changes)
export function clearDailyDataCache(): void {
  dailyDataCache.clear();
  console.log('Daily data cache cleared');
}

// --- Main Data Loading Function ---
export async function loadAggregatedData(timeRange: TimeRange): Promise<MapData> {
  console.log(`Loading aggregated map data for time range: ${timeRange}`);

  try {
    // Get dates to load
    const dates = getDatesForRange(timeRange);
    console.log(`Loading data for dates: ${dates.join(', ')}`);

    // Load all daily data files with concurrency limiting
    const dailyDataPromises = dates.map(date => loadDailyData(date));
    const dailyDataResults = await Promise.all(dailyDataPromises);

    // Filter out failed loads and extract successful data
    const validDailyData: DailyMapData[] = [];
    const errors: string[] = [];
    
    dailyDataResults.forEach((result, index) => {
      if (result.success) {
        validDailyData.push(result.data);
      } else {
        const date = dates[index];
        errors.push(`${date}: ${result.error} - ${result.message}`);
        if (result.error !== 'not_found') {
          console.warn(`Failed to load data for ${date}: ${result.message}`);
        }
      }
    });

    if (validDailyData.length === 0) {
      console.warn(`No valid data found for time range: ${timeRange}`);
      if (errors.length > 0) {
        console.warn('Errors encountered:', errors);
      }
      return createEmptyMapData(dates);
    }

    console.log(`Successfully loaded ${validDailyData.length} days of data out of ${dates.length} requested`);
    if (errors.length > 0 && errors.some(e => !e.includes('not_found'))) {
      console.warn(`${errors.length} days had issues:`, errors);
    }

    // Aggregate the daily data
    const aggregatedData = aggregateDailyData(validDailyData);
    aggregatedData.dateRange = dates;

    return aggregatedData;

  } catch (error) {
    console.error("Error loading aggregated map data:", error);
    return createEmptyMapData();
  }
}

// Load trend data with proper error handling
export async function loadCountryTrendData(countryCode: string): Promise<TrendDataPoint[]> {
  console.log(`Loading ${TREND_DATA_DAYS}-day trend data for country: ${countryCode}`);
  
  try {
    // Generate dates for the trend period
    const dates = generateDateRange(TREND_DATA_DAYS);
    
    // Load all daily data using existing function (with proper caching and concurrency limiting)
    const dailyDataPromises = dates.map(date => loadDailyData(date));
    const dailyDataResults = await Promise.allSettled(dailyDataPromises);
    
    // Process results and build trend data
    const trendData: TrendDataPoint[] = [];
    
    dailyDataResults.forEach((result, index) => {
      const date = dates[index];
      
      if (result.status === 'fulfilled' && result.value.success) {
        const data = result.value.data;
        const foreignPressData = data.foreignPressData;
        
        if (foreignPressData) {
          const featuredValue = foreignPressData.countryCoverage[countryCode]?.totalCoverage || 0;
          const coveringValue = foreignPressData.countryCovering[countryCode]?.totalCovering || 0;
          
          trendData.push({
            date,
            featured: featuredValue,
            covering: coveringValue
          });
        }
      } else {
        // Add zero values for missing data to maintain timeline continuity
        trendData.push({
          date,
          featured: 0,
          covering: 0
        });
      }
    });
    
    // Data is already sorted by date since dates array is in chronological order
    return trendData;
    
  } catch (error) {
    console.error("Error loading country trend data:", error);
    return [];
  }
}

// --- Result Type for Better Error Handling ---
type LoadResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: 'not_found' | 'network_error' | 'validation_error' | 'unknown_error';
  message: string;
}; 