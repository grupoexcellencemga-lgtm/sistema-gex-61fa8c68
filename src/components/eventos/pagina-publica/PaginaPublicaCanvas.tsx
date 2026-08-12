import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Globe } from "lucide-react";
import type { Secao } from "./types";
import { SECAO_LABELS, SECAO_ICONS } from "./types";
import { renderSecao } from "./PaginaPreview";

/* ─── Add bloco button ────────────────────────────────────── */
function AddBlocoButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-1 relative z-30">
      <button
        className="flex items-center gap-1.5 text-xs font-medium text-white bg-cyan-500 hover:bg-cyan-600 px-3 py-1 rounded-full shadow-sm transition-colors"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Plus className="h-3 w-3" /> Adicionar bloco
      </button>
    </div>
  );
}

/* ─── SecaoWrapper ────────────────────────────────────────── */
function SecaoWrapper({
  secao,
  idx,
  total,
  isActive,
  onSelect,
  onMove,
  onRemove,
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
  onAddAbove: () => void;
  onAddBelow: () => void;
  evento: any;
}) {
  return (
    <div className={`relative group transition-opacity ${!secao.ativo ? "opacity-40" : ""}`}>

      {/* Add above (first section or always visible between) */}
      <div
        className={`transition-opacity ${
          idx === 0 ? "opacity-0 group-hover:opacity-100" : "opacity-100"
        }`}
      >
        <AddBlocoButton onClick={onAddAbove} />
      </div>

      {/* Section content wrapper */}
      <div
        className={`relative cursor-pointer transition-all ${
          isActive
            ? "outline outline-2 outline-cyan-500 outline-offset-0 z-10"
            : "hover:outline hover:outline-2 hover:outline-cyan-400/50 hover:outline-offset-0"
        }`}
        onClick={onSelect}
      >
        {/* Toolbar — top-left floating pill */}
        <div
          className={`absolute top-0 left-0 z-30 transition-all ${
            isActive ? "opacity-100 translate-y-0" : "opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center bg-white dark:bg-zinc-900 border border-border shadow-md rounded-br-xl overflow-hidden">
            {/* Label */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-r bg-cyan-500 text-white">
              <span className="text-xs leading-none">{SECAO_ICONS[secao.tipo]}</span>
              <span className="text-xs font-medium leading-none whitespace-nowrap">{SECAO_LABELS[secao.tipo]}</span>
            </div>
            {/* Edit */}
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors border-r"
              onClick={onSelect}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            {/* Move up */}
            <button
              className="px-2 py-1.5 hover:bg-muted/60 transition-colors border-r disabled:opacity-30"
              onClick={() => onMove(-1)}
              disabled={idx === 0}
              title="Mover para cima"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            {/* Move down */}
            <button
              className="px-2 py-1.5 hover:bg-muted/60 transition-colors border-r disabled:opacity-30"
              onClick={() => onMove(1)}
              disabled={idx === total - 1}
              title="Mover para baixo"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {/* Delete */}
            <button
              className="px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors"
              onClick={onRemove}
              title="Remover seção"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Section render */}
        {renderSecao(secao, evento, () => {})}
      </div>

      {/* Add below */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <AddBlocoButton onClick={onAddBelow} />
      </div>
    </div>
  );
}

/* ─── PaginaPublicaCanvas ─────────────────────────────────── */
export function PaginaPublicaCanvas({
  evento,
  secoes,
  activeSecaoId,
  onSelectSecao,
  onMoveSecao,
  onRemoveSecao,
  onAddSecao,
}: {
  evento: any;
  secoes: Secao[];
  activeSecaoId: string | null;
  onSelectSecao: (id: string) => void;
  onMoveSecao: (id: string, dir: -1 | 1) => void;
  onRemoveSecao: (id: string) => void;
  onAddSecao: (atIndex: number) => void;
}) {
  const ordenadas = [...secoes].sort((a, b) => a.ordem - b.ordem);

  if (ordenadas.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Globe className="h-12 w-12 opacity-20" />
        <p className="text-base font-medium">Página em branco</p>
        <p className="text-sm">Clique no + para adicionar o primeiro bloco.</p>
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded-full shadow-sm transition-colors mt-2"
          onClick={() => onAddSecao(0)}
        >
          <Plus className="h-4 w-4" /> Adicionar primeiro bloco
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {ordenadas.map((secao, idx) => (
        <SecaoWrapper
          key={secao.id}
          secao={secao}
          idx={idx}
          total={ordenadas.length}
          isActive={activeSecaoId === secao.id}
          onSelect={() => onSelectSecao(secao.id)}
          onMove={(dir) => onMoveSecao(secao.id, dir)}
          onRemove={() => onRemoveSecao(secao.id)}
          onAddAbove={() => onAddSecao(idx)}
          onAddBelow={() => onAddSecao(idx + 1)}
          evento={evento}
        />
      ))}
      {/* Final add below */}
      <AddBlocoButton onClick={() => onAddSecao(ordenadas.length)} />
    </div>
  );
}
