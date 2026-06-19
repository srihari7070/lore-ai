import { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant } from 'reactflow';
import NodeCard from './NodeCard.jsx';
import TableNode from './TableNode.jsx';
import ModuleNode from './ModuleNode.jsx';
import RootNode from './RootNode.jsx';
import Breadcrumb from './Breadcrumb.jsx';
import { useGraphStore, graphAtPath } from '../store/graphStore.js';

// React Flow canvas wrapper. Renders the graph at the current drill-down level;
// double-clicking a node opens (drills into) its sub-structure.
export default function Canvas() {
  const rootNodes = useGraphStore((s) => s.nodes);
  const rootEdges = useGraphStore((s) => s.edges);
  const path = useGraphStore((s) => s.path);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const selectNode = useGraphStore((s) => s.selectNode);
  const drillInto = useGraphStore((s) => s.drillInto);

  const { nodes, edges } = useMemo(
    () => graphAtPath(rootNodes, rootEdges, path),
    [rootNodes, rootEdges, path]
  );

  const nodeTypes = useMemo(
    () => ({ lore: NodeCard, table: TableNode, module: ModuleNode, root: RootNode }),
    []
  );

  return (
    <>
      <Breadcrumb />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_e, node) => selectNode(node.type === 'root' ? null : node.id)}
        onNodeDoubleClick={(_e, node) => {
          if (node.type !== 'root') drillInto(node.id);
        }}
        onPaneClick={() => selectNode(null)}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-canvas"
      >
        {/* Blueprint grid: fine minor lines + heavier major lines */}
        <Background id="minor" variant={BackgroundVariant.Lines} gap={24} lineWidth={0.5} color="#141a22" />
        <Background id="major" variant={BackgroundVariant.Lines} gap={120} lineWidth={0.6} color="#1b2530" />
        <Controls className="!bg-node" />
        <MiniMap nodeColor="#5ea9ff" maskColor="rgba(10,11,13,0.75)" pannable zoomable />
      </ReactFlow>
    </>
  );
}
