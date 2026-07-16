import { useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Set initial content only on mount — never on re-renders to avoid cursor jump
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || "";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const execCmd = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    emitChange();
  };

  // Apply font size to selected text.
  // Trick: use execCommand('fontSize','7') as marker → replace <font size=7> with <span style="font-size:Xpx">
  const adjustFontSize = (dir: "up" | "down") => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    editorRef.current?.focus();

    const range = sel.getRangeAt(0);
    const anchor = range.startContainer;
    const parentEl =
      anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement);
    const currentPx = parentEl
      ? parseFloat(window.getComputedStyle(parentEl).fontSize) || 14
      : 14;
    const newPx =
      dir === "up" ? Math.min(currentPx + 2, 48) : Math.max(currentPx - 2, 8);

    document.execCommand("fontSize", false, "7");

    if (editorRef.current) {
      editorRef.current.querySelectorAll('font[size="7"]').forEach((font) => {
        const span = document.createElement("span");
        span.style.fontSize = `${newPx}px`;
        span.innerHTML = (font as HTMLElement).innerHTML;
        font.parentNode?.replaceChild(span, font);
      });
    }

    emitChange();
  };

  const toolbarBtn = (label: string, onClick: () => void, title: string, extraClass = "") => (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={`h-7 min-w-[28px] px-1.5 text-xs select-none ${extraClass}`}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
    >
      {label}
    </Button>
  );

  return (
    <div className={`border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 ${className || ""}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b bg-muted/40">
        {toolbarBtn("N", () => execCmd("bold"), "Negrito (Ctrl+B)", "font-bold")}
        {toolbarBtn("I", () => execCmd("italic"), "Itálico (Ctrl+I)", "italic")}
        {toolbarBtn("S", () => execCmd("underline"), "Sublinhado (Ctrl+U)", "underline")}
        <div className="w-px h-4 bg-border mx-1" />
        {toolbarBtn("A−", () => adjustFontSize("down"), "Diminuir texto selecionado")}
        {toolbarBtn("A+", () => adjustFontSize("up"), "Aumentar texto selecionado")}
        <div className="w-px h-4 bg-border mx-1" />
        {toolbarBtn("• Lista", () => execCmd("insertUnorderedList"), "Lista com marcadores")}
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Digite aqui..."}
        onInput={emitChange}
        onKeyDown={(e) => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === "b") { e.preventDefault(); execCmd("bold"); }
            if (e.key === "i") { e.preventDefault(); execCmd("italic"); }
            if (e.key === "u") { e.preventDefault(); execCmd("underline"); }
          }
        }}
        className={[
          "min-h-[120px] max-h-[320px] overflow-y-auto p-3 text-sm",
          "focus:outline-none",
          "[&_b]:font-bold [&_strong]:font-bold",
          "[&_i]:italic [&_em]:italic",
          "[&_u]:underline",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
        ].join(" ")}
      />
    </div>
  );
}
