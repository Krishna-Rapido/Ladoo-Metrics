import { useRef, useCallback, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import Plot from 'react-plotly.js';
import type { SankeyData, SankeyNodeMeta, SankeyLinkMeta } from '@/lib/api';
import { Button } from '@/components/ui/button';

export type NodeClickInfo = SankeyNodeMeta;
export type LinkClickInfo = SankeyLinkMeta;

export interface PlotlySankeyProps {
    data: SankeyData;
    onNodeClick?: (info: NodeClickInfo) => void;
    onLinkClick?: (info: LinkClickInfo) => void;
}

const DEFAULT_HEIGHT = 550;
const FULLSCREEN_HEIGHT = typeof window !== 'undefined' ? Math.max(400, window.innerHeight - 120) : 700;

export function PlotlySankey({ data, onNodeClick, onLinkClick }: PlotlySankeyProps) {
    const plotRef = useRef<any>(null);
    const [fullscreen, setFullscreen] = useState(false);

    const handleClick = useCallback(
        (event: any) => {
            if (!event?.points?.[0]) return;
            const point = event.points[0];
            // Plotly sankey: link has source/target, node has pointNumber
            if (point.source !== undefined && point.target !== undefined) {
                // Link click
                const linkIdx = point.pointNumber;
                if (linkIdx != null && data.link_meta[linkIdx]) {
                    onLinkClick?.(data.link_meta[linkIdx]);
                }
            } else if (point.pointNumber !== undefined) {
                // Node click
                const nodeIdx = point.pointNumber;
                if (nodeIdx != null && data.node_meta[nodeIdx]) {
                    onNodeClick?.(data.node_meta[nodeIdx]);
                }
            }
        },
        [data, onNodeClick, onLinkClick]
    );

    if (!data || !data.node_labels?.length) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                No transition data available for Sankey diagram
            </div>
        );
    }

    const plotData: any[] = [
        {
            type: 'sankey',
            orientation: 'h',
            arrangement: 'snap',
            node: {
                pad: 20,
                thickness: 30,
                line: { color: 'black', width: 0.5 },
                label: data.node_labels,
                color: data.node_colors,
                x: data.node_x,
                y: data.node_y,
                hovertemplate: '%{label}<extra></extra>',
            },
            link: {
                source: data.link_source,
                target: data.link_target,
                value: data.link_value,
                color: data.link_color,
                hovertemplate: 'Count: %{value:,}<extra></extra>',
            },
        },
    ];

    const layout: any = {
        font: { size: 11, family: 'Inter, system-ui, sans-serif' },
        margin: { l: 10, r: 10, t: 30, b: 30 },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        height: fullscreen ? FULLSCREEN_HEIGHT : DEFAULT_HEIGHT,
        dragmode: 'pan',
        xaxis: { fixedrange: false },
        yaxis: { fixedrange: false },
    };

    const config: any = {
        displayModeBar: true,
        responsive: true,
        scrollZoom: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        modeBarButtonsToAdd: ['zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
    };

    const plotEl = (
        <Plot
            ref={plotRef}
            data={plotData}
            layout={layout}
            config={config}
            style={{ width: '100%', minHeight: fullscreen ? FULLSCREEN_HEIGHT : DEFAULT_HEIGHT }}
            onClick={handleClick}
            useResizeHandler
        />
    );

    return (
        <div className="w-full relative">
            <div className="absolute top-2 right-2 z-10">
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5 shadow-sm"
                    onClick={() => setFullscreen((f) => !f)}
                >
                    {fullscreen ? (
                        <>
                            <Minimize2 className="h-4 w-4" />
                            Exit full screen
                        </>
                    ) : (
                        <>
                            <Maximize2 className="h-4 w-4" />
                            Full screen
                        </>
                    )}
                </Button>
            </div>
            {fullscreen ? (
                <div className="fixed inset-0 z-50 bg-background flex flex-col items-stretch p-4">
                    <div className="flex-1 min-h-0 w-full rounded-lg border bg-card overflow-auto">
                        {plotEl}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-4 justify-center shrink-0 py-2">
                        {data.segments?.length
                            ? data.segments.map((segment, i) => (
                                  <div key={segment} className="flex items-center gap-2">
                                      <div
                                          className="w-4 h-4 rounded"
                                          style={{ backgroundColor: data.segment_colors?.[i] ?? '#ccc' }}
                                      />
                                      <span className="text-sm capitalize">{segment}</span>
                                  </div>
                              ))
                            : null}
                    </div>
                    <p className="text-xs text-muted-foreground text-center pb-2">
                        Drag to pan, scroll to zoom. Click a node or edge to view captains.
                    </p>
                </div>
            ) : (
                <>
                    {plotEl}
                    {data.segments?.length > 0 && (
                        <div className="flex flex-wrap gap-4 mt-4 justify-center">
                            {data.segments.map((segment, i) => (
                                <div key={segment} className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: data.segment_colors?.[i] ?? '#ccc' }}
                                    />
                                    <span className="text-sm capitalize">{segment}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                        Drag to pan, scroll to zoom. Click a node or edge to view captains in that segment or transition.
                    </p>
                </>
            )}
        </div>
    );
}
