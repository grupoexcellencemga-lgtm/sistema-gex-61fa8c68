import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft, Plus, Settings2, Globe, Link2, Upload,
  ImageIcon, ExternalLink, X, Loader2, Monitor, Smartphone,
  Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Palette,
} from "lucide-react";
import { toast } from "sonner";
import type { Secao, SecaoTipo, SecaoEstilo } from "./types";
import { SECAO_LABELS, SECAO_ICONS } from "./types";
import { SecaoEditor } from "./SecaoEditor";
import { PaginaPublicaCanvas } from "./PaginaPublicaCanvas";
import { BlocosPanel } from "./BlocosPanel";

/* ─── Helpers ─────────────────────────────────────────────── */

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const DEFAULT_DADOS: Record<SecaoTipo, any> = {
  hero:         { subtitulo: "", cta_texto: "Quero me inscrever" },
  sobre:        { texto: "", imagem_url: "" },
  palestrantes: { palestrantes: [] },
  agenda:       { itens: [] },
  depoimentos:  { depoimentos: [] },
  local:        { endereco: "", link_mapa: "" },
  faq:          { faqs: [] },
  beneficios:   {
    titulo_secao: "Por que participar?",
    beneficios: [
      { id: crypto.randomUUID(), icone: "✅", titulo: "Aprendizado prático", texto: "Conteúdo direto ao ponto com aplicação imediata." },
      { id: crypto.randomUUID(), icone: "🎯", titulo: "Foco em resultados", texto: "Metodologia voltada para transformação real." },
      { id: crypto.randomUUID(), icone: "🚀", titulo: "Networking de valor", texto: "Conecte-se com pessoas que pensam como você." },
    ],
  },
  garantias: {
    garantias: [
      { id: crypto.randomUUID(), icone: "✅", texto: "100% online e ao vivo" },
      { id: crypto.randomUUID(), icone: "🔒", texto: "Acesso garantido" },
      { id: crypto.randomUUID(), icone: "📜", texto: "Certificado incluso" },
    ],
  },
};

type LeftPanel = "blocos" | "settings" | null;
type RightTab = "conteudo" | "estilo";

/* ─── Estilo panel ────────────────────────────────────────── */

const PRESET_COLORS = [
  { label: "Padrão",        value: "" },
  { label: "Branco",        value: "#ffffff" },
  { label: "Cinza claro",   value: "#f8f9fa" },
  { label: "Cinza",         value: "#e9ecef" },
  { label: "Escuro",        value: "#1e2022" },
  { label: "Preto",         value: "#000000" },
  { label: "Âmbar suave",   value: "#fffbeb" },
  { label: "Cyan suave",    value: "#ecfeff" },
];

function EstiloPanel({
  estilo,
  onChange,
}: {
  estilo?: SecaoEstilo;
  onChange: (estilo: SecaoEstilo) => void;
}) {
  const atual = estilo ?? {};
  const cor = atual.bg_color ?? "";

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Cor de fundo</Label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              title={preset.label}
              onClick={() => onChange({ ...atual, bg_color: preset.value || undefined })}
              className={`h-8 rounded-md border-2 transition-all ${
                cor === preset.value
                  ? "border-cyan-500 scale-105"
                  : "border-border hover:border-cyan-300"
              } ${!preset.value ? "bg-[repeating-linear-gradient(45deg,#ddd_0px,#ddd_1px,white_1px,white_6px)]" : ""}`}
              style={preset.value ? { backgroundColor: preset.value } : {}}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Personalizar</Label>
          <input
            type="color"
            value={cor || "#ffffff"}
            onChange={(e) => onChange({ ...atual, bg_color: e.target.value })}
            className="h-8 w-12 rounded border cursor-pointer"
          />
          {cor && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onChange({ ...atual, bg_color: undefined })}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="border-t" />

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Espaçamento vertical</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {(["none", "sm", "md", "lg"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...atual, padding: p })}
              className={`h-7 rounded text-xs font-medium border transition-all ${
                (atual.padding ?? "md") === p
                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600"
                  : "border-border hover:border-cyan-300"
              }`}
            >
              {{ none: "Nenhum", sm: "Pequeno", md: "Médio", lg: "Grande" }[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PaginaPublicaEditor ─────────────────────────────────── */

export function PaginaPublicaEditor({
  evento,
  open,
  onClose,
}: {
  evento: any;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [localEvento, setLocalEvento] = useState<any>(evento);
  const [localSecoes, setLocalSecoes] = useState<Secao[]>(() =>
    Array.isArray(evento.pagina_secoes)
      ? [...evento.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
      : []
  );

  const [leftPanel, setLeftPanel] = useState<LeftPanel>(null);
  const [addAtIndex, setAddAtIndex] = useState<number>(0);
  const [activeSecaoId, setActiveSecaoId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("conteudo");

  useEffect(() => {
    if (open) {
      setLocalEvento(evento);
      setLocalSecoes(
        Array.isArray(evento.pagina_secoes)
          ? [...evento.pagina_secoes].sort((a, b) => a.ordem - b.ordem)
          : []
      );
    }
  }, [open, evento.id]);

  /* ── DB mutation ──────────────────────────────────────── */
  const salvar = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      const { error } = await (supabase as any)
        .from("eventos")
        .update(patch)
        .eq("id", evento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evento-pagina-publica", evento.id] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + e.message),
  });

  /* ── Section operations ───────────────────────────────── */
  const atualizarSecoes = (novas: Secao[]) => {
    const reordenadas = novas.map((s, i) => ({ ...s, ordem: i }));
    setLocalSecoes(reordenadas);
    salvar.mutate({ pagina_secoes: reordenadas });
  };

  const adicionarSecao = (tipo: SecaoTipo, atIndex: number) => {
    const nova: Secao = {
      id: crypto.randomUUID(),
      tipo,
      ativo: true,
      ordem: atIndex,
      dados: { ...DEFAULT_DADOS[tipo] },
    };
    const copia = [...localSecoes];
    copia.splice(atIndex, 0, nova);
    atualizarSecoes(copia);
    setActiveSecaoId(nova.id);
    setRightTab("conteudo");
    setLeftPanel(null);
  };

  const removerSecao = (id: string) => {
    atualizarSecoes(localSecoes.filter((s) => s.id !== id));
    if (activeSecaoId === id) setActiveSecaoId(null);
  };

  const moverSecao = (id: string, dir: -1 | 1) => {
    const sorted = [...localSecoes].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= sorted.length) return;
    [sorted[idx], sorted[alvo]] = [sorted[alvo], sorted[idx]];
    atualizarSecoes(sorted);
  };

  const atualizarSecaoDados = (id: string, dados: any) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, dados } : s)));

  const atualizarSecaoEstilo = (id: string, estilo: SecaoEstilo) =>
    atualizarSecoes(localSecoes.map((s) => (s.id === id ? { ...s, estilo } : s)));

  /* ── Global settings ──────────────────────────────────── */
  const updateSlug = (slug: string) => {
    const v = slug || null;
    setLocalEvento((e: any) => ({ ...e, slug: v }));
    salvar.mutate({ slug: v });
  };

  const setAtiva = (v: boolean) => {
    if (v && !localEvento?.slug) {
      toast.error("Defina o slug (URL) antes de publicar.");
      return;
    }
    setLocalEvento((e: any) => ({ ...e, pagina_publica_ativa: v }));
    salvar.mutate({ pagina_publica_ativa: v });
    toast.success(v ? "Página publicada!" : "Página despublicada.");
  };

  const uploadBanner = async (file: File) => {
    setUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${evento.id}/banner.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("evento-banners")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("evento-banners").getPublicUrl(path);
      const url = urlData.publicUrl;
      setLocalEvento((e: any) => ({ ...e, banner_url: url }));
      await salvar.mutateAsync({ banner_url: url });
      toast.success("Banner enviado!");
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  /* ── Derived ──────────────────────────────────────────── */
  const slugGerado = slugify(evento.nome || "");
  const linkPublico = localEvento?.slug
    ? `${window.location.origin}/e/${localEvento.slug}`
    : null;

  const activeSecao = activeSecaoId
    ? localSecoes.find((s) => s.id === activeSecaoId) ?? null
    : null;

  const sortedSecoes = [...localSecoes].sort((a, b) => a.ordem - b.ordem);
  const activeIdx = activeSecao
    ? sortedSecoes.findIndex((s) => s.id === activeSecao.id)
    : -1;

  const toggleLeftPanel = (panel: LeftPanel) =>
    setLeftPanel((prev) => (prev === panel ? null : panel));

  const handleAddSecao = (atIndex: number) => {
    setAddAtIndex(atIndex);
    setLeftPanel("blocos");
    setActiveSecaoId(null);
  };

  const handleSelectSecao = (id: string) => {
    setActiveSecaoId(id);
    setRightTab("conteudo");
    setLeftPanel(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[100vw] sm:w-[100vw] sm:h-[100vh] sm:max-h-[100vh] p-0 flex flex-col gap-0 overflow-hidden [&>button:last-child]:hidden rounded-none">
        <DialogTitle className="sr-only">Editor de página pública — {evento.nome}</DialogTitle>

        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="flex items-center h-12 px-3 border-b bg-background shrink-0 gap-3">
          {/* Close */}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} title="Fechar editor">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Desktop / Mobile toggle */}
          <div className="flex items-center rounded-lg border p-0.5 gap-0.5 bg-muted/50 shrink-0">
            <button className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium bg-background shadow-sm border">
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </button>
            <button className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground">
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            {salvar.isPending ? (
              <span className="flex items-center gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
              </span>
            ) : (
              <span className="text-xs">Alterações salvas</span>
            )}
          </div>

          {/* Settings */}
          <Button
            variant={leftPanel === "settings" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Configurações da página"
            onClick={() => toggleLeftPanel("settings")}
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          {/* Preview live */}
          {linkPublico && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild title="Ver ao vivo">
              <a href={linkPublico} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}

          {/* Publish */}
          <Button
            className="h-8 bg-black hover:bg-black/80 text-white text-sm px-4 gap-2 shrink-0"
            onClick={() => setAtiva(!localEvento.pagina_publica_ativa)}
          >
            <Globe className="h-3.5 w-3.5" />
            {localEvento.pagina_publica_ativa ? "Despublicar" : "Publicar"}
          </Button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left icon sidebar */}
          <div className="w-12 border-r shrink-0 flex flex-col items-center py-3 gap-1.5 bg-background">
            <button
              title="Adicionar bloco"
              onClick={() => toggleLeftPanel("blocos")}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                leftPanel === "blocos"
                  ? "bg-cyan-500 text-white"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              title="Estilos globais"
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Palette className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Left panel (Blocos or Settings) */}
          {leftPanel === "blocos" && (
            <BlocosPanel
              onClose={() => setLeftPanel(null)}
              onSelect={(tipo) => adicionarSecao(tipo, addAtIndex)}
            />
          )}

          {leftPanel === "settings" && (
            <div className="w-[320px] shrink-0 border-r flex flex-col bg-background overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
                <Globe className="h-4 w-4 text-cyan-500 shrink-0" />
                <span className="text-sm font-semibold flex-1">Configurações da página</span>
                <button
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground"
                  onClick={() => setLeftPanel(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Slug */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> URL da página
                  </Label>
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-muted-foreground bg-muted border rounded-md px-2 h-8 flex items-center shrink-0">/e/</span>
                    <Input
                      className="flex-1 h-8 text-sm"
                      defaultValue={localEvento?.slug ?? ""}
                      onBlur={(e) => updateSlug(e.target.value)}
                      placeholder={slugGerado}
                    />
                  </div>
                  {!localEvento?.slug ? (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => updateSlug(slugGerado)}>
                      Gerar automático
                    </Button>
                  ) : (
                    <p className="text-[11px] text-muted-foreground truncate break-all">
                      {window.location.origin}/e/{localEvento.slug}
                    </p>
                  )}
                </div>
                <div className="border-t" />
                {/* Banner */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> Banner do evento
                  </Label>
                  {localEvento?.banner_url ? (
                    <div className="relative rounded-lg overflow-hidden border aspect-[3/1]">
                      <img src={localEvento.banner_url} alt="Banner" className="w-full h-full object-cover" />
                      <Button
                        size="sm" variant="secondary"
                        className="absolute bottom-2 right-2 shadow text-xs h-7"
                        onClick={() => fileRef.current?.click()}
                      >
                        Trocar imagem
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed rounded-lg aspect-[3/1] flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-cyan-400 hover:text-cyan-500 transition-colors"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5" />
                          <span className="text-sm">Enviar banner</span>
                          <span className="text-xs opacity-60">JPG · PNG · WebP · máx 5 MB</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBanner(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                <div className="border-t" />
                {/* Publish toggle */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Publicação
                  </Label>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">
                        {localEvento.pagina_publica_ativa ? "Página ao vivo" : "Rascunho"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {localEvento.pagina_publica_ativa
                          ? "Visível para qualquer pessoa com o link"
                          : "Somente você pode ver"}
                      </p>
                    </div>
                    <Switch checked={!!localEvento.pagina_publica_ativa} onCheckedChange={setAtiva} />
                  </div>
                  {linkPublico && (
                    <Button variant="outline" size="sm" className="w-full gap-2" asChild>
                      <a href={linkPublico} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Ver página ao vivo
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-950">
            <div className="min-h-full bg-background max-w-5xl mx-auto shadow-sm">
              <PaginaPublicaCanvas
                evento={localEvento}
                secoes={localSecoes}
                activeSecaoId={activeSecaoId}
                onSelectSecao={handleSelectSecao}
                onMoveSecao={moverSecao}
                onRemoveSecao={removerSecao}
                onAddSecao={handleAddSecao}
              />
            </div>
          </div>

          {/* Right panel — section editor */}
          {activeSecao && (
            <div className="w-[340px] shrink-0 border-l flex flex-col bg-background overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
                <span className="text-sm">{SECAO_ICONS[activeSecao.tipo]}</span>
                <span className="text-sm font-semibold flex-1 truncate">
                  Editar — {SECAO_LABELS[activeSecao.tipo]}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    title={activeSecao.ativo ? "Ocultar seção" : "Mostrar seção"}
                    onClick={() =>
                      atualizarSecoes(localSecoes.map((s) =>
                        s.id === activeSecao.id ? { ...s, ativo: !s.ativo } : s
                      ))
                    }
                  >
                    {activeSecao.ativo
                      ? <Eye className="h-3.5 w-3.5" />
                      : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Remover seção"
                    onClick={() => removerSecao(activeSecao.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                    onClick={() => setActiveSecaoId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b shrink-0">
                {(["conteudo", "estilo"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                      rightTab === tab
                        ? "border-cyan-500 text-cyan-600"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {{ conteudo: "Conteúdo", estilo: "Estilo" }[tab]}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {rightTab === "conteudo" && (
                  <div className="p-4 space-y-4">
                    {/* Move controls */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground flex-1">
                        Posição {activeIdx + 1} de {sortedSecoes.length}
                      </span>
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => moverSecao(activeSecao.id, -1)}
                        disabled={activeIdx === 0}
                      >
                        <ChevronUp className="h-3.5 w-3.5" /> Subir
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1 text-xs"
                        onClick={() => moverSecao(activeSecao.id, 1)}
                        disabled={activeIdx === sortedSecoes.length - 1}
                      >
                        Descer <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="border-t" />
                    <SecaoEditor
                      secao={activeSecao}
                      evento={localEvento}
                      onChange={(dados) => atualizarSecaoDados(activeSecao.id, dados)}
                    />
                  </div>
                )}

                {rightTab === "estilo" && (
                  <EstiloPanel
                    estilo={activeSecao.estilo}
                    onChange={(estilo) => atualizarSecaoEstilo(activeSecao.id, estilo)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
