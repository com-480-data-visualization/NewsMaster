import React, { useState, useEffect, useRef } from 'react';

// Define TableRowData type
type TableRowData = {
    rank: number;
    topic: string;
    latestScore: number;
    isTrendingUp: boolean | null; // For rank trend (arrows)
    isPresenceTrendingUp: boolean | null; // For percentage change colors
    percentageChange: number | null;
};

interface TopicTableProps { 
    data: TableRowData[];
    defaultSelectedTopic?: string | null; // Added for default selection
}

// TrendIcon component
const TrendIcon: React.FC<{ isUp: boolean | null }> = ({ isUp }) => {
    if (isUp === null) return <span className="text-gray-500 dark:text-gray-400">-</span>;
    return isUp
        ? <span className="text-green-500 dark:text-green-400">▲</span> // Up arrow
        : <span className="text-red-500 dark:text-red-400">▼</span>; // Down arrow
};

// Format percentage change
const formatPercentage = (change: number | null): string => {
    if (change === null) return 'N/A';
    if (change === Infinity) return '+∞%';
    if (change === -Infinity) return '-∞%';
    if (change === 0) return '0%';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}%`;
}

// Helper function to get class for trend values
const getTrendClass = (isPresenceTrendingUp: boolean | null): string => {
    if (isPresenceTrendingUp === null) return 'text-gray-500 dark:text-gray-400';
    return isPresenceTrendingUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
}

// Calculate optimal maxLength for topic names based on table width
const calculateOptimalMaxLength = (tableElement?: HTMLElement | null): number => {
    // Get the actual table container width
    let containerWidth = 500; // Default fallback
    
    if (tableElement) {
        const tableWrapper = tableElement.closest('#topic-table-wrapper') as HTMLElement;
        if (tableWrapper) {
            containerWidth = tableWrapper.clientWidth;
        }
    } else {
        // Fallback: try to find the table wrapper in the DOM
        const tableWrapper = document.getElementById('topic-table-wrapper');
        if (tableWrapper) {
            containerWidth = tableWrapper.clientWidth;
        } else {
            // Last resort: use a percentage of screen width
            containerWidth = window.innerWidth * 0.8; // Assume table takes 80% of screen
        }
    }
    
    // For very small containers, use a minimal length
    if (containerWidth <= 500) {
        return 8;
    }
    
    // Method 1: Detailed calculation
    const charWidth = 10; // Conservative character width
    const padding = 16; // px-4 = 16px on each side
    const topicColumnPadding = padding * 2;
    
    const maxTopicColumnWidth = containerWidth * 0.30;
    const maxCharsByPercentage = Math.floor((maxTopicColumnWidth - topicColumnPadding) / charWidth);
    
    const minLength = 8;
    const maxLength = 35; // Further reduced max length
    
    const result = Math.max(minLength, Math.min(maxLength, maxCharsByPercentage));
    return result;
};

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 20): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Define the styles
const tableWrapperStyle = {
    maxHeight: 'calc(100% - 4rem)' /* Adjust based on header height */
};

const tableHeaderStyle = {
    backgroundColor: '#f9fafb' /* Keep header visible */
};

const TopicTable: React.FC<TopicTableProps> = ({ data, defaultSelectedTopic }) => {
    const tableWrapperRef = useRef<HTMLDivElement>(null);
    const [maxLength, setMaxLength] = useState<number>(calculateOptimalMaxLength());

    useEffect(() => {
        const handleResize = () => {
            setMaxLength(calculateOptimalMaxLength(tableWrapperRef.current));
        };

        // Set initial value after component mounts
        const timer = setTimeout(() => {
            setMaxLength(calculateOptimalMaxLength(tableWrapperRef.current));
        }, 0);

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <div 
            ref={tableWrapperRef}
            id="topic-table-wrapper" 
            className="overflow-x-auto" 
            style={tableWrapperStyle}
        >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank</th>
                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Topic</th>
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Presence in articles</th>
                        <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rank trend</th>
                        <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Since last week</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.filter(item => item.latestScore > 0).map((item) => {
                        const isDefaultSelected = defaultSelectedTopic === item.topic;
                        const truncatedTopic = truncateText(item.topic, maxLength);
                        const isTopicTruncated = item.topic.length > maxLength;
                        
                        return (
                            <tr
                                key={item.topic}
                                data-topic={item.topic}
                                className={`hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer topic-row ${
                                    isDefaultSelected ? 'bg-blue-100 dark:bg-blue-900/40' : ''
                                }`}
                                onClick={(event) => {
                                    // Dispatch a custom event that the parent page can listen to
                                    console.log(`Table: Row clicked, dispatching topicSelected for topic: ${item.topic}`);
                                    document.dispatchEvent(new CustomEvent('topicSelected', {
                                        detail: { topic: item.topic }
                                    }));
                                    // Toggle selection on the current row
                                    event.currentTarget.classList.toggle('bg-blue-100');
                                    event.currentTarget.classList.toggle('dark:bg-blue-900/40');
                                }}
                            >
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{item.rank}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                                    <span 
                                        title={isTopicTruncated ? item.topic : undefined}
                                    >
                                        {truncatedTopic}
                                    </span>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-base font-semibold text-gray-800 dark:text-gray-200 text-right">{item.latestScore}%</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                                    <TrendIcon isUp={item.isTrendingUp} />
                                </td>
                                <td className={`px-4 py-2 whitespace-nowrap text-sm text-right ${getTrendClass(item.isPresenceTrendingUp)}`}>
                                    {formatPercentage(item.percentageChange)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TopicTable; 