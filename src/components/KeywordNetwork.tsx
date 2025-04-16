import React, { useMemo, useState } from "react";
import Select from "react-select";
import type { SingleValue } from "react-select";
import ForceGraph2D from "react-force-graph-2d";
import articlesData from "../../data/articles_16.04.2025.json";
const articles = articlesData.data;

type Article = {
    id: string;
    providerId: string;
    title: string;
    description: string;
    url: string;
    language: string;
    createdAt: string;
    pubDate: number;
};

type Node = {
    id: string;
    val: number;
};

type Link = {
    source: string;
    target: string;
    articles: string[];
    value: number;
    title: string;
};

type GraphData = {
    nodes: Node[];
    links: Link[];
};

type CategoryOption = {
    value: string | null;
    label: string;
};

// Updated `buildGraphData` to use keywords instead of titles for nodes and edges
function buildGraphData(filterCategory: string | null): GraphData {
    const keywordMap = new Map<string, Node>();
    const edgeMap = new Map<string, { source: string; target: string; articles: string[] }>();

    (articles as Article[]).forEach((article) => {
        const keywords: { label: string; category: string }[] = [];

        // Extract keywords from the article (e.g., "AI", "Nebraska", "Carlos Mendes")
        if (article.title) {
            const extractedKeywords = article.title.split(/\s+/); // Simple split for demonstration
            extractedKeywords.forEach((kw) => {
                keywords.push({ label: kw, category: "keyword" });
            });
        }

        // Build keyword occurrences
        keywords.forEach((kw) => {
            if (!keywordMap.has(kw.label)) {
                keywordMap.set(kw.label, { id: kw.label, val: 1 });
            } else {
                keywordMap.get(kw.label)!.val += 1;
            }
        });

        // Build edges (co-occurrence)
        for (let i = 0; i < keywords.length; i++) {
            for (let j = i + 1; j < keywords.length; j++) {
                const key = [keywords[i].label, keywords[j].label].sort().join("--");
                if (!edgeMap.has(key)) {
                    edgeMap.set(key, { source: keywords[i].label, target: keywords[j].label, articles: [article.title] });
                } else {
                    edgeMap.get(key)!.articles.push(article.title);
                }
            }
        }
    });

    const nodes = Array.from(keywordMap.values());
    const links = Array.from(edgeMap.values()).map((e) => ({
        ...e,
        value: e.articles.length,
        title: e.articles.join("\n")
    }));

    return { nodes, links };
}

const categoryOptions: CategoryOption[] = [
    { value: null, label: "All" },
    { value: "organisation", label: "Organisation" },
    { value: "location", label: "Location" },
    { value: "person", label: "Person" },
    { value: "misc", label: "Misc" }
];

const KeywordNetwork = () => {
    const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);

    const graphData = useMemo(() => buildGraphData(selectedCategory?.value || null), [selectedCategory]);

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Keyword Co-occurrence Graph</h1>
            <div className="mb-4 w-64">
                <Select
                    options={categoryOptions}
                    value={selectedCategory}
                    onChange={(newValue) => setSelectedCategory(newValue as SingleValue<CategoryOption>)}
                    isClearable
                    placeholder="Filter by category..."
                />
            </div>
            <ForceGraph2D
                graphData={graphData}
                nodeLabel={(node) => `${node.id} (x${node.val})`}
                nodeAutoColorBy="id"
                nodeVal={(node) => node.val}
                linkDirectionalParticles={2}
                linkDirectionalParticleWidth={1}
                linkLabel={(link) => link.title}
                linkWidth={(link) => Math.log2(link.value + 1)}
                width={1000}
                height={600}
            />
        </div>
    );
};

export default KeywordNetwork;
