"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, Search, Check, ArrowUpRight, type LucideIcon } from "lucide-react";

export function IconButton({ icon: Icon, label, onClick, className = "", disabled = false }: { icon: LucideIcon; label: string; onClick: () => void; className?: string; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}><Icon size={19} strokeWidth={1.6} /></button>;
}
export function Button({ children, onClick, variant = "primary", icon: Icon, type = "button", disabled = false, className = "" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: LucideIcon; type?: "button" | "submit"; disabled?: boolean; className?: string }) {
  return <button type={type} className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled}>{Icon && <Icon size={17} strokeWidth={1.7} />}{children}</button>;
}
export function Dialog({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); old?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`dialog ${wide ? "dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}><div className="dialog-heading"><div><p className="eyebrow">SEU ATELIÊ, ORGANIZADO</p><h2 id="dialog-title">{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div><IconButton icon={X} label="Fechar janela" onClick={onClose} /></div>{children}</div></div>;
}
export function EmptyState({ icon: Icon, title, text, action, onAction }: { icon: LucideIcon; title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={29} strokeWidth={1.3} /></span><h3>{title}</h3><p>{text}</p>{action && <Button icon={Plus} variant="secondary" onClick={onAction}>{action}</Button>}</div>;
}
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return <div className="search-field"><Search size={17} /><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />{value && <button type="button" aria-label="Limpar busca" onClick={() => onChange("")}><X size={15} /></button>}</div>;
}
export function Stat({ label, value, icon: Icon, detail, tone = "sand" }: { label: string; value: string; icon: LucideIcon; detail: string; tone?: string }) {
  return <div className="stat"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.5} /></span></div><strong>{value}</strong><span className="stat-detail">{detail}</span></div>;
}
export function Toast({ message }: { message: string }) { return <div className="toast" role="status"><span><Check size={17} /></span>{message}</div>; }
export function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) { return <div className="section-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>{action}</div>; }
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15} /></button>; }
