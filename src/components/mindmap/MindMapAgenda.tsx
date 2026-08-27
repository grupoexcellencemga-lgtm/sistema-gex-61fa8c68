import { useState, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, ChevronRight, Plus, Trash2,
  Image as ImageIcon, Type, Loader2, LayoutGrid, BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [viewMode, setViewMode] = useState<"day" | "all">("day");
  const [diaIdx, setDiaIdx] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ diaId: string; blocoId: string } | null>(null);

  // sync when prop changes (map switch)
  const prevMapId = useRef(mindmapId);
  if (prevMapId.current !== mindmapId) {
    prevMapId.current = mindmapId;
    const next = agendaProp ?? emptyAgenda();
    setAgenda(next);
    setDiaIdx(0);
  }

  const commit = useCallback((next: Agenda) => {
    setAgenda(next);
    onSave(next);
  }, [onSave]);

  const addDia = () => {
    const next: Agenda = {
      dias: [...agenda.dias, { id: crypto.randomUUID(), numero: agenda.dias.length + 1, blocos: [] }],
    };
    commit(next);
    setDiaIdx(next.dias.length - 1);
  };

  const removeDia = (diaId: string) => {
    const novos = agenda.dias.filter(d => d.id !== diaId).map((d, i) => ({ ...d, numero: i + 1 }));
    commit({ dias: novos });
    setDiaIdx(idx => Math.min(idx, Math.max(0, novos.length - 1)));
  };

  const addBloco = (diaId: string, tipo: "text" | "image") => {
    const bloco: AgendaBloco = { id: crypto.randomUUID(), tipo };
    if (tipo === "text") bloco.conteudo = "";
    const next: Agenda = {
      dias: agenda.dias.map(d => d.id === diaId ? { ...d, blocos: [...d.blocos, bloco] } : d),
    };
    commit(next);
    if (tipo === "image") {
      pendingUpload.current = { diaId, blocoId: bloco.id };
      fileInputRef.current?.click();
    }
  };

  const removeBloco = (diaId: string, blocoId: string) => {
    commit({
      dias: agenda.dias.map(d => d.id === diaId ? { ...d, blocos: d.blocos.filter(b => b.id !== blocoId) } : d),
    });
  };

  const updateText = (diaId: string, blocoId: string, texto: string) => {
    commit({
      dias: agenda.dias.map(d =>
        d.id === diaId ? { ...d, blocos: d.blocos.map(b => b.id === blocoId ? { ...b, conteudo: texto } : b) } : d
      ),
    });
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
    const snap = agenda; // use closure — agenda may have updated
    commit({
      dias: snap.dias.map(d =>
        d.id === ref.diaId ? { ...d, blocos: d.blocos.map(b => b.id === ref.blocoId ? { ...b, url: urlData.publicUrl } : b) } : d
      ),
    });
    setUploading(null);
    pendingUpload.current = null;
  };

  const dia = agenda.dias[diaIdx];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] max-w-[95vw] flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">📅 Agenda de Dias</SheetTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant={viewMode === "day" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setViewMode("day")}>
                <BookOpen className="h-3 w-3 mr-1" /> Por dia
              </Button>
              <Button size="sm" variant={viewMode === "all" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setViewMode("all")}>
                <LayoutGrid className="h-3 w-3 mr-1" /> Geral
              </Button>
            </div>
          </div>
          <div className="flex items-center mt-2">
            <span className="text-xs text-muted-foreground">{agenda.dias.length} dia(s)</span>
            <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={addDia}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar dia
            </Button>
          </div>
        </SheetHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {agenda.dias.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
              <p className="text-sm">Nenhum dia adicionado ainda.</p>
              <Button size="sm" onClick={addDia}><Plus className="h-3 w-3 mr-1" /> Adicionar dia</Button>
            </div>
          ) : viewMode === "day" ? (
            <div className="flex flex-col">
              {/* Day nav */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/30 sticky top-0 z-10">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={diaIdx === 0} onClick={() => setDiaIdx(i => i - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Dia {dia?.numero}</span>
                  {dia && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Remover este dia" onClick={() => removeDia(dia.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={diaIdx === agenda.dias.length - 1} onClick={() => setDiaIdx(i => i + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {dia && (
                <DiaContent
                  dia={dia}
                  uploading={uploading}
                  onAddText={() => addBloco(dia.id, "text")}
                  onAddImage={() => { pendingUpload.current = null; addBloco(dia.id, "image"); }}
                  onRemove={(bid) => removeBloco(dia.id, bid)}
                  onText={(bid, v) => updateText(dia.id, bid, v)}
                />
              )}
            </div>
          ) : (
            <div className="divide-y">
              {agenda.dias.map((d, idx) => (
                <div key={d.id} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Dia {d.numero}</h3>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setViewMode("day"); setDiaIdx(idx); }}>
                        Ver
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeDia(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <DiaContent
                    dia={d}
                    uploading={uploading}
                    onAddText={() => addBloco(d.id, "text")}
                    onAddImage={() => { pendingUpload.current = null; addBloco(d.id, "image"); }}
                    onRemove={(bid) => removeBloco(d.id, bid)}
                    onText={(bid, v) => updateText(d.id, bid, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DiaContent({ dia, uploading, onAddText, onAddImage, onRemove, onText }: {
  dia: AgendaDia;
  uploading: string | null;
  onAddText: () => void;
  onAddImage: () => void;
  onRemove: (blocoId: string) => void;
  onText: (blocoId: string, valor: string) => void;
}) {
  return (
    <div className="px-5 py-4 space-y-3">
      {dia.blocos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum conteúdo neste dia.</p>
      )}
      {dia.blocos.map((bloco) => (
        <div key={bloco.id} className="relative group rounded-lg border bg-card overflow-hidden">
          <Button
            size="icon"
            variant="destructive"
            className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full shadow"
            onClick={() => onRemove(bloco.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {bloco.tipo === "text" ? (
            <Textarea
              className="min-h-[90px] text-sm border-0 rounded-none resize-none focus-visible:ring-0 bg-transparent px-3 py-2.5"
              placeholder="Escreva aqui..."
              defaultValue={bloco.conteudo || ""}
              onBlur={(e) => onText(bloco.id, e.target.value)}
            />
          ) : uploading === bloco.id ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando imagem...
            </div>
          ) : bloco.url ? (
            <img src={bloco.url} alt="" className="w-full object-contain max-h-72" />
          ) : (
            <div className="flex items-center justify-center h-28 text-muted-foreground border-2 border-dashed m-2 rounded-md">
              <ImageIcon className="h-5 w-5 mr-2" /> Sem imagem
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={onAddText}>
          <Type className="h-3 w-3 mr-1" /> Texto
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs flex-1" onClick={onAddImage}>
          <ImageIcon className="h-3 w-3 mr-1" /> Imagem
        </Button>
      </div>
    </div>
  );
}
