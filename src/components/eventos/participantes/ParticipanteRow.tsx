import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import {
  formatPhone,
  formatCurrencyNullable as formatCurrency,
} from "@/lib/formatters";
import { getStatusBadge } from "./participantesUtils";

interface Props {
  p: any;
  isComunidade: boolean;
  alunoVinculado: any;
  virarAlunoPending: boolean;
  onOpenDetail: (p: any) => void;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
  onVirarAluno: (p: any) => void;
  onTogglePresenca: (id: string, presenca: boolean) => void;
  podeMatricular?: boolean;
  matriculando?: boolean;
  onMatricular?: (p: any) => void;
  jaMatriculado?: boolean;
}

export function ParticipanteRow({
  p,
  isComunidade,
  alunoVinculado,
  virarAlunoPending,
  onOpenDetail,
  onEdit,
  onDelete,
  onVirarAluno,
  onTogglePresenca,
  podeMatricular,
  matriculando,
  onMatricular,
  jaMatriculado,
}: Props) {
  return (
    <TableRow
      key={p.id}
      className="cursor-pointer hover:bg-secondary/50"
      onClick={() => onOpenDetail(p)}
    >
      <TableCell className="text-center" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex flex-col items-center gap-0.5">
          <Checkbox
            checked={!!p.presenca}
            onCheckedChange={(checked) => onTogglePresenca(p.id, !!checked)}
          />
          {p.presenca && p.presenca_marcada_em && (
            <span className="text-[10px] text-muted-foreground leading-tight">
              {new Date(p.presenca_marcada_em).toLocaleDateString("pt-BR")}{" "}
              {new Date(p.presenca_marcada_em).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {p.presenca_marcada_por && (
                <>
                  <br />
                  por {p.presenca_marcada_por}
                </>
              )}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="font-medium">{p.nome}</TableCell>
      <TableCell className="text-sm">{p.email || "—"}</TableCell>
      <TableCell className="text-sm">
        {p.telefone ? formatPhone(p.telefone) : "—"}
      </TableCell>
      {isComunidade && (
        <TableCell className="text-sm">
          {p.tipo_participante === "comunidade" && (
            <Badge variant="secondary">Comunidade</Badge>
          )}
          {p.tipo_participante === "convidado" && (
            <Badge variant="outline">Convidado(a)</Badge>
          )}
          {p.tipo_participante === "divulgacao" && (
            <Badge className="bg-purple-600 text-white">Divulgação</Badge>
          )}
          {!p.tipo_participante && "—"}
        </TableCell>
      )}
      <TableCell className="text-sm">{formatCurrency(p.valor)}</TableCell>
      <TableCell>{getStatusBadge(p.status_pagamento)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {p.adicionado_por_nome || "—"}
      </TableCell>
      <TableCell onClick={(ev) => ev.stopPropagation()}>
        <div className="flex flex-wrap justify-end gap-1">
          {podeMatricular && jaMatriculado && (
            <Badge className="h-7 px-2 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
              Matriculado(a)
            </Badge>
          )}
          {podeMatricular && onMatricular && !jaMatriculado && (
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={matriculando}
              onClick={() => onMatricular(p)}
              title="Vira aluno (se preciso) e abre a matrícula na turma do evento"
            >
              {matriculando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Matricular na turma"
              )}
            </Button>
          )}
          <Button
            variant={alunoVinculado ? "secondary" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!!alunoVinculado || virarAlunoPending}
            onClick={() => onVirarAluno(p)}
          >
            {virarAlunoPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : alunoVinculado ? (
              "Já é aluno"
            ) : (
              "Virar aluno"
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(p)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => {
              if (confirm("Remover este participante?")) onDelete(p.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
