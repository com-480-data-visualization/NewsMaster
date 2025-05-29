import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Button } from '@/components/ui/button';
import { ZoomInIcon, ZoomOutIcon, RotateCcwIcon } from 'lucide-react';

interface NerEntity {
    entity: string;
    label: string;
    start: number;
    end: number;
    source: string;
}

interface Article {
    id: string;
    providerId: string;
    title: string;
    description: string;
    url: string;
    language: string;
    createdAt: string;
    pubDate: number;
    translatedTitle?: string;
    translatedDescription?: string;
    ner: NerEntity[];
}

interface NetworkData {
    data: Article[];
}

interface NetworkNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    entityType: string;
    degree: number;
    isTarget: boolean;
    connectedArticles: string[];
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
    source: NetworkNode;
    target: NetworkNode;
    articles: Article[];
    strength: number;
}

interface EntityPowerNetworkProps {
    targetEntity: string;
    date?: string;
    className?: string;
}

const EntityPowerNetwork: React.FC<EntityPowerNetworkProps> = ({
    targetEntity,
    date,
    className = ""
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
    const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkLink> | null>(null);

    // Load articles data
    const loadArticlesData = async () => {
        if (!date) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/data/${date}/articles.json`);
            if (!response.ok) {
                throw new Error(`Failed to load data for ${date}`);
            }
            const data: NetworkData = await response.json();
            setNetworkData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
            setNetworkData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (date) {
            loadArticlesData();
        }
    }, [date]);

    // Process data to create network graph focused on target entity
    const { nodes, links } = useMemo(() => {
        if (!networkData || !targetEntity) {
            return { nodes: [], links: [] };
        }

        // Find all articles that mention the target entity
        const relevantArticles = networkData.data.filter(article =>
            article.ner.some(entity =>
                entity.entity.toLowerCase() === targetEntity.toLowerCase()
            )
        );

        if (relevantArticles.length === 0) {
            return { nodes: [], links: [] };
        }

        // Create nodes map
        const nodesMap = new Map<string, NetworkNode>();
        const linkPairs = new Map<string, Article[]>();

        // Process each relevant article
        relevantArticles.forEach(article => {
            const entities = article.ner.filter(entity =>
                entity.entity.trim().length > 1 // Filter out very short entities
            );

            // Add nodes for all entities in the article
            entities.forEach(entity => {
                const entityKey = entity.entity.toLowerCase();
                if (!nodesMap.has(entityKey)) {
                    nodesMap.set(entityKey, {
                        id: entity.entity,
                        label: entity.label,
                        entityType: entity.label,
                        degree: 0,
                        isTarget: entityKey === targetEntity.toLowerCase(),
                        connectedArticles: []
                    });
                }

                // Add article to connected articles
                const node = nodesMap.get(entityKey)!;
                if (!node.connectedArticles.includes(article.id)) {
                    node.connectedArticles.push(article.id);
                }
            });

            // Create links between entities in the same article
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i].entity.toLowerCase();
                    const entity2 = entities[j].entity.toLowerCase();

                    // Skip self-links
                    if (entity1 === entity2) continue;

                    const pairKey = [entity1, entity2].sort().join('|');

                    if (!linkPairs.has(pairKey)) {
                        linkPairs.set(pairKey, []);
                    }
                    linkPairs.get(pairKey)!.push(article);
                }
            }
        });

        // Update node degrees
        linkPairs.forEach((articles, pairKey) => {
            const [entity1, entity2] = pairKey.split('|');
            const node1 = nodesMap.get(entity1);
            const node2 = nodesMap.get(entity2);
            if (node1) node1.degree++;
            if (node2) node2.degree++;
        });

        // Convert to arrays
        const nodes: NetworkNode[] = Array.from(nodesMap.values());
        const links: NetworkLink[] = [];

        linkPairs.forEach((articles, pairKey) => {
            const [entity1, entity2] = pairKey.split('|');
            const source = nodesMap.get(entity1);
            const target = nodesMap.get(entity2);

            if (source && target) {
                links.push({
                    source,
                    target,
                    articles,
                    strength: articles.length
                });
            }
        });

        return { nodes, links };
    }, [networkData, targetEntity]);

    // Create and update D3 visualization
    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) return;

        const svg = d3.select(svgRef.current);
        const width = 800;
        const height = 600;

        // Clear previous content
        svg.selectAll("*").remove();

        // Create container group for zooming
        const container = svg.append("g");

        // Set up zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Create simulation
        const simulation = d3.forceSimulation<NetworkNode>(nodes)
            .force("link", d3.forceLink<NetworkNode, NetworkLink>(links)
                .id(d => d.id)
                .distance(d => Math.max(80, 200 / Math.sqrt(d.strength)))
                .strength(d => Math.min(1, d.strength / 10))
            )
            .force("charge", d3.forceManyBody()
                .strength((d) => (d as NetworkNode).isTarget ? -800 : -300)
            )
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide()
                .radius((d) => (d as NetworkNode).isTarget ? 25 : 15)
            );

        simulationRef.current = simulation;

        // Color scale for entity types
        const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

        // Create links
        const link = container.append("g")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .attr("stroke-width", d => Math.sqrt(d.strength) * 2)
            .style("cursor", "pointer")
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#ff6b6b").attr("stroke-opacity", 1);
            })
            .on("mouseout", function (event, d) {
                d3.select(this).attr("stroke", "#999").attr("stroke-opacity", 0.6);
            })
            .on("click", function (event, d) {
                setSelectedNode(null);
                // Could show article details here
                console.log("Link articles:", d.articles);
            });

        // Create nodes
        const node = container.append("g")
            .selectAll("circle")
            .data(nodes)
            .enter().append("circle")
            .attr("r", d => d.isTarget ? 20 : Math.max(8, Math.sqrt(d.degree) * 3))
            .attr("fill", d => d.isTarget ? "#ff4757" : colorScale(d.entityType))
            .attr("stroke", "#fff")
            .attr("stroke-width", d => d.isTarget ? 3 : 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function (event, d) {
                setHoveredNode(d);
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", (d.isTarget ? 20 : Math.max(8, Math.sqrt(d.degree) * 3)) * 1.3);
            })
            .on("mouseout", function (event, d) {
                setHoveredNode(null);
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", d.isTarget ? 20 : Math.max(8, Math.sqrt(d.degree) * 3));
            })
            .on("click", function (event, d) {
                setSelectedNode(d);
                event.stopPropagation();
            })
            .call(d3.drag<SVGCircleElement, NetworkNode>()
                .on("start", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                })
            );

        // Create labels
        const label = container.append("g")
            .selectAll("text")
            .data(nodes)
            .enter().append("text")
            .text(d => d.id)
            .attr("font-size", d => d.isTarget ? "14px" : "10px")
            .attr("font-weight", d => d.isTarget ? "bold" : "normal")
            .attr("fill", d => d.isTarget ? "#fff" : "#333")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("pointer-events", "none")
            .style("user-select", "none");

        // Update positions on simulation tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as NetworkNode).x!)
                .attr("y1", d => (d.source as NetworkNode).y!)
                .attr("x2", d => (d.target as NetworkNode).x!)
                .attr("y2", d => (d.target as NetworkNode).y!);

            node
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);

            label
                .attr("x", d => d.x!)
                .attr("y", d => d.y!);
        });

        // Reset zoom function
        const resetZoom = () => {
            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity
            );
        };

        // Zoom in function
        const zoomIn = () => {
            svg.transition().duration(200).call(
                zoom.scaleBy,
                1.5
            );
        };

        // Zoom out function
        const zoomOut = () => {
            svg.transition().duration(200).call(
                zoom.scaleBy,
                1 / 1.5
            );
        };

        // Store functions for cleanup
        (svg.node() as any)._resetZoom = resetZoom;
        (svg.node() as any)._zoomIn = zoomIn;
        (svg.node() as any)._zoomOut = zoomOut;

        return () => {
            simulation.stop();
        };
    }, [nodes, links]);

    // Control functions
    const handleReset = () => {
        const svg = svgRef.current;
        if (svg && (svg as any)._resetZoom) {
            (svg as any)._resetZoom();
        }
    };

    const handleZoomIn = () => {
        const svg = svgRef.current;
        if (svg && (svg as any)._zoomIn) {
            (svg as any)._zoomIn();
        }
    };

    const handleZoomOut = () => {
        const svg = svgRef.current;
        if (svg && (svg as any)._zoomOut) {
            (svg as any)._zoomOut();
        }
    };

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center h-full ${className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading network data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex items-center justify-center h-full ${className}`}>
                <div className="text-center">
                    <p className="text-red-600 mb-2">Error loading network data</p>
                    <p className="text-muted-foreground text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full ${className}`}>
                <div className="text-center">
                    <p className="text-muted-foreground">No network data found for {targetEntity}</p>
                    <p className="text-muted-foreground text-sm">Try selecting a different date or entity</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {/* Control buttons */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleZoomIn}
                    title="Zoom In"
                >
                    <ZoomInIcon className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleZoomOut}
                    title="Zoom Out"
                >
                    <ZoomOutIcon className="h-4 w-4" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    title="Reset View"
                >
                    <RotateCcwIcon className="h-4 w-4" />
                </Button>
            </div>

            {/* Network visualization */}
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox="0 0 800 600"
                className="border rounded-lg bg-white dark:bg-gray-900"
                style={{ minHeight: '400px' }}
            />

            {/* Node info panel */}
            {(hoveredNode || selectedNode) && (
                <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-lg max-w-xs">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-lg">
                            {(hoveredNode || selectedNode)!.id}
                        </h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Type:</strong> {(hoveredNode || selectedNode)!.entityType}</p>
                            <p><strong>Connections:</strong> {(hoveredNode || selectedNode)!.degree}</p>
                            <p><strong>Articles:</strong> {(hoveredNode || selectedNode)!.connectedArticles.length}</p>
                            {(hoveredNode || selectedNode)!.isTarget && (
                                <p className="text-red-600 font-medium">Target Entity</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Network stats */}
            <div className="absolute top-4 left-4 z-10 bg-white dark:bg-gray-800 border rounded-lg p-3 shadow-lg">
                <div className="text-sm space-y-1">
                    <p><strong>Entities:</strong> {nodes.length}</p>
                    <p><strong>Connections:</strong> {links.length}</p>
                    <p><strong>Target:</strong> {targetEntity}</p>
                </div>
            </div>
        </div>
    );
};

export default EntityPowerNetwork;
