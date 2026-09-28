import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/components/lib/cn";

type AlertVariant = "info" | "success" | "warning" | "danger";

const ICON: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

const CLASS: Record<AlertVariant, string> = {
  info: "border-border bg-bg text-text",
  success: "border-success/30 bg-success-bg text-success",
  warning: "border-warning/30 bg-warning-bg text-warning",
  danger: "border-danger/30 bg-danger-bg text-danger",
};

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
};

/** Banner de estado (erro de login, aviso de assinatura…). `role="alert"` quando não é `info`. */
export function Alert({ variant = "info", title, className, children, ...props }: AlertProps) {
  const Icon = ICON[variant];
  return (
    <div
      role={variant === "info" ? undefined : "alert"}
      className={cn("flex gap-3 rounded-card border p-4 text-sm", CLASS[variant], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title && "mt-0.5 text-text-secondary")}>{children}</div>
      </div>
    </div>
  );
}
