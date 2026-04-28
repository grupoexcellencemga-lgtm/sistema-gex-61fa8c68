import { useState, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Pencil, Trash2, Upload, Download, BarChart3, UserPlus, DollarSign, CreditCard, Loader2, MapPin, Paperclip, File, X, Receipt, Filter, Search, CheckCircle2, Package } from "lucide-react";
import { formatPhone, formatDate, formatCurrencyNullable as formatCurrency } from "@/lib/formatters";
import { EventoMetricsDialog } from "./EventoMetricsDialog";
import { EventoDespesasTab } from "./EventoDespesasTab";
import { EventoImport } from "./EventoImport";
import { toast } from "sonner";
import { useFormasPagamento, getFormaPagamentoLabel } from "@/hooks/useFormasPagamento";

// ---- Inline filter components ----
const MultiSelectFilter = ({ selected, onChange, options, label, searchable = false }: { selected: string[]; onChange: (v: string[]) => void; options: string[]; label: string; searchable?: boolean }) => {
  const [search, setSearch] = useState("");
  const toggle = (opt: string) => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  const filtered = searchable && search ? options.filter(o => o.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-7 text-xs w-full justify-start gap-1 font-normal ${selected.length > 0 ? "border-primary text-primary" : ""}`}>
          <Filter className="h-3 w-3" />
          {selected.length > 0 ? `${selected.length} selecionado(s)` : "Filtrar"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" onOpenAutoFocus={e => { if (searchable) e.preventDefault(); }}>
        <div className="p-2 border-b flex items-center justify-between">
          <span className="text-xs font-medium">{label}</span>
          {selected.length > 0 && <button className="text-xs text-destructive hover:underline" onClick={() => onChange([])}>Limpar</button>}
        </div>
        {searchable && <div className="p-2 border-b"><Input placeholder="Buscar..." className="h-7 text-xs" value={search} onChange={e => setSearch(e.target.value)} /></div>}
        <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
          {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Nenhum resultado</p>}
          {filtered.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent cursor-pointer">
              <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="h-3.5 w-3.5" />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface Props {
  evento: any;
  onBack: () => void;
  onEditEvento: (e: any) => void;
  currentUserName: string | null;
  produtos: any[];
  turmas: any[];
}

export function ParticipantesSection({ evento, onBack, onEditEvento, currentUserName, produtos, turmas }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: formasPagamento = [] } = useFormasPagamento();
  const comprovanteInputRef = useRef<HTMLInputElement>(null);

  const [addParticipanteOpen, setAddParticipanteOpen] = useState(false);
  const [partForm, setPartForm] = useState({ nome: "", email: "", telefone: "", observacoes: "", tipo_participante: "", convidado_por: "" });
  const [alunoSearch, setAlunoSearch] = useState("");
  const [selectedAlunoId, setSelectedAlunoId] = useState<string | null>(null);

  const [selectedParticipante, setSelectedParticipante] = useState<any>(null);
  const [partDetailOpen, setPartDetailOpen] = useState(false);
  const [payForm, setPayForm] = useState({ status_pagamento: "pendente", forma_pagamento: "", data_pagamento: "", valor: "", conta_bancaria_id: "" });
  const [editPartForm, setEditPartForm] = useState({ nome: "", email: "", telefone: "", observacoes: "", tipo_participante: "", convidado_por: "" });
  const [isEditingParticipante, setIsEditingParticipante] = useState(false);

  const [metricsOpen, setMetricsOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploadingComprovante, setUploadingComprovante] = useState(false);

  const [partFilters, setPartFilters] = useState<{
    presenca: string[]; nome: string[]; email: string[]; telefone: string[]; tipo: string[]; pagamento: string[]; adicionado: string[]; valor: string;
  }>({ presenca: [], nome: [], email: [], telefone: [], tipo: [], pagamento: [], adicionado: [], valor: "" });
  const setPartFilter = (key: string, value: any) => setPartFilters(prev => ({ ...prev, [key]: value }));

  // Queries
  const { data: participantes = [] } = useQuery({
    queryKey: ["participantes_eventos", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("participantes_eventos").select("*").eq("evento_id", evento.id).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("id, nome").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: alunosCadastrados = [] } = useQuery({
    queryKey: ["alunos-evento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alunos").select("id, nome, email, telefone").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const addParticipanteMutation = useMutation({
    mutationFn: async (data: typeof partForm) => {
      const { error } = await supabase.from("participantes_eventos").insert({
        evento_id: evento.id, nome: data.nome.trim(), email: data.email.trim() || null,
        telefone: data.telefone.replace(/\D/g, "") || null, observacoes: data.observacoes.trim() || null,
        valor: evento.pago ? (evento.valor || 0) : 0, status_pagamento: evento.pago ? "pendente" : "gratuito",
        tipo_participante: data.tipo_participante || null,
        convidado_por: data.tipo_participante === "convidado" ? (data.convidado_por.trim() || null) : null,
        adicionado_por_nome: currentUserName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      queryClient.invalidateQueries({ queryKey: ["all_participantes_eventos"] });
      toast.success("Participante adicionado");
      setAddParticipanteOpen(false);
      setPartForm({ nome: "", email: "", telefone: "", observacoes: "", tipo_participante: "", convidado_por: "" });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteParticipanteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("participantes_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      queryClient.invalidateQueries({ queryKey: ["all_participantes_eventos"] });
      toast.success("Participante removido");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("participantes_eventos").update({
        status_pagamento: data.status_pagamento, forma_pagamento: data.forma_pagamento || null,
        data_pagamento: data.data_pagamento || null, valor: data.valor, conta_bancaria_id: data.conta_bancaria_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] }); toast.success("Pagamento atualizado"); setPartDetailOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateParticipanteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("participantes_eventos").update({
        nome: data.nome, email: data.email, telefone: data.telefone, observacoes: data.observacoes,
        tipo_participante: data.tipo_participante, convidado_por: data.convidado_por,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] }); toast.success("Participante atualizado"); setIsEditingParticipante(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const togglePresencaMutation = useMutation({
    mutationFn: async ({ id, presenca }: { id: string; presenca: boolean }) => {
      const { error } = await supabase.from("participantes_eventos").update({
        presenca, presenca_marcada_em: presenca ? new Date().toISOString() : null,
        presenca_marcada_por: presenca ? currentUserName : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] }),
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // Comprovante
  const handleComprovanteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedParticipante) return;
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) { toast.error("Tipo de arquivo não suportado. Use PDF, PNG, JPG ou Word."); return; }
    setUploadingComprovante(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${evento.id}/${selectedParticipante.id}.${ext}`;
      if (selectedParticipante.comprovante_url) {
        const oldPath = selectedParticipante.comprovante_url.split("/comprovantes_eventos/")[1];
        if (oldPath) await supabase.storage.from("comprovantes_eventos").remove([oldPath]);
      }
      const { error: uploadError } = await supabase.storage.from("comprovantes_eventos").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("comprovantes_eventos").getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("participantes_eventos").update({ comprovante_url: urlData.publicUrl }).eq("id", selectedParticipante.id);
      if (updateError) throw updateError;
      setSelectedParticipante((prev: any) => ({ ...prev, comprovante_url: urlData.publicUrl }));
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Comprovante anexado!");
    } catch (err: any) { toast.error("Erro ao enviar comprovante: " + err.message); }
    finally { setUploadingComprovante(false); if (comprovanteInputRef.current) comprovanteInputRef.current.value = ""; }
  };

  const handleComprovanteDelete = async () => {
    if (!selectedParticipante?.comprovante_url) return;
    try {
      const oldPath = selectedParticipante.comprovante_url.split("/comprovantes_eventos/")[1];
      if (oldPath) await supabase.storage.from("comprovantes_eventos").remove([oldPath]);
      await supabase.from("participantes_eventos").update({ comprovante_url: null }).eq("id", selectedParticipante.id);
      setSelectedParticipante((prev: any) => ({ ...prev, comprovante_url: null }));
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos"] });
      toast.success("Comprovante removido");
    } catch (err: any) { toast.error("Erro ao remover: " + err.message); }
  };

  // Helpers
  const openParticipanteDetail = (p: any) => {
    setSelectedParticipante(p);
    setPayForm({ status_pagamento: p.status_pagamento || "pendente", forma_pagamento: p.forma_pagamento || "", data_pagamento: p.data_pagamento || "", valor: p.valor != null ? String(p.valor) : String(evento?.valor || 0), conta_bancaria_id: p.conta_bancaria_id || "" });
    setEditPartForm({ nome: p.nome || "", email: p.email || "", telefone: p.telefone ? formatPhone(p.telefone) : "", observacoes: p.observacoes || "", tipo_participante: p.tipo_participante || "", convidado_por: p.convidado_por || "" });
    setIsEditingParticipante(false);
    setPartDetailOpen(true);
  };

  const saveParticipanteEdit = () => {
    if (!selectedParticipante || !editPartForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    updateParticipanteMutation.mutate({ id: selectedParticipante.id, data: { nome: editPartForm.nome.trim(), email: editPartForm.email.trim() || null, telefone: editPartForm.telefone.replace(/\D/g, "") || null, observacoes: editPartForm.observacoes.trim() || null, tipo_participante: editPartForm.tipo_participante || null, convidado_por: editPartForm.tipo_participante === "convidado" ? (editPartForm.convidado_por.trim() || null) : null } });
  };

  const savePayment = () => {
    if (!selectedParticipante) return;
    updatePaymentMutation.mutate({ id: selectedParticipante.id, data: { status_pagamento: payForm.status_pagamento, forma_pagamento: payForm.forma_pagamento || null, data_pagamento: payForm.data_pagamento || null, valor: payForm.valor ? parseFloat(payForm.valor) : 0, conta_bancaria_id: payForm.conta_bancaria_id || null } });
  };

  const saveParticipante = () => {
    if (!partForm.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    addParticipanteMutation.mutate(partForm);
  };

  const handleExportParticipantes = () => {
    if (participantes.length === 0) { toast.error("Nenhum participante para exportar."); return; }
    import("xlsx").then(XLSX => {
      const statusLabel = (s: string) => s === "pago" ? "Pago" : s === "gratuito" ? "Gratuito" : s === "permuta" ? "Permuta" : "Pendente";
      const wsData = [
        ["Nome", "Email", "Telefone", "Tipo", "Presença", "Status Pagamento", "Forma Pagamento", "Valor", "Convidado por", "Adicionado por", "Observações"],
        ...participantes.map((p: any) => [p.nome || "", p.email || "", p.telefone || "", p.tipo_participante || "", p.presenca ? "Presente" : "Ausente", statusLabel(p.status_pagamento), getFormaPagamentoLabel(p.forma_pagamento, formasPagamento), p.valor ?? 0, p.convidado_por || "", p.adicionado_por_nome || "", p.observacoes || ""]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Participantes");
      XLSX.writeFile(wb, `participantes_${evento.nome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.xlsx`);
      toast.success("Planilha exportada com sucesso!");
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago": return <Badge className="bg-emerald-600 text-white">Pago</Badge>;
      case "pendente": return <Badge variant="destructive">Pendente</Badge>;
      case "gratuito": return <Badge variant="secondary">Gratuito</Badge>;
      case "permuta": return <Badge className="bg-amber-600 text-white">Permuta</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const tipoLabelFn = (t: string | null) => t === "comunidade" ? "Comunidade" : t === "convidado" ? "Convidado(a)" : t === "divulgacao" ? "Divulgação" : "";
  const statusLabelFn = (s: string) => s === "pago" ? "Pago" : s === "pendente" ? "Pendente" : s === "gratuito" ? "Gratuito" : s === "isento" ? "Isento" : s === "permuta" ? "Permuta" : s;

  const uniqueNomes = useMemo(() => [...new Set(participantes.map((p: any) => p.nome).filter(Boolean))].sort(), [participantes]);
  const uniqueEmails = useMemo(() => [...new Set(participantes.map((p: any) => p.email).filter(Boolean))].sort(), [participantes]);
  const uniqueTelefones = useMemo(() => [...new Set(participantes.map((p: any) => p.telefone ? formatPhone(p.telefone) : null).filter(Boolean))].sort() as string[], [participantes]);
  const uniqueTipos = useMemo(() => [...new Set(participantes.map((p: any) => tipoLabelFn(p.tipo_participante)).filter(Boolean))].sort(), [participantes]);
  const uniquePagamentos = useMemo(() => [...new Set(participantes.map((p: any) => statusLabelFn(p.status_pagamento)).filter(Boolean))].sort(), [participantes]);
  const uniqueAdicionados = useMemo(() => [...new Set(participantes.map((p: any) => p.adicionado_por_nome || "—"))].sort(), [participantes]);

  const isPago = evento.pago;
  const total = participantes.length;
  const pagos = isPago ? participantes.filter((p: any) => p.status_pagamento === "pago").length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{evento.nome}</h1>
            {isPago && <Badge className="bg-amber-600 text-white gap-1"><DollarSign className="h-3 w-3" />{formatCurrency(evento.valor)}</Badge>}
            {!isPago && <Badge variant="secondary">Gratuito</Badge>}
            {evento.comunidade && <Badge className="bg-blue-600 text-white">Comunidade</Badge>}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            {evento.data && <span>{formatDate(evento.data)}</span>}
            {evento.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{evento.local}</span>}
            {evento.tipo && <Badge variant="outline">{evento.tipo}</Badge>}
            {evento.responsavel && <span>Resp: {evento.responsavel}</span>}
            {evento.produto_id && (
              <Badge variant="outline" className="gap-1">
                <Package className="h-3 w-3" />
                {produtos.find((p: any) => p.id === evento.produto_id)?.nome || "Produto"}
                {evento.turma_id && ` / ${turmas.find((t: any) => t.id === evento.turma_id)?.nome || "Turma"}`}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onEditEvento(evento)}><Pencil className="h-4 w-4 mr-1" /> Editar Evento</Button>
      </div>

      {evento.descricao && <p className="text-sm text-muted-foreground">{evento.descricao}</p>}

      {/* Stats & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" /><span className="font-semibold">{total} participante(s){evento.limite_participantes ? ` / ${evento.limite_participantes} vagas` : ""}</span></div>
          {isPago && total > 0 && <span className="text-sm text-muted-foreground">{pagos}/{total} pagos • {formatCurrency(participantes.filter((p: any) => p.status_pagamento === "pago").reduce((sum: number, p: any) => sum + (p.valor || 0), 0))} recebido</span>}
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setImportFile(file);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Importar</Button>
          <Button variant="outline" size="sm" onClick={handleExportParticipantes}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          <Button variant="outline" size="sm" onClick={() => setMetricsOpen(true)}><BarChart3 className="h-4 w-4 mr-1" /> Métricas</Button>
          <Button size="sm" onClick={() => { setPartForm({ nome: "", email: "", telefone: "", observacoes: "", tipo_participante: "", convidado_por: "" }); setAlunoSearch(""); setSelectedAlunoId(null); setAddParticipanteOpen(true); }}><UserPlus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </div>
      </div>

      {importFile && (
        <EventoImport eventoId={evento.id} eventoNome={evento.nome} isPago={isPago} valorEvento={evento.valor} currentUserName={currentUserName} file={importFile} onClose={() => setImportFile(null)} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="participantes" className="w-full">
        <TabsList>
          <TabsTrigger value="participantes" className="gap-1"><Users className="h-4 w-4" /> Participantes</TabsTrigger>
          <TabsTrigger value="despesas" className="gap-1"><Receipt className="h-4 w-4" /> Despesas</TabsTrigger>
        </TabsList>

        <TabsContent value="participantes">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Presença</TableHead>
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
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.presenca} onChange={(v) => setPartFilter("presenca", v)} options={["Presente", "Ausente"]} label="Presença" /></TableHead>
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.nome} onChange={(v) => setPartFilter("nome", v)} options={uniqueNomes} label="Nome" searchable /></TableHead>
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.email} onChange={(v) => setPartFilter("email", v)} options={uniqueEmails} label="Email" searchable /></TableHead>
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.telefone} onChange={(v) => setPartFilter("telefone", v)} options={uniqueTelefones} label="Telefone" searchable /></TableHead>
                    {evento.comunidade && <TableHead className="p-1"><MultiSelectFilter selected={partFilters.tipo} onChange={(v) => setPartFilter("tipo", v)} options={uniqueTipos} label="Tipo" /></TableHead>}
                    <TableHead className="p-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={partFilters.valor} onChange={e => setPartFilter("valor", e.target.value)} /></TableHead>
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.pagamento} onChange={(v) => setPartFilter("pagamento", v)} options={uniquePagamentos} label="Pagamento" /></TableHead>
                    <TableHead className="p-1"><MultiSelectFilter selected={partFilters.adicionado} onChange={(v) => setPartFilter("adicionado", v)} options={uniqueAdicionados} label="Adicionado" /></TableHead>
                    <TableHead className="p-1" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const matchMulti = (val: string, filter: string[]) => filter.length === 0 || filter.includes(val);
                    const match = (val: string, filter: string) => !filter || val.toLowerCase().includes(filter.toLowerCase());

                    const filtered = participantes.filter((p: any) => {
                      if (partFilters.presenca.length > 0) { const presLabel = p.presenca ? "Presente" : "Ausente"; if (!partFilters.presenca.includes(presLabel)) return false; }
                      if (!matchMulti(p.nome || "", partFilters.nome)) return false;
                      if (!matchMulti(p.email || "", partFilters.email)) return false;
                      if (!matchMulti(p.telefone ? formatPhone(p.telefone) : "", partFilters.telefone)) return false;
                      if (evento.comunidade && !matchMulti(tipoLabelFn(p.tipo_participante), partFilters.tipo)) return false;
                      if (!match(formatCurrency(p.valor), partFilters.valor)) return false;
                      if (!matchMulti(statusLabelFn(p.status_pagamento), partFilters.pagamento)) return false;
                      if (!matchMulti(p.adicionado_por_nome || "—", partFilters.adicionado)) return false;
                      return true;
                    });

                    if (filtered.length === 0) return (
                      <TableRow><TableCell colSpan={evento.comunidade ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        {participantes.length === 0 ? 'Nenhum participante cadastrado. Use "Importar Planilha" ou "Adicionar" para incluir participantes.' : "Nenhum participante encontrado com os filtros aplicados."}
                      </TableCell></TableRow>
                    );

                    return filtered.map((p: any) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => openParticipanteDetail(p)}>
                        <TableCell className="text-center" onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex flex-col items-center gap-0.5">
                            <Checkbox checked={!!p.presenca} onCheckedChange={(checked) => togglePresencaMutation.mutate({ id: p.id, presenca: !!checked })} />
                            {p.presenca && p.presenca_marcada_em && (
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                {new Date(p.presenca_marcada_em).toLocaleDateString("pt-BR")} {new Date(p.presenca_marcada_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                {p.presenca_marcada_por && <><br/>por {p.presenca_marcada_por}</>}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-sm">{p.email || "—"}</TableCell>
                        <TableCell className="text-sm">{p.telefone ? formatPhone(p.telefone) : "—"}</TableCell>
                        {evento.comunidade && (
                          <TableCell className="text-sm">
                            {p.tipo_participante === "comunidade" && <Badge variant="secondary">Comunidade</Badge>}
                            {p.tipo_participante === "convidado" && <Badge variant="outline">Convidado(a)</Badge>}
                            {p.tipo_participante === "divulgacao" && <Badge className="bg-purple-600 text-white">Divulgação</Badge>}
                            {!p.tipo_participante && "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-sm">{formatCurrency(p.valor)}</TableCell>
                        <TableCell>{getStatusBadge(p.status_pagamento)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.adicionado_por_nome || "—"}</TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { openParticipanteDetail(p); setIsEditingParticipante(true); }}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Remover este participante?")) deleteParticipanteMutation.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <EventoDespesasTab eventoId={evento.id} eventoProdutoId={evento.produto_id} eventoTurmaId={evento.turma_id} />
        </TabsContent>
      </Tabs>

      {/* Participant Detail / Payment Dialog */}
      <Dialog open={partDetailOpen} onOpenChange={(o) => { setPartDetailOpen(o); if (!o) setIsEditingParticipante(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> {selectedParticipante?.nome}</DialogTitle>
            <DialogDescription>Informações do participante e pagamento</DialogDescription>
          </DialogHeader>
          {selectedParticipante && (
            <div className="space-y-4">
              {isEditingParticipante ? (
                <div className="space-y-3">
                  <div className="space-y-2"><Label>Nome *</Label><Input value={editPartForm.nome} onChange={(e) => setEditPartForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" /></div>
                  <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={editPartForm.email} onChange={(e) => setEditPartForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Telefone</Label><Input value={editPartForm.telefone} onChange={(e) => setEditPartForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
                  <div className="space-y-2"><Label>Observações</Label><Input value={editPartForm.observacoes} onChange={(e) => setEditPartForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
                  {evento.comunidade && (
                    <>
                      <div className="space-y-2">
                        <Label>Tipo de participante</Label>
                        <Select value={editPartForm.tipo_participante} onValueChange={(v) => setEditPartForm(f => ({ ...f, tipo_participante: v, convidado_por: v !== "convidado" ? "" : f.convidado_por }))}>
                          <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                          <SelectContent><SelectItem value="comunidade">Comunidade</SelectItem><SelectItem value="convidado">Convidado(a)</SelectItem><SelectItem value="divulgacao">Divulgação</SelectItem></SelectContent>
                        </Select>
                      </div>
                      {editPartForm.tipo_participante === "convidado" && (
                        <div className="space-y-2"><Label>Convidado(a) por</Label><Input value={editPartForm.convidado_por} onChange={(e) => setEditPartForm(f => ({ ...f, convidado_por: e.target.value }))} placeholder="Nome de quem convidou" /></div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setIsEditingParticipante(false)}>Cancelar</Button>
                    <Button className="flex-1" onClick={saveParticipanteEdit} disabled={updateParticipanteMutation.isPending}>
                      {updateParticipanteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar Dados
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Dados do participante</span>
                    <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setIsEditingParticipante(true)}><Pencil className="h-3 w-3" /> Editar</Button>
                  </div>
                  <div><span className="text-muted-foreground">E-mail:</span><p className="font-medium break-all">{selectedParticipante.email || "—"}</p></div>
                  <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{selectedParticipante.telefone ? formatPhone(selectedParticipante.telefone) : "—"}</p></div>
                  {evento.comunidade && <div><span className="text-muted-foreground">Tipo:</span><p className="font-medium">{selectedParticipante.tipo_participante === "comunidade" ? "Comunidade" : selectedParticipante.tipo_participante === "convidado" ? "Convidado(a)" : selectedParticipante.tipo_participante === "divulgacao" ? "Divulgação" : "—"}</p></div>}
                  {evento.comunidade && selectedParticipante.tipo_participante === "convidado" && selectedParticipante.convidado_por && <div><span className="text-muted-foreground">Convidado(a) por:</span><p className="font-medium">{selectedParticipante.convidado_por}</p></div>}
                  {selectedParticipante.observacoes && <div><span className="text-muted-foreground">Observações:</span><p className="font-medium">{selectedParticipante.observacoes}</p></div>}
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2"><DollarSign className="h-4 w-4" /> Informações de Pagamento</h3>
                <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0" value={payForm.valor} onChange={(e) => setPayForm(f => ({ ...f, valor: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Status do pagamento</Label>
                  <Select value={payForm.status_pagamento} onValueChange={(v) => setPayForm(f => ({ ...f, status_pagamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="gratuito">Gratuito</SelectItem><SelectItem value="permuta">Permuta</SelectItem></SelectContent>
                  </Select>
                </div>
                {payForm.status_pagamento === "pago" && (
                  <>
                    <div className="space-y-2">
                      <Label>Forma de pagamento</Label>
                      <Select value={payForm.forma_pagamento} onValueChange={(v) => setPayForm(f => ({ ...f, forma_pagamento: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {formasPagamento.length === 0 ? (
                            <SelectItem value="nenhuma_forma_pagamento" disabled>
                              Nenhuma forma cadastrada
                            </SelectItem>
                          ) : (
                            formasPagamento.map((forma) => (
                              <SelectItem key={forma.id} value={forma.codigo}>
                                {forma.nome}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Data do pagamento</Label><Input type="date" value={payForm.data_pagamento} onChange={(e) => setPayForm(f => ({ ...f, data_pagamento: e.target.value }))} /></div>
                    <div className="space-y-2">
                      <Label>Conta Bancária</Label>
                      <Select value={payForm.conta_bancaria_id} onValueChange={(v) => setPayForm(f => ({ ...f, conta_bancaria_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar banco..." /></SelectTrigger>
                        <SelectContent>{contasBancarias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              <Button className="w-full" onClick={savePayment} disabled={updatePaymentMutation.isPending}>
                {updatePaymentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar Pagamento
              </Button>

              {isPago && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Paperclip className="h-4 w-4" /> Comprovante de Pagamento</h3>
                  <input ref={comprovanteInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={handleComprovanteUpload} />
                  {selectedParticipante?.comprovante_url ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                      <File className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1">Comprovante anexado</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild><a href={selectedParticipante.comprovante_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={handleComprovanteDelete}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full gap-2" onClick={() => comprovanteInputRef.current?.click()} disabled={uploadingComprovante}>
                      {uploadingComprovante ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploadingComprovante ? "Enviando..." : "Anexar Comprovante"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Formatos aceitos: PDF, PNG, JPG, Word</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Participante Dialog */}
      <Dialog open={addParticipanteOpen} onOpenChange={setAddParticipanteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Participante</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Buscar aluno cadastrado</Label>
              <div className="relative">
                <Input value={alunoSearch} onChange={(e) => { setAlunoSearch(e.target.value); setSelectedAlunoId(null); }} placeholder="Digite o nome do aluno..." />
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {alunoSearch.length >= 2 && !selectedAlunoId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {alunosCadastrados.filter((a: any) => a.nome.toLowerCase().includes(alunoSearch.toLowerCase())).slice(0, 8).map((a: any) => (
                    <button key={a.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b last:border-b-0" onClick={() => { setSelectedAlunoId(a.id); setAlunoSearch(a.nome); setPartForm(f => ({ ...f, nome: a.nome, email: a.email || "", telefone: a.telefone ? formatPhone(a.telefone) : "" })); }}>
                      <span className="font-medium">{a.nome}</span>{a.email && <span className="text-muted-foreground ml-2 text-xs">{a.email}</span>}
                    </button>
                  ))}
                  {alunosCadastrados.filter((a: any) => a.nome.toLowerCase().includes(alunoSearch.toLowerCase())).length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum aluno encontrado</p>}
                </div>
              )}
              {selectedAlunoId && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Aluno selecionado — campos preenchidos automaticamente</p>}
            </div>

            <div className="relative flex items-center gap-2"><div className="flex-1 border-t" /><span className="text-xs text-muted-foreground">ou preencha manualmente</span><div className="flex-1 border-t" /></div>

            <div className="space-y-2"><Label>Nome *</Label><Input value={partForm.nome} onChange={(e) => { setPartForm(f => ({ ...f, nome: e.target.value })); if (selectedAlunoId) { setSelectedAlunoId(null); setAlunoSearch(""); } }} placeholder="Nome completo" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={partForm.email} onChange={(e) => setPartForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={partForm.telefone} onChange={(e) => setPartForm(f => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(00) 00000-0000" maxLength={15} /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Input value={partForm.observacoes} onChange={(e) => setPartForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            {evento.comunidade && (
              <>
                <div className="space-y-2">
                  <Label>Tipo de participante</Label>
                  <Select value={partForm.tipo_participante} onValueChange={(v) => setPartForm(f => ({ ...f, tipo_participante: v, convidado_por: v !== "convidado" ? "" : f.convidado_por }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent><SelectItem value="comunidade">Comunidade</SelectItem><SelectItem value="convidado">Convidado(a)</SelectItem><SelectItem value="divulgacao">Divulgação</SelectItem></SelectContent>
                  </Select>
                </div>
                {partForm.tipo_participante === "convidado" && (
                  <div className="space-y-2"><Label>Convidado(a) por</Label><Input value={partForm.convidado_por} onChange={(e) => setPartForm(f => ({ ...f, convidado_por: e.target.value }))} placeholder="Nome de quem convidou" /></div>
                )}
              </>
            )}
            {isPago && <p className="text-sm text-muted-foreground">Valor do evento: <strong>{formatCurrency(evento.valor)}</strong> — será atribuído automaticamente ao participante.</p>}
            <Button onClick={saveParticipante} disabled={addParticipanteMutation.isPending} className="w-full">
              {addParticipanteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Adicionar Participante
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EventoMetricsDialog open={metricsOpen} onOpenChange={setMetricsOpen} participantes={participantes} evento={evento} />
    </div>
  );
}
