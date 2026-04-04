import { useEffect, useRef } from "react";
import { Copy, Scissors, ClipboardPaste, StickyNote, ExternalLink, Trash2, Plus } from "lucide-react";

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
  onCopy: (nodeId: string) => void;
  onCut: (nodeId: string) => void;
  onPaste: (nodeId: string) => void;
  onAddNote: (nodeId: string) => void;
  onAddLink: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (nodeId: string) => void;
}

export default function NodeContextMenu({
  x, y, nodeId, onClose,
  onCopy, onCut, onPaste, onAddNote, onAddLink, onDelete, onAddChild,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "Copiar", icon: Copy, action: () => onCopy(nodeId), shortcut: "Ctrl+C" },
    { label: "Recortar", icon: Scissors, action: () => onCut(nodeId), shortcut: "Ctrl+X" },
    { label: "Colar", icon: ClipboardPaste, action: () => onPaste(nodeId), shortcut: "Ctrl+V" },
    null,
    { label: "Adicionar filho", icon: Plus, action: () => onAddChild(nodeId), shortcut: "Tab" },
    { label: "Adicionar nota", icon: StickyNote, action: () => onAddNote(nodeId) },
    { label: "Adicionar link", icon: ExternalLink, action: () => onAddLink(nodeId) },
    null,
    { label: "Apagar", icon: Trash2, action: () => onDelete(nodeId), shortcut: "Del", destructive: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px] text-xs"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="border-t border-border my-0.5" />
        ) : (
          <button
            key={item.label}
            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors text-left ${
              item.destructive ? "text-destructive" : "text-foreground"
            }`}
            onClick={() => { item.action(); onClose(); }}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-muted-foreground text-[10px]">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
