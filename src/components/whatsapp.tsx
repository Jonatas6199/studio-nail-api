"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, RotateCcw, Bell, ChevronRight } from "lucide-react";
import { formatDate, type Appointment, type MessageContext, type MessageKind, type Store } from "@/lib/model";
import { appointmentMessage, contextKey, messageContext, messageReceipt, pendingReminders, whatsappLink, whatsappNumber } from "@/lib/whatsapp";
import { Button, EmptyState } from "./ui";

export function WhatsAppMessage({ store, appointment, kind, onSent, onSettings }: {
  store: Store; appointment: Appointment; kind: MessageKind;
  onSent: (context: MessageContext, sent: boolean) => Promise<boolean>; onSettings: () => void;
}) {
  const context = messageContext(store, appointment);
  const [message, setMessage] = useState(() => appointmentMessage(context, kind));
  const [copied, setCopied] = useState(false); const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const receipt = messageReceipt(store, appointment, kind);
  const number = whatsappNumber(context.phone);
  const ready = number && context.address.trim() && message.trim();
  const link = ready ? whatsappLink(context.phone, message) : null;
  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopied(true); setOpened(true); setError(""); }
    catch { setError("Não foi possível copiar. Selecione o texto acima e copie pelo menu do celular."); }
  }
  async function mark(sent: boolean) {
    setBusy(true); setError("");
    try { if (!await onSent(context, sent)) setError("Não foi possível atualizar o envio. Confira a mensagem exibida e tente novamente."); }
    finally { setBusy(false); }
  }
  return <div className="editor-form whatsapp-editor">
    <div className="message-recipient"><span className="avatar sage"><MessageCircle size={22} /></span><div><strong>{context.client}</strong><small>{context.phone || "Sem telefone cadastrado"}</small></div></div>
    {!number && <p className="warning-box" role="alert">Cadastre um telefone válido com DDD na ficha da cliente para abrir o WhatsApp.</p>}
    {!context.address.trim() && <div className="warning-box">Preencha o endereço do ateliê antes de abrir a mensagem.<button className="text-link" onClick={onSettings}>Ir às configurações</button></div>}
    <label>Mensagem para a cliente<textarea rows={14} maxLength={4000} value={message} onChange={e => { setMessage(e.target.value); setCopied(false); }} /></label>
    <div className="message-actions">
      {link ? <a className="button button-primary" href={link} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}><MessageCircle size={17} />Abrir WhatsApp</a> : <Button icon={MessageCircle} disabled>Abrir WhatsApp</Button>}
      <Button icon={copied ? Check : Copy} variant="secondary" onClick={copy}>{copied ? "Mensagem copiada" : "Copiar mensagem"}</Button>
    </div>
    <p className="form-hint">Você revisa e toca em Enviar dentro do WhatsApp. No iPhone, se abrir o pessoal, copie a mensagem e cole no Business.</p>
    {receipt ? <div className="message-sent"><span><Check size={17} />Você marcou como enviada em {new Date(receipt.sentAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.</span><Button variant="ghost" icon={RotateCcw} disabled={busy} onClick={() => void mark(false)}>Desfazer marcação</Button></div> : <div className="message-confirm"><p>Depois de enviar à cliente, registre aqui:</p><Button icon={Check} variant="secondary" disabled={busy || !opened} onClick={() => void mark(true)}>Já enviei {kind === "reminder" ? "o lembrete" : "a confirmação"}</Button><small>Abrir ou copiar a mensagem não marca o envio automaticamente.</small></div>}
    <Button variant="ghost" icon={RotateCcw} onClick={() => { setMessage(appointmentMessage(context, kind)); setCopied(false); }}>Restaurar mensagem padrão</Button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

export function ReminderList({ store, now, onOpen }: { store: Store; now: Date; onOpen: (a: Appointment) => void }) {
  const reminders = pendingReminders(store, now);
  return reminders.length ? <div className="reminder-list">{reminders.map(a => <button key={a.id} className="reminder-row" onClick={() => onOpen(a)}><span className="avatar sage"><MessageCircle size={19} /></span><span><strong>{store.clients.find(c => c.id === a.clientId)?.name}</strong><small>{formatDate(a.date, { day: "2-digit", month: "2-digit" })} · {a.time} · {a.procedures.map(p => p.name).join(" + ")}</small></span><span className="reminder-open">Preparar lembrete<ChevronRight size={16} /></span></button>)}</div> : <EmptyState icon={Check} title="Lembretes em dia" text="As pendências aparecem às 09h, dois dias antes de cada atendimento, e ficam aqui até você marcar o envio." />;
}

export function ReminderPanel({ store, now, onOpen }: { store: Store; now: Date; onOpen: (a: Appointment) => void }) {
  const reminders = pendingReminders(store, now);
  if (!reminders.length) return null;
  return <section className="panel reminder-panel" aria-label="Lembretes de WhatsApp pendentes"><div className="reminder-heading"><span className="reminder-symbol"><Bell size={21} strokeWidth={1.5} /></span><div><p className="eyebrow">UM CUIDADO ANTES DO ENCONTRO</p><h2>{reminders.length === 1 ? "Uma cliente para lembrar" : `${reminders.length} clientes para lembrar`}</h2><p>As mensagens estão prontas. Você escolhe a hora de enviar.</p></div><span className="subtle-badge">Envio manual</span></div><ReminderList store={store} now={now} onOpen={onOpen} /></section>;
}

export { contextKey };
