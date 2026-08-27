import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  Panel,
  MarkerType,
  SelectionMode,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X, Download, PanelLeftClose, PanelLeft, Brain, Undo2, Hand, MousePointer2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import MindMapNode from "@/components/mindmap/MindMapNode";
import NodeStylePanel from "@/components/mindmap/NodeStylePanel";
import MindMapAgenda, { type Agenda } from "@/components/mindmap/MindMapAgenda";
import NodeContextMenu from "@/components/mindmap/NodeContextMenu";

const nodeTypes = { mindmap: MindMapNode };

const NODE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

const MindMap = () => {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [newMapName, setNewMapName] = useState("");
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styleHistoryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const selectedMapIdRef = useRef(selectedMapId);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { selectedMapIdRef.current = selectedMapId; }, [selectedMapId]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[]; cut: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const MAX_HISTORY = 30;
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan");

  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) {
        toast.info("Nenhuma ação para desfazer");
        return prev;
      }
      const last = prev[prev.length - 1];
      setNodes(last.nodes);
      setEdges(last.edges);
      toast.success("Ação desfeita!");
      return prev.slice(0, -1);
    });
  }, [setNodes, setEdges]);


  // Fetch maps
  const { data: maps = [] } = useQuery({
    queryKey: ["mindmaps", user?.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mindmaps")
        .select("id, nome, updated_at, user_id")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!empresaId,
  });

  // Load selected map — staleTime 0 garante que sempre busca do banco ao voltar
  const { data: currentMap } = useQuery({
    queryKey: ["mindmap", selectedMapId],
    queryFn: async () => {
      if (!selectedMapId) return null;
      const { data, error } = await supabase
        .from("mindmaps")
        .select("*")
        .eq("id", selectedMapId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedMapId,
    staleTime: 0,
  });

  // Salva imediatamente (cancela debounce pendente)
  const saveImmediately = useCallback(async (mapId: string) => {
    if (!mapId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await supabase.from("mindmaps").update({
      nodes: nodesRef.current as any,
      edges: edgesRef.current as any,
      updated_at: new Date().toISOString(),
    }).eq("id", mapId);
  }, []);

  const saveAgenda = useCallback(async (agenda: Agenda) => {
    if (!selectedMapId) return;
    await supabase.from("mindmaps").update({ agenda: agenda as any }).eq("id", selectedMapId);
  }, [selectedMapId]);

  // Troca de mapa: salva o atual antes de mudar
  const handleMapSelect = useCallback(async (newMapId: string) => {
    const prev = selectedMapIdRef.current;
    if (prev && prev !== newMapId) {
      await saveImmediately(prev);
    }
    setSelectedMapId(newMapId);
  }, [saveImmediately]);

  useEffect(() => {
    if (currentMap) {
      setNodes((currentMap.nodes as any[]) || []);
      setEdges((currentMap.edges as any[]) || []);
    }
  }, [currentMap, setNodes, setEdges]);

  // Autosave
  const autoSave = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (!selectedMapId) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        await supabase
          .from("mindmaps")
          .update({
            nodes: newNodes as any,
            edges: newEdges as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedMapId);
      }, 800);
    },
    [selectedMapId]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => { onNodesChange(changes); },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => { onEdgesChange(changes); },
    [onEdgesChange]
  );

  useEffect(() => {
    if (selectedMapId && (nodes.length > 0 || edges.length > 0)) {
      autoSave(nodes, edges);
    }
  }, [nodes, edges, selectedMapId, autoSave]);

  const onNodeDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory();
      setEdges((eds) =>
        addEdge({
          ...params,
          type: "smoothstep",
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        }, eds)
      );
    },
    [setEdges, pushHistory]
  );

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!selectedMapId || !reactFlowInstance) return;
      pushHistory();
      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "mindmap",
        position,
        data: { label: "Nova ideia", color: NODE_COLORS[0], isRoot: true },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [selectedMapId, reactFlowInstance, setNodes, pushHistory]
  );

  // Add child
  const addChildToNode = useCallback(
    (parentId: string) => {
      const parentNode = nodes.find((n) => n.id === parentId);
      if (!parentNode) return;
      pushHistory();
      const childId = crypto.randomUUID();
      // child fica à direita do pai por padrão
      const childPos = { x: parentNode.position.x + 250, y: parentNode.position.y + Math.random() * 100 - 50 };
      const newNode: Node = {
        id: childId,
        type: "mindmap",
        position: childPos,
        data: { label: "Nova ideia", color: parentNode.data.color || NODE_COLORS[0], isRoot: false, textColor: "#000000" },
      };
      const lineColor = (parentNode.data.color as string) || NODE_COLORS[0];
      // filho à direita → handle "right" do pai → handle "left" do filho
      const childIsRight = childPos.x >= parentNode.position.x;
      const newEdge: Edge = {
        id: `e-${parentId}-${childId}`,
        source: parentId,
        target: childId,
        sourceHandle: childIsRight ? "right" : "left",
        targetHandle: childIsRight ? "left" : "right",
        type: "smoothstep",
        style: { stroke: lineColor, strokeWidth: 2 },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);
      setSelectedNodeId(childId);
    },
    [nodes, setNodes, setEdges, pushHistory]
  );

  // Add sibling
  const addSiblingToNode = useCallback(
    (nodeId: string) => {
      const parentEdge = edges.find((e) => e.target === nodeId);
      const currentNode = nodes.find((n) => n.id === nodeId);
      if (!currentNode) return;
      pushHistory();
      const siblingId = crypto.randomUUID();
      const siblingPos = { x: currentNode.position.x, y: currentNode.position.y + 80 };
      const newNode: Node = {
        id: siblingId,
        type: "mindmap",
        position: siblingPos,
        data: { label: "Nova ideia", color: currentNode.data.color || NODE_COLORS[0], isRoot: false, textColor: "#000000" },
      };
      setNodes((nds) => [...nds, newNode]);
      if (parentEdge) {
        const parentNode = nodes.find((n) => n.id === parentEdge.source);
        const lineColor = (parentNode?.data.color as string) || NODE_COLORS[0];
        // determina o lado baseado na posição relativa ao pai
        const siblingIsRight = parentNode ? siblingPos.x >= parentNode.position.x : true;
        const newEdge: Edge = {
          id: `e-${parentEdge.source}-${siblingId}`,
          source: parentEdge.source,
          target: siblingId,
          sourceHandle: siblingIsRight ? "right" : "left",
          targetHandle: siblingIsRight ? "left" : "right",
          type: "smoothstep",
          style: { stroke: lineColor, strokeWidth: 2 },
        };
        setEdges((eds) => [...eds, newEdge]);
      }
      setSelectedNodeId(siblingId);
    },
    [nodes, edges, setNodes, setEdges, pushHistory]
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId: string) => {
      pushHistory();
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [setNodes, setEdges, selectedNodeId, pushHistory]
  );

  // Copy / Cut / Paste (multi-node)
  const copyNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setClipboard({ nodes: [node], edges: [], cut: false });
  }, [nodes]);

  const cutNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setClipboard({ nodes: [node], edges: [], cut: true });
    deleteNode(nodeId);
  }, [nodes, deleteNode]);

  // Copy all currently selected nodes (Ctrl+C / Ctrl+X from keyboard)
  const copySelectedNodes = useCallback((cut = false) => {
    const selected = nodes.filter((n) => n.selected);
    const toCopy = selected.length > 0 ? selected : (selectedNodeId ? nodes.filter((n) => n.id === selectedNodeId) : []);
    if (toCopy.length === 0) return;
    const ids = new Set(toCopy.map((n) => n.id));
    const internalEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    setClipboard({ nodes: toCopy.map((n) => ({ ...n })), edges: internalEdges, cut });
    if (cut) {
      pushHistory();
      setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
      setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    }
  }, [nodes, edges, selectedNodeId, pushHistory, setNodes, setEdges]);

  const pasteNode = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const idMap = new Map<string, string>();
    clipboard.nodes.forEach((n) => idMap.set(n.id, crypto.randomUUID()));
    const newNodes: Node[] = clipboard.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: false,
    }));
    const newEdges: Edge[] = clipboard.edges.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));
    setNodes((nds) => [...nds, ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    setSelectedNodeId(newNodes[0]?.id ?? null);
  }, [clipboard, setNodes, setEdges]);

  // Update node data from style panel (debounced history so rapid style clicks don't flood)
  const updateNodeData = useCallback(
    (nodeId: string, updates: Record<string, any>) => {
      if (styleHistoryRef.current) clearTimeout(styleHistoryRef.current);
      styleHistoryRef.current = setTimeout(() => pushHistory(), 600);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const newData = { ...n.data, ...updates };
          const newNode = { ...n, data: newData };
          if ("locked" in updates) newNode.draggable = !updates.locked;
          return newNode;
        })
      );
    },
    [setNodes, pushHistory]
  );

  // Bulk image upload: creates one child node per image
  const addMultipleImageNodes = useCallback(
    async (parentId: string, files: File[]) => {
      const parentNode = nodes.find((n) => n.id === parentId);
      if (!parentNode) return;
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const lineColor = (parentNode.data.color as string) || NODE_COLORS[0];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} excede 5MB, pulando...`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${parentId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("mindmap_images").upload(path, file);
        if (error) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }
        const { data: urlData } = supabase.storage.from("mindmap_images").getPublicUrl(path);
        const childId = crypto.randomUUID();
        const nodeName = file.name.replace(/\.[^.]+$/, "");
        newNodes.push({
          id: childId,
          type: "mindmap",
          position: {
            x: parentNode.position.x + 250,
            y: parentNode.position.y + i * 120 - ((files.length - 1) * 60),
          },
          data: { label: nodeName, color: lineColor, isRoot: false, textColor: "#000000", image: urlData.publicUrl },
        });
        newEdges.push({
          id: `e-${parentId}-${childId}`,
          source: parentId,
          target: childId,
          sourceHandle: "right",
          targetHandle: "left",
          type: "smoothstep",
          style: { stroke: lineColor, strokeWidth: 2 },
        });
      }

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        toast.success(`${newNodes.length} imagem(ns) adicionada(s)!`);
      }
    },
    [nodes, setNodes, setEdges]
  );

  // Context menu actions
  const onNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    setSelectedNodeId(nodeId);
  }, []);

  const addNoteToNode = useCallback((nodeId: string) => {
    const note = prompt("Digite a nota:");
    if (note !== null) updateNodeData(nodeId, { note: note || undefined });
  }, [updateNodeData]);

  const addLinkToNode = useCallback((nodeId: string) => {
    const link = prompt("Digite a URL:");
    if (link !== null) updateNodeData(nodeId, { link: link || undefined });
  }, [updateNodeData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedMapId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Tab" && selectedNodeId) {
        e.preventDefault();
        addChildToNode(selectedNodeId);
        return;
      }
      if (e.key === "Enter" && selectedNodeId) {
        e.preventDefault();
        addSiblingToNode(selectedNodeId);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
        } else {
          const selectedEdges = edges.filter((ed) => ed.selected);
          if (selectedEdges.length > 0) {
            pushHistory();
            const ids = new Set(selectedEdges.map((ed) => ed.id));
            setEdges((eds) => eds.filter((ed) => !ids.has(ed.id)));
          }
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undo(); return; }
        if (e.key === "c") { e.preventDefault(); copySelectedNodes(false); }
        if (e.key === "x") { e.preventDefault(); copySelectedNodes(true); }
        if (e.key === "v") { e.preventDefault(); pasteNode(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedNodeId, selectedMapId, addChildToNode, addSiblingToNode, deleteNode, copySelectedNodes, pasteNode, undo]);

  // Enrich nodes with callbacks
  const enrichedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onAddChild: addChildToNode, onAddSibling: addSiblingToNode, onContextMenu: onNodeContextMenu },
      })),
    [nodes, addChildToNode, addSiblingToNode, onNodeContextMenu]
  );

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  // Create map
  const createMap = useMutation({
    mutationFn: async (name: string) => {
      const rootNode: Node = {
        id: crypto.randomUUID(),
        type: "mindmap",
        position: { x: 400, y: 300 },
        data: { label: name || "Ideia Central", color: NODE_COLORS[0], isRoot: true },
      };
      const { data, error } = await supabase
        .from("mindmaps")
        .insert({ user_id: user!.id, empresa_id: empresaId, nome: name || "Novo Mapa", nodes: [rootNode] as any, edges: [] as any })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mindmaps"] });
      setSelectedMapId(data.id);
      setNewMapName("");
      toast.success("Mapa criado!");
    },
  });

  const renameMap = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("mindmaps").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mindmaps"] });
      setEditingMapId(null);
      toast.success("Renomeado!");
    },
  });

  const deleteMap = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mindmaps").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["mindmaps"] });
      if (selectedMapId === id) { setSelectedMapId(null); setNodes([]); setEdges([]); }
      toast.success("Mapa excluído!");
    },
  });

  const exportPng = useCallback(() => {
    const viewport = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) return;
    import("html-to-image").then(({ toPng }: any) => {
      toPng(viewport, { backgroundColor: "#1a1a2e" }).then((dataUrl: string) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${maps.find((m) => m.id === selectedMapId)?.nome || "mindmap"}.png`;
        a.click();
      });
    }).catch(() => toast.error("Erro ao exportar"));
  }, [selectedMapId, maps]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  const selectedMap = maps.find((m) => m.id === selectedMapId);

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-lg overflow-hidden border border-border bg-card">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Meus Mapas</span>
          </div>
          <div className="p-2 border-b border-border">
            <form onSubmit={(e) => { e.preventDefault(); createMap.mutate(newMapName); }} className="flex gap-1">
              <Input value={newMapName} onChange={(e) => setNewMapName(e.target.value)} placeholder="Nome do mapa..." className="h-8 text-xs" />
              <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={createMap.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </div>
          <div className="flex-1 overflow-auto p-1 space-y-0.5">
            {maps.map((map) => (
              <div
                key={map.id}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer group",
                  selectedMapId === map.id ? "bg-primary/20 text-primary" : "hover:bg-muted text-foreground"
                )}
              >
                {editingMapId === map.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); renameMap.mutate({ id: map.id, nome: editingName }); }} className="flex items-center gap-1 flex-1">
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-6 text-xs" autoFocus />
                    <Button type="submit" size="icon" variant="ghost" className="h-6 w-6"><Check className="h-3 w-3" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMapId(null)}><X className="h-3 w-3" /></Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate" onClick={() => handleMapSelect(map.id)}>{map.nome}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => { setEditingMapId(map.id); setEditingName(map.nome); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteMap.mutate(map.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {maps.length === 0 && <p className="text-xs text-muted-foreground text-center p-4">Crie seu primeiro mapa mental!</p>}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        {!selectedMapId ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Brain className="h-16 w-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground">Selecione ou crie um mapa mental</p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={enrichedNodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDoubleClick={onPaneDoubleClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={[]}
            className="bg-background"
            panOnDrag={interactionMode === "pan" ? true : [1, 2]}
            selectionOnDrag={interactionMode === "select"}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Control"
            connectionMode={ConnectionMode.Loose}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
            <MiniMap
              nodeColor={(n) => (n.data?.color as string) || "#3b82f6"}
              maskColor="hsl(var(--background) / 0.8)"
              className="!bg-card !border-border"
            />
            <Controls className="!bg-card !border-border !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />

            {/* Top toolbar */}
            <Panel position="top-center">
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-lg">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSidebarOpen(!sidebarOpen)}>
                  {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
                <span className="text-sm font-medium truncate max-w-[200px]">{selectedMap?.nome}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createMap.mutate("")}>
                  <Plus className="h-3 w-3 mr-1" /> Novo
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportPng}>
                  <Download className="h-3 w-3 mr-1" /> PNG
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={undo} disabled={history.length === 0}>
                  <Undo2 className="h-3 w-3 mr-1" /> Desfazer
                </Button>
                <Button size="sm" variant={agendaOpen ? "default" : "outline"} className="h-7 text-xs" onClick={() => setAgendaOpen(o => !o)}>
                  <CalendarDays className="h-3 w-3 mr-1" /> Dias
                </Button>
              </div>
            </Panel>

            {/* Node style panel */}
            {selectedNode && (
              <Panel position="top-right">
                <NodeStylePanel node={selectedNode} onUpdate={updateNodeData} onBulkImages={addMultipleImageNodes} />
              </Panel>
            )}

            {/* Interaction mode toolbar */}
            <Panel position="bottom-center">
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1.5 shadow-lg mb-2">
                <Button
                  size="icon"
                  variant={interactionMode === "pan" ? "default" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => setInteractionMode("pan")}
                  title="Mão livre — arrastar move o canvas"
                >
                  <Hand className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant={interactionMode === "select" ? "default" : "ghost"}
                  className="h-7 w-7"
                  onClick={() => setInteractionMode("select")}
                  title="Seletor — arraste para selecionar vários blocos"
                >
                  <MousePointer2 className="h-4 w-4" />
                </Button>
                {interactionMode === "select" && (
                  <span className="text-[10px] text-muted-foreground ml-1 pr-1">
                    Arraste para selecionar
                  </span>
                )}
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* Agenda de dias */}
      {selectedMapId && (
        <MindMapAgenda
          open={agendaOpen}
          onOpenChange={setAgendaOpen}
          mindmapId={selectedMapId}
          agenda={(currentMap as any)?.agenda ?? null}
          onSave={saveAgenda}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
          onCopy={copyNode}
          onCut={cutNode}
          onPaste={pasteNode}
          onAddNote={addNoteToNode}
          onAddLink={addLinkToNode}
          onDelete={deleteNode}
          onAddChild={addChildToNode}
        />
      )}
    </div>
  );
};

export default MindMap;
