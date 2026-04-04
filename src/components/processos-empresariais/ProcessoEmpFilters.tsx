import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterResponsavel: string;
  onFilterResponsavelChange: (v: string) => void;
  responsaveis: string[];
}

export function ProcessoEmpFilters({
  search, onSearchChange, filterStatus, onFilterStatusChange,
  filterResponsavel, onFilterResponsavelChange, responsaveis,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => onSearchChange(e.target.value)} />
      </div>
      <Select value={filterStatus} onValueChange={onFilterStatusChange}>
        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos Status</SelectItem>
          <SelectItem value="aberto">Aberto</SelectItem>
          <SelectItem value="finalizado">Finalizado</SelectItem>
          <SelectItem value="cancelado">Cancelado</SelectItem>
          <SelectItem value="pausado">Pausado</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterResponsavel} onValueChange={onFilterResponsavelChange}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="Especialista" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos Especialistas</SelectItem>
          {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
