import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Define the types for the props and data
type TopicData = {
    [topic: string]: {
        [date: string]: number;
    };
};

type ChartDataInput = {
    topics: TopicData;
    dateRanges: string[];
};

interface TopicTrendChartProps {
    data: ChartDataInput;
    defaultTopic: string | null;
}

// Define a type for the formatted chart data
type FormattedChartData = {
    name: string; // Date
    [topic: string]: number | string; // Topic scores, and 'name' property
};

// Helper to generate distinct colors for lines
const COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908',
    '#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#AF19FF'
];

// Helper function to format date for display
const formatDateForDisplay = (dateStr: string): string => {
    // Convert from DD.MM.YYYY to a more readable format
    const [day, month, year] = dateStr.split('.');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Return format like "Mon 28/05"
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[date.getDay()];
    return `${dayName} ${day}/${month}`;
};

const TopicTrendChart: React.FC<TopicTrendChartProps> = ({ data, defaultTopic }) => {
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    useEffect(() => {
        if (defaultTopic) {
            setSelectedTopics([defaultTopic]);
        }
    }, [defaultTopic]);

    const handleTopicSelect = useCallback((event: CustomEvent) => {
        const { topic: clickedTopic } = event.detail;
        console.log(`Chart: topicSelected event received for topic: ${clickedTopic}`);
        setSelectedTopics(prevSelectedTopics => {
            if (prevSelectedTopics.includes(clickedTopic)) {
                // If topic is already selected, remove it (unless it's the only one)
                return prevSelectedTopics.length > 1 ? prevSelectedTopics.filter(t => t !== clickedTopic) : prevSelectedTopics;
            } else {
                // Add new topic to selection
                return [...prevSelectedTopics, clickedTopic];
            }
        });
    }, []);

    useEffect(() => {
        // Add event listener for topic selections from the table
        document.addEventListener('topicSelected', handleTopicSelect as EventListener);
        console.log("Chart: Event listener for 'topicSelected' added.");

        return () => {
            // Clean up event listener
            document.removeEventListener('topicSelected', handleTopicSelect as EventListener);
            console.log("Chart: Event listener for 'topicSelected' removed.");
        };
    }, [handleTopicSelect]);

    // Format data for Recharts
    const chartData: FormattedChartData[] = data.dateRanges.map(date => {
        const dataPoint: FormattedChartData = { name: formatDateForDisplay(date) };
        selectedTopics.forEach(topic => {
            if (data.topics[topic] && data.topics[topic][date] !== undefined) {
                dataPoint[topic] = data.topics[topic][date];
            } else {
                dataPoint[topic] = 0; // Use 0 if data is missing for a selected topic
            }
        });
        return dataPoint;
    });

    if (!defaultTopic && selectedTopics.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                    <div className="text-4xl mb-4">📊</div>
                    <p>Select a topic from the table to see its 7-day trend.</p>
                </div>
            </div>
        );
    }
    
    if (selectedTopics.length === 0 && defaultTopic && !selectedTopics.includes(defaultTopic)) {
         return (
             <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                 <div className="text-center">
                     <div className="animate-pulse text-2xl mb-2">📈</div>
                     <p>Loading chart for {defaultTopic}...</p>
                 </div>
             </div>
         );
    }
    
    if (selectedTopics.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <div className="text-center">
                    <div className="text-4xl mb-4">📈</div>
                    <p>Please select a topic to view the 7-day trend.</p>
                </div>
            </div>
        );
    }

    // Define CSS variables for dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    const tooltipBgColor = isDarkMode ? '#1f2937' : 'white';
    const tooltipTextColor = isDarkMode ? '#e5e7eb' : 'black';
    const tooltipBorderColor = isDarkMode ? '#4b5563' : '#ccc';

    return (
        <div className="h-full flex flex-col">
            {selectedTopics.length > 1 && (
                <div className="mb-2 text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
                    Comparing {selectedTopics.length} topics over the last 7 days
                </div>
            )}
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{
                            top: 25,
                            right: 30,
                            left: 20,
                            bottom: 5,
                        }}
                        className="dark:text-gray-200"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-30" />
                        <XAxis 
                            dataKey="name" 
                            stroke="#6B7280"
                            tick={{ fill: 'currentColor', fontSize: 12 }}
                            className="dark:text-gray-300" 
                        />
                        <YAxis 
                            stroke="#6B7280"
                            tick={{ fill: 'currentColor', fontSize: 12 }}
                            className="dark:text-gray-300" 
                            label={{ 
                                value: 'Presence in articles (%)', 
                                angle: -90, 
                                position: 'insideLeft',
                                style: { textAnchor: 'middle' }
                            }}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: tooltipBgColor, 
                                color: tooltipTextColor,
                                borderColor: tooltipBorderColor,
                                borderRadius: '8px',
                                fontSize: '14px'
                            }}
                            itemStyle={{ color: 'currentColor' }}
                            formatter={(value: any, name: string) => [`${value}%`, name]}
                            labelFormatter={(label: string) => `Date: ${label}`}
                        />
                        <Legend 
                            className="dark:text-gray-300"
                            wrapperStyle={{ fontSize: '14px' }}
                        />
                        {selectedTopics.map((topic, index) => (
                            <Line
                                key={topic}
                                type="monotone"
                                dataKey={topic}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                activeDot={{ r: 6, strokeWidth: 2 }}
                                dot={{ r: 3 }}
                                connectNulls={false} // Don't connect lines if there are missing data points
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default TopicTrendChart; 