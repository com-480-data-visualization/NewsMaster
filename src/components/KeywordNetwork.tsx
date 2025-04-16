import React, { useState, useEffect, useRef } from "react";
import Select from "react-select";
import { Sigma } from "sigma";
import Graph from "graphology";
import { random } from "graphology-layout";

const KEYWORD_TYPES = ["organisation", "person", "location", "misc"];

interface Article {
    title: string;
    organisation?: string[];
    person?: string[];
    location?: string[];
    misc?: string[];
    [key: string]: any;
}

interface ArticleOption {
    value: number;
    label: string;
}

const KeywordNetwork: React.FC = () => {
    const [data, setData] = useState<Article[]>([]);
    const [keywordType, setKeywordType] = useState<string>("person");
    const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<ArticleOption | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sigmaRef = useRef<Sigma | null>(null);
    const depth = 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/data/16.04.2025/network.json");
                const json = await res.json();
                setData(json.data);

                const options = json.data.map((article: Article, idx: number) => ({
                    value: idx,
                    label: article.title,
                }));
                setArticleOptions(options);
            } catch (err) {
                console.error("Error fetching articles.json:", err);
            }
        };

        fetchData();
    }, []);

    const getLinks = (articles: Article[], type: string): [number, number][] => {
        const keywordMap = new Map<string, number[]>();

        articles.forEach((article, index) => {
            const keywords = article[type] as string[] | undefined;
            if (Array.isArray(keywords)) {
                keywords.forEach(keyword => {
                    if (!keywordMap.has(keyword)) {
                        keywordMap.set(keyword, []);
                    }
                    keywordMap.get(keyword)?.push(index);
                });
            }
        });

        const links: [number, number][] = [];
        keywordMap.forEach(indices => {
            for (let i = 0; i < indices.length; i++) {
                for (let j = i + 1; j < indices.length; j++) {
                    links.push([indices[i], indices[j]]);
                }
            }
        });

        return links;
    };

    const addGraphNodesAndEdges = (
        graph: Graph,
        links: [number, number][],
        current: number,
        depth: number,
        visited: Set<number> = new Set(),
        level: number = 0
    ): void => {
        if (depth === 0 || visited.has(current)) return;
        visited.add(current);

        links.forEach(([source, target]) => {
            if (source === current || target === current) {
                const other = source === current ? target : source;

                if (!graph.hasNode(String(source))) {
                    graph.addNode(String(source), {
                        label: data[source]?.title || `Article ${source}`,
                        depth: level,
                        size: 5,
                    });
                }

                if (!graph.hasNode(String(target))) {
                    graph.addNode(String(target), {
                        label: data[target]?.title || `Article ${target}`,
                        depth: level,
                        size: 5,
                    });
                }

                if (!graph.hasEdge(String(source), String(target)) &&
                    !graph.hasEdge(String(target), String(source))) {
                    graph.addEdge(String(source), String(target), {
                        color: "#999",
                        size: 1,
                    });
                }

                addGraphNodesAndEdges(graph, links, other, depth - 1, visited, level + 1);
            }
        });
    };

    useEffect(() => {
        if (!selectedArticle || !data.length) return;

        // Clean up previous Sigma instance
        if (sigmaRef.current) {
            // Type assertion to access kill method
            (sigmaRef.current as any).kill();
            sigmaRef.current = null;
        }

        const graph = new Graph();
        const links = getLinks(data, keywordType);
        const current = selectedArticle.value;

        addGraphNodesAndEdges(graph, links, current, depth);

        graph.forEachNode((node, attrs) => {
            const degree = graph.degree(node);
            graph.setNodeAttribute(node, "size", Math.min(degree + 3, 10));
            graph.setNodeAttribute(node, "color",
                node === String(current) ? "blue" :
                    attrs.depth === 0 ? "violet" : "#666"
            );
        });

        random.assign(graph);

        if (containerRef.current) {
            const sigma = new Sigma(graph, containerRef.current);
            sigmaRef.current = sigma;

            const capturedCurrent = current; // Capture the current value for closure

            sigma.on("enterNode", ({ node }: { node: string }) => {
                graph.updateEachNodeAttributes((n, attrs) => ({
                    ...attrs,
                    color: n === node ? "red" : attrs.color,
                }));

                graph.updateEachEdgeAttributes((edge, attrs) => {
                    const [source, target] = graph.extremities(edge);
                    return {
                        ...attrs,
                        color: source === node || target === node ? "red" : attrs.color,
                        size: source === node || target === node ? 2 : 1,
                        hidden: source !== node && target !== node,
                    };
                });

                sigma.refresh();
            });

            sigma.on("leaveNode", () => {
                graph.updateEachNodeAttributes((n, attrs) => ({
                    ...attrs,
                    color: n === String(capturedCurrent) ? "blue" :
                        attrs.depth === 0 ? "violet" : "#666",
                }));

                graph.updateEachEdgeAttributes((edge, attrs) => ({
                    ...attrs,
                    color: "#999",
                    size: 1,
                    hidden: false,
                }));

                sigma.refresh();
            });
        }

        // Cleanup function
        return () => {
            if (sigmaRef.current) {
                (sigmaRef.current as any).kill();
                sigmaRef.current = null;
            }
        };
    }, [selectedArticle, keywordType, data, depth]);

    return (
        <div>
            <div className="flex gap-4 p-4">
                <Select
                    options={KEYWORD_TYPES.map(k => ({ label: k, value: k }))}
                    onChange={(opt) => setKeywordType(opt?.value || "person")}
                    defaultValue={{ label: "person", value: "person" }}
                    placeholder="Select keyword type"
                />
                <Select
                    options={articleOptions}
                    onChange={(opt) => setSelectedArticle(opt)}
                    placeholder="Select an article"
                />
            </div>
            <div ref={containerRef} style={{ width: "100%", height: "90vh" }} />
        </div>
    );
};

export default KeywordNetwork;