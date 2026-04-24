import { useCallback, useRef, useState } from "react";
import { type Node } from "@xyflow/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Bold, Italic, Image as ImageIcon, StickyNote, ExternalLink, Trash2, Upload, Loader2,
  Minus, Circle, MoreHorizontal, Video,
} from "lucide-react";

const NODE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#78716c",
];

const TEXT_COLORS = [
  "#ffffff", "#000000", "#fde68a", "#bbf7d0", "#bfdbfe",
  "#fecaca", "#e9d5ff", "#fed7aa", "#d1d5db", "#fce7f3",
];

const BORDER_STYLES = [
  { value: "solid", label: "Sólida", icon: Minus },
  { value: "dashed", label: "Tracejada", icon: MoreHorizontal },
  { value: "dotted", label: "Pontilhada", icon: Circle },
];

interface NodeStylePanelProps {
  node: Node;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
  onBulkImages?: (parentId: string, files: File[]) => Promise<void>;
}

export default function NodeStylePanel({ node, onUpdate, onBulkImages }: NodeStylePanelProps) {
  const d = node.data;
  const [noteOpen, setNoteOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(
    (key: string, value: any) => onUpdate(node.id, { [key]: value }),
    [node.id, onUpdate]
  );

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg space-y-3 w-56 max-h-[70vh] overflow-y-auto text-xs">
      {/* Toggle título */}
      <div>
        <Button
          size="sm"
          variant={d.isRoot !== false ? "default" : "outline"}
          className="w-full h-7 text-[11px]"
          onClick={() => update("isRoot", d.isRoot === false ? true : false)}
        >
          {d.isRoot !== false ? "✦ É título (preenchido)" : "Tornar título (preenchido)"}
        </Button>
      </div>

      {/* Colors */}
      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Cor do nó</Label>
        <div className="flex gap-1 flex-wrap">
          {NODE_COLORS.map((c) => (
            <button
              key={c}
              className="h-5 w-5 rounded-full border-2 transition-colors"
              style={{
                backgroundColor: c,
                borderColor: d.color === c ? "white" : "transparent",
              }}
              onClick={() => update("color", c)}
            />
          ))}
        </div>
      </div>

      {/* Border style */}
      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Borda</Label>
        <div className="flex gap-1">
          {BORDER_STYLES.map((bs) => (
            <Button
              key={bs.value}
              size="sm"
              variant={d.borderStyle === bs.value ? "default" : "outline"}
              className="h-7 flex-1 text-[10px]"
              onClick={() => update("borderStyle", bs.value)}
              title={bs.label}
            >
              <bs.icon className="h-3 w-3" />
            </Button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap mt-1">
          {["transparent", "#ffffff", "#000000", "#ef4444", "#3b82f6", "#22c55e"].map((c) => (
            <button
              key={c}
              className="h-4 w-4 rounded border transition-colors"
              style={{
                backgroundColor: c === "transparent" ? "transparent" : c,
                borderColor: d.borderColor === c ? "white" : "hsl(var(--border))",
              }}
              onClick={() => update("borderColor", c)}
              title={c === "transparent" ? "Sem borda" : c}
            />
          ))}
        </div>
      </div>

      {/* Text formatting */}
      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Texto</Label>
        <div className="flex gap-1 items-center">
          <Button
            size="icon"
            variant={d.bold ? "default" : "outline"}
            className="h-7 w-7"
            onClick={() => update("bold", !d.bold)}
          >
            <Bold className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant={d.italic ? "default" : "outline"}
            className="h-7 w-7"
            onClick={() => update("italic", !d.italic)}
          >
            <Italic className="h-3 w-3" />
          </Button>
          <select
            className="h-7 rounded border border-border bg-card text-foreground text-[10px] px-1"
            value={(d.fontSize as number) || 14}
            onChange={(e) => update("fontSize", Number(e.target.value))}
          >
            {[10, 12, 14, 16, 18, 20, 24].map((s) => (
              <option key={s} value={s}>{s}px</option>
            ))}
          </select>
        </div>
        <Label className="text-[10px] text-muted-foreground mt-1 block">Cor do texto</Label>
        <div className="flex gap-1 flex-wrap">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              className="h-4 w-4 rounded-full border transition-colors"
              style={{
                backgroundColor: c,
                borderColor: (d.textColor || "#ffffff") === c ? "hsl(var(--primary))" : "hsl(var(--border))",
              }}
              onClick={() => update("textColor", c)}
            />
          ))}
        </div>
      </div>

      {/* Node size */}
      <div>
        <Label className="text-[11px] text-muted-foreground mb-1 block">Tamanho do nó</Label>
        <div className="flex gap-1">
          {[
            { label: "P", value: 160 },
            { label: "M", value: 250 },
            { label: "G", value: 350 },
            { label: "GG", value: 450 },
          ].map((s) => (
            <Button
              key={s.label}
              size="sm"
              variant={(d.nodeWidth || 160) === s.value ? "default" : "outline"}
              className="h-7 flex-1 text-[10px]"
              onClick={() => update("nodeWidth", s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Image */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              toast.error("Imagem deve ter no máximo 5MB");
              return;
            }
            setUploading(true);
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${node.id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from("mindmap_images").upload(path, file);
            if (error) {
              toast.error("Erro ao enviar imagem");
              setUploading(false);
              return;
            }
            const { data: urlData } = supabase.storage.from("mindmap_images").getPublicUrl(path);
            update("image", urlData.publicUrl);
            setUploading(false);
            toast.success("Imagem adicionada!");
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px]"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="h-3 w-3 mr-1" /> {d.image ? "Trocar imagem" : "Enviar imagem"}</>
          )}
        </Button>
        {d.image && (
          <div className="mt-1 space-y-1">
            <img src={d.image as string} alt="" className="w-full max-h-[60px] object-cover rounded" />
            <Button size="sm" variant="destructive" className="w-full h-6 text-[10px]" onClick={() => update("image", undefined)}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover imagem
            </Button>
          </div>
        )}
        {/* Bulk images - one per node */}
        {onBulkImages && (
          <>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                setBulkUploading(true);
                await onBulkImages(node.id, files);
                setBulkUploading(false);
                if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[11px] mt-1"
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={bulkUploading}
            >
              {bulkUploading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
              ) : (
                <><ImageIcon className="h-3 w-3 mr-1" /> Várias imagens → nós filhos</>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Video */}
      <div>
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 200 * 1024 * 1024) {
              toast.error("Vídeo deve ter no máximo 200MB");
              return;
            }
            setVideoUploading(true);
            const ext = file.name.split(".").pop() || "mp4";
            const path = `${node.id}/${crypto.randomUUID()}.${ext}`;
            const { error } = await supabase.storage.from("mindmap_videos").upload(path, file);
            if (error) {
              toast.error("Erro ao enviar vídeo");
              setVideoUploading(false);
              return;
            }
            const { data: urlData } = supabase.storage.from("mindmap_videos").getPublicUrl(path);
            update("video", urlData.publicUrl);
            setVideoUploading(false);
            toast.success("Vídeo adicionado!");
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px]"
          onClick={() => setVideoOpen(!videoOpen)}
        >
          <Video className="h-3 w-3 mr-1" />
          {d.video ? "Editar vídeo" : "Adicionar vídeo"}
        </Button>
        {videoOpen && (
          <div className="mt-1 space-y-1">
            <Input
              placeholder="Link YouTube, Vimeo ou URL de vídeo..."
              className="h-7 text-[11px]"
              defaultValue={(d.video as string) || ""}
              onBlur={(e) => update("video", e.target.value || undefined)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update("video", (e.target as HTMLInputElement).value || undefined);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-[11px]"
              onClick={() => videoFileInputRef.current?.click()}
              disabled={videoUploading}
            >
              {videoUploading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="h-3 w-3 mr-1" /> Upload de vídeo (até 200MB)</>
              )}
            </Button>
            {d.video && (
              <Button size="sm" variant="destructive" className="w-full h-6 text-[10px]" onClick={() => update("video", undefined)}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover vídeo
              </Button>
            )}
          </div>
        )}
      </div>
      <div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px]"
          onClick={() => setNoteOpen(!noteOpen)}
        >
          <StickyNote className="h-3 w-3 mr-1" />
          {d.note ? "Editar nota" : "Adicionar nota"}
        </Button>
        {noteOpen && (
          <Textarea
            placeholder="Escreva uma nota..."
            className="mt-1 text-[11px] min-h-[60px]"
            defaultValue={(d.note as string) || ""}
            onBlur={(e) => update("note", e.target.value || undefined)}
          />
        )}
      </div>

      {/* Link */}
      <div>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-[11px]"
          onClick={() => setLinkOpen(!linkOpen)}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          {d.link ? "Editar link" : "Adicionar link"}
        </Button>
        {linkOpen && (
          <div className="mt-1 space-y-1">
            <Input
              placeholder="https://..."
              className="h-7 text-[11px]"
              defaultValue={(d.link as string) || ""}
              onBlur={(e) => update("link", e.target.value || undefined)}
              onKeyDown={(e) => {
                if (e.key === "Enter") update("link", (e.target as HTMLInputElement).value || undefined);
              }}
            />
            {d.link && (
              <Button size="sm" variant="destructive" className="w-full h-6 text-[10px]" onClick={() => update("link", undefined)}>
                <Trash2 className="h-3 w-3 mr-1" /> Remover link
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
