import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Globe } from "lucide-react";
import type { Secao } from "./types";
import { SECAO_LABELS, SECAO_ICONS } from "./types";
import {
  SecaoHero,
  SecaoSobre,
  SecaoPalestrantes,
  SecaoAgenda,
  SecaoDepoimentos,
  SecaoLocal,
  SecaoFaq,
  SecaoCTA,
} from "./PaginaPreview";

function AddBlocoButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-0 relative z-30">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 border-dashed bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar bloco
      </Button>
    </div>
  );
}

function SecaoWrapper({
  secao,
  idx,
  total,
  isActive,
  onSelect,
  onMove,
  onRemove,
  onToggle,
  onAddAbove,
  onAddBelow,
  evento,
}: {
  secao: Secao;
  idx: number;
  total: number;
  isActive: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onToggle: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  evento: any;
}) {
  const renderSection = () => {
    switch (secao.tipo) {
      case "hero":
        return <SecaoHero evento={evento} dados={secao.dados} onInscrever={() => {}} />;
      case "sobre":
        return <SecaoSobre dados={secao.dados} />;
      case "palestrantes":
        return <SecaoPalestrantes dados={secao.dados} />;
      case "agenda":
        return <SecaoAgenda dados={secao.dados} />;
      case "depoimentos":
        return <SecaoDepoimentos dados={secao.dados} />;
      case "local":
        return <SecaoLocal dados={secao.dados} />;
      case "faq":
        return <SecaoFaq dados={secao.dados} />;
      default:
        return null;
    }
  };

  return (
    <div className={`relative group transition-opacity ${!secao.ativo ? "opacity-40" : ""}`}>

      {/* Add above (first section only) */}
      {idx === 0 && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity py-1">
          <AddBlocoButton onClick={onAddAbove} />
        </div>
      )}

      {/* Section content */}
      <div
        className={`relative cursor-pointer transition-all ${
          isActive ? "outline outline-2 outline-blue-500 outline-offset-0 z-10" : ""
        }`}
        onClick={onSelect}
      >
        {/* Hover ring (not active) */}
        {!isActive && (
          <div className="absolute inset-0 ring-2 ring-inset ring-transparent group-hover:ring-blue-400/60 pointer-events-none z-10 transition-all" />
        )}

        {/* Section label chip */}
        <div
          className={`absolute top-0 left-0 z-20 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <div className="bg-blue-500 text-white text-xs px-3 py-1.5 flex items-center gap-1.5 rounded-br-xl shadow-md font-medium">
            <span>{SECAO_ICONS[secao.tipo]}</span>
            <span>{SECAO_LABELS[secao.tipo]}</span>
            {!secao.ativo && (
              <Badge className="text-[10px] h-4 bg-white/20 text-white border-0">Oculta</Badge>
            )}
          </div>
        </div>

        {/* Action buttons (top-right) */}
        <div
          className={`absolute top-2 right-3 z-20 flex items-center gap-1 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white h-7 text-xs shadow-md gap-1"
            onClick={onSelect}
          >
            <Pencil className="h-3 w-3" /> Editar
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-md bg-background"
            onClick={() => onMove(-1)}
            disabled={idx === 0}
            title="Mover para cima"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-md bg-background"
            onClick={() => onMove(1)}
            disabled={idx === total - 1}
            title="Mover para baixo"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 shadow-md bg-background"
            onClick={onToggle}
            title={secao.ativo ? "Ocultar seção" : "Mostrar seção"}
          >
            {secao.ativo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 shadow-md"
            onClick={() => onRemove()}
            title="Remover seção"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {renderSection()}
      </div>

      {/* Add below */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity py-1">
        <AddBlocoButton onClick={onAddBelow} />
      </div>
    </div>
  );
}

export function PaginaPublicaCanvas({
  evento,
  secoes,
  activeSecaoId,
  onSelectSecao,
  onMoveSecao,
  onRemoveSecao,
  onToggleSecao,
  onAddSecao,
}: {
  evento: any;
  secoes: Secao[];
  activeSecaoId: string | null;
  onSelectSecao: (id: string) => void;
  onMoveSecao: (id: string, dir: -1 | 1) => void;
  onRemoveSecao: (id: string) => void;
  onToggleSecao: (id: string) => void;
  onAddSecao: (atIndex: number) => void;
}) {
  const ativas = [...secoes].sort((a, b) => a.ordem - b.ordem);
  const temHero = ativas.some((s) => s.tipo === "hero");

  if (ativas.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-muted-foreground bg-muted/20">
        <Globe className="h-12 w-12 opacity-20" />
        <p className="text-lg font-medium">Página em branco</p>
        <p className="text-sm">Adicione o primeiro bloco para começar.</p>
        <Button
          variant="outline"
          className="gap-2 mt-2"
          onClick={() => onAddSecao(0)}
        >
          <Plus className="h-4 w-4" /> Adicionar primeiro bloco
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fallback hero if none configured */}
      {!temHero && (
        <SecaoHero
          evento={evento}
          dados={{ cta_texto: "Quero me inscrever" }}
          onInscrever={() => {}}
        />
      )}

      {ativas.map((secao, idx) => (
        <SecaoWrapper
          key={secao.id}
          secao={secao}
          idx={idx}
          total={ativas.length}
          isActive={activeSecaoId === secao.id}
          onSelect={() => onSelectSecao(secao.id)}
          onMove={(dir) => onMoveSecao(secao.id, dir)}
          onRemove={() => onRemoveSecao(secao.id)}
          onToggle={() => onToggleSecao(secao.id)}
          onAddAbove={() => onAddSecao(idx)}
          onAddBelow={() => onAddSecao(idx + 1)}
          evento={evento}
        />
      ))}

      {/* CTA final */}
      {evento.status !== "finalizado" && evento.status !== "cancelado" && (
        <SecaoCTA evento={evento} onInscrever={() => {}} />
      )}

      <footer className="py-6 text-center text-xs text-muted-foreground border-t">
        {new Date().getFullYear()} · Grupo Excellence
      </footer>
    </div>
  );
}
