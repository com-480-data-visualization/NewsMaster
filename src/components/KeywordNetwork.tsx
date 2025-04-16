import React, { useEffect, useRef, useState } from "react";
import Graph from "graphology";
import ForceAtlas2 from "graphology-layout-force";
import type { Attributes } from "graphology-types";

interface Node {
    id: string;
    label: string;
    size: number;
}

interface Edge {
    id: string;
    source: string;
    target: string;
    size: number;
    label: string;
}

interface GraphData {
    nodes: Node[];
    edges: Edge[];
}

const KeywordNetwork: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<Graph | null>(null);
    const sigmaRef = useRef<any | null>(null);
    const draggedNodeRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        
        const fetchGraphData = async () => {
            try {
                console.log("Fetching graph data...");
                // Dynamic import Sigma to avoid SSR issues
                const { Sigma } = await import("sigma");
                
                if (!isMounted) return;
                
                console.log("Sigma imported successfully");
                
                const response = await fetch("/data/16.04.2025/bubbles.json");
                console.log("Fetch response:", response.status);

                if (!response.ok) {
                    throw new Error(`Failed to fetch graph data: ${response.statusText}`);
                }

                const data = await response.json();
                console.log("Data loaded:", data.nodes.length, "nodes,", data.edges.length, "edges");

                if (!isMounted || !containerRef.current) {
                    console.log("Component unmounted or container ref not available");
                    return;
                }

                // Create a new graph
                const graph = new Graph();

                // Add nodes to the graph
                data.nodes.forEach((node) => {
                    graph.addNode(node.id, {
                        label: node.label,
                        size: node.size * 3, // Scale size for better visualization
                        color: getRandomColor(),
                        x: Math.random() * 100, // Random initial position
                        y: Math.random() * 100, // Random initial position
                    });
                });

                // Add edges to the graph
                data.edges.forEach((edge) => {
                    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                        graph.addEdge(edge.source, edge.target, {
                            size: edge.size,
                            label: edge.label || "",
                            color: "#ccc",
                        });
                    }
                });

                graphRef.current = graph;
                console.log("Graph created with", graph.order, "nodes and", graph.size, "edges");

                // Initialize the Sigma instance
                if (containerRef.current) {
                    console.log("Container dimensions:", containerRef.current.offsetWidth, "x", containerRef.current.offsetHeight);
                    
                    // Apply initial force layout
                    const positions = ForceAtlas2.assign(graph, { iterations: 100 });
                    
                    // Apply positions to the graph
                    graph.forEachNode((nodeId) => {
                        const pos = positions[nodeId];
                        if (pos) {
                            graph.setNodeAttribute(nodeId, "x", pos.x);
                            graph.setNodeAttribute(nodeId, "y", pos.y);
                        }
                    });

                    // Create sigma instance with explicit settings
                    try {
                        sigmaRef.current = new Sigma(graph, containerRef.current, {
                            renderEdgeLabels: true,
                            allowInvalidContainer: true,
                        });
                        
                        console.log("Sigma instance created successfully");
                        
                        // Setup drag and drop events
                        setupDragAndDrop();
                    } catch (sigmaError) {
                        console.error("Error initializing Sigma:", sigmaError);
                        setError(`Error initializing visualization: ${sigmaError.message}`);
                    }
                } else {
                    console.error("Container ref is null when trying to initialize Sigma");
                    setError("Visualization container not found");
                }

                if (isMounted) {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error setting up graph:", err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Unknown error");
                    setIsLoading(false);
                }
            }
        };

        // Delay initialization slightly to ensure DOM is ready
        const timer = setTimeout(() => {
            fetchGraphData();
        }, 100);

        // Cleanup function
        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (sigmaRef.current) {
                try {
                    sigmaRef.current.kill();
                } catch (e) {
                    console.error("Error during Sigma cleanup:", e);
                }
                sigmaRef.current = null;
            }
        };
    }, []);

    const setupDragAndDrop = () => {
        if (!sigmaRef.current || !graphRef.current || !containerRef.current) {
            console.error("Cannot setup drag and drop - missing references");
            return;
        }

        const sigma = sigmaRef.current;
        const graph = graphRef.current;
        const container = containerRef.current;

        // State for drag'n'drop
        let isDragging = false;
        let draggedNode: string | null = null;
        let startPosition = { x: 0, y: 0 };
        let currentPosition = { x: 0, y: 0 };

        // Mouse event handlers
        const onMouseDown = (e: MouseEvent) => {
            // Find node under mouse using sigma's coordinate-to-node method
            const { x, y } = sigma.viewportToGraph({ x: e.offsetX, y: e.offsetY });
            const nodesAtPoint = graph
                .nodes()
                .map((nodeId) => {
                    const nodeX = graph.getNodeAttribute(nodeId, "x");
                    const nodeY = graph.getNodeAttribute(nodeId, "y");
                    const nodeSize = graph.getNodeAttribute(nodeId, "size");
                    const distance = Math.sqrt(Math.pow(nodeX - x, 2) + Math.pow(nodeY - y, 2));

                    return {
                        id: nodeId,
                        distance: distance,
                        size: nodeSize
                    };
                })
                .filter((n) => n.distance < n.size / 5) // Filter nodes close to the click
                .sort((a, b) => a.distance - b.distance); // Sort by closest

            if (nodesAtPoint.length > 0) {
                const nodeId = nodesAtPoint[0].id;
                isDragging = true;
                draggedNode = nodeId;
                draggedNodeRef.current = nodeId;
                container.style.cursor = "grabbing";

                // Record start position
                startPosition = {
                    x: graph.getNodeAttribute(nodeId, "x"),
                    y: graph.getNodeAttribute(nodeId, "y")
                };
                currentPosition = { ...startPosition };

                // Prevent sigma from handling the event
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging || !draggedNode) return;

            // Convert mouse position to graph position
            const pos = sigma.viewportToGraph({ x: e.offsetX, y: e.offsetY });

            // Update node position
            graph.setNodeAttribute(draggedNode, "x", pos.x);
            graph.setNodeAttribute(draggedNode, "y", pos.y);

            currentPosition = { x: pos.x, y: pos.y };

            // Prevent default to avoid text selection during drag
            e.preventDefault();
            e.stopPropagation();
        };

        const onMouseUp = () => {
            isDragging = false;
            draggedNode = null;
            draggedNodeRef.current = null;
            container.style.cursor = "default";
        };

        // Register event listeners
        container.addEventListener("mousedown", onMouseDown);
        container.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        container.addEventListener("mouseleave", onMouseUp);

        console.log("Drag and drop event listeners set up");
    };

    const getRandomColor = () => {
        const colors = [
            "#4285F4", // Google Blue
            "#EA4335", // Google Red
            "#FBBC05", // Google Yellow
            "#34A853", // Google Green
            "#8E44AD", // Purple
            "#F39C12", // Orange
            "#16A085", // Teal
            "#2C3E50", // Dark Blue
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-96">Loading graph...</div>;
    }

    if (error) {
        return <div className="text-red-500">Error: {error}</div>;
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <h3 className="text-xl font-semibold p-4 border-b">Keyword Network</h3>
            <div
                ref={containerRef}
                className="w-full h-[500px]"
                style={{ 
                    background: "#f5f5f5",
                    position: "relative" 
                }}
            />
            <div className="p-3 text-sm text-gray-500">
                Drag nodes to reposition. Node size represents frequency in articles.
            </div>
        </div>
    );
};

export default KeywordNetwork;