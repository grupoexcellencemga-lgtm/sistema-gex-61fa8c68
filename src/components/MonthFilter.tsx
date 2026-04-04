import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Returns current date/time in Brazil (America/Sao_Paulo) */
export function getBrazilNow(): Date {
  const now = new Date();
  const brStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
  return new Date(brStr);
}

interface MonthFilterProps {
  mes: number; // 0-11
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

export function MonthFilter({ mes, ano, onChange }: MonthFilterProps) {
  const [open, setOpen] = useState(false);
  const [pickerAno, setPickerAno] = useState(ano);

  const prev = () => {
    if (mes === 0) onChange(11, ano - 1);
    else onChange(mes - 1, ano);
  };
  const next = () => {
    if (mes === 11) onChange(0, ano + 1);
    else onChange(mes + 1, ano);
  };

  const handleOpenChange = (o: boolean) => {
    if (o) setPickerAno(ano);
    setOpen(o);
  };

  const selectMonth = (m: number) => {
    onChange(m, pickerAno);
    setOpen(false);
  };

  const today = () => {
    const br = getBrazilNow();
    onChange(br.getMonth(), br.getFullYear());
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 min-w-[160px] justify-center font-medium">
            <Calendar className="h-3.5 w-3.5" />
            {monthNames[mes]} {ano}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3 pointer-events-auto" align="center">
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerAno(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold">{pickerAno}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerAno(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {monthShort.map((name, i) => (
              <Button
                key={i}
                variant={i === mes && pickerAno === ano ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => selectMonth(i)}
              >
                {name}
              </Button>
            ))}
          </div>
          {/* Today button */}
          <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs" onClick={today}>
            Mês Atual
          </Button>
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Check if a date string (YYYY-MM-DD or ISO) falls in the given month/year */
export function isInMonth(dateStr: string | null | undefined, mes: number, ano: number): boolean {
  if (!dateStr) return false;
  const parts = dateStr.substring(0, 10).split("-");
  if (parts.length < 3) return false;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  return month === mes && year === ano;
}
