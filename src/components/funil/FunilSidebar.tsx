import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Folder, FolderPlus, MoreHorizontal, Plus, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buildFunnelNavigation, type FunilPasta, type FunilQuadroOrganizado, type StatusCiclo } from "./funilFolders";

const statusLabel: Record<StatusCiclo, string> = {
  preparacao: "Preparação",
  recebendo_leads: "Recebendo leads",
  encerrando: "Encerrando",
  encerrado: "Encerrado",
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
  onDelete: (funnel: FunilQuadroOrganizado) => void;
  createOptions?: ReactNode;
};

function FunnelRow({ funnel, selected, folders, onSelect, onToggleFavorite, onActivate, onMove, onRename, onDelete }: {
  funnel: FunilQuadroOrganizado; selected: boolean; folders: FunilPasta[];
} & Pick<Props, "onSelect" | "onToggleFavorite" | "onActivate" | "onMove" | "onRename" | "onDelete">) {
  return <div className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5", selected ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
    <button type="button" onClick={() => onSelect(funnel.id)} className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-medium">{funnel.nome}</span>
      <span className={cn("text-[10px]", funnel.recebe_novos_leads ? "font-semibold text-emerald-600" : "text-muted-foreground")}>{statusLabel[funnel.status_ciclo]}</span>
    </button>
    <button type="button" aria-label={funnel.favorito ? `Desfavoritar ${funnel.nome}` : `Favoritar ${funnel.nome}`} onClick={() => onToggleFavorite(funnel)} className="p-1 text-muted-foreground hover:text-amber-500">
      <Star className={cn("h-3.5 w-3.5", funnel.favorito && "fill-amber-400 text-amber-500")} />
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Ações de ${funnel.nome}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!funnel.recebe_novos_leads && funnel.pasta_id && funnel.status_ciclo !== "encerrado" && <DropdownMenuItem onClick={() => onActivate(funnel)}>Receber novos leads</DropdownMenuItem>}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Mover para</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => onMove(funnel, null)}>Sem pasta</DropdownMenuItem>
            {folders.map((folder) => <DropdownMenuItem key={folder.id} onClick={() => onMove(funnel, folder.id)}>{folder.nome}</DropdownMenuItem>)}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => { const name = window.prompt("Novo nome do funil", funnel.nome); if (name?.trim()) onRename(funnel, name.trim()); }}>Renomear</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(funnel)}>Excluir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

export function FunilSidebar(props: Props) {
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [funnelName, setFunnelName] = useState("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const navigation = useMemo(() => buildFunnelNavigation(props.folders, props.funnels, search), [props.folders, props.funnels, search]);

  return <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r bg-card">
    <div className="space-y-2 border-b p-3">
      <div className="flex items-center gap-2"><Folder className="h-5 w-5 text-primary" /><div><h2 className="text-sm font-semibold">Produtos e turmas</h2><p className="text-[11px] text-muted-foreground">Organize cada ciclo comercial</p></div></div>
      <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou turma..." className="h-9 pl-8 text-xs" /></div>
    </div>
    <div className="flex-1 space-y-3 overflow-auto p-2">
      {props.loading ? <p className="p-4 text-center text-xs text-muted-foreground">Carregando...</p> : <>
        {navigation.favorites.length > 0 && <section><h3 className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Favoritos</h3>{navigation.favorites.map((funnel) => <FunnelRow key={`fav-${funnel.id}`} funnel={funnel} selected={props.selectedId === funnel.id} folders={props.folders} {...props} />)}</section>}
        {navigation.groups.map((group) => <details key={group.id} open className="group/folder">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold hover:bg-muted"><ChevronDown className="h-3.5 w-3.5 transition-transform group-open/folder:rotate-0" /><Folder className="h-4 w-4 text-primary" /><span className="flex-1 truncate">{group.name}</span><span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{group.funnels.length}</span></summary>
          <div className="ml-2 border-l pl-1">{group.funnels.map((funnel) => <FunnelRow key={funnel.id} funnel={funnel} selected={props.selectedId === funnel.id} folders={props.folders} {...props} />)}</div>
        </details>)}
        {navigation.groups.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Nenhum funil encontrado.</p>}
      </>}
    </div>
    <div className="space-y-3 border-t p-3">
      <form onSubmit={(e) => { e.preventDefault(); if (!folderName.trim()) return; props.onCreateFolder(folderName.trim()); setFolderName(""); }} className="flex gap-2">
        <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="Nova pasta de produto..." className="h-8 text-xs" />
        <Button type="submit" size="icon" variant="outline" className="h-8 w-8" aria-label="Criar pasta"><FolderPlus className="h-4 w-4" /></Button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); if (!funnelName.trim()) return; props.onCreateFunnel(funnelName.trim(), targetFolder || null); setFunnelName(""); }} className="space-y-2">
        <div className="flex gap-2"><Input value={funnelName} onChange={(e) => setFunnelName(e.target.value)} placeholder="Novo funil ou turma..." className="h-8 text-xs" /><Button type="submit" size="icon" className="h-8 w-8" aria-label="Criar funil"><Plus className="h-4 w-4" /></Button></div>
        <select aria-label="Pasta do novo funil" value={targetFolder} onChange={(e) => setTargetFolder(e.target.value)} className="h-8 w-full rounded-md border bg-background px-2 text-xs"><option value="">Sem pasta</option>{props.folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.nome}</option>)}</select>
        {props.createOptions}
      </form>
    </div>
  </aside>;
}
