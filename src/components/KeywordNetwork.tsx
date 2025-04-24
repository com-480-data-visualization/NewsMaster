import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import Select from 'react-select';

interface NerEntity {
    text: string;
    label: string;
}

interface Article {
    id: string;
    title: string;
    description: string;
    ner: NerEntity[];
}

interface NetworkData {
    data: Article[];
}

interface GraphNode {
    id: string;
    label: string;
    degree?: number; // Add degree property for node size
    // Add other properties if needed, e.g., color based on label
}

interface GraphLink {
    source: string;
    target: string;
    articles: string[]; // Store titles of articles connecting the nodes
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface SelectOption {
    value: string;
    label: string;
}

const KeywordNetwork: React.FC = () => {
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [selectedLabels, setSelectedLabels] = useState<SelectOption[]>([]);
    const [allLabels, setAllLabels] = useState<SelectOption[]>([]);

    useEffect(() => {
        // Fetch data from the public directory
        fetch('/data/16.04.2025/network.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then((data: NetworkData) => {
                setNetworkData(data);
                // Extract all unique NER labels for the select options
                const labels = new Set<string>();
                data.data.forEach(article => {
                    article.ner.forEach(entity => labels.add(entity.label));
                });
                setAllLabels(Array.from(labels).sort().map(label => ({ value: label, label })));
                // Optionally pre-select all labels initially
                // setSelectedLabels(Array.from(labels).sort().map(label => ({ value: label, label })));
            })
            .catch(error => {
                console.error("Error fetching network data:", error);
            });
    }, []);

    const graphData = useMemo<GraphData>(() => {
        if (!networkData) return { nodes: [], links: [] };

        const nodesMap = new Map<string, GraphNode>();
        // Remove linksSet as it wasn't used effectively for finding existing links
        const links: GraphLink[] = [];
        const activeLabels = new Set(selectedLabels.map(opt => opt.value));
        const nodeDegrees = new Map<string, number>(); // Map to store node degrees

        networkData.data.forEach(article => {
            const articleEntities = article.ner
                .filter(entity => activeLabels.size === 0 || activeLabels.has(entity.label)); // Filter by selected labels (or show all if none selected)

            // Add nodes (initially without degree)
            articleEntities.forEach(entity => {
                if (!nodesMap.has(entity.text)) {
                    // Initialize degree to 0 when adding the node
                    nodesMap.set(entity.text, { id: entity.text, label: entity.label, degree: 0 });
                }
            });

            // Add links and update degrees
            for (let i = 0; i < articleEntities.length; i++) {
                for (let j = i + 1; j < articleEntities.length; j++) {
                    const source = articleEntities[i].text;
                    const target = articleEntities[j].text;
                    // Ensure consistent link key regardless of order
                    const linkKey = [source, target].sort().join('--');
                    // Find existing link more efficiently
                    const existingLinkIndex = links.findIndex(l => [l.source, l.target].sort().join('--') === linkKey);

                    if (existingLinkIndex === -1) {
                        links.push({ source, target, articles: [article.title] });
                        // Increment degree for both source and target nodes
                        nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
                        nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
                    } else {
                        // If the link already exists, add the article title if it's not already there
                        if (!links[existingLinkIndex].articles.includes(article.title)) {
                            links[existingLinkIndex].articles.push(article.title);
                        }
                        // Note: Degree is only incremented when a *new* link is added between two nodes.
                        // If you want degree to increase every time an article connects two existing nodes,
                        // you would increment degrees here as well. Current logic counts unique connections.
                    }
                }
            }
        });

        // Add calculated degrees to the nodes in nodesMap
        nodeDegrees.forEach((degree, nodeId) => {
            const node = nodesMap.get(nodeId);
            if (node) {
                node.degree = degree;
            }
        });


        // Filter nodes that are actually part of the selected links
        const nodesInLinks = new Set<string>();
        links.forEach(link => {
            nodesInLinks.add(link.source);
            nodesInLinks.add(link.target);
        });

        // Ensure nodes have degree property, default to 0 if not in nodeDegrees (shouldn't happen with current logic)
        // Also update the node in the map directly before filtering
        const filteredNodes = Array.from(nodesMap.values())
            .filter(node => nodesInLinks.has(node.id))
            .map(node => ({ ...node, degree: node.degree ?? 0 })); // Ensure degree is always a number


        return { nodes: filteredNodes, links };
    }, [networkData, selectedLabels]);

    const handleLabelChange = (selectedOptions: readonly SelectOption[] | null) => {
        setSelectedLabels(selectedOptions ? Array.from(selectedOptions) : []);
    };

    // ForceGraph3D requires client-side rendering. Ensure this component is used with a client:* directive in Astro.
    // We also need to check if we are in a browser environment before rendering ForceGraph3D.
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);


    return (
        <div style={{ height: '80vh', width: '100%', position: 'relative' }}>
            <div style={{ marginBottom: '1rem', zIndex: 10, position: 'relative' }}>
                <label htmlFor="ner-select">Filter by NER Label:</label>
                <Select
                    id="ner-select"
                    isMulti
                    options={allLabels}
                    value={selectedLabels}
                    onChange={handleLabelChange}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    placeholder="Select NER labels to display..."
                />
            </div>
            {isClient && networkData ? (
                <ForceGraph3D
                    graphData={graphData}
                    nodeLabel="id" // Show node ID (NER text) on hover
                    nodeAutoColorBy="label" // Color nodes by NER label
                    nodeVal="degree" // Set node size based on degree
                    // The type inference seems incorrect here, source/target are node objects
                    // Also, the link object itself needs type assertion
                    linkLabel={link => {
                        const sourceNode = link.source as GraphNode;
                        const targetNode = link.target as GraphNode;
                        const linkData = link as GraphLink; // Assert link type to access articles
                        const articleTitles = linkData.articles.join(', ');
                        return `${sourceNode.id} &harr; ${targetNode.id}<br/>Articles: ${articleTitles}`;
                    }}
                    linkDirectionalParticles={1} // Optional: show particle flow on links
                    linkDirectionalParticleWidth={1.5}
                    linkWidth={0.5}
                    backgroundColor="rgba(0,0,0,0)" // Transparent background
                />
            ) : (
                <div>Loading graph data...</div>
            )}
            {/* Basic styling for react-select if needed, or use Tailwind/CSS modules */}
            <style>{`
         .react-select-container .react-select__control {
           background-color: var(--background);
           border-color: var(--border);
         }
         .react-select-container .react-select__menu {
           background-color: var(--background);
           color: var(--foreground);
         }
         .react-select-container .react-select__option--is-focused {
           background-color: var(--accent);
         }
         .react-select-container .react-select__multi-value {
           background-color: var(--primary);
           color: var(--primary-foreground);
         }
         .react-select-container .react-select__multi-value__label {
            color: var(--primary-foreground);
         }
         .react-select-container .react-select__multi-value__remove {
            color: var(--primary-foreground);
         }
         .react-select-container .react-select__multi-value__remove:hover {
            background-color: var(--primary / 0.8);
            color: var(--primary-foreground);
         }
         .react-select-container .react-select__input-container {
            color: var(--foreground);
         }
       `}</style>
        </div>
    );
};

export default KeywordNetwork;
