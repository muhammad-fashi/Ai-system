"use client";
import { useEffect } from "react";
import { titleCase } from "@/lib/utils";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="Loading"
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "brand",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "brand" | "green" | "red" | "amber" | "violet" | "slate";
}) {
  const accents: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {icon && (
          <div className={`rounded-lg p-2 text-lg ${accents[accent]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-700",
  CALLING: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-sky-100 text-sky-700",
  INTERESTED: "bg-emerald-100 text-emerald-700",
  NOT_INTERESTED: "bg-slate-200 text-slate-600",
  FOLLOW_UP_REQUIRED: "bg-amber-100 text-amber-700",
  MEETING_BOOKED: "bg-violet-100 text-violet-700",
  CONVERTED: "bg-emerald-200 text-emerald-800",
  DO_NOT_CALL: "bg-red-100 text-red-700",
  INVALID_NUMBER: "bg-red-50 text-red-600",
  // call statuses
  QUEUED: "bg-slate-100 text-slate-600",
  INITIATED: "bg-blue-100 text-blue-700",
  RINGING: "bg-blue-100 text-blue-700",
  CONNECTED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  NO_ANSWER: "bg-amber-100 text-amber-700",
  BUSY: "bg-amber-100 text-amber-700",
  VOICEMAIL: "bg-violet-100 text-violet-700",
  RETRY_SCHEDULED: "bg-amber-100 text-amber-700",
  SKIPPED: "bg-slate-100 text-slate-500",
  // campaign
  DRAFT: "bg-slate-100 text-slate-600",
  RUNNING: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  STOPPED: "bg-red-100 text-red-700",
  // outcomes
  MEETING_REQUESTED: "bg-violet-100 text-violet-700",
  PRICING_REQUESTED: "bg-sky-100 text-sky-700",
  INFORMATION_REQUESTED: "bg-sky-100 text-sky-700",
  WRONG_NUMBER: "bg-red-50 text-red-600",
  UNKNOWN: "bg-slate-100 text-slate-500",
  // followup
  PENDING_FU: "bg-amber-100 text-amber-700",
  RESCHEDULED: "bg-sky-100 text-sky-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const cls = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return <span className={`badge ${cls}`}>{titleCase(status)}</span>;
}

export function InterestBadge({ level }: { level?: string | null }) {
  if (!level || level === "UNKNOWN")
    return <span className="badge bg-slate-100 text-slate-500">Unknown</span>;
  const map: Record<string, string> = {
    HOT: "bg-red-100 text-red-700",
    WARM: "bg-amber-100 text-amber-700",
    COLD: "bg-sky-100 text-sky-700",
  };
  const emoji: Record<string, string> = { HOT: "🔥", WARM: "🌤️", COLD: "❄️" };
  return (
    <span className={`badge ${map[level] || "bg-slate-100"}`}>
      {emoji[level]} {titleCase(level)}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6">
      <div
        className={`card w-full ${sizes[size]} my-8 p-0 animate-[fadeIn_.15s_ease]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = "📭",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          className="btn-secondary px-3 py-1"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn-secondary px-3 py-1"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onCancel,
  loading = false,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={danger ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Spinner /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  );
}
