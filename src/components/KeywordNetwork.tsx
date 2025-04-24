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
    // Add other properties if needed, e.g., color based on label
}

interface GraphLink {
    source: string;
    target: string;
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
        const linksSet = new Set<string>(); // Use a set to avoid duplicate links (e.g., A-B and B-A)
        const links: GraphLink[] = [];
        const activeLabels = new Set(selectedLabels.map(opt => opt.value));

        networkData.data.forEach(article => {
            const articleEntities = article.ner
                .filter(entity => activeLabels.size === 0 || activeLabels.has(entity.label)); // Filter by selected labels (or show all if none selected)

            // Add nodes
            articleEntities.forEach(entity => {
                if (!nodesMap.has(entity.text)) {
                    nodesMap.set(entity.text, { id: entity.text, label: entity.label });
                }
            });

            // Add links for co-occurring entities within the article
            for (let i = 0; i < articleEntities.length; i++) {
                for (let j = i + 1; j < articleEntities.length; j++) {
                    const source = articleEntities[i].text;
                    const target = articleEntities[j].text;
                    // Ensure consistent link key regardless of order
                    const linkKey = [source, target].sort().join('--');
                    if (!linksSet.has(linkKey)) {
                        linksSet.add(linkKey);
                        links.push({ source, target });
                    }
                }
            }
        });

        // Filter nodes that are actually part of the selected links
        const nodesInLinks = new Set<string>();
        links.forEach(link => {
            nodesInLinks.add(link.source);
            nodesInLinks.add(link.target);
        });

        const filteredNodes = Array.from(nodesMap.values()).filter(node => nodesInLinks.has(node.id));


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
