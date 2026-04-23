import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  categoria: string;
  onCategoriaChange: (v: string) => void;
  responsavel: string;
  onResponsavelChange: (v: string) => void;
  responsaveis: string[];
}

export function DivulgacaoFilters({ search, onSearchChange, categoria, onCategoriaChange, responsavel, onResponsavelChange, responsaveis }: Props) {
  const hasFilters = search || categoria !== "todos" || responsavel !== "todos";
  const clearAll = () => { onSearchChange(""); onCategoriaChange("todos"); onResponsavelChange("todos"); };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="pl-8 h-8 text-sm" placeholder="Buscar..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
      </div>
      <Select value={categoria} onValueChange={onCategoriaChange}>
        <SelectTrigger className="h-8 w-[150px] text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas categorias</SelectItem>
          <SelectItem value="Comunicado">Comunicado</SelectItem>
          <SelectItem value="Campanha">Campanha</SelectItem>
          <SelectItem value="Evento">Evento</SelectItem>
          <SelectItem value="Treinamento">Treinamento</SelectItem>
        </SelectContent>
      </Select>
      {responsaveis.length > 0 && (
        <Select value={responsavel} onValueChange={onResponsavelChange}>
          <SelectTrigger className="h-8 w-[150px] text-sm"><SelectValue placeholder="Respons\u00e1vel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs" onClick={clearAll}>
          <X className="h-3 w-3" />Limpar
        </Button>
      )}
    </div>
  );
}