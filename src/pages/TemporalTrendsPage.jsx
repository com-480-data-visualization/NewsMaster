import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import weeksData from '@/../public/data/temporal_trends/weeks.json';
import topicsData from '@/../public/data/temporal_trends/topics.json';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Function to format week keys (e.g., "14-20.04" to "14 - 20 April")
const formatWeekKey = (weekKey) => {
  if (!weekKey) return '';
  const [dates, monthNum] = weekKey.split('.');
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[parseInt(monthNum, 10) - 1] || '';
  return `${dates.replace('-', ' - ')} ${month}`;
};

// Custom Tooltip for Bar Chart
const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border p-2 rounded shadow-lg">
        <p className="label font-bold">{`${label}`}</p>
        <p className="intro text-sm text-muted-foreground">{`Percentage: ${payload[0].value}%`}</p>
        <p className="desc text-sm text-muted-foreground">{`Appearances: ${payload[0].payload['#']}`}</p>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Line Chart
const CustomLineTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border p-2 rounded shadow-lg">
        <p className="label font-bold">{`${formatWeekKey(label)}`}</p>
        <p className="desc text-sm text-muted-foreground">{`Appearances: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const TemporalTrendsPage = () => {
  const weekKeys = useMemo(() => Object.keys(weeksData), []);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handlePrevWeek = () => {
    setCurrentWeekIndex((prevIndex) => prevIndex - 1);
    setSelectedTopic(null); // Reset topic selection when changing week
  };

  const handleNextWeek = () => {
    setCurrentWeekIndex((prevIndex) => prevIndex + 1);
    setSelectedTopic(null); // Reset topic selection when changing week
  };

  const handleBarClick = (data) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const topicName = data.activePayload[0].payload.name;
      setSelectedTopic(topicName);
    }
  };

  const currentWeekKey = weekKeys[currentWeekIndex];
  const currentWeekDisplay = formatWeekKey(currentWeekKey);
  
  // Sort topics by percentage in descending order
  const currentWeekTopics = useMemo(() => {
    const topics = weeksData[currentWeekKey] || [];
    return [...topics].sort((a, b) => b["%"] - a["%"]);
  }, [currentWeekKey]);

  // Prepare data for the topic trend line chart
  const topicTrendData = useMemo(() => {
    if (!selectedTopic || !topicsData[selectedTopic]) return [];
    return weekKeys.map(weekKey => ({
      week: weekKey,
      appearances: topicsData[selectedTopic][weekKey] || 0,
    }));
  }, [selectedTopic, weekKeys]);

  const isFirstWeek = currentWeekIndex === 0;
  const isLastWeek = currentWeekIndex === weekKeys.length - 1;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">By week</CardTitle>
            <div className="flex items-center space-x-2">
              {!isFirstWeek && (
                <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {isFirstWeek && <div className="w-9" />} {/* Placeholder to maintain alignment */}
              <span className="w-32 text-center font-semibold">{currentWeekDisplay}</span>
              {!isLastWeek && (
                <Button variant="outline" size="icon" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {isLastWeek && <div className="w-9" />} {/* Placeholder to maintain alignment */}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={currentWeekTopics} onClick={handleBarClick} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis unit="%" tickLine={false} axisLine={false} width={60} />
                <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="%" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {selectedTopic && topicTrendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Temporal trend: {selectedTopic}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={topicTrendData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tickFormatter={formatWeekKey} tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={60} />
                  <RechartsTooltip content={<CustomLineTooltip />} />
                  <Line type="monotone" dataKey="appearances" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
};

export default TemporalTrendsPage; 