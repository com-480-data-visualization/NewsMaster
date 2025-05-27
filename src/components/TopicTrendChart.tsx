import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Define the types for the props and data
type TopicData = {
    [topic: string]: {
        [dateRange: string]: number;
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
    name: string; // Date range
    [topic: string]: number | string; // Topic scores, and 'name' property
};

// Helper to generate distinct colors for lines
const COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908',
    '#00C49F', '#FFBB28', '#FF8042', '#0088FE', '#AF19FF'
];

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
    const chartData: FormattedChartData[] = data.dateRanges.map(dateRange => {
        const dataPoint: FormattedChartData = { name: dateRange };
        selectedTopics.forEach(topic => {
            if (data.topics[topic] && data.topics[topic][dateRange] !== undefined) {
                dataPoint[topic] = data.topics[topic][dateRange];
            } else {
                dataPoint[topic] = 0; // Use 0 or null if data is missing for a selected topic
            }
        });
        return dataPoint;
    });

    if (!defaultTopic && selectedTopics.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">Select a topic from the table to see its trend.</div>;
    }
    
    if (selectedTopics.length === 0 && defaultTopic && !selectedTopics.includes(defaultTopic)) {
         return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">Loading chart for {defaultTopic}...</div>;
    }
    
    if (selectedTopics.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">Please select a topic to view the trend.</div>;
    }

    // Define CSS variables for dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    const tooltipBgColor = isDarkMode ? '#1f2937' : 'white';
    const tooltipTextColor = isDarkMode ? '#e5e7eb' : 'black';
    const tooltipBorderColor = isDarkMode ? '#4b5563' : '#ccc';

    return (
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
                    tick={{ fill: 'currentColor' }}
                    className="dark:text-gray-300" 
                />
                <YAxis 
                    stroke="#6B7280"
                    tick={{ fill: 'currentColor' }}
                    className="dark:text-gray-300" 
                    label={{ value: 'Presence in articles (%)', angle: 0, position: 'top', fill: 'currentColor', dy: -5, dx: 40 }}
                />
                <Tooltip 
                    contentStyle={{ 
                        backgroundColor: tooltipBgColor, 
                        color: tooltipTextColor,
                        borderColor: tooltipBorderColor
                    }}
                    itemStyle={{ color: 'currentColor' }}
                />
                <Legend className="dark:text-gray-300" />
                {selectedTopics.map((topic, index) => (
                    <Line
                        key={topic}
                        type="monotone"
                        dataKey={topic}
                        stroke={COLORS[index % COLORS.length]}
                        activeDot={{ r: 8 }}
                        connectNulls // Connect lines even if there are null/missing data points
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default TopicTrendChart; 