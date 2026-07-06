import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter } from "lucide-react";
import { normalizarBusca } from "./participantesUtils";

export const MultiSelectFilter = ({
  selected,
  onChange,
  options,
  label,
  searchable = false,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: string[];
  label: string;
  searchable?: boolean;
}) => {
  const [search, setSearch] = useState("");
  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );
  const filtered =
    searchable && search
      ? options.filter((o) => {
          const termo = normalizarBusca(search);
          const digitosTermo = search.replace(/\D/g, "");
          const digitosOpt = o.replace(/\D/g, "");
          return (
            normalizarBusca(o).includes(termo) ||
            (digitosTermo.length > 0 && digitosOpt.includes(digitosTermo))
          );
        })
      : options;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs w-full justify-start gap-1 font-normal ${selected.length > 0 ? "border-primary text-primary" : ""}`}
        >
          <Filter className="h-3 w-3" />
          {selected.length > 0
            ? `${selected.length} selecionado(s)`
            : "Filtrar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          if (searchable) e.preventDefault();
        }}
      >
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-medium">{label}</span>
          {selected.length > 0 && (
            <button
              className="text-xs text-destructive hover:underline"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
          )}
        </div>
        {searchable && (
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar..."
              className="h-7 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2">
              Nenhum resultado
            </p>
          )}
          {filtered.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() => toggle(opt)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
