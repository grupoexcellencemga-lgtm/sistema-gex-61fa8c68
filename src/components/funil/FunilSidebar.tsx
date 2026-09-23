import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, GripVertical, MoreHorizontal, Plus, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  buildFunnelNavigation,
  type FunilPasta,
  type FunilQuadroOrganizado,
  type FunnelNavigationGroup,
  type StatusCiclo,
} from "./funilFolders";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_ORDER_KEY = "funil-sidebar-folder-order";
const STORAGE_OPEN_KEY  = "funil-sidebar-open-groups";
const STORAGE_UNFILED_LABEL_KEY = "funil-unfiled-label";

const statusLabel: Record<StatusCiclo, string> = {
  preparacao: "Preparação",
  recebendo_leads: "Recebendo leads",
  encerrando: "Encerrando",
  encerrado: "Encerrado",
};

const statusColor: Record<StatusCiclo, string> = {
  preparacao: "text-muted-foreground",
  recebendo_leads: "font-semibold text-emerald-600",
  encerrando: "text-amber-600",
  encerrado: "text-muted-foreground line-through",
};

type Props = {
  folders: FunilPasta[];
  funnels: FunilQuadroOrganizado[];
  selectedId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateFunnel: (name: string, folderId: string | null) => void;
  onToggleFavorite: (funnel: FunilQuadroOrganizado) => void;
  onActivate: (funnel: FunilQuadroOrganizado) => void;
  onMove: (funnel: FunilQuadroOrganizado, folderId: string | null) => void;
  onRename: (funnel: FunilQuadroOrganizado, name: string) => void;
  onRenameFolder: (folder: FunilPasta, name: string) => void;
  onReorderFolders: (orderedIds: string[]) => void;
  onDelete: (funnel: FunilQuadroOrganizado) => void;
  createOptions?: ReactNode;
};

function FunnelRow({
  funnel, selected, folders,
  onSelect, onToggleFavorite, onActivate, onMove, onRename, onDelete,
}: {
  funnel: FunilQuadroOrganizado;
  selected: boolean;
  folders: FunilPasta[];
} & Pick<Props, "onSelect" | "onToggleFavorite" | "onActivate" | "onMove" | "onRename" | "onDelete">) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-2",
        selected ? "bg-primary/15 text-primary" : "hover:bg-muted",
      )}
    >
      <button type="button" onClick={() => onSelect(funnel.id)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium leading-snug">{funnel.nome}</span>
        <span className={cn("text-[11px] leading-tight", statusColor[funnel.status_ciclo])}>
          {statusLabel[funnel.status_ciclo]}
        </span>
      </button>

      <button
        type="button"
        aria-label={funnel.favorito ? `Desfavoritar ${funnel.nome}` : `Favoritar ${funnel.nome}`}
        onClick={() => onToggleFavorite(funnel)}
        className="p-1 text-muted-foreground opacity-0 transition-opacity hover:text-amber-500 group-hover:opacity-100"
      >
        <Star className={cn("h-3.5 w-3.5", funnel.favorito && "fill-amber-400 text-amber-500 opacity-100")} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Ações de ${funnel.nome}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!funnel.recebe_novos_leads && funnel.pasta_id && funnel.status_ciclo !== "encerrado" && (
            <DropdownMenuItem onClick={() => onActivate(funnel)}>Receber novos leads</DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mover para</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onMove(funnel, null)}>Sem pasta</DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => onMove(funnel, folder.id)}>{folder.nome}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => { const name = window.prompt("Novo nome do funil", funnel.nome); if (name?.trim()) onRename(funnel, name.trim()); }}>
            Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(funnel)}>Excluir</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SortableFolderGroup({
  group, isEditing, editingName, isOpen,
  onToggle, onStartEdit, onFinishEdit, onCancelEdit, onEditNameChange, onConfirmRename,
  isReal,
  children,
}: {
  group: FunnelNavigationGroup;
  isEditing: boolean;
  editingName: string;
  isOpen: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onEditNameChange: (v: string) => void;
  onConfirmRename: (name: string) => void;
  isReal: boolean; // false para "unfiled"
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      {isEditing ? (
        <form
          className="flex items-center gap-1 px-1 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingName.trim()) onConfirmRename(editingName.trim());
            onFinishEdit();
          }}
        >
          <Input
            autoFocus
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="h-7 flex-1 text-xs"
            onBlur={onCancelEdit}
            onKeyDown={(e) => { if (e.key === "Escape") onCancelEdit(); }}
          />
          <Button type="submit" size="icon" className="h-7 w-7 shrink-0">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      ) : (
        <div className="group/folder flex items-center gap-1 rounded-md pr-1 hover:bg-muted">
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab p-1 text-muted-foreground opacity-0 transition-opacity group-hover/folder:opacity-100 active:cursor-grabbing"
            aria-label="Arrastar pasta"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 cursor-pointer items-center gap-2 py-1.5 pr-1 text-xs font-semibold"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <Folder className={cn("h-4 w-4 shrink-0", isReal ? "text-primary" : "text-muted-foreground")} />
            <span className="flex-1 truncate text-left">{group.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {group.funnels.length}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover/folder:opacity-100"
                aria-label={`Ações da pasta ${group.name}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartEdit}>Renomear pasta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {isOpen && (
        <div className="mt-0.5 ml-3 border-l pl-1.5 space-y-0.5">
          {children}
        </div>
      )}
    </section>
  );
}

type CreateMode = null | "folder" | "funnel";

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function FunilSidebar(props: Props) {
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => lsGet(STORAGE_OPEN_KEY, {})
  );

  // Nome customizável de "Sem pasta"
  const [unfiledLabel, setUnfiledLabel] = useState<string>(
    () => lsGet(STORAGE_UNFILED_LABEL_KEY, "Sem pasta")
  );

  // Ordem das pastas (inclui "unfiled") — persistida no localStorage
  const [localFolderOrder, setLocalFolderOrder] = useState<string[]>(
    () => lsGet(STORAGE_ORDER_KEY, [])
  );

  // Sincroniza quando pastas mudam: adiciona novas, remove excluídas, mantém posição das existentes
  useEffect(() => {
    const realIds = props.folders.map((f) => f.id);
    const allIds = [...realIds, "unfiled"];
    setLocalFolderOrder((prev) => {
      const kept = prev.filter((id) => allIds.includes(id));
      const newIds = allIds.filter((id) => !kept.includes(id));
      // Novos IDs reais vão antes de "unfiled"; "unfiled" vai ao final se ainda não estava
      const unfiledPos = kept.indexOf("unfiled");
      if (unfiledPos >= 0) {
        kept.splice(unfiledPos, 0, ...newIds.filter((id) => id !== "unfiled"));
      } else {
        kept.push(...newIds.filter((id) => id !== "unfiled"), "unfiled");
      }
      return kept;
    });
  }, [props.folders]);

  // Estado de edição de nome de pasta
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const navigation = useMemo(
    () => buildFunnelNavigation(props.folders, props.funnels, search),
    [props.folders, props.funnels, search],
  );

  // Aplica o label customizado ao grupo "unfiled"
  const groupMap = useMemo(() => {
    const map = new Map(navigation.groups.map((g) => [g.id, g]));
    const unfiled = map.get("unfiled");
    if (unfiled) map.set("unfiled", { ...unfiled, name: unfiledLabel });
    return map;
  }, [navigation.groups, unfiledLabel]);

  // Ordena os grupos de acordo com localFolderOrder
  const sortedGroups = useMemo(() => {
    return localFolderOrder
      .map((id) => groupMap.get(id))
      .filter(Boolean) as FunnelNavigationGroup[];
  }, [localFolderOrder, groupMap]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      lsSet(STORAGE_OPEN_KEY, next);
      return next;
    });

  const isOpen = (id: string) => openGroups[id] ?? true;

  const dndSensor = useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
  const dndSensors = useSensors(dndSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLocalFolderOrder((prev) => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      lsSet(STORAGE_ORDER_KEY, next);
      props.onReorderFolders(next); // Funil.tsx filtra "unfiled" antes de salvar no DB
      return next;
    });
  };

  const handleConfirmRename = (groupId: string, name: string) => {
    if (groupId === "unfiled") {
      setUnfiledLabel(name);
      lsSet(STORAGE_UNFILED_LABEL_KEY, name);
    } else {
      const folder = props.folders.find((f) => f.id === groupId);
      if (folder) props.onRenameFolder(folder, name);
    }
  };

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r bg-card">
      {/* Cabeçalho */}
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-2.5">
          <Folder className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="text-sm font-semibold leading-tight">Produtos e turmas</h2>
            <p className="text-[11px] text-muted-foreground">Organize cada ciclo comercial</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou turma..."
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-2">
        {props.loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {/* Favoritos */}
            {navigation.favorites.length > 0 && (
              <section>
                <h3 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Favoritos
                </h3>
                {navigation.favorites.map((funnel) => (
                  <FunnelRow
                    key={`fav-${funnel.id}`}
                    funnel={funnel}
                    selected={props.selectedId === funnel.id}
                    folders={props.folders}
                    {...props}
                  />
                ))}
              </section>
            )}

            {/* Grupos com DnD (todas as pastas, incluindo "Sem pasta") */}
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={localFolderOrder} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {sortedGroups.map((group) => (
                    <SortableFolderGroup
                      key={group.id}
                      group={group}
                      isReal={group.id !== "unfiled"}
                      isEditing={editingGroupId === group.id}
                      editingName={editingGroupName}
                      isOpen={isOpen(group.id)}
                      onToggle={() => toggleGroup(group.id)}
                      onStartEdit={() => {
                        setEditingGroupName(group.name);
                        setEditingGroupId(group.id);
                      }}
                      onFinishEdit={() => setEditingGroupId(null)}
                      onCancelEdit={() => setEditingGroupId(null)}
                      onEditNameChange={setEditingGroupName}
                      onConfirmRename={(name) => handleConfirmRename(group.id, name)}
                    >
                      {group.funnels.map((funnel) => (
                        <FunnelRow
                          key={funnel.id}
                          funnel={funnel}
                          selected={props.selectedId === funnel.id}
                          folders={props.folders}
                          {...props}
                        />
                      ))}
                    </SortableFolderGroup>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {sortedGroups.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Nenhum funil encontrado.</p>
            )}
          </div>
        )}
      </div>

      {/* Barra de criação */}
      <div className="border-t bg-card">
        {createMode === null && (
          <div className="flex gap-2 p-3">
            <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => setCreateMode("folder")}>
              <FolderPlus className="h-3.5 w-3.5" /> Nova pasta
            </Button>
            <Button size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => setCreateMode("funnel")}>
              <Plus className="h-3.5 w-3.5" /> Novo funil
            </Button>
          </div>
        )}

        {createMode === "folder" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!folderName.trim()) return;
              props.onCreateFolder(folderName.trim());
              setFolderName("");
              setCreateMode(null);
            }}
            className="space-y-2 p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Nova pasta de produto</span>
              <button type="button" onClick={() => setCreateMode(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <Input autoFocus value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Ex: OPEX, HEX, Gestão..." className="h-9 text-sm" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setCreateMode(null)}>Cancelar</Button>
              <Button type="submit" size="sm" className="flex-1" disabled={!folderName.trim()}>Criar pasta</Button>
            </div>
          </form>
        )}

        {createMode === "funnel" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!funnelName.trim()) return;
              props.onCreateFunnel(funnelName.trim(), targetFolder || null);
              setFunnelName("");
              setCreateMode(null);
            }}
            className="space-y-2 p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">Novo funil / turma</span>
              <button type="button" onClick={() => setCreateMode(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <Input autoFocus value={funnelName} onChange={(e) => setFunnelName(e.target.value)} placeholder="Ex: Turma 25, Turma 26..." className="h-9 text-sm" />
            <select
              aria-label="Pasta do novo funil"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Sem pasta</option>
              {props.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.nome}</option>
              ))}
            </select>
            {props.createOptions}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setCreateMode(null)}>Cancelar</Button>
              <Button type="submit" size="sm" className="flex-1" disabled={!funnelName.trim()}>Criar funil</Button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
