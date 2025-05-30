import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { NodeObject, LinkObject } from 'react-force-graph-3d';
import Select from 'react-select';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { MinimizeIcon } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface NerEntity {
    entity: string;
    label: string;
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

interface CustomNodeObject extends NodeObject {
    id: string;
    label: string;
    degree?: number;
    color?: string;
    __threeObj?: THREE.Object3D;
}
interface CustomLinkObject extends LinkObject {
    source: string | number | CustomNodeObject;
    target: string | number | CustomNodeObject;
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

interface Provider {
    id: string;
    builtin: boolean;
    language: string;
    url: string[];
    country: string;
}

const KeywordNetwork: React.FC = () => {
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [selectedLabels, setSelectedLabels] = useState<SelectOption[]>([]);
    const [allLabels, setAllLabels] = useState<SelectOption[]>([]);
    const [selectedProviders, setSelectedProviders] = useState<SelectOption[]>([]);
    const [allProviders, setAllProviders] = useState<SelectOption[]>([]);
    const [isClient, setIsClient] = useState(false);
    const [isPlainScreen, setIsPlainScreen] = useState(false);
    const [showVisualization, setShowVisualization] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        return today.toISOString().slice(0, 10);
    });
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [linkDetails, setLinkDetails] = useState<CustomLinkObject | null>(null);
    const [articleDetails, setArticleDetails] = useState<Article[]>([]);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingLabels, setIsLoadingLabels] = useState(false);

    const defaultProviders = [
        'BBC News',
        'CNN',
        'New York Times',
        'Al Jazeera',
        'The Guardian',
        'France 24',
        'DW News',
        'NPR',
        'The Times of India',
        'South China Morning Post',
        'The Japan Times',
        'El País',
        'Le Monde',
        'Der Spiegel'
    ];

    useEffect(() => {
        setIsClient(true);
        fetch('/data/providers.json')
            .then(response => response.json())
            .then((providers: Provider[]) => {
                const providerOptions = providers.map(provider => ({
                    value: provider.id,
                    label: provider.id
                }));
                setAllProviders(providerOptions);

                const defaultSelected = providerOptions.filter(option =>
                    defaultProviders.includes(option.value)
                );
                setSelectedProviders(defaultSelected);
            })
            .catch(error => {
                console.error('Error loading providers:', error);
                const fallbackProviders = defaultProviders.map(provider => ({
                    value: provider,
                    label: provider
                }));
                setAllProviders(fallbackProviders);
                setSelectedProviders(fallbackProviders);
            });
    }, []);

    const loadNerLabels = () => {
        setIsLoadingLabels(true);
        setFetchError(null);
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
                const labels = new Set<string>();
                data.data.forEach(article => {
                    article.ner.forEach(entity => labels.add(entity.label));
                });
                setAllLabels(Array.from(labels).sort().map(label => ({ value: label, label })));
                setIsLoadingLabels(false);
            })
            .catch(error => {
                setFetchError("No data for this date. Please select another date.");
                setIsLoadingLabels(false);
                console.error("Error fetching NER labels:", error);
            });
    };

    const loadArticlesData = (filterByProviders: boolean = false) => {
        setIsLoading(true);
        setFetchError(null);
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
                let filteredData = data.data;

                if (filterByProviders && selectedProviders.length > 0) {
                    const selectedProviderIds = selectedProviders.map(p => p.value);
                    filteredData = filteredData.filter(article =>
                        selectedProviderIds.includes(article.providerId)
                    );
                }

                const processedData = {
                    ...data,
                    data: filteredData
                };

                setNetworkData(processedData);
                setShowVisualization(true);
                setIsPlainScreen(true);
                setIsLoading(false);
            })
            .catch(error => {
                setNetworkData(null);
                setFetchError("No data for this date. Please select another date.");
                setIsLoading(false);
                console.error("Error fetching network data:", error);
            });
    };

    // Process articles into graph nodes and links based on shared entities
    const graphData = useMemo<GraphData>(() => {
        if (!networkData) return { nodes: [], links: [] };

        const nodesMap = new Map<string, CustomNodeObject>();
        const links: CustomLinkObject[] = [];
        const activeLabels = new Set(selectedLabels.map(opt => opt.value));
        const nodeDegrees = new Map<string, number>();

        networkData.data.forEach(article => {
            const articleEntities = article.ner
                .filter(entity => activeLabels.size === 0 || activeLabels.has(entity.label));

            articleEntities.forEach(entity => {
                if (!nodesMap.has(entity.entity)) {
                    nodesMap.set(entity.entity, { id: entity.entity, label: entity.label, degree: 0 });
                }
            });

            // Create links between entities that appear in the same article
            for (let i = 0; i < articleEntities.length; i++) {
                for (let j = i + 1; j < articleEntities.length; j++) {
                    const source = articleEntities[i].entity;
                    const target = articleEntities[j].entity;
                    const linkKey = [source, target].sort().join('--');
                    const existingLinkIndex = links.findIndex(l => {
                        const linkSourceId = typeof l.source === 'object' && l.source !== null && 'id' in l.source ? l.source.id : l.source;
                        const linkTargetId = typeof l.target === 'object' && l.target !== null && 'id' in l.target ? l.target.id : l.target;
                        return [linkSourceId, linkTargetId].sort().join('--') === linkKey;
                    });

                    if (existingLinkIndex === -1) {
                        links.push({ source: source, target: target, articles: [article.title] });
                        nodeDegrees.set(source, (nodeDegrees.get(source) || 0) + 1);
                        nodeDegrees.set(target, (nodeDegrees.get(target) || 0) + 1);
                    } else {
                        if (!links[existingLinkIndex].articles.includes(article.title)) {
                            links[existingLinkIndex].articles.push(article.title);
                        }
                    }
                }
            }
        });

        nodeDegrees.forEach((degree, nodeId) => {
            const node = nodesMap.get(nodeId);
            if (node) {
                node.degree = degree;
            }
        });

        // Only include nodes that have connections
        const nodesInLinks = new Set<string>();
        links.forEach(link => {
            const sourceId = typeof link.source === 'object' && link.source !== null && 'id' in link.source ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' && link.target !== null && 'id' in link.target ? link.target.id : link.target;
            nodesInLinks.add(sourceId as string);
            nodesInLinks.add(targetId as string);
        });

        const filteredNodes = Array.from(nodesMap.values())
            .filter(node => nodesInLinks.has(node.id))
            .map(node => ({ ...node, degree: node.degree ?? 0 }));

        return { nodes: filteredNodes, links: links as CustomLinkObject[] };
    }, [networkData, selectedLabels]);

    const handleLabelChange = (selectedOptions: readonly SelectOption[] | null) => {
        setSelectedLabels(selectedOptions ? Array.from(selectedOptions) : []);
    };

    const handleProviderChange = (selectedOptions: readonly SelectOption[] | null) => {
        setSelectedProviders(selectedOptions ? Array.from(selectedOptions) : []);
    };

    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        setAllLabels([]);
        setSelectedLabels([]);
        setFetchError(null);
    };

    // Create 3D text sprite for node labels with adaptive sizing
    const createNodeLabelSprite = (node: CustomNodeObject, isDarkMode: boolean): THREE.Sprite => {
        const sprite = new THREE.Sprite() as any;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return sprite;

        const degree = node.degree ?? 1;
        const nodeVal = Math.max(2, degree * 3);
        const nodeRadius = Math.cbrt(nodeVal) * 2.5;
        
        const baseFontSize = 16;
        const fontSize = Math.max(12, Math.min(32, baseFontSize + (nodeRadius * 0.8)));
        
        const fontWeight = 'bold';
        const fontFamily = 'sans-serif';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const text = node.id;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;

        const baseScale = Math.max(0.08, Math.min(0.15, 0.1 + (nodeRadius * 0.002)));
        const padding = Math.max(4, fontSize * 0.25);
        const canvasWidth = textWidth + padding * 2;
        const canvasHeight = fontSize + padding * 2;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.fillStyle = isDarkMode ? 'white' : 'dark';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            depthWrite: false,
            transparent: true,
        });
        sprite.material = material;

        sprite.scale.set(canvasWidth * baseScale, canvasHeight * baseScale, 1.0);

        sprite.nodeId = node.id;

        return sprite;
    };

    const togglePlainScreen = () => {
        if (isPlainScreen) {
            setIsPlainScreen(false);
            setShowVisualization(false);
            setNetworkData(null);
        } else {
            setIsPlainScreen(!isPlainScreen);
        }
    };

    const handleLoadAllArticles = () => {
        loadArticlesData();
    };

    const handleLoadSelectedProviders = () => {
        loadArticlesData(true);
    };

    const getArticlesForLink = (link: CustomLinkObject): Article[] => {
        if (!networkData) return [];
        return networkData.data.filter(article => link.articles.includes(article.title));
    };

    // Dark theme styles for visualization mode
    const plainScreenSelectStyles = isPlainScreen ? {
        control: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: '#1a1a1a',
            borderColor: '#444',
        }),
        menu: (baseStyles: any) => ({
            ...baseStyles,
            backgroundColor: '#1a1a1a',
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
            backgroundColor: '#007bff',
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
            color: '#ccc',
        }),
    } : {};

    return (
        <>
            {!showVisualization ? (
                <div className="container mx-auto px-4 py-8">
                    <div className="mb-6">
                        <label htmlFor="date-picker" className="block text-sm font-medium mb-2">
                            Select Date:
                        </label>
                        <input
                            id="date-picker"
                            type="date"
                            value={selectedDate}
                            onChange={e => handleDateChange(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                            max={new Date().toISOString().slice(0, 10)}
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="provider-select" className="block text-sm font-medium mb-2">
                            Select Providers:
                        </label>
                        <Select
                            id="provider-select"
                            isMulti
                            options={allProviders}
                            value={selectedProviders}
                            onChange={handleProviderChange}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="Select providers to include..."
                        />
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center gap-4 mb-2">
                            <label htmlFor="ner-select" className="block text-sm font-medium">
                                Filter by NER Labels (Optional):
                            </label>
                            <Button
                                onClick={loadNerLabels}
                                disabled={isLoadingLabels}
                                variant="outline"
                                size="sm"
                            >
                                {isLoadingLabels ? 'Loading...' : 'Load Available Labels'}
                            </Button>
                        </div>
                        <Select
                            id="ner-select"
                            isMulti
                            options={allLabels}
                            value={selectedLabels}
                            onChange={handleLabelChange}
                            className="react-select-container"
                            classNamePrefix="react-select"
                            placeholder="First load labels, then select NER labels to filter..."
                            isDisabled={allLabels.length === 0}
                        />
                        {allLabels.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {allLabels.length} labels available. Leave empty to show all entities.
                            </p>
                        )}
                    </div>

                    {fetchError && (
                        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                            {fetchError}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <Button
                            onClick={handleLoadSelectedProviders}
                            disabled={isLoading}
                            className="px-6 py-3 text-lg"
                        >
                            {isLoading ? 'Loading...' : 'Load Selected Providers'}
                        </Button>

                        <Button
                            onClick={handleLoadAllArticles}
                            disabled={isLoading}
                            variant="outline"
                            className="px-6 py-3 text-lg"
                        >
                            {isLoading ? 'Loading...' : 'Load All Articles (Requires Good Computer)'}
                        </Button>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <p>• <strong>Load All Articles:</strong> Visualize the complete network of all articles for the selected date (requires good computer)</p>
                        <p>• <strong>Load Selected Providers:</strong> Visualize only articles from major news providers (BBC, CNN, NYT, Al Jazeera, Guardian, etc.)</p>
                        <p>• <strong>NER Filtering:</strong> Optionally filter entities by their types (PERSON, ORG, LOC, etc.) to focus on specific categories</p>

                        <div className="mt-3 p-3 bg-gray-50 rounded border">
                            <p className="font-medium mb-2">Selected Providers ({selectedProviders.length}):</p>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                                {selectedProviders.map(provider => (
                                    <span key={provider.value} className="text-gray-700">• {provider.label}</span>
                                ))}
                            </div>
                            {selectedLabels.length > 0 && (
                                <>
                                    <p className="font-medium mb-2 mt-3">Selected NER Labels ({selectedLabels.length}):</p>
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                        {selectedLabels.map(label => (
                                            <span key={label.value} className="text-blue-700">• {label.label}</span>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                // Full-screen visualization mode
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: '#000',
                        zIndex: 1000,
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div style={{
                        marginBottom: '1rem',
                        zIndex: 1001,
                        position: 'relative',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        flexShrink: 0,
                        padding: '0 1rem',
                        flexWrap: 'wrap',
                    }}>
                        <div className="text-white text-sm">
                            <span className="font-medium">Date: </span>
                            <span className="text-blue-300">{new Date(selectedDate).toLocaleDateString()}</span>
                        </div>
                        
                        <div className="text-white text-sm">
                            <span className="font-medium">Providers ({selectedProviders.length}): </span>
                            <span className="text-green-300">
                                {selectedProviders.length > 0 
                                    ? selectedProviders.map(provider => provider.label).join(', ')
                                    : 'All providers'
                                }
                            </span>
                        </div>

                        {selectedLabels.length > 0 && (
                            <div className="text-white text-sm">
                                <span className="font-medium">NER Filter: </span>
                                <span className="text-blue-300">
                                    {selectedLabels.map(label => label.label).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePlainScreen}
                        title="Exit visualization"
                        style={{
                            position: 'fixed',
                            top: '1rem',
                            right: '1rem',
                            backgroundColor: '#2a2a2a',
                            borderColor: '#555',
                            color: 'white',
                            zIndex: 1002
                        }}
                    >
                        <MinimizeIcon className="h-4 w-4" />
                    </Button>

                    <div style={{ flexGrow: 1, position: 'relative' }}>
                        {isClient && networkData ? (
                            <ForceGraph3D
                                graphData={graphData}
                                nodeAutoColorBy="label"
                                nodeVal={node => {
                                    const degree = (node as CustomNodeObject).degree ?? 1;
                                    return Math.max(2, degree * 3);
                                }}
                                nodeThreeObject={(node): THREE.Object3D => {
                                    const customNode = node as CustomNodeObject;
                                    if (!customNode.id) {
                                        console.warn("Node missing id:", customNode);
                                        return new THREE.Object3D();
                                    }
                                    const nodeVal = customNode.degree ?? 1;
                                    const radius = Math.cbrt(Math.max(2, nodeVal * 3)) * 2.5;
                                    const geometry = new THREE.SphereGeometry(radius, 16, 8);
                                    const material = new THREE.MeshLambertMaterial({
                                        color: customNode.color || '#ffffaa',
                                        transparent: true,
                                        opacity: 0.75
                                    });
                                    const sphere = new THREE.Mesh(geometry, material);
                                    const sprite = createNodeLabelSprite(customNode, true);
                                    
                                    const spriteScaleMultiplier = Math.max(0.8, Math.min(1.5, radius * 0.4));
                                    sprite.scale.multiplyScalar(spriteScaleMultiplier);
                                    
                                    const verticalOffset = radius + (sprite.scale.y / 2) + Math.max(2, radius * 0.3);
                                    sprite.position.set(0, verticalOffset, 0);
                                    
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
                                    return `<div style="color: white;">${sourceId} &harr; ${targetId}<br/>Articles: ${articleTitles}</div>`;
                                }}
                                linkDirectionalParticles={1}
                                linkDirectionalParticleWidth={1.5}
                                linkWidth={0.5}
                                backgroundColor="#000000"
                                onLinkClick={(link: CustomLinkObject, event: MouseEvent) => {
                                    setLinkDetails(link);
                                    setArticleDetails(getArticlesForLink(link));
                                    setShowLinkDialog(true);
                                }}
                            />
                        ) : (
                            <div className="text-white">
                                {fetchError ? fetchError : 'Loading graph data...'}
                            </div>
                        )}
                    </div>

                    {showLinkDialog && linkDetails && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0,0,0,0.6)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                            onClick={() => setShowLinkDialog(false)}
                        >
                            <div style={{
                                background: '#222',
                                color: 'white',
                                borderRadius: 12,
                                padding: 32,
                                minWidth: 400,
                                maxWidth: 600,
                                boxShadow: '0 4px 32px #000a',
                                position: 'relative',
                            }} onClick={e => e.stopPropagation()}>
                                <button
                                    style={{
                                        position: 'absolute',
                                        top: 12,
                                        right: 16,
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#fff',
                                        fontSize: 24,
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => setShowLinkDialog(false)}
                                    aria-label="Close"
                                >×</button>
                                <h2 style={{ marginBottom: 12, fontSize: 22, fontWeight: 700 }}>
                                    Link: {((linkDetails.source as CustomNodeObject)?.id ?? linkDetails.source)} &harr; {((linkDetails.target as CustomNodeObject)?.id ?? linkDetails.target)}
                                </h2>
                                <div style={{ marginBottom: 16 }}>
                                    <strong>Articles ({articleDetails.length}):</strong><br /><br />
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                        {articleDetails.map(article => (
                                            <li key={article.id} style={{ marginBottom: 18, borderBottom: '1px solid #444', paddingBottom: 10 }}>
                                                <div style={{ fontWeight: 600, fontSize: 17 }}>{article.title}</div>
                                                <div style={{ fontSize: 14, color: '#ccc', margin: '4px 0' }}>{article.description}</div>
                                                <div style={{ fontSize: 13, color: '#aaa' }}>
                                                    <span>Provider: {article.providerId}</span>
                                                </div>
                                                <div style={{ fontSize: 13, color: '#aaa' }}>
                                                    <span>Published: {formatDistanceToNow(parseISO(article.createdAt), { addSuffix: true })}</span>
                                                </div>
                                                <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4ea1ff', fontSize: 14, textDecoration: 'underline' }}>Read full article</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default KeywordNetwork;
