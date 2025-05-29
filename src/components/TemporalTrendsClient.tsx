import React, { useState, useEffect } from 'react';
import TopicTable from './TopicTable';
import TopicTrendChart from './TopicTrendChart';

// Types
type DailyTopicData = {
    [topic: string]: number;
};

type TableRowData = {
    rank: number;
    topic: string;
    latestScore: number;
    isTrendingUp: boolean | null;
    isPresenceTrendingUp: boolean | null;
    percentageChange: number | null;
};

type ChartDataInput = {
    topics: { [topic: string]: { [date: string]: number } };
    dateRanges: string[];
};

// Utility functions
function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function getLastNDays(n: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = n - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(formatDate(date));
    }
    
    return dates;
}

async function loadTopicsForDate(date: string): Promise<DailyTopicData | null> {
    try {
        const response = await fetch(`/data/${date}/topics.json`);
        if (!response.ok) {
            console.warn(`Failed to load data for ${date}: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.warn(`Error loading data for ${date}:`, error);
        return null;
    }
}

function processTableData(todayData: DailyTopicData, yesterdayData: DailyTopicData | null): TableRowData[] {
    // First, calculate yesterday's rankings if data is available
    let yesterdayRankings: { [topic: string]: number } = {};
    if (yesterdayData) {
        const yesterdayEntries = Object.entries(yesterdayData)
            .filter(([_, score]) => score > 0)
            .sort(([, a], [, b]) => b - a);
        
        yesterdayEntries.forEach(([topic, _], index) => {
            yesterdayRankings[topic] = index + 1;
        });
    }

    const tableData: TableRowData[] = Object.entries(todayData)
        .map(([topic, todayScore]) => {
            const yesterdayScore = yesterdayData?.[topic] ?? 0;
            
            let isTrendingUp: boolean | null = null;
            let isPresenceTrendingUp: boolean | null = null;
            let percentageChange: number | null = null;

            // Calculate percentage change for presence trending
            if (yesterdayScore === 0) {
                percentageChange = todayScore > 0 ? todayScore : 0;
                isPresenceTrendingUp = todayScore > 0 ? true : null;
            } else {
                percentageChange = parseFloat((todayScore - yesterdayScore).toFixed(1));
                isPresenceTrendingUp = todayScore > yesterdayScore ? true : (todayScore < yesterdayScore ? false : null);
            }

            return {
                topic,
                latestScore: todayScore,
                isTrendingUp, // Will be calculated after sorting
                isPresenceTrendingUp,
                percentageChange,
            };
        })
        .filter(item => item.latestScore > 0)
        .sort((a, b) => b.latestScore - a.latestScore)
        .map((item, index) => {
            const todayRank = index + 1;
            const yesterdayRank = yesterdayRankings[item.topic];
            
            // Calculate rank trending
            let isTrendingUp: boolean | null = null;
            if (yesterdayRank !== undefined) {
                // Lower rank number means better position, so trending up means rank decreased
                if (todayRank < yesterdayRank) {
                    isTrendingUp = true; // Moved up in rankings
                } else if (todayRank > yesterdayRank) {
                    isTrendingUp = false; // Moved down in rankings
                } else {
                    isTrendingUp = null; // Same rank
                }
            } else {
                // Topic wasn't ranked yesterday, so it's new to the rankings
                isTrendingUp = true;
            }

            return { 
                ...item, 
                rank: todayRank,
                isTrendingUp 
            };
        });

    return tableData;
}

function processChartData(dailyData: { [date: string]: DailyTopicData }, dates: string[]): ChartDataInput {
    const topics: { [topic: string]: { [date: string]: number } } = {};
    
    // Collect all unique topics
    const allTopics = new Set<string>();
    Object.values(dailyData).forEach(dayData => {
        Object.keys(dayData).forEach(topic => allTopics.add(topic));
    });

    // Build the chart data structure
    allTopics.forEach(topic => {
        topics[topic] = {};
        dates.forEach(date => {
            topics[topic][date] = dailyData[date]?.[topic] ?? 0;
        });
    });

    return {
        topics,
        dateRanges: dates
    };
}

// Loading component
const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">{message}</p>
    </div>
);

// Error component
const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full">
        <div className="text-red-500 mb-2 text-2xl">⚠️</div>
        <p className="text-red-500 dark:text-red-400">{message}</p>
    </div>
);

const TemporalTrendsClient: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tableData, setTableData] = useState<TableRowData[]>([]);
    const [chartData, setChartData] = useState<ChartDataInput | null>(null);
    const [topTopic, setTopTopic] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Get the last 7 days
                const last7Days = getLastNDays(7);
                const today = last7Days[last7Days.length - 1];
                const yesterday = last7Days[last7Days.length - 2];

                // Load data for all days
                const dailyDataPromises = last7Days.map(async date => ({
                    date,
                    data: await loadTopicsForDate(date)
                }));

                const dailyDataResults = await Promise.all(dailyDataPromises);
                
                // Filter out failed loads and create data map
                const dailyData: { [date: string]: DailyTopicData } = {};
                const availableDates: string[] = [];
                
                dailyDataResults.forEach(({ date, data }) => {
                    if (data) {
                        dailyData[date] = data;
                        availableDates.push(date);
                    }
                });

                if (availableDates.length === 0) {
                    setError('No data available for the last 7 days');
                    return;
                }

                // Get today's and yesterday's data
                const todayData = dailyData[today];
                const yesterdayData = dailyData[yesterday] || null;

                if (!todayData) {
                    setError('Today\'s data not available');
                    return;
                }

                // Process data for components
                const processedTableData = processTableData(todayData, yesterdayData);
                const processedChartData = processChartData(dailyData, availableDates);
                const topTopicName = processedTableData.length > 0 ? processedTableData[0].topic : null;

                setTableData(processedTableData);
                setChartData(processedChartData);
                setTopTopic(topTopicName);

            } catch (err) {
                console.error('Error loading data:', err);
                setError('Error loading data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 h-[calc(100vh-200px)]">
                <div className="border rounded-lg p-4 md:col-span-2">
                    <h2 className="text-xl font-semibold mb-4">Today's Topic Rankings</h2>
                    <LoadingSpinner message="Loading today's topics..." />
                </div>
                <div className="border rounded-lg p-4 flex flex-col md:col-span-3">
                    <h2 className="text-xl font-semibold mb-4">7-Day Trend Evolution</h2>
                    <div className="flex-1 min-h-[400px] max-h-[600px]">
                        <LoadingSpinner message="Loading trend data..." />
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8 h-[calc(100vh-200px)]">
                <div className="border rounded-lg p-4 md:col-span-2">
                    <h2 className="text-xl font-semibold mb-4">Today's Topic Rankings</h2>
                    <ErrorDisplay message={error} />
                </div>
                <div className="border rounded-lg p-4 flex flex-col md:col-span-3">
                    <h2 className="text-xl font-semibold mb-4">7-Day Trend Evolution</h2>
                    <div className="flex-1 min-h-[400px] max-h-[600px]">
                        <ErrorDisplay message={error} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 h-[calc(100vh-200px)]">
            <div className="border rounded-lg p-4 md:col-span-2">
                <h2 className="text-xl font-semibold mb-4">Today's Topic Rankings</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <p><span className="font-bold">Click on a row</span> to see the trend in the chart!</p>
                </div> 
                <TopicTable 
                    data={tableData} 
                    defaultSelectedTopic={topTopic} 
                />
            </div>
            <div className="border rounded-lg p-4 flex flex-col md:col-span-3">
                <h2 className="text-xl font-semibold mb-4">7-Day Trend Evolution</h2>
                <div className="flex-1 min-h-[400px] max-h-[600px]">
                    {chartData && (
                        <TopicTrendChart 
                            data={chartData} 
                            defaultTopic={topTopic} 
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemporalTrendsClient; 