import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  Pencil,
  Upload,
  Download,
  BarChart3,
  UserPlus,
  DollarSign,
  MapPin,
  CheckCircle2,
  Package,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatDate,
  formatCurrencyNullable as formatCurrency,
} from "@/lib/formatters";

interface Props {
  evento: any;
  participantes: any[];
  produtos: any[];
  turmas: any[];
  onBack: () => void;
  onEditEvento: (e: any) => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
  onOpenMetrics: () => void;
  onOpenAdd: () => void;
}

export function ParticipantesHeader({
  evento,
  participantes,
  produtos,
  turmas,
  onBack,
  onEditEvento,
  onImportFile,
  onExport,
  onOpenMetrics,
  onOpenAdd,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPago = evento.pago;
  const total = participantes.length;
  const presentes = participantes.filter((p: any) => !!p.presenca).length;
  const ausentes = Math.max(total - presentes, 0);
  const percentualPresenca =
    total > 0 ? Math.round((presentes / total) * 100) : 0;
  const pagantes = isPago
    ? participantes.filter((p: any) => p.status_pagamento !== "gratuito" && p.status_pagamento !== "isento")
    : [];
  const pagos = pagantes.filter((p: any) => p.status_pagamento === "pago").length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{evento.nome}</h1>
            {isPago && (
              <Badge className="bg-amber-600 text-white gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(evento.valor)}
              </Badge>
            )}
            {!isPago && <Badge variant="secondary">Gratuito</Badge>}
            {evento.comunidade && (
              <Badge className="bg-blue-600 text-white">Comunidade</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            {evento.data && <span>{formatDate(evento.data)}</span>}
            {evento.local && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {evento.local}
              </span>
            )}
            {evento.tipo && <Badge variant="outline">{evento.tipo}</Badge>}
            {evento.responsavel && <span>Resp: {evento.responsavel}</span>}
            {evento.produto_id && (
              <Badge variant="outline" className="gap-1">
                <Package className="h-3 w-3" />
                {produtos.find((p: any) => p.id === evento.produto_id)?.nome ||
                  "Produto"}
                {evento.turma_id &&
                  ` / ${turmas.find((t: any) => t.id === evento.turma_id)?.nome || "Turma"}`}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEditEvento(evento)}
        >
          <Pencil className="h-4 w-4 mr-1" /> Editar Evento
        </Button>
      </div>

      {evento.descricao && (
        <p className="text-sm text-muted-foreground">{evento.descricao}</p>
      )}

      {/* Stats & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">
              {total} participante(s)
              {evento.limite_participantes
                ? ` / ${evento.limite_participantes} vagas`
                : ""}
            </span>
          </div>
          {isPago && pagantes.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {pagos}/{pagantes.length} pagos •{" "}
              {formatCurrency(
                pagantes
                  .filter((p: any) => p.status_pagamento === "pago")
                  .reduce((sum: number, p: any) => sum + (p.valor || 0), 0),
              )}{" "}
              recebido
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenMetrics}>
            <BarChart3 className="h-4 w-4 mr-1" /> Métricas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const link = `${window.location.origin}/inscricao/${evento.id}`;
              navigator.clipboard.writeText(link).then(() => toast.success("Link de inscrição copiado!"));
            }}
          >
            <Link2 className="h-4 w-4 mr-1" /> Link de inscrição
          </Button>
          <Button size="sm" onClick={onOpenAdd}>
            <UserPlus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Já chegaram
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                  {presentes}
                </p>
                <p className="text-xs text-muted-foreground">
                  participante(s) com presença marcada
                </p>
              </div>
              <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Ainda não vieram
                </p>
                <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {ausentes}
                </p>
                <p className="text-xs text-muted-foreground">
                  participante(s) sem presença marcada
                </p>
              </div>
              <Users className="h-9 w-9 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Presença geral
                </p>
                <p className="mt-1 text-3xl font-bold">{percentualPresenca}%</p>
                <p className="text-xs text-muted-foreground">
                  {presentes} de {total} participante(s)
                </p>
              </div>
              <BarChart3 className="h-9 w-9 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
