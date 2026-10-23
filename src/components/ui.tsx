"use client";

import { Loader2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
} from "react";

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  secondary:
    "bg-surface text-fg border border-line hover:bg-subtle shadow-sm",
  ghost: "text-muted hover:text-fg hover:bg-subtle",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "icon";
  loading?: boolean;
}) {
  const sizes = {
    sm: "h-8 px-2.5 text-[13px] gap-1.5",
    md: "h-9 px-3.5 text-sm gap-2",
    icon: "h-8 w-8 justify-center",
  };
  return (
    <button
      className={`inline-flex items-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Form fields ---------- */

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-faint outline-none transition focus:border-accent focus:ring-3 focus:ring-accent/15 ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`size-5 animate-spin text-muted ${className}`} />;
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-[2px] animate-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        role="dialog"
        className={`relative w-full ${width} rounded-xl border border-line bg-surface shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="truncate text-[15px] font-semibold text-fg">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-subtle/50 px-5 py-3 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Prompt / Confirm dialogs ---------- */

type PromptProps = {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
};

/** Mounted only while open so its state starts fresh from `initial` each time. */
export function PromptDialog(props: PromptProps) {
  return props.open ? <PromptDialogInner {...props} /> : null;
}

function PromptDialogInner({
  open,
  title,
  label,
  initial = "",
  confirmLabel = "Simpan",
  onClose,
  onSubmit,
}: PromptProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Select the name without its extension, like a desktop file manager.
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant="primary" loading={busy} onClick={submit}>{confirmLabel}</Button>
        </>
      }
    >
      <Field label={label}>
        <Input ref={ref} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </Field>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  danger = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{message}</div>
    </Modal>
  );
}

/* ---------- Toasts ---------- */

type Toast = { id: number; kind: "success" | "error" | "info"; message: string };
const ToastCtx = createContext<(kind: Toast["kind"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-lg animate-in ${
              t.kind === "error"
                ? "bg-red-600 text-white"
                : t.kind === "success"
                  ? "bg-fg text-bg"
                  : "bg-surface text-fg border border-line"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
