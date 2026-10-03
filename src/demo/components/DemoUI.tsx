import type { ReactNode } from "react";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";

export function PageIntro({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-[26px] md:text-[30px] tracking-[-0.035em] font-semibold text-[#181818]">{title}</h2>
        <p className="mt-1 text-sm text-black/45">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PrimaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="h-9 px-3.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2" style={{ background: "var(--demo-primary)" }}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} className="h-9 px-3.5 rounded-lg text-xs font-medium border border-black/[0.08] bg-white hover:bg-black/[0.02] flex items-center gap-2">{children}</button>;
}
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`bg-white rounded-[18px] border border-black/[0.055] shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${className}`}>{children}</section>;
}

export function PanelHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-black/[0.055] flex items-center justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-black/35 mb-1">{eyebrow}</p>}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {action ?? <MoreHorizontal className="h-4 w-4 text-black/25" />}
    </div>
  );
}

export function StatCard({ label, value, delta, hint }: { label: string; value: string; delta?: string; hint?: string }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-black/42">{label}</p>
        {delta && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />{delta}</span>}
      </div>
      <div className="mt-4 text-[24px] md:text-[28px] leading-none tracking-[-0.035em] font-semibold">{value}</div>
      {hint && <p className="mt-2 text-[11px] text-black/35">{hint}</p>}
    </Panel>
  );
}
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-black/[0.045] text-black/55",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    info: "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-black/[0.055] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: "var(--demo-primary)" }} />
    </div>
  );
}

export function EmptyAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").slice(0, 2).map((part) => part[0]).join("");
  const sizes = { sm: "h-7 w-7 text-[9px]", md: "h-9 w-9 text-[10px]", lg: "h-12 w-12 text-xs" };
  return <div className={`${sizes[size]} shrink-0 rounded-full flex items-center justify-center font-semibold`} style={{ background: "var(--demo-primary-soft)", color: "var(--demo-primary)" }}>{initials}</div>;
}
export function MiniBarChart({ data }: { data: Array<{ label: string; primary: number; secondary?: number }> }) {
  const max = Math.max(...data.flatMap((item) => [item.primary, item.secondary ?? 0]), 1);
  return (
    <div className="h-48 flex items-end gap-3 pt-5">
      {data.map((item) => (
        <div key={item.label} className="flex-1 h-full flex flex-col justify-end gap-2 min-w-0">
          <div className="flex-1 flex items-end justify-center gap-1.5 min-h-0">
            <div className="w-[38%] max-w-8 rounded-t-md" style={{ height: `${(item.primary / max) * 100}%`, background: "var(--demo-primary)" }} />
            {item.secondary !== undefined && <div className="w-[38%] max-w-8 rounded-t-md bg-black/[0.09]" style={{ height: `${(item.secondary / max) * 100}%` }} />}
          </div>
          <span className="text-[10px] text-black/35 text-center truncate">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="h-11 flex items-end gap-1">
      {values.map((value, index) => (
        <div key={index} className="flex-1 rounded-sm" style={{ height: `${Math.max(14, (value / max) * 100)}%`, background: index === values.length - 1 ? "var(--demo-primary)" : "var(--demo-primary-soft)" }} />
      ))}
    </div>
  );
}
