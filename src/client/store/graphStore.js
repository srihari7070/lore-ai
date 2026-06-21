import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';

let idCounter = 1;
const nextId = () => `n${idCounter++}`;

// ── Hierarchical graph helpers ─────────────────────────────────────────────
// The map is a tree of graphs: every node may hold a child graph in
// node.data.children = { nodes, edges }. `path` is the list of node ids the
// user has drilled into. These pure helpers read/write the graph at a path.

export function graphAtPath(rootNodes, rootEdges, path) {
  let nodes = rootNodes;
  let edges = rootEdges;
  for (const id of path) {
    const n = nodes.find((x) => x.id === id);
    const c = n?.data?.children;
    nodes = c?.nodes || [];
    edges = c?.edges || [];
  }
  return { nodes, edges };
}

function withGraphAtPath(rootNodes, rootEdges, path, newGraph) {
  if (path.length === 0) return { nodes: newGraph.nodes, edges: newGraph.edges };
  const [head, ...rest] = path;
  const nodes = rootNodes.map((n) => {
    if (n.id !== head) return n;
    const child = n.data.children || { nodes: [], edges: [] };
    const updated = withGraphAtPath(child.nodes, child.edges, rest, newGraph);
    return { ...n, data: { ...n.data, children: updated } };
  });
  return { nodes, edges: rootEdges };
}

// Lay out a fresh set of nodes in a loose grid so they don't overlap.
function layout(nodes) {
  const perRow = 3;
  const gapX = 320;
  const gapY = 220;
  return nodes.map((node, i) => ({
    ...node,
    position: node.position || {
      x: (i % perRow) * gapX + 80,
      y: Math.floor(i / perRow) * gapY + 80,
    },
  }));
}

// Recursively turn an AI payload (nodes with optional children) into RF nodes.
// Pick the React Flow renderer for a node based on its detailType.
function rendererFor(detailType) {
  if (detailType === 'table') return 'table';
  if (detailType === 'module' || detailType === 'file') return 'module';
  return 'lore';
}

function buildNodes(rawNodes = []) {
  const rf = layout(
    rawNodes.map((n) => ({
      id: nextId(),
      type: rendererFor(n.detailType),
      position: null,
      data: {
        title: n.title || 'Untitled',
        nodeType: n.type || 'custom',
        detailType: n.detailType || null, // 'database' | 'backend' | 'frontend' | 'table' | 'module' | ...
        status: 'empty',
        dump: '',
        notes: n.notes || '',
        rationale: n.rationale || '',
        stack: n.stack || [],
        fields: n.fields || null, // table columns (for ER view)
        subNodes: [],
        children: n.children ? buildGraph(n.children) : null,
      },
    }))
  );
  return rf;
}

function edgeStyle(label) {
  return {
    label: label || 'relates to',
    animated: true,
    style: { stroke: '#5ea9ff' },
    labelStyle: { fill: '#e6e8eb', fontSize: 11, fontFamily: 'JetBrains Mono' },
    labelBgStyle: { fill: '#15181e' },
  };
}

// Build a {nodes, edges} graph from raw {nodes, edges} (edges by node title).
function buildGraph(raw = {}) {
  const nodes = buildNodes(raw.nodes || []);
  const titleToId = {};
  nodes.forEach((n) => {
    titleToId[n.data.title] = n.id;
  });
  const edges = (raw.edges || [])
    .filter((e) => titleToId[e.from] && titleToId[e.to])
    .map((e, i) => ({
      id: `e${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: titleToId[e.from],
      target: titleToId[e.to],
      ...edgeStyle(e.label),
    }));
  return { nodes, edges };
}

export const useGraphStore = create((set, get) => ({
  config: { mode: 'plan', projectName: '', model: '', hasBlueprint: false },
  nodes: [],
  edges: [],
  path: [], // drill-down stack of node ids
  decisions: [],
  openQuestions: [],
  summary: '',
  selectedNodeId: null,
  compiledMarkdown: null,

  // Build / commit state
  builderModel: 'claude-sonnet-4-6',
  committed: null,
  buildResult: null,
  handoffResult: null,
  buildProgress: null, // { active, percent, phase, lastAction, activities[], startedAt }

  setConfig: (config) => set({ config }),
  setBuilderModel: (builderModel) => set({ builderModel }),
  setBuildResult: (buildResult) => set({ buildResult }),
  setHandoffResult: (handoffResult) => set({ handoffResult }),
  setBuildProgress: (patch) =>
    set({ buildProgress: patch === null ? null : { ...(get().buildProgress || {}), ...patch } }),
  pushActivity: (action) => {
    const bp = get().buildProgress;
    if (!bp) return;
    const activities = [...(bp.activities || []), action].slice(-50);
    // Activity-driven bar: ramps toward ~92% with each action, then 100% on done.
    const percent = Math.min(92, 14 + activities.length * 4);
    set({ buildProgress: { ...bp, activities, lastAction: action, percent } });
  },
  markCommitted: () => set({ committed: get().serializeGraph() }),

  // Build the canvas from an AI-generated plan/scan payload (supports nesting).
  // The top level is arranged as a TREE: a bold project root at the top with
  // every top-level node hanging beneath it.
  loadGraph: ({ summary, nodes = [], edges = [], decisions = [] }) => {
    const { nodes: rfNodes, edges: rfEdges } = buildGraph({ nodes, edges });

    // Position the top-level nodes in rows beneath the root.
    const perRow = 4;
    const gapX = 280;
    const gapY = 200;
    rfNodes.forEach((n, i) => {
      n.position = { x: (i % perRow) * gapX, y: 180 + Math.floor(i / perRow) * gapY };
    });

    // Inject the project root node, centered above the first row.
    const rootId = nextId();
    const rowCount = Math.min(rfNodes.length, perRow);
    const rootNode = {
      id: rootId,
      type: 'root',
      position: { x: Math.max(0, (rowCount * gapX) / 2 - 90), y: 0 },
      data: {
        title: get().config.projectName || 'Project',
        subtitle: 'architecture',
        isRoot: true,
      },
    };

    // Connect the root to every top-level node (the tree edges).
    const treeEdges = rfNodes.map((n, i) => ({
      id: `root-${i}-${Date.now()}`,
      source: rootId,
      target: n.id,
      style: { stroke: 'rgba(94,169,255,0.45)', strokeWidth: 1 },
    }));

    set({
      summary: summary || '',
      nodes: [rootNode, ...rfNodes],
      edges: [...rfEdges, ...treeEdges],
      path: [],
      selectedNodeId: null,
      decisions: (decisions || []).map((text, i) => ({ id: `d${i}`, text, answered: false })),
    });

    // A scan/deep/sync map describes code that ALREADY exists, so seed the
    // committed baseline to the freshly loaded map. Then a build sends only the
    // delta the user edits — not "rebuild everything". Plan mode stays unseeded
    // so its first build can scaffold a brand-new project from scratch.
    if (get().config.mode !== 'plan') {
      set({ committed: get().serializeGraph() });
    }
  },

  // ── Drill-down navigation ────────────────────────────────────────────────
  drillInto: (id) => set({ path: [...get().path, id], selectedNodeId: null }),
  drillUp: () => set({ path: get().path.slice(0, -1), selectedNodeId: null }),
  drillTo: (index) => set({ path: get().path.slice(0, index), selectedNodeId: null }), // index 0 = root
  // Resolve breadcrumb titles for the current path.
  breadcrumb: () => {
    const { nodes, edges, path } = get();
    const crumbs = [];
    let level = { nodes, edges };
    for (const id of path) {
      const n = level.nodes.find((x) => x.id === id);
      crumbs.push({ id, title: n?.data?.title || '…' });
      level = n?.data?.children || { nodes: [], edges: [] };
    }
    return crumbs;
  },

  // ── Path-aware graph mutations (operate on the current level) ─────────────
  onNodesChange: (changes) => {
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const next = { nodes: applyNodeChanges(changes, cur.nodes), edges: cur.edges };
    set(withGraphAtPath(nodes, edges, path, next));
  },
  onEdgesChange: (changes) => {
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const next = { nodes: cur.nodes, edges: applyEdgeChanges(changes, cur.edges) };
    set(withGraphAtPath(nodes, edges, path, next));
  },
  onConnect: (connection) => {
    const label = window.prompt('Label this connection (e.g. "calls", "reads from"):', 'calls') || '';
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const next = { nodes: cur.nodes, edges: addEdge({ ...connection, ...edgeStyle(label) }, cur.edges) };
    set(withGraphAtPath(nodes, edges, path, next));
  },

  addNode: (partial = {}) => {
    const id = nextId();
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const offset = cur.nodes.length * 24;
    const newNode = {
      id,
      type: 'lore',
      position: { x: 120 + offset, y: 120 + offset },
      data: {
        title: partial.title || 'New Node',
        nodeType: partial.nodeType || 'custom',
        detailType: null,
        status: 'empty',
        dump: '',
        notes: '',
        rationale: '',
        stack: [],
        subNodes: [],
        children: null,
      },
    };
    set(withGraphAtPath(nodes, edges, path, { nodes: [...cur.nodes, newNode], edges: cur.edges }));
    set({ selectedNodeId: id });
    return id;
  },

  updateNodeData: (id, patch) => {
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const next = {
      nodes: cur.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      edges: cur.edges,
    };
    set(withGraphAtPath(nodes, edges, path, next));
  },

  removeNode: (id) => {
    const { nodes, edges, path } = get();
    const cur = graphAtPath(nodes, edges, path);
    const next = {
      nodes: cur.nodes.filter((n) => n.id !== id),
      edges: cur.edges.filter((e) => e.source !== id && e.target !== id),
    };
    set(withGraphAtPath(nodes, edges, path, next));
    if (get().selectedNodeId === id) set({ selectedNodeId: null });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleDecision: (id) =>
    set({
      decisions: get().decisions.map((d) => (d.id === id ? { ...d, answered: !d.answered } : d)),
    }),

  setOpenQuestions: (openQuestions) => set({ openQuestions }),
  setCompiled: (compiledMarkdown) => set({ compiledMarkdown }),

  // Serialize the WHOLE tree (all levels) for compile/build.
  serializeGraph: () => {
    const { nodes, edges, summary, decisions } = get();
    const serializeLevel = (lvlNodes, lvlEdges) => {
      // The injected project root is presentation only — never part of the spec.
      const real = lvlNodes.filter((n) => n.type !== 'root' && !n.data.isRoot);
      const idToTitle = {};
      real.forEach((n) => {
        idToTitle[n.id] = n.data.title;
      });
      return real.map((n) => ({
        title: n.data.title,
        type: n.data.nodeType,
        detailType: n.data.detailType,
        status: n.data.status,
        stack: n.data.stack,
        notes: n.data.notes,
        dump: n.data.dump,
        connections: lvlEdges
          .filter((e) => e.source === n.id)
          .map((e) => ({ to: idToTitle[e.target], label: e.label })),
        children: n.data.children
          ? serializeLevel(n.data.children.nodes, n.data.children.edges)
          : undefined,
      }));
    };
    return {
      summary,
      decisions: decisions.map((d) => ({ question: d.text, answered: d.answered })),
      nodes: serializeLevel(nodes, edges),
    };
  },

  // Diff current tree vs last committed snapshot (top level — surgical builds).
  stagedChanges: () => {
    const current = get().serializeGraph();
    const prev = get().committed;
    const sig = (n) => JSON.stringify(n);
    if (!prev) return { initial: true, summary: current.summary, nodes: current.nodes };
    const prevByTitle = Object.fromEntries(prev.nodes.map((n) => [n.title, n]));
    const currByTitle = Object.fromEntries(current.nodes.map((n) => [n.title, n]));
    const added = current.nodes.filter((n) => !prevByTitle[n.title]);
    const removed = prev.nodes.filter((n) => !currByTitle[n.title]).map((n) => n.title);
    const modified = current.nodes.filter((n) => prevByTitle[n.title] && sig(n) !== sig(prevByTitle[n.title]));
    return { initial: false, added, removed, modified };
  },

  hasStagedChanges: () => {
    const d = get().stagedChanges();
    if (d.initial) return d.nodes.length > 0;
    return d.added.length > 0 || d.removed.length > 0 || d.modified.length > 0;
  },
}));
