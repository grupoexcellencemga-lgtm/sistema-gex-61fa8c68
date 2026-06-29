import { eachDayOfInterval, format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ChecklistExecucaoRow } from "@/types";

interface Props {
  history: ChecklistExecucaoRow[];
  days: number;
}

export function ChecklistHistoryGrid({ history, days }: Props) {
  const byDate = new Map(history.map((e) => [e.data, e.concluido]));
  const interval = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });

  return (
    <div className="flex gap-1">
      {interval.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const concluido = byDate.get(dayStr);
        return (
          <div
            key={dayStr}
            title={`${format(day, "dd/MM", { locale: ptBR })} — ${concluido ? "concluído" : "não concluído"}`}
            className={cn(
              "h-4 w-4 rounded-sm",
              concluido ? "bg-green-500" : "bg-muted",
            )}
          />
        );
      })}
    </div>
  );
}
