import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { NodeObject, LinkObject } from 'react-force-graph-3d'; // Use type-only import
import Select from 'react-select';
import * as THREE from 'three'; // Import THREE for sprite-based labels
import { Button } from '@/components/ui/button'; // Import Button
import { MaximizeIcon, MinimizeIcon } from 'lucide-react'; // Import icons

interface NerEntity {
    entity: string;
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
    const [isClient, setIsClient] = useState(false);
    const [isPlainScreen, setIsPlainScreen] = useState(false); // State for plain screen mode
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        // Default to today's date in yyyy-mm-dd format
        const today = new Date();
        return today.toISOString().slice(0, 10);
    });
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        setIsClient(true);
        setFetchError(null); // Reset error on date change
        // Format date as DD.MM.YYYY for the path
        const [year, month, day] = selectedDate.split('-');
        const formattedDate = `${day}.${month}.${year}`;
        const jsonPath = `/data/${formattedDate}/articles.json`;
        fetch(jsonPath)
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
                setNetworkData(null);
                setFetchError("No data for this date. Please select another date.");
                console.error("Error fetching network data:", error);
            });
    }, [selectedDate]);

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
                if (!nodesMap.has(entity.entity)) {
                    // Initialize degree to 0 when adding the node
                    // Ensure id is string and other properties match CustomNodeObject
                    nodesMap.set(entity.entity, { id: entity.entity, label: entity.label, degree: 0 });
                }
            });

            // Add links and update degrees
            for (let i = 0; i < articleEntities.length; i++) {
                for (let j = i + 1; j < articleEntities.length; j++) {
                    const source = articleEntities[i].entity;
                    const target = articleEntities[j].entity;
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

    // Function to create sprite-based labels - now accepts isDarkMode
    const createNodeLabelSprite = (node: CustomNodeObject, isDarkMode: boolean): THREE.Sprite => {
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

        // Text - Color depends on dark mode
        ctx.fillStyle = isDarkMode ? 'white' : 'dark'; // White text on dark, red on light
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

    const togglePlainScreen = () => setIsPlainScreen(!isPlainScreen);

    // Define styles for react-select in dark mode
    const plainScreenSelectStyles = isPlainScreen ? {
        control: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: '#1a1a1a', // Dark background
            borderColor: '#444',
        }),
        menu: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: '#1a1a1a', // Dark background
        }),
        option: (baseStyles: any, state: { isFocused: boolean; }) => ({
            ...baseStyles,
            backgroundColor: state.isFocused ? '#333' : '#1a1a1a',
            color: 'white',
            ':active': {
                backgroundColor: '#555',
            },
        }),
        multiValue: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: '#007bff', // Keep primary color or adjust
        }),
        multiValueLabel: (baseStyles: any) => ({
            ...baseStyles,
            color: 'white',
        }),
        multiValueRemove: (baseStyles: any) => ({
            ...baseStyles,
            color: 'white',
            ':hover': {
                backgroundColor: '#0056b3',
                color: 'white',
            },
        }),
        input: (baseStyles: any) => ({
            ...baseStyles,
            color: 'white',
        }),
        singleValue: (baseStyles: any) => ({
            ...baseStyles,
            color: 'white',
        }),
        placeholder: (baseStyles: any) => ({
            ...baseStyles,
            color: '#ccc', // Lighter placeholder text for dark bg
        }),
    } : {};


    return (
        <div
            style={isPlainScreen ? {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: '#000', // Force dark background
                zIndex: 1000, // Ensure it's on top
                padding: '1rem', // Add some padding
                display: 'flex',
                flexDirection: 'column', // Stack controls and graph
            } : {
                height: '80vh',
                width: '100%',
                position: 'relative', // Keep original layout flow
            }}
        >
            {/* Controls container */}
            <div style={{
                marginBottom: '1rem',
                zIndex: 1001, // Above graph
                position: isPlainScreen ? 'relative' : 'relative',
                display: 'flex',
                gap: '0.5rem', // Reduced gap slightly for better alignment
                alignItems: 'center',
                flexShrink: 0,
                padding: isPlainScreen ? '0 1rem' : '0',
            }}>
                {/* Date selector */}
                <label
                    htmlFor="date-picker"
                    className={`${isPlainScreen ? 'text-white' : ''} whitespace-nowrap`}
                    style={{ marginRight: '0.5rem' }}
                >
                    Date:
                </label>
                <input
                    id="date-picker"
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{
                        marginRight: '1rem',
                        background: isPlainScreen ? '#1a1a1a' : undefined,
                        color: isPlainScreen ? 'white' : undefined,
                        border: isPlainScreen ? '1px solid #444' : undefined,
                        borderRadius: 4,
                        padding: '0.25rem 0.5rem',
                    }}
                    max={new Date().toISOString().slice(0, 10)}
                />
                {/* NER label filter */}
                <label
                    htmlFor="ner-select"
                    className={`${isPlainScreen ? 'text-white' : ''} whitespace-nowrap`}
                    style={{ marginRight: '0.5rem' }}
                >
                    Filter by NER Label:
                </label>
                <div style={{ flexGrow: 1 }}>
                    <Select
                        id="ner-select"
                        isMulti
                        options={allLabels}
                        value={selectedLabels}
                        onChange={handleLabelChange}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select NER labels to display..."
                        styles={plainScreenSelectStyles}
                    />
                </div>
                {/* Button remains the last item */}
                <Button
                    variant="outline"
                    size="icon"
                    onClick={togglePlainScreen}
                    title={isPlainScreen ? "Exit plain screen" : "Enter plain screen"}
                    style={isPlainScreen ? {
                        backgroundColor: '#2a2a2a',
                        borderColor: '#555',
                        color: 'white'
                    } : {}}
                >
                    {isPlainScreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
                </Button>
            </div>

            {/* Graph container */}
            <div style={{ flexGrow: 1, position: 'relative' }}> {/* Make graph take remaining space */}
                {isClient && networkData ? (
                    <ForceGraph3D
                        graphData={graphData}
                        nodeAutoColorBy="label"
                        nodeVal={node => {
                            // Increase scaling factor for bubble size
                            const degree = (node as CustomNodeObject).degree ?? 1;
                            return Math.max(2, degree * 3); // Make bubbles much bigger for higher degree
                        }}
                        nodeThreeObject={(node): THREE.Object3D => {
                            const customNode = node as CustomNodeObject;
                            if (!customNode.id) {
                                console.warn("Node missing id:", customNode);
                                return new THREE.Object3D();
                            }
                            const nodeVal = customNode.degree ?? 1;
                            // Increase radius scaling for more visible difference
                            const radius = Math.cbrt(Math.max(2, nodeVal * 3)) * 2.5;
                            const geometry = new THREE.SphereGeometry(radius, 16, 8);
                            const material = new THREE.MeshLambertMaterial({
                                color: customNode.color || '#ffffaa',
                                transparent: true,
                                opacity: 0.75
                            });
                            const sphere = new THREE.Mesh(geometry, material);
                            // Pass isPlainScreen to label creation
                            const sprite = createNodeLabelSprite(customNode, isPlainScreen);
                            const spriteScaleMultiplier = radius * 0.5;
                            sprite.scale.multiplyScalar(spriteScaleMultiplier);
                            // Position the label sprite above the bubble
                            sprite.position.set(0, radius + (sprite.scale.y / 2) + 2, 0);
                            const group = new THREE.Group();
                            group.add(sphere);
                            group.add(sprite);
                            customNode.__threeObj = group;
                            return group;
                        }}
                        linkLabel={(link: CustomLinkObject) => {
                            const sourceNode = link.source as CustomNodeObject;
                            const targetNode = link.target as CustomNodeObject;
                            const sourceId = sourceNode?.id ?? 'Unknown Source';
                            const targetId = targetNode?.id ?? 'Unknown Target';
                            const articleTitles = link.articles?.join(', ') ?? 'No articles';
                            // Use light text color for tooltip in dark mode
                            const linkLabelColor = isPlainScreen ? 'color: white;' : '';
                            return `<div style="${linkLabelColor}">${sourceId} &harr; ${targetId}<br/>Articles: ${articleTitles}</div>`;
                        }}
                        linkDirectionalParticles={1}
                        linkDirectionalParticleWidth={1.5}
                        linkWidth={0.5}
                        // Set background based on plain screen mode
                        backgroundColor={isPlainScreen ? '#000000' : 'rgba(0,0,0,0)'}
                        // Ensure graph fills its container
                        height={isPlainScreen ? undefined : undefined} // Let parent div control height
                        width={isPlainScreen ? undefined : undefined} // Let parent div control width
                        onLinkClick={(link: CustomLinkObject, event: MouseEvent) => {
                            // Show article titles in an alert (replace with custom UI as needed)
                            const articleTitles = link.articles?.join(', ') || 'No articles';
                            alert(`Articles for this link: ${articleTitles}`);
                        }}
                    />
                ) : (
                    <div className={isPlainScreen ? 'text-white' : ''}>
                        {fetchError ? fetchError : 'Loading graph data...'}
                    </div>
                )}
            </div>
            {/* Keep original styles for non-plain screen mode */}
            {!isPlainScreen && (
                <style>{`
                    .react-select-container .react-select__control {
                    background-color: var(--background);
                    border-color: var(--border);
                    }
                    .react-select-container .react-select__menu {
                    background-color: var(--background);
                    color: var(--foreground); /* Ensure text color uses variable */
                    }
                    .react-select-container .react-select__option--is-focused {
                    background-color: var(--accent);
                    }
                     .react-select-container .react-select__option--is-selected {
                        background-color: var(--primary); /* Style for selected option */
                        color: var(--primary-foreground);
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
                        background-color: hsl(var(--primary) / 0.8); /* Use HSL variable */
                        color: var(--primary-foreground);
                    }
                    .react-select-container .react-select__input-container {
                        color: var(--foreground);
                    }
                    .react-select-container .react-select__placeholder {
                         color: var(--muted-foreground); /* Style placeholder */
                    }
                     .react-select-container .react-select__single-value {
                         color: var(--foreground); /* Style single selected value */
                    }
                `}</style>
            )}
        </div>
    );
};

export default KeywordNetwork;
