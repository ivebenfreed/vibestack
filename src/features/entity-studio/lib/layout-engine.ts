/**
 * Layout Engine - Graph layout algorithms for better visualization
 * Uses dagre for hierarchical layouts
 */

import dagre from 'dagre'
import type { EntityGraphNode, EntityGraphEdge } from '../types'

const nodeWidth = 300
const nodeHeight = 100

/**
 * Apply hierarchical layout using dagre
 * TB direction with normal edges: source entities go BELOW their targets
 * This puts User/Client at BOTTOM (most referenced)
 */
export function getHierarchicalLayout(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  direction: 'TB' | 'LR' | 'BT' = 'BT'
): EntityGraphNode[] {
  // Create fresh graph instance to avoid accumulation
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 250,      // Vertical spacing between ranks
    nodesep: 150,      // Horizontal spacing between nodes in same rank
    edgesep: 100,      // Edge separation
    ranker: 'longest-path',  // Better ranking algorithm
    marginx: 100,
    marginy: 100
  })

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  // Add edges with normal direction
  // BT puts sources at top and targets at bottom naturally
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Find max X position to mirror horizontally
  let maxX = 0
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    const x = nodeWithPosition.x + nodeWidth / 2
    if (x > maxX) maxX = x
  })

  // Apply calculated positions to nodes with horizontal mirroring
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    return {
      ...node,
      position: {
        x: maxX - (nodeWithPosition.x + nodeWidth / 2),  // Mirror horizontally
        y: nodeWithPosition.y - nodeHeight / 2           // Keep vertical as-is
      }
    }
  })
}

/**
 * Apply force-directed layout (centered grid with slight randomness)
 */
export function getForceLayout(nodes: EntityGraphNode[]): EntityGraphNode[] {
  const columns = Math.ceil(Math.sqrt(nodes.length))
  const spacing = 400

  return nodes.map((node, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)

    // Add slight randomness for organic feel
    const jitterX = (Math.random() - 0.5) * 50
    const jitterY = (Math.random() - 0.5) * 50

    return {
      ...node,
      position: {
        x: col * spacing + jitterX,
        y: row * spacing + jitterY
      }
    }
  })
}

/**
 * Circular layout - arranges nodes in a circle
 */
export function getCircularLayout(nodes: EntityGraphNode[]): EntityGraphNode[] {
  const radius = Math.max(400, nodes.length * 30)
  const center = { x: radius, y: radius }

  return nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI

    return {
      ...node,
      position: {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      }
    }
  })
}
