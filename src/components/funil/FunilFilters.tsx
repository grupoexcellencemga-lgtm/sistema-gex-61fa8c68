import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { origens, cidades } from "./funilUtils";
import type { ProdutoSelect, ComercialSelect } from "@/types";

interface Filters {
  search: string;
  responsavel_id: string;
  produto_interesse: string;
  origem: string;
  cidade: string;
}

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  comerciais: ComercialSelect[];
  produtos: ProdutoSelect[];
}

export function FunilFilters({ filters, setFilters, comerciais, produtos }: Props) {
  const u = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            className="pl-9"
            value={filters.search}
            onChange={(e) => u("search", e.target.value)}
          />
        </div>
      </div>
      <div className="w-[150px]">
        <Label className="text-xs">Vendedor</Label>
        <Select value={filters.responsavel_id} onValueChange={(v) => u("responsavel_id", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sem">Sem vendedor</SelectItem>
            {comerciais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[150px]">
        <Label className="text-xs">Produto</Label>
        <Select value={filters.produto_interesse} onValueChange={(v) => u("produto_interesse", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {produtos.map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[130px]">
        <Label className="text-xs">Origem</Label>
        <Select value={filters.origem} onValueChange={(v) => u("origem", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {origens.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="w-[130px]">
        <Label className="text-xs">Cidade</Label>
        <Select value={filters.cidade} onValueChange={(v) => u("cidade", v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
