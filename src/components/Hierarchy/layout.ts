import dagre from "@dagrejs/dagre";
import { Node, Edge } from "reactflow";

const dagreGraph = new dagre.graphlib.Graph();

dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 220;
const nodeHeight = 90;

export function getLayoutedElements(
    nodes: Node[],
    edges: Edge[],
    direction: "TB" | "LR" = "TB"
) {
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: 120,
        nodesep: 80,
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
            width: nodeWidth,
            height: nodeHeight,
        });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const position = dagreGraph.node(node.id);

        return {
            ...node,
            position: {
                x: position.x - nodeWidth / 2,
                y: position.y - nodeHeight / 2,
            },
        };
    });

    return {
        nodes: layoutedNodes,
        edges,
    };
}