import * as React from "react";

import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm table-fixed", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const MIN_COLUMN_WIDTH = 88;

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, style, children, ...props }, ref) => {
    const [columnWidth, setColumnWidth] = React.useState<number | null>(null);
    const headRef = React.useRef<HTMLTableCellElement | null>(null);
    const cleanupResizeRef = React.useRef<(() => void) | null>(null);

    React.useEffect(() => () => cleanupResizeRef.current?.(), []);

    const setRefs = React.useCallback(
      (node: HTMLTableCellElement | null) => {
        headRef.current = node;

        if (typeof ref === "function") {
          ref(node);
          return;
        }

        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const handleResizeStart = React.useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
      if (!headRef.current) return;

      event.preventDefault();
      event.stopPropagation();

      const resizeHandle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const initialWidth = headRef.current.getBoundingClientRect().width;

      setColumnWidth(initialWidth);
      resizeHandle.setPointerCapture(pointerId);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(initialWidth + moveEvent.clientX - startX));
        setColumnWidth(nextWidth);
      };

      const stopResizing = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", stopResizing);
        window.removeEventListener("pointercancel", stopResizing);

        if (resizeHandle.hasPointerCapture(pointerId)) {
          resizeHandle.releasePointerCapture(pointerId);
        }

        cleanupResizeRef.current = null;
      };

      cleanupResizeRef.current?.();
      cleanupResizeRef.current = stopResizing;

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", stopResizing);
      window.addEventListener("pointercancel", stopResizing);
    }, []);

    return (
      <th
        ref={setRefs}
        style={
          columnWidth
            ? {
                ...style,
                width: `${columnWidth}px`,
                minWidth: `${columnWidth}px`,
              }
            : style
        }
        className={cn(
          "group relative h-12 px-4 pr-6 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
          className,
        )}
        {...props}
      >
        {children}
        <span
          role="separator"
          aria-label="Redimensionar coluna"
          aria-orientation="vertical"
          onPointerDown={handleResizeStart}
          className="absolute right-0 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none select-none items-center justify-center"
        >
          <span className="h-6 w-px rounded-full bg-border transition-colors group-hover:bg-primary/70 group-active:bg-primary" />
        </span>
      </th>
    );
  },
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
