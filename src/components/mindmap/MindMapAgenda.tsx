import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Image as ImageIcon, Type, Loader2, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AgendaBloco {
  id: string;
  tipo: "text" | "image";
  conteudo?: string;
  url?: string;
}

export interface AgendaDia {
  id: string;
  numero: number;
  blocos: AgendaBloco[];
}

export interface Agenda {
  dias: AgendaDia[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mindmapId: string;
  agenda: Agenda | null;
  onSave: (agenda: Agenda) => void;
}

function emptyAgenda(): Agenda {
  return { dias: [] };
}

export default function MindMapAgenda({ open, onOpenChange, mindmapId, agenda: agendaProp, onSave }: Props) {
  const [agenda, setAgenda] = useState<Agenda>(agendaProp ?? emptyAgenda());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ diaId: string; blocoId: string } | null>(null);

  // Sync quando troca de mapa
  const prevMapId = useRef(mindmapId);
  if (prevMapId.current !== mindmapId) {
    prevMapId.current = mindmapId;
    setAgenda(agendaProp ?? emptyAgenda());
    setDiaSelecionado(null);
  }

  const commit = useCallback((next: Agenda) => {
    setAgenda(next);
    onSave(next);
  }, [onSave]);

  const addDia = () => {
    const novo: AgendaDia = { id: crypto.randomUUID(), numero: agenda.dias.length + 1, blocos: [] };
    const next: Agenda = { dias: [...agenda.dias, novo] };
    commit(next);
    setDiaSelecionado(novo.id);
  };

  const removeDia = (diaId: string) => {
    const novos = agenda.dias.filter(d => d.id !== diaId).map((d, i) => ({ ...d, numero: i + 1 }));
    commit({ dias: novos });
    if (diaSelecionado === diaId) setDiaSelecionado(null);
  };

  const addBloco = (diaId: string, tipo: "text" | "image") => {
    const bloco: AgendaBloco = { id: crypto.randomUUID(), tipo, conteudo: tipo === "text" ? "" : undefined };
    commit({ dias: agenda.dias.map(d => d.id === diaId ? { ...d, blocos: [...d.blocos, bloco] } : d) });
    if (tipo === "image") {
      pendingUpload.current = { diaId, blocoId: bloco.id };
      fileInputRef.current?.click();
    }
  };

  const removeBloco = (diaId: string, blocoId: string) => {
    commit({ dias: agenda.dias.map(d => d.id === diaId ? { ...d, blocos: d.blocos.filter(b => b.id !== blocoId) } : d) });
  };

  const updateText = (diaId: string, blocoId: string, texto: string) => {
    commit({ dias: agenda.dias.map(d => d.id === diaId ? { ...d, blocos: d.blocos.map(b => b.id === blocoId ? { ...b, conteudo: texto } : b) } : d) });
  };

  const handleFile = async (file: File) => {
    const ref = pendingUpload.current;
    if (!ref) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 10MB"); return; }
    setUploading(ref.blocoId);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `agenda/${mindmapId}/${ref.blocoId}.${ext}`;
    const { error } = await supabase.storage.from("mindmap_images").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro ao enviar imagem"); setUploading(null); return; }
    const { data: urlData } = supabase.storage.from("mindmap_images").getPublicUrl(path);
    const snap = agenda;
    commit({ dias: snap.dias.map(d => d.id === ref.diaId ? { ...d, blocos: d.blocos.map(b => b.id === ref.blocoId ? { ...b, url: urlData.publicUrl } : b) } : d) });
    setUploading(null);
    pendingUpload.current = null;
  };

  const diaAtual = agenda.dias.find(d => d.id === diaSelecionado) ?? null;
  const diaIdx = diaAtual ? agenda.dias.indexOf(diaAtual) : -1;

  // navegar entre dias no painel de edição
  const navDia = (delta: number) => {
    const idx = diaIdx + delta;
    if (idx >= 0 && idx < agenda.dias.length) setDiaSelecionado(agenda.dias[idx].id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-full max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base flex items-center gap-2">
              📅 Calendário Editorial
              <span className="text-xs font-normal text-muted-foreground">
                {agenda.dias.length} dia(s)
              </span>
            </DialogTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addDia}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar dia
            </Button>
          </div>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Grade do calendário */}
          <div className={cn("overflow-y-auto p-4 transition-all duration-300", diaAtual ? "w-[58%] border-r" : "w-full")}>
            {agenda.dias.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
                <p className="text-sm">Nenhum dia adicionado ainda.</p>
                <Button size="sm" onClick={addDia}><Plus className="h-3 w-3 mr-1" /> Adicionar dia</Button>
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {agenda.dias.map((dia) => {
                  const imagens = dia.blocos.filter(b => b.tipo === "image" && b.url);
                  const temTexto = dia.blocos.some(b => b.tipo === "text" && b.conteudo);
                  const selecionado = dia.id === diaSelecionado;

                  return (
                    <button
                      key={dia.id}
                      className={cn(
                        "relative rounded-xl border-2 overflow-hidden text-left transition-all group",
                        "aspect-[3/4] flex flex-col",
                        selecionado
                          ? "border-primary shadow-md shadow-primary/20"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setDiaSelecionado(selecionado ? null : dia.id)}
                    >
                      {/* Thumbnail principal */}
                      {imagens.length > 0 ? (
                        <div className="flex-1 relative overflow-hidden">
                          {imagens.length === 1 ? (
                            <img src={imagens[0].url} alt="" className="w-full h-full object-cover" />
                          ) : imagens.length === 2 ? (
                            <div className="grid grid-cols-2 h-full">
                              {imagens.slice(0, 2).map(img => (
                                <img key={img.id} src={img.url} alt="" className="w-full h-full object-cover" />
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 grid-rows-2 h-full">
                              <img src={imagens[0].url} alt="" className="w-full h-full object-cover row-span-2" />
                              <img src={imagens[1].url} alt="" className="w-full h-full object-cover" />
                              <div className="w-full h-full bg-muted/80 flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                +{imagens.length - 2}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center bg-muted/30">
                          <Plus className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Footer do card */}
                      <div className="px-1.5 py-1 bg-background/95 border-t flex items-center justify-between shrink-0">
                        <span className="text-[10px] font-bold text-foreground">Dia {dia.numero}</span>
                        <div className="flex gap-1 items-center">
                          {temTexto && <span title="Tem texto" className="text-[9px]">📝</span>}
                          {imagens.length > 0 && <span className="text-[9px] text-muted-foreground">{imagens.length}🖼️</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Botão de adicionar no final da grade */}
                <button
                  className="aspect-[3/4] rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                  onClick={addDia}
                >
                  <Plus className="h-5 w-5 text-muted-foreground/50" />
                </button>
              </div>
            )}
          </div>

          {/* Painel de edição do dia selecionado */}
          {diaAtual && (
            <div className="flex flex-col w-[42%] overflow-hidden">
              {/* Header do dia */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={diaIdx === 0} onClick={() => navDia(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-sm px-1">Dia {diaAtual.numero}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={diaIdx === agenda.dias.length - 1} onClick={() => navDia(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remover dia" onClick={() => removeDia(diaAtual.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDiaSelecionado(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Blocos de conteúdo */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {diaAtual.blocos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhum conteúdo neste dia.</p>
                )}
                {diaAtual.blocos.map((bloco) => (
                  <div key={bloco.id} className="relative group rounded-lg border bg-card overflow-hidden">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-1.5 right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full shadow"
                      onClick={() => removeBloco(diaAtual.id, bloco.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                    {bloco.tipo === "text" ? (
                      <Textarea
                        className="min-h-[80px] text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent px-3 py-2.5"
                        placeholder="Escreva aqui..."
                        defaultValue={bloco.conteudo || ""}
                        onBlur={(e) => updateText(diaAtual.id, bloco.id, e.target.value)}
                      />
                    ) : uploading === bloco.id ? (
                      <div className="flex items-center justify-center h-28 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando...
                      </div>
                    ) : bloco.url ? (
                      <img src={bloco.url} alt="" className="w-full object-contain max-h-52" />
                    ) : (
                      <div className="flex items-center justify-center h-24 text-muted-foreground border-2 border-dashed m-2 rounded-md">
                        <ImageIcon className="h-4 w-4 mr-2" /> Sem imagem
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Botões de adicionar */}
              <div className="flex gap-2 px-4 py-3 border-t shrink-0">
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => addBloco(diaAtual.id, "text")}>
                  <Type className="h-3 w-3 mr-1" /> Texto
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={() => { pendingUpload.current = null; addBloco(diaAtual.id, "image"); }}>
                  <ImageIcon className="h-3 w-3 mr-1" /> Imagem
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
