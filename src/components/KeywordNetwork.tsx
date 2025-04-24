import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { NodeObject, LinkObject } from 'react-force-graph-3d'; // Use type-only import
import Select from 'react-select';
import * as THREE from 'three'; // Import THREE for sprite-based labels

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

// Extend NodeObject from react-force-graph-3d to include our custom properties
interface CustomNodeObject extends NodeObject {
    id: string; // Ensure id is always string
    label: string;
    degree?: number;
    // color property is added by react-force-graph when nodeAutoColorBy is used
    color?: string;
    // val property is added by react-force-graph when nodeVal is used
    __threeObj?: THREE.Object3D; // Internal property used by the library
}
// Extend LinkObject similarly
interface CustomLinkObject extends LinkObject {
    source: string | number | CustomNodeObject; // Keep original flexibility but expect CustomNodeObject in callbacks
    target: string | number | CustomNodeObject; // Keep original flexibility but expect CustomNodeObject in callbacks
    articles: string[];
}

interface GraphData {
    nodes: CustomNodeObject[];
    links: CustomLinkObject[];
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

        const nodesMap = new Map<string, CustomNodeObject>();
        const links: CustomLinkObject[] = []; // Use CustomLinkObject here
        const activeLabels = new Set(selectedLabels.map(opt => opt.value));
        const nodeDegrees = new Map<string, number>(); // Map to store node degrees

        networkData.data.forEach(article => {
            const articleEntities = article.ner
                .filter(entity => activeLabels.size === 0 || activeLabels.has(entity.label));

            // Add nodes
            articleEntities.forEach(entity => {
                if (!nodesMap.has(entity.text)) {
                    // Initialize degree to 0 when adding the node
                    // Ensure id is string and other properties match CustomNodeObject
                    nodesMap.set(entity.text, { id: entity.text, label: entity.label, degree: 0 });
                }
            });

            // Add links and update degrees
            for (let i = 0; i < articleEntities.length; i++) {
                for (let j = i + 1; j < articleEntities.length; j++) {
                    const source = articleEntities[i].text;
                    const target = articleEntities[j].text;
                    const linkKey = [source, target].sort().join('--');
                    // Find existing link more efficiently
                    const existingLinkIndex = links.findIndex(l => {
                        // Ensure source/target are treated as strings for comparison if they are objects
                        // The source/target in the links array *should* be strings here based on creation
                        const linkSourceId = typeof l.source === 'object' && l.source !== null && 'id' in l.source ? l.source.id : l.source;
                        const linkTargetId = typeof l.target === 'object' && l.target !== null && 'id' in l.target ? l.target.id : l.target;
                        return [linkSourceId, linkTargetId].sort().join('--') === linkKey;
                    });


                    if (existingLinkIndex === -1) {
                        // Ensure source/target are strings when creating the link object
                        links.push({ source: source, target: target, articles: [article.title] });
                        // Increment degree for both source and target nodes
                        nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
                        nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
                    } else {
                        // If the link already exists, add the article title if it's not already there
                        if (!links[existingLinkIndex].articles.includes(article.title)) {
                            links[existingLinkIndex].articles.push(article.title);
                        }
                        // Note: Degree is only incremented when a *new* link is added
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
            // Ensure source/target are treated as strings for adding to the set
            const sourceId = typeof link.source === 'object' && link.source !== null && 'id' in link.source ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' && link.target !== null && 'id' in link.target ? link.target.id : link.target;
            nodesInLinks.add(sourceId as string);
            nodesInLinks.add(targetId as string);
        });

        // Ensure nodes have degree property, default to 0 if not in nodeDegrees
        const filteredNodes = Array.from(nodesMap.values())
            .filter(node => nodesInLinks.has(node.id))
            .map(node => ({ ...node, degree: node.degree ?? 0 })); // Ensure degree is always a number


        // Cast links back to CustomLinkObject[] if needed, though it should already be correct
        return { nodes: filteredNodes, links: links as CustomLinkObject[] };
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

    // Function to create sprite-based labels
    const createNodeLabelSprite = (node: CustomNodeObject): THREE.Sprite => { // Return THREE.Sprite
        const sprite = new THREE.Sprite() as any; // Use 'as any' for custom properties
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return sprite; // Return empty sprite if context fails

        const fontSize = 24; // Increased font size further (was 20)
        const fontWeight = 'bold'; // Make text bolder
        const fontFamily = 'sans-serif';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const text = node.id; // Use node.id which is the NER text
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;

        // Base scale factor - will be multiplied by node size later
        const baseScale = 0.1;
        const padding = 6; // Increased padding
        const canvasWidth = textWidth + padding * 2;
        const canvasHeight = fontSize + padding * 2;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Background - Transparent
        // No background fill

        // Text
        ctx.fillStyle = 'red'; // Set text color to red
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        // texture.minFilter = THREE.LinearFilter; // Optional: improve texture quality

        const material = new THREE.SpriteMaterial({
            map: texture,
            depthWrite: false, // Don't write to depth buffer
            transparent: true, // Enable transparency
            // sizeAttenuation: false // Optional: Keep size constant regardless of distance
        });
        sprite.material = material;

        // Set base scale - final scaling happens in nodeThreeObject
        sprite.scale.set(canvasWidth * baseScale, canvasHeight * baseScale, 1.0);

        // Store node id for potential interaction later
        sprite.nodeId = node.id;

        return sprite; // Return the sprite itself
    };


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
                    nodeAutoColorBy="label" // Color nodes by NER label
                    nodeVal={node => (node as CustomNodeObject).degree ?? 1} // Set node size based on degree, ensure type
                    // Use nodeThreeObject to create custom node appearance (sphere + label)
                    nodeThreeObject={(node): THREE.Object3D => {
                        const customNode = node as CustomNodeObject;
                        if (!customNode.id) {
                            console.warn("Node missing id:", customNode);
                            return new THREE.Object3D();
                        }

                        // --- Calculate Node Size ---
                        const nodeVal = customNode.degree ?? 1;
                        // Adjust multiplier for more pronounced size differences
                        const radius = Math.cbrt(nodeVal) * 2.0; // Increased multiplier (was 1.5)

                        // --- Create the Sphere (Bubble) ---
                        const geometry = new THREE.SphereGeometry(radius, 16, 8); // Adjust segments for performance/quality
                        const material = new THREE.MeshLambertMaterial({
                            color: customNode.color || '#ffffaa', // Use color assigned by library or a default
                            transparent: true,
                            opacity: 0.75 // Slightly transparent nodes
                        });
                        const sphere = new THREE.Mesh(geometry, material);

                        // --- Create the Label Sprite ---
                        const sprite = createNodeLabelSprite(customNode);

                        // --- Scale the Sprite proportionally to the node radius ---
                        // Adjust this multiplier to fine-tune text size relative to bubble size
                        const spriteScaleMultiplier = radius * 0.5;
                        sprite.scale.multiplyScalar(spriteScaleMultiplier); // Scale existing sprite scale

                        // Position sprite slightly in front of the sphere's center
                        sprite.position.set(0, 0, radius + 0.1); // Position in front along Z

                        // --- Create a Group ---
                        const group = new THREE.Group();
                        group.add(sphere);
                        group.add(sprite); // Add scaled sprite to the group

                        // Store the group on the node object if needed (optional, library might do this)
                        customNode.__threeObj = group;

                        return group; // Return the group containing sphere and sprite
                    }}
                    // Adjust linkLabel to handle potentially complex source/target objects
                    linkLabel={(link: CustomLinkObject) => {
                        // Type assertion needed as react-force-graph provides full objects here
                        const sourceNode = link.source as CustomNodeObject;
                        const targetNode = link.target as CustomNodeObject;
                        // Ensure IDs exist before creating label
                        const sourceId = sourceNode?.id ?? 'Unknown Source';
                        const targetId = targetNode?.id ?? 'Unknown Target';
                        const articleTitles = link.articles?.join(', ') ?? 'No articles';
                        return `${sourceId} &harr; ${targetId}<br/>Articles: ${articleTitles}`;
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
           color: var (--foreground);
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
            color: var (--primary-foreground);
         }
         .react-select-container .react-select__input-container {
            color: var(--foreground);
         }
       `}</style>
        </div>
    );
};

export default KeywordNetwork;
