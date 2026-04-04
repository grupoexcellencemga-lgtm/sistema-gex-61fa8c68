import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "primary" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

const variantStyles = {
  default: "glass-panel",
  primary: "glass-panel border-l-4 border-l-primary",
  success: "glass-panel border-l-4 border-l-success",
  warning: "glass-panel border-l-4 border-l-warning",
  destructive: "glass-panel border-l-4 border-l-destructive",
};

export function MetricCard({ title, value, icon: Icon, trend, variant = "default", onClick }: MetricCardProps) {
  return (
    <div
      className={`rounded-lg p-5 transition-all duration-300 ${variantStyles[variant]} ${onClick ? "cursor-pointer glass-panel-hover" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-card-foreground dark:text-white">{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary dark:bg-primary/10">
          <Icon className="h-5 w-5 text-muted-foreground dark:text-primary dark:drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-all" />
        </div>
      </div>
    </div>
  );
}
