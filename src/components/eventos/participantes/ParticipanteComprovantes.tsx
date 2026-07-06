import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, File, X, Upload, Download } from "lucide-react";
import { abrirComprovante } from "@/lib/comprovantes";
import { getComprovantesParticipante } from "./participantesUtils";

interface Props {
  participante: any;
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onDelete: (index?: number) => void;
}

export function ParticipanteComprovantes({
  participante,
  uploading,
  onUpload,
  onDelete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const comprovantes = getComprovantesParticipante(participante);

  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Paperclip className="h-4 w-4" /> Comprovante de Pagamento
      </h3>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.webp"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          onUpload(files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {comprovantes.length > 0 && (
        <div className="space-y-2">
          {comprovantes.map((comp: any, index: number) => (
            <div
              key={`${comp.url}-${index}`}
              className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3"
            >
              <File className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm truncate flex-1">
                {comp.nome || `Comprovante ${index + 1}`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => abrirComprovante(comp.url)}
                title="Abrir comprovante"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive shrink-0"
                onClick={() => onDelete(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading
          ? "Enviando..."
          : comprovantes.length > 0
            ? "Adicionar mais comprovantes"
            : "Anexar Comprovante"}
      </Button>
      {comprovantes.length > 1 && (
        <Button
          variant="ghost"
          className="w-full gap-2 text-destructive"
          onClick={() => onDelete()}
        >
          <X className="h-4 w-4" />
          Remover todos os comprovantes
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Você pode anexar mais de um arquivo. Formatos aceitos: PDF, PNG, JPG,
        Word
      </p>
    </div>
  );
}
