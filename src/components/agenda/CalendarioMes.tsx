import { useState } from "react";
import {
  AgendaItem,
  TIPO_CONFIG,
  corTexto,
  gridDoMes,
  isoDoDia,
  itensPorDia,
  hojeISO,
  DIAS_SEMANA,
} from "./agendaUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  mesRef: Date;
  itens: AgendaItem[];
  onItemClick: (item: AgendaItem) => void;
}

function ChipItem({
  item,
  onClick,
}: {
  item: AgendaItem;
  onClick: () => void;
}) {
  const cfg = TIPO_CONFIG[item.tipo];
  // Eventos do Google usam a cor real definida na agenda; os demais mantêm a cor do tipo.
  const usaCor = item.tipo === "google" && !!item.cor;
  const style = usaCor
    ? { backgroundColor: item.cor, color: corTexto(item.cor), borderColor: item.cor }
    : undefined;
  return (
    <button
      onClick={onClick}
      title={item.titulo}
      style={style}
      className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] leading-tight border transition-colors ${usaCor ? "hover:brightness-95" : cfg.chip} ${item.concluida ? "line-through opacity-60" : ""} ${item.atrasada ? "ring-1 ring-red-400" : ""}`}
    >
      {item.titulo}
    </button>
  );
}

export function CalendarioMes({ mesRef, itens, onItemClick }: Props) {
  const dias = gridDoMes(mesRef);
  const porDia = itensPorDia(itens);
  const mesAtual = mesRef.getMonth();
  const hoje = hojeISO();
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);

  const MAX_VISIVEL = 3;
  const itensDoDiaExpandido = diaExpandido
    ? porDia.get(diaExpandido) || []
    : [];

  return (
    <>
      <div className="rounded-lg border overflow-hidden bg-card">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-[11px] font-semibold text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const iso = isoDoDia(dia);
            const doMes = dia.getMonth() === mesAtual;
            const ehHoje = iso === hoje;
            const lista = porDia.get(iso) || [];
            const visiveis = lista.slice(0, MAX_VISIVEL);
            const extras = lista.length - visiveis.length;

            return (
              <div
                key={iso}
                className={`min-h-[104px] border-b border-r p-1 space-y-1 ${doMes ? "" : "bg-muted/20"}`}
              >
                <div className="flex justify-end">
                  <span
                    className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                      ehHoje
                        ? "bg-primary text-primary-foreground font-bold"
                        : doMes
                          ? "text-foreground"
                          : "text-muted-foreground/50"
                    }`}
                  >
                    {dia.getDate()}
                  </span>
                </div>
                {visiveis.map((it) => (
                  <ChipItem
                    key={`${it.tipo}-${it.id}`}
                    item={it}
                    onClick={() => onItemClick(it)}
                  />
                ))}
                {extras > 0 && (
                  <button
                    onClick={() => setDiaExpandido(iso)}
                    className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground px-1.5"
                  >
                    +{extras} mais
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog com todos os itens do dia */}
      <Dialog
        open={!!diaExpandido}
        onOpenChange={(o) => !o && setDiaExpandido(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {diaExpandido
                ? new Date(diaExpandido + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                    { weekday: "long", day: "2-digit", month: "long" },
                  )
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {itensDoDiaExpandido.map((it) => (
              <ChipItem
                key={`exp-${it.tipo}-${it.id}`}
                item={it}
                onClick={() => {
                  setDiaExpandido(null);
                  onItemClick(it);
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
