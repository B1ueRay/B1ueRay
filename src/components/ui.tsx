"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
export function AIBadge() {
  return (
    <span className="ai-badge">
      <Sparkles size={11} /> AI creator
    </span>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={16} />;
}
export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={32} />
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      {dismissible && (
        <button
          className="modal-close icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      )}
      <div className="eyebrow">YOUR PRIVATE WORLD</div>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
export function ToastHost() {
  const [item, setItem] = useState<{ message: string; error: boolean } | null>(
    null,
  );
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const listener = (e: Event) => {
      setItem((e as CustomEvent).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setItem(null), 5000);
    };
    window.addEventListener("velora-toast", listener);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("velora-toast", listener);
    };
  }, []);
  return item ? (
    <div role="status" className={`toast ${item.error ? "error" : ""}`}>
      {item.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{" "}
      {item.message}
    </div>
  ) : null;
}
export function LockedMedia({
  label = "A little closer. A little more personal.",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="locked-media">
      <div className="locked-art" />
      <div className="locked-content">
        <div className="lock-orb">
          <LockKeyhole size={22} />
        </div>
        <h3>{label}</h3>
        <p>Private content, for your eyes only.</p>
        {children}
      </div>
    </div>
  );
}
