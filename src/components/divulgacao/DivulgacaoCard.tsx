import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Pencil, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Divulgacao {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria: "Comunicado" | "Campanha" | "Evento" | "Treinamento";
  status: "Em breve" | "Em andamento" | "Conclu\u00EDdo";
  imagem_url?: string | null;
  responsavel_iniciais?: string | null;
  data?: string | null;
  created_at: string;
}

const CATEGORIA_COLORS: Record<string, string> = {
  Comunicado: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campanha: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Evento: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Treinamento: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

interface Props {
  divulgacao: Divulgacao;
  onEdit: (d: Divulgacao) => void;
  onDelete: (id: string) => void;
}

export function DivulgacaoCard({ divulgacao, onEdit, onDelete }: Props) {
  return (
    <Card className="group transition-shadow hover:shadow-md border bg-card">
      {divulgacao.imagem_url && (
        <div className="w-full h-32 overflow-hidden rounded-t-lg">
          <img src={divulgacao.imagem_url} alt={divulgacao.titulo} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-3 space-y-2">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORIA_COLORS[divulgacao.categoria] ?? "bg-muted text-muted-foreground"}`}>
          {divulgacao.categoria}
        </span>
        <p className="font-semibold text-sm leading-tight line-clamp-2">{divulgacao.titulo}</p>
        {divulgacao.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{divulgacao.descricao}</p>}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {divulgacao.data && (
              <span className="flex items-center gap-0.5">
                <CalendarDays className="h-3 w-3" />
                {format(new Date(divulgacao.data + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {divulgacao.responsavel_iniciais && (
              <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{divulgacao.responsavel_iniciais}</span>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(divulgacao)}><Pencil className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(divulgacao.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}