import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatPhone, formatCurrencyNullable as formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const COLUMN_MAP: Record<string, string> = {
  nome: "nome", name: "nome", "nome completo": "nome", participante: "nome",
  email: "email", "e-mail": "email",
  telefone: "telefone", celular: "telefone", phone: "telefone", whatsapp: "telefone",
  "observações": "observacoes", observacoes: "observacoes", obs: "observacoes",
};

const normalizeCol = (col: string): string | null => {
  const n = col.trim().toLowerCase().replace(/_/g, " ");
  return COLUMN_MAP[n] || null;
};

interface ParsedParticipante {
  nome: string;
  email: string | null;
  telefone: string | null;
  observacoes: string | null;
  valid: boolean;
  error?: string;
}

interface Props {
  eventoId: string;
  eventoNome: string;
  isPago: boolean;
  valorEvento: number;
  currentUserName: string | null;
  file: File;
  onClose: () => void;
}

export function EventoImport({ eventoId, eventoNome, isPago, valorEvento, currentUserName, file, onClose }: Props) {
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ParsedParticipante[]>([]);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (jsonRows.length === 0) { toast.error("Planilha vazia."); onClose(); return; }

        const headers = Object.keys(jsonRows[0]);
        const colMapping: Record<string, string> = {};
        headers.forEach(h => { const mapped = normalizeCol(h); if (mapped) colMapping[h] = mapped; });

        if (!Object.values(colMapping).includes("nome")) { toast.error("Coluna 'Nome' não encontrada na planilha."); onClose(); return; }

        const allParsed: ParsedParticipante[] = jsonRows.map((row, idx) => {
          const mapped: Record<string, any> = {};
          Object.entries(row).forEach(([key, val]) => { const field = colMapping[key]; if (field) mapped[field] = val; });
          const nome = String(mapped.nome || "").trim();
          const valid = nome.length > 0;
          return { nome, email: mapped.email ? String(mapped.email).trim() : null, telefone: mapped.telefone ? String(mapped.telefone).replace(/\D/g, "").slice(0, 11) : null, observacoes: mapped.observacoes ? String(mapped.observacoes).trim() : null, valid, error: valid ? undefined : `Linha ${idx + 2}: Nome é obrigatório` };
        });

        const seen = new Set<string>();
        let removedCount = 0;
        const parsed = allParsed.filter(r => {
          if (!r.valid) return true;
          const key = r.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
          if (seen.has(key)) { removedCount++; return false; }
          seen.add(key);
          return true;
        });

        if (removedCount > 0) toast.info(`${removedCount} duplicata(s) removida(s) da planilha.`);
        setParsedRows(parsed);
        setDialogOpen(true);
      } catch { toast.error("Erro ao ler o arquivo."); onClose(); }
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  const handleImportConfirm = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error("Nenhuma linha válida"); return; }

    setImporting(true);
    try {
      const { data: existing } = await supabase.from("participantes_eventos").select("nome").eq("evento_id", eventoId);
      const existingNames = new Set((existing || []).map((p: any) => p.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ")));

      const newRows = validRows.filter(r => {
        const key = r.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
        return !existingNames.has(key);
      });

      const skipped = validRows.length - newRows.length;

      if (newRows.length === 0) {
        toast.info("Todos os participantes já estão cadastrados neste evento.");
        handleClose();
        return;
      }

      const toInsert = newRows.map(r => ({
        evento_id: eventoId, nome: r.nome, email: r.email, telefone: r.telefone, observacoes: r.observacoes,
        valor: isPago ? (valorEvento || 0) : 0, status_pagamento: isPago ? "pendente" : "gratuito",
        adicionado_por_nome: currentUserName,
      }));

      const { error } = await supabase.from("participantes_eventos").insert(toInsert);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      queryClient.invalidateQueries({ queryKey: ["all_participantes_eventos"] });
      const msg = skipped > 0 ? `${newRows.length} importado(s), ${skipped} já existente(s) ignorado(s).` : `${newRows.length} participante(s) importado(s)!`;
      toast.success(msg);
      handleClose();
    } catch (err: any) { toast.error("Erro ao importar: " + err.message); }
    finally { setImporting(false); }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setParsedRows([]);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importar Participantes</DialogTitle>
          <DialogDescription>
            Importando para o evento: <strong>{eventoNome}</strong>
            {isPago && <> — Valor por participante: <strong>{formatCurrency(valorEvento)}</strong></>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-3">
          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} válido(s)</Badge>
          {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> {invalidCount} com erro</Badge>}
        </div>

        <div className="overflow-auto flex-1 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedRows.map((row, idx) => (
                <TableRow key={idx} className={!row.valid ? "bg-destructive/10" : ""}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{row.nome || "—"}</TableCell>
                  <TableCell className="text-sm">{row.email || "—"}</TableCell>
                  <TableCell className="text-sm">{row.telefone ? formatPhone(row.telefone) : "—"}</TableCell>
                  <TableCell className="text-sm">{row.observacoes || "—"}</TableCell>
                  <TableCell>{row.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-destructive">{row.error}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleImportConfirm} disabled={importing || validCount === 0}>
            {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Importar {validCount} participante(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
