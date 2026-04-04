import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Plus, StickyNote, ExternalLink, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId = "";
      if (u.hostname.includes("youtu.be")) videoId = u.pathname.slice(1);
      else videoId = u.searchParams.get("v") || "";
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const match = u.pathname.match(/\/(\d+)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch { /* ignore */ }
  return null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

function MindMapNode({ id, data, selected }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label as string);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setLabel(data.label as string);
  }, [data.label]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  const commitLabel = useCallback(() => {
    setEditing(false);
    setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
    );
  }, [id, label, setNodes]);

  const color = (data.color as string) || "#3b82f6";
  const image = data.image as string | undefined;
  const video = data.video as string | undefined;
  const note = data.note as string | undefined;
  const link = data.link as string | undefined;
  const bold = data.bold as boolean | undefined;
  const italic = data.italic as boolean | undefined;
  const fontSize = (data.fontSize as number) || 14;
  const isRoot = data.isRoot !== false; // default true for backward compat
  const textColor = isRoot ? ((data.textColor as string) || "#ffffff") : ((data.textColor as string) || "#000000");
  const borderStyle = (data.borderStyle as string) || "solid";
  const borderColor = (data.borderColor as string) || "transparent";
  const nodeWidth = (data.nodeWidth as number) || 160;
  const onAddChild = data.onAddChild as ((nodeId: string) => void) | undefined;
  const onAddSibling = data.onAddSibling as ((nodeId: string) => void) | undefined;
  const onContextMenu = data.onContextMenu as ((e: React.MouseEvent, nodeId: string) => void) | undefined;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, id);
  }, [onContextMenu, id]);

  return (
    <div
      className="relative group"
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-background" style={{ backgroundColor: color }} />
      <div
        className={cn(
          "px-4 py-2 rounded-xl text-center transition-all overflow-hidden",
          isRoot ? "shadow-lg" : ""
        )}
        style={{
          width: nodeWidth,
          minWidth: nodeWidth,
          maxWidth: nodeWidth,
          backgroundColor: isRoot ? color : "transparent",
          borderWidth: isRoot ? 2 : 0,
          borderStyle: selected ? "solid" : (borderStyle as any),
          borderColor: selected
            ? "hsl(var(--primary))"
            : isRoot ? (borderColor === "transparent" ? "transparent" : borderColor) : "transparent",
          boxShadow: isRoot
            ? selected
              ? `0 0 0 2px hsl(var(--primary) / 0.3), 0 4px 12px ${color}40`
              : `0 4px 12px ${color}30`
            : selected ? `0 0 0 2px hsl(var(--primary) / 0.3)` : "none",
        }}
      >
        {/* Image */}
        {image && (
          <img
            src={image}
            alt=""
            className="w-full h-auto rounded-lg mb-1.5"
            style={{ objectFit: "contain", maxHeight: "none" }}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}

        {/* Video */}
        {video && (() => {
          const embedUrl = getVideoEmbedUrl(video);
          if (embedUrl) {
            return (
              <div className="w-full rounded-lg mb-1.5 overflow-hidden nodrag nopan nowheel" style={{ aspectRatio: "16/9" }}>
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          if (isDirectVideo(video)) {
            return (
              <video
                src={video}
                controls
                className="w-full rounded-lg mb-1.5 nodrag nopan nowheel"
                style={{ maxHeight: "none" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            );
          }
          return null;
        })()}

        {/* Text */}
        {editing ? (
          <textarea
            autoFocus
            className="bg-transparent text-sm font-medium w-full text-center outline-none resize-none nodrag nopan nowheel"
            style={{ color: textColor, minHeight: "1.5em", overflow: "hidden" }}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onFocus={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onBlur={commitLabel}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitLabel(); }
              if (e.key === "Escape") { setLabel(data.label as string); setEditing(false); }
              e.stopPropagation();
            }}
          />
        ) : (
          <span
            className="text-sm break-words whitespace-pre-wrap"
            style={{
              color: textColor,
              fontWeight: bold ? "bold" : "normal",
              fontStyle: italic ? "italic" : "normal",
              fontSize: `${fontSize}px`,
            }}
          >
            {label}
          </span>
        )}

        {/* Icons row */}
        {(note || link || image || video) && (
          <div className="flex items-center justify-center gap-1.5 mt-1">
            {note && (
              <span title={note}>
                <StickyNote className="h-3 w-3 text-yellow-200 opacity-80" />
              </span>
            )}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={link}
              >
                <ExternalLink className="h-3 w-3 text-blue-200 opacity-80 hover:opacity-100" />
              </a>
            )}
            {image && (
              <ImageIcon className="h-3 w-3 text-green-200 opacity-60" />
            )}
            {video && (
              <Video className="h-3 w-3 text-purple-200 opacity-60" />
            )}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-background" style={{ backgroundColor: color }} />

      {/* Add child button (right side) */}
      {onAddChild && (
        <button
          className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:scale-110"
          onClick={(e) => { e.stopPropagation(); onAddChild(id); }}
          title="Adicionar filho (Tab)"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}

      {/* Add sibling button (bottom) */}
      {onAddSibling && (
        <button
          className="absolute left-1/2 -translate-x-1/2 -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary text-secondary-foreground rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:scale-110"
          onClick={(e) => { e.stopPropagation(); onAddSibling(id); }}
          title="Adicionar irmão (Enter)"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default memo(MindMapNode, (prev, next) => {
  // Force re-render when data changes (deep compare key fields)
  if (prev.selected !== next.selected) return false;
  const pd = prev.data;
  const nd = next.data;
  if (pd.label !== nd.label) return false;
  if (pd.color !== nd.color) return false;
  if (pd.isRoot !== nd.isRoot) return false;
  if (pd.image !== nd.image) return false;
  if (pd.video !== nd.video) return false;
  if (pd.note !== nd.note) return false;
  if (pd.link !== nd.link) return false;
  if (pd.bold !== nd.bold) return false;
  if (pd.italic !== nd.italic) return false;
  if (pd.fontSize !== nd.fontSize) return false;
  if (pd.textColor !== nd.textColor) return false;
  if (pd.borderStyle !== nd.borderStyle) return false;
  if (pd.borderColor !== nd.borderColor) return false;
  if (pd.nodeWidth !== nd.nodeWidth) return false;
  return true;
});
