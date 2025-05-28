"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import type {
    ChartConfig,
} from "@/components/ui/chart"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"

interface DBData {
    articles_per_day: { date: string; articles: number; ner: number }[];
    total_ner_today: number;
    total_articles_today: number;
    total_articles_week: number;
    total_articles_total: number;
}

const chartConfig = {
    articles: {
        label: "Articles",
        color: "hsl(var(--chart-1))",
    },
    ner: {
        label: "NER",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export function Chart() {
    const [activeChart, setActiveChart] =
        React.useState<keyof typeof chartConfig>("articles");
    const [dbData, setDbData] = React.useState<DBData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('/data/db.json');
                if (!response.ok) {
                    throw new Error(`Failed to load db.json: ${response.statusText}`);
                }
                const data = await response.json();
                setDbData(data);
                setError(null);
            } catch (err) {
                console.error('Error fetching db.json:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const chartData = dbData?.articles_per_day || [];

    const total = React.useMemo(
        () => ({
            articles: chartData.reduce((acc, curr) => acc + curr.articles, 0),
            ner: chartData.reduce((acc, curr) => acc + curr.ner, 0),
        }),
        [chartData]
    );

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Articles & NER per Day</CardTitle>
                    <CardDescription>Loading chart data...</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:p-6">
                    <div className="flex items-center justify-center h-[250px]">
                        <div className="text-muted-foreground">Loading...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !dbData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Articles & NER per Day</CardTitle>
                    <CardDescription>Error loading chart data</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:p-6">
                    <div className="flex items-center justify-center h-[250px]">
                        <div className="text-red-500">
                            {error || 'Failed to load data'}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
                <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
                    <CardTitle>Articles & NER per Day</CardTitle>
                    <CardDescription>
                        Showing articles and NER counts for the last days
                    </CardDescription>
                </div>
                <div className="flex">
                    {["articles", "ner"].map((key) => {
                        const chart = key as keyof typeof chartConfig
                        return (
                            <button
                                key={chart}
                                data-active={activeChart === chart}
                                className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6"
                                onClick={() => setActiveChart(chart)}
                            >
                                <span className="text-xs text-muted-foreground">
                                    {chartConfig[chart].label}
                                </span>
                                <span className="text-lg font-bold leading-none sm:text-3xl">
                                    {total[key as keyof typeof total].toLocaleString()}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </CardHeader>
            <CardContent className="px-2 sm:p-6">
                <ChartContainer
                    config={chartConfig}
                    className="aspect-auto h-[250px] w-full"
                >
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                        />
                        <ChartTooltip
                            content={
                                <ChartTooltipContent
                                    className="w-[150px]"
                                    nameKey={activeChart}
                                    labelFormatter={(value) => value}
                                />
                            }
                        />
                        <Bar dataKey={activeChart} fill={`var(--color-${activeChart})`} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
