import React, { useState, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { NodeObject, LinkObject } from 'react-force-graph-3d';
import Select from 'react-select';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { MaximizeIcon, MinimizeIcon } from 'lucide-react';
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

const KeywordNetwork: React.FC = () => {
    const [networkData, setNetworkData] = useState<NetworkData | null>(null);
    const [selectedLabels, setSelectedLabels] = useState<SelectOption[]>([]);
    const [allLabels, setAllLabels] = useState<SelectOption[]>([]);
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

    useEffect(() => {
        setIsClient(true);
    }, []);

    const loadArticlesData = (limitTo100: boolean = false) => {
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
                const processedData = limitTo100 ? {
                    ...data,
                    data: data.data.slice(0, 100)
                } : data;

                setNetworkData(processedData);
                const labels = new Set<string>();
                processedData.data.forEach(article => {
                    article.ner.forEach(entity => labels.add(entity.label));
                });
                setAllLabels(Array.from(labels).sort().map(label => ({ value: label, label })));

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

    const createNodeLabelSprite = (node: CustomNodeObject, isDarkMode: boolean): THREE.Sprite => {
        const sprite = new THREE.Sprite() as any;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return sprite;

        const fontSize = 24;
        const fontWeight = 'bold';
        const fontFamily = 'sans-serif';
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const text = node.id;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;

        const baseScale = 0.1;
        const padding = 6;
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
        loadArticlesData(false);
    };

    const handleLoadFirst100 = () => {
        loadArticlesData(true);
    };

    const getArticlesForLink = (link: CustomLinkObject): Article[] => {
        if (!networkData) return [];
        return networkData.data.filter(article => link.articles.includes(article.title));
    };

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
                            onChange={e => setSelectedDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                            max={new Date().toISOString().slice(0, 10)}
                        />
                    </div>

                    {fetchError && (
                        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                            {fetchError}
                        </div>
                    )}

                    <div className="flex gap-4">
                        <Button
                            onClick={handleLoadAllArticles}
                            disabled={isLoading}
                            className="px-6 py-3 text-lg"
                        >
                            {isLoading ? 'Loading...' : 'Load All Articles'}
                        </Button>

                        <Button
                            onClick={handleLoadFirst100}
                            disabled={isLoading}
                            variant="outline"
                            className="px-6 py-3 text-lg"
                        >
                            {isLoading ? 'Loading...' : 'Load First 100 Articles'}
                        </Button>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <p>• <strong>Load All Articles:</strong> Visualize the complete network of all articles for the selected date</p>
                        <p>• <strong>Load First 100 Articles:</strong> Visualize a subset for faster performance</p>
                    </div>
                </div>
            ) : (
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
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexShrink: 0,
                        padding: '0 1rem',
                    }}>
                        <label
                            htmlFor="date-picker"
                            className="text-white whitespace-nowrap"
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
                                background: '#1a1a1a',
                                color: 'white',
                                border: '1px solid #444',
                                borderRadius: 4,
                                padding: '0.25rem 0.5rem',
                            }}
                            max={new Date().toISOString().slice(0, 10)}
                        />
                        <label
                            htmlFor="ner-select"
                            className="text-white whitespace-nowrap"
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
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={togglePlainScreen}
                            title="Exit visualization"
                            style={{
                                backgroundColor: '#2a2a2a',
                                borderColor: '#555',
                                color: 'white'
                            }}
                        >
                            <MinimizeIcon className="h-4 w-4" />
                        </Button>
                    </div>

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
                                    const spriteScaleMultiplier = radius * 0.5;
                                    sprite.scale.multiplyScalar(spriteScaleMultiplier);
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
