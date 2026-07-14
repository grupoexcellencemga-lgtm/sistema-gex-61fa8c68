import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, X } from "lucide-react";
import {
  formatPhone,
  formatCurrencyNullable as formatCurrency,
} from "@/lib/formatters";
import { MultiSelectFilter } from "./MultiSelectFilter";
import {
  normalizarBusca,
  tipoLabelFn,
  statusLabelFn,
} from "./participantesUtils";
import { ParticipanteRow } from "./ParticipanteRow";

interface Props {
  evento: any;
  participantes: any[];
  encontrarAlunoDoParticipante: (p: any) => any;
  virarAlunoPending: boolean;
  onOpenDetail: (p: any) => void;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
  onVirarAluno: (p: any) => void;
  onTogglePresenca: (id: string, presenca: boolean) => void;
  podeMatricular?: boolean;
  matriculandoId?: string | null;
  onMatricular?: (p: any) => void;
  matriculadosAlunoIds?: string[];
}

export function ParticipantesTable({
  evento,
  participantes,
  encontrarAlunoDoParticipante,
  virarAlunoPending,
  onOpenDetail,
  onEdit,
  onDelete,
  onVirarAluno,
  onTogglePresenca,
  podeMatricular,
  matriculandoId,
  onMatricular,
  matriculadosAlunoIds,
}: Props) {
  const [partBusca, setPartBusca] = useState("");
  const [partFilters, setPartFilters] = useState<{
    presenca: string[];
    nome: string[];
    email: string[];
    telefone: string[];
    tipo: string[];
    pagamento: string[];
    adicionado: string[];
    valor: string;
  }>({
    presenca: [],
    nome: [],
    email: [],
    telefone: [],
    tipo: [],
    pagamento: [],
    adicionado: [],
    valor: "",
  });
  const setPartFilter = (key: string, value: any) =>
    setPartFilters((prev) => ({ ...prev, [key]: value }));

  const uniqueNomes = useMemo(
    () =>
      [
        ...new Set(participantes.map((p: any) => p.nome).filter(Boolean)),
      ].sort(),
    [participantes],
  );
  const uniqueEmails = useMemo(
    () =>
      [
        ...new Set(participantes.map((p: any) => p.email).filter(Boolean)),
      ].sort(),
    [participantes],
  );
  const uniqueTelefones = useMemo(
    () =>
      [
        ...new Set(
          participantes
            .map((p: any) => (p.telefone ? formatPhone(p.telefone) : null))
            .filter(Boolean),
        ),
      ].sort() as string[],
    [participantes],
  );
  const uniqueTipos = useMemo(
    () =>
      [
        ...new Set(
          participantes
            .map((p: any) => tipoLabelFn(p.tipo_participante))
            .filter(Boolean),
        ),
      ].sort(),
    [participantes],
  );
  const uniquePagamentos = useMemo(
    () =>
      [
        ...new Set(
          participantes
            .map((p: any) => statusLabelFn(p.status_pagamento))
            .filter(Boolean),
        ),
      ].sort(),
    [participantes],
  );
  const uniqueAdicionados = useMemo(
    () =>
      [
        ...new Set(participantes.map((p: any) => p.adicionado_por_nome || "—")),
      ].sort(),
    [participantes],
  );

  const matchMulti = (val: string, filter: string[]) =>
    filter.length === 0 || filter.includes(val);
  const match = (val: string, filter: string) =>
    !filter || val.toLowerCase().includes(filter.toLowerCase());

  const buscaTexto = normalizarBusca(partBusca);
  const buscaDigitos = partBusca.replace(/\D/g, "");

  const filtered = participantes.filter((p: any) => {
    if (buscaTexto || buscaDigitos) {
      const nomeN = normalizarBusca(p.nome);
      const emailN = normalizarBusca(p.email);
      const telDigitos = (p.telefone || "").replace(/\D/g, "");
      const achouTexto =
        !!buscaTexto &&
        (nomeN.includes(buscaTexto) || emailN.includes(buscaTexto));
      const achouTelefone =
        buscaDigitos.length > 0 && telDigitos.includes(buscaDigitos);
      if (!achouTexto && !achouTelefone) return false;
    }
    if (partFilters.presenca.length > 0) {
      const presLabel = p.presenca ? "Presente" : "Ausente";
      if (!partFilters.presenca.includes(presLabel)) return false;
    }
    if (!matchMulti(p.nome || "", partFilters.nome)) return false;
    if (!matchMulti(p.email || "", partFilters.email)) return false;
    if (
      !matchMulti(
        p.telefone ? formatPhone(p.telefone) : "",
        partFilters.telefone,
      )
    )
      return false;
    if (
      evento.comunidade &&
      !matchMulti(tipoLabelFn(p.tipo_participante), partFilters.tipo)
    )
      return false;
    if (!match(formatCurrency(p.valor), partFilters.valor)) return false;
    if (!matchMulti(statusLabelFn(p.status_pagamento), partFilters.pagamento))
      return false;
    if (!matchMulti(p.adicionado_por_nome || "—", partFilters.adicionado))
      return false;
    return true;
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="h-9 pl-8 pr-8"
              value={partBusca}
              onChange={(e) => setPartBusca(e.target.value)}
            />
            {partBusca && (
              <button
                type="button"
                onClick={() => setPartBusca("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24 text-center px-2">Presença</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              {evento.comunidade && <TableHead>Tipo</TableHead>}
              <TableHead>Valor</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Adicionado por</TableHead>
              <TableHead className="w-12" />
            </TableRow>
            <TableRow>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.presenca}
                  onChange={(v) => setPartFilter("presenca", v)}
                  options={["Presente", "Ausente"]}
                  label="Presença"
                />
              </TableHead>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.nome}
                  onChange={(v) => setPartFilter("nome", v)}
                  options={uniqueNomes}
                  label="Nome"
                  searchable
                />
              </TableHead>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.email}
                  onChange={(v) => setPartFilter("email", v)}
                  options={uniqueEmails}
                  label="Email"
                  searchable
                />
              </TableHead>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.telefone}
                  onChange={(v) => setPartFilter("telefone", v)}
                  options={uniqueTelefones}
                  label="Telefone"
                  searchable
                />
              </TableHead>
              {evento.comunidade && (
                <TableHead className="p-1">
                  <MultiSelectFilter
                    selected={partFilters.tipo}
                    onChange={(v) => setPartFilter("tipo", v)}
                    options={uniqueTipos}
                    label="Tipo"
                  />
                </TableHead>
              )}
              <TableHead className="p-1">
                <Input
                  placeholder="Filtrar..."
                  className="h-7 text-xs"
                  value={partFilters.valor}
                  onChange={(e) => setPartFilter("valor", e.target.value)}
                />
              </TableHead>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.pagamento}
                  onChange={(v) => setPartFilter("pagamento", v)}
                  options={uniquePagamentos}
                  label="Pagamento"
                />
              </TableHead>
              <TableHead className="p-1">
                <MultiSelectFilter
                  selected={partFilters.adicionado}
                  onChange={(v) => setPartFilter("adicionado", v)}
                  options={uniqueAdicionados}
                  label="Adicionado"
                />
              </TableHead>
              <TableHead className="p-1" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={evento.comunidade ? 9 : 8}
                  className="text-center py-8 text-muted-foreground"
                >
                  {participantes.length === 0
                    ? 'Nenhum participante cadastrado. Use "Importar Planilha" ou "Adicionar" para incluir participantes.'
                    : "Nenhum participante encontrado com os filtros aplicados."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => (
                <ParticipanteRow
                  key={p.id}
                  p={p}
                  isPago={!!evento.pago}
                  isComunidade={!!evento.comunidade}
                  alunoVinculado={encontrarAlunoDoParticipante(p)}
                  virarAlunoPending={virarAlunoPending}
                  onOpenDetail={onOpenDetail}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onVirarAluno={onVirarAluno}
                  onTogglePresenca={onTogglePresenca}
                  podeMatricular={podeMatricular}
                  matriculando={matriculandoId === p.id}
                  onMatricular={onMatricular}
                  jaMatriculado={
                    matriculadosAlunoIds?.includes(
                      encontrarAlunoDoParticipante(p)?.id,
                    ) ?? false
                  }
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
