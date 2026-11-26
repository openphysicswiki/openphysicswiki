import { DependencyGraph, type GraphEntry } from "./graph";

export interface GraphNodeSize { width: number; height: number }

export interface PositionedEntry extends GraphEntry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  path: string;
}

export interface GraphLayout {
  nodes: PositionedEntry[];
  edges: GraphEdge[];
  width: number;
  height: number;
  nodeSize: GraphNodeSize;
}

/**
 * Lay prerequisites out from left to right. Long logical chains therefore use
 * horizontal space (with scrolling) instead of pushing the rest of the page
 * several screenfuls down.
 */
export function layoutGraph(graph: DependencyGraph, visible: Set<string>, compact = false): GraphLayout {
  const layers = graph.layers(visible);
  const nodeSize = compact ? { width: 176, height: 64 } : { width: 200, height: 78 };
  const layerGap = compact ? 34 : 52;
  const rowGap = compact ? 22 : 34;
  const padding = compact ? 26 : 36;
  const rowSize = Math.max(1, ...layers.map((layer) => layer.length));
  const width = Math.max(
    compact ? 560 : 680,
    layers.length * nodeSize.width + Math.max(0, layers.length - 1) * layerGap + padding * 2,
  );
  const height = Math.max(
    compact ? 116 : 140,
    rowSize * nodeSize.height + Math.max(0, rowSize - 1) * rowGap + padding * 2,
  );
  const nodes: PositionedEntry[] = [];

  layers.forEach((layer, layerIndex) => {
    const columnHeight = layer.length * nodeSize.height + (layer.length - 1) * rowGap;
    const startY = (height - columnHeight) / 2;
    layer.forEach((slug, index) => {
      const entry = graph.byId.get(slug)!;
      nodes.push({
        ...entry,
        x: padding + layerIndex * (nodeSize.width + layerGap) + nodeSize.width / 2,
        y: startY + index * (nodeSize.height + rowGap) + nodeSize.height / 2,
        width: nodeSize.width,
        height: nodeSize.height,
      });
    });
  });

  const positions = new Map(nodes.map((node) => [node.slug, node]));
  const edges: GraphEdge[] = [];
  for (const target of nodes) {
    for (const sourceId of target.dependencies) {
      if (!visible.has(sourceId)) continue;
      const source = positions.get(sourceId)!;
      const x1 = source.x + source.width / 2;
      const y1 = source.y;
      const x2 = target.x - target.width / 2;
      const y2 = target.y;
      const bend = Math.max(16, (x2 - x1) / 2);
      const path = Math.abs(y2 - y1) < 1
        ? `M ${x1} ${y1} L ${x2 - 5} ${y2}`
        : `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2 - 5} ${y2}`;
      edges.push({ source: sourceId, target: target.slug, path });
    }
  }

  return { nodes, edges, width, height, nodeSize };
}

export function wrapTitle(title: string, maxLength = 25): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= 3) return lines;
  return [lines[0], lines[1], `${lines.slice(2).join(" ").slice(0, maxLength - 1)}…`];
}
