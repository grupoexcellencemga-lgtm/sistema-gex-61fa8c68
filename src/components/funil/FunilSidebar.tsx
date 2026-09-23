import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderPlus, MoreHorizontal, Plus, Search, Star, X } from "lucide-react";
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
  type StatusCiclo,
} from "./funilFolders";

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
      <button
        type="button"
        onClick={() => onSelect(funnel.id)}
        className="min-w-0 flex-1 text-left"
      >
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Ações de ${funnel.nome}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!funnel.recebe_novos_leads && funnel.pasta_id && funnel.status_ciclo !== "encerrado" && (
            <DropdownMenuItem onClick={() => onActivate(funnel)}>
              Receber novos leads
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Mover para</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onMove(funnel, null)}>Sem pasta</DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => onMove(funnel, folder.id)}>
                  {folder.nome}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onClick={() => {
              const name = window.prompt("Novo nome do funil", funnel.nome);
              if (name?.trim()) onRename(funnel, name.trim());
            }}
          >
            Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(funnel)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type CreateMode = null | "folder" | "funnel";

export function FunilSidebar(props: Props) {
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("funil-sidebar-open-groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");

  const navigation = useMemo(
    () => buildFunnelNavigation(props.folders, props.funnels, search),
    [props.folders, props.funnels, search],
  );

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      try { localStorage.setItem("funil-sidebar-open-groups", JSON.stringify(next)); } catch {}
      return next;
    });

  const isOpen = (id: string) => openGroups[id] ?? true;

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

      {/* Lista — scroll livre */}
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

            {/* Grupos / pastas */}
            {navigation.groups.map((group) => {
              const folder = props.folders.find((f) => f.id === group.id);
              const isEditing = editingFolderId === group.id;
              return (
              <section key={group.id}>
                {isEditing && folder ? (
                  <form
                    className="flex items-center gap-1 px-1 py-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = editingFolderName.trim();
                      if (name) props.onRenameFolder(folder, name);
                      setEditingFolderId(null);
                    }}
                  >
                    <Input
                      autoFocus
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      className="h-7 flex-1 text-xs"
                      onBlur={() => setEditingFolderId(null)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingFolderId(null); }}
                    />
                    <Button type="submit" size="icon" className="h-7 w-7 shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </form>
                ) : (
                <div className="group/folder flex items-center gap-1 rounded-md pr-1 hover:bg-muted">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-xs font-semibold"
                  >
                    {isOpen(group.id) ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1 truncate text-left">{group.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {group.funnels.length}
                    </span>
                  </button>
                  {folder && (
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
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingFolderName(group.name);
                            setEditingFolderId(group.id);
                          }}
                        >
                          Renomear pasta
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                )}

                {isOpen(group.id) && (
                  <div className="mt-0.5 ml-3 border-l pl-1.5 space-y-0.5">
                    {group.funnels.map((funnel) => (
                      <FunnelRow
                        key={funnel.id}
                        funnel={funnel}
                        selected={props.selectedId === funnel.id}
                        folders={props.folders}
                        {...props}
                      />
                    ))}
                  </div>
                )}
              </section>
            );})}


            {navigation.groups.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum funil encontrado.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Barra de criação — compacta por padrão, expande ao clicar */}
      <div className="border-t bg-card">
        {/* Botões compactos */}
        {createMode === null && (
          <div className="flex gap-2 p-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs"
              onClick={() => setCreateMode("folder")}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Nova pasta
            </Button>
            <Button
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs"
              onClick={() => setCreateMode("funnel")}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo funil
            </Button>
          </div>
        )}

        {/* Formulário: criar pasta */}
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
              <button type="button" onClick={() => setCreateMode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Ex: OPEX, HEX, Gestão..."
              className="h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setCreateMode(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="flex-1" disabled={!folderName.trim()}>
                Criar pasta
              </Button>
            </div>
          </form>
        )}

        {/* Formulário: criar funil */}
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
              <button type="button" onClick={() => setCreateMode(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              autoFocus
              value={funnelName}
              onChange={(e) => setFunnelName(e.target.value)}
              placeholder="Ex: Turma 25, Turma 26..."
              className="h-9 text-sm"
            />
            <select
              aria-label="Pasta do novo funil"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Sem pasta</option>
              {props.folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.nome}
                </option>
              ))}
            </select>
            {props.createOptions}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setCreateMode(null)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="flex-1" disabled={!funnelName.trim()}>
                Criar funil
              </Button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
