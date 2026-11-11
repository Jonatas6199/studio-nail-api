"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Check, Plus, Clock3 } from "lucide-react";
import { Button } from "./ui";
import { CATEGORIES, COLORS, METHODS, conflicts, endTime, minutes, money, paidFor, todayISO, uid, type Appointment, type Client, type Expense, type Payment, type Procedure, type Store } from "@/lib/model";

export function AppointmentEditor({ store, date, time = "09:00", appointment, initialClientId, onSave, onClose }: { store: Store; date: string; time?: string; appointment?: Appointment; initialClientId?: string; onSave: (a: Appointment, client?: Client, payment?: Payment) => void; onClose: () => void }) {
  const [draftId] = useState(() => appointment?.id ?? uid());
  const [draftClientId] = useState(uid);
  const [draftPaymentId] = useState(uid);
  const [clientId, setClientId] = useState(appointment?.clientId ?? initialClientId ?? "");
  const [newClient, setNewClient] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState(appointment?.procedures ?? []);
  const [day, setDay] = useState(appointment?.date ?? date);
  const [start, setStart] = useState(appointment?.time ?? time);
  const [duration, setDuration] = useState(appointment?.duration ?? 90);
  const [price, setPrice] = useState(String((appointment?.price ?? 0) / 100));
  const [deposit, setDeposit] = useState(""); const [method, setMethod] = useState("Pix");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [allowOverlap, setAllowOverlap] = useState(false); const [error, setError] = useState("");
  const draft = { id: appointment?.id ?? "new", date: day, time: start, duration };
  const overlapping = conflicts(store, draft);
  const amount = Math.round(Number(price) * 100); const signal = Math.round(Number(deposit || 0) * 100);
  const existingPaid = appointment ? paidFor(store, appointment.id) : 0;
  function toggle(p: Procedure) {
    const next = selected.some(s => s.id === p.id) ? selected.filter(s => s.id !== p.id) : [...selected, { id: p.id, name: p.name, price: p.price, duration: p.duration }];
    setSelected(next); setPrice(String(next.reduce((sum, s) => sum + s.price, 0) / 100)); setDuration(next.reduce((sum, s) => sum + s.duration, 0) || 30); setAllowOverlap(false);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if ((!newClient && !clientId) || (newClient && !name.trim())) return setError("Selecione ou cadastre uma cliente.");
    if (!selected.length) return setError("Selecione pelo menos um procedimento.");
    if (!Number.isFinite(amount) || amount < 0 || duration < 5 || minutes(start) + duration > 1440) return setError("Confira o valor e a duração. O atendimento deve terminar no mesmo dia.");
    if (!Number.isFinite(signal) || signal < 0 || signal + existingPaid > amount) return setError("O total recebido não pode ser maior que o valor do atendimento.");
    if (overlapping.length && !allowOverlap) return setError("Confirme a sobreposição para continuar.");
    const client = newClient ? { id: draftClientId, name: name.trim(), phone, notes: "", color: COLORS[store.clients.length % COLORS.length] } : undefined;
    const id = draftId;
    const a: Appointment = { ...appointment, id, clientId: client?.id ?? clientId, date: day, time: start, duration, price: amount, procedures: selected, notes: notes.trim(), status: appointment?.status ?? "scheduled", overlapConfirmed: overlapping.length ? allowOverlap : false };
    onSave(a, client, signal ? { id: draftPaymentId, appointmentId: id, amount: signal, date: todayISO(), method, kind: signal === amount ? "balance" : "deposit" } : undefined);
  }
  return <form onSubmit={submit} className="editor-form">
    <div className="field"><div className="label-row"><label htmlFor="appointment-client">Cliente</label><button type="button" className="inline-action" onClick={() => setNewClient(!newClient)}>{newClient ? "Selecionar existente" : <><Plus size={13} />Nova cliente</>}</button></div>{newClient ? <div className="inline-client form-grid"><label>Nome completo<input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome da cliente" maxLength={100} /></label><label>Telefone<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-0000" maxLength={24} /></label></div> : <select id="appointment-client" value={clientId} onChange={e => setClientId(e.target.value)} required><option value="">Selecione uma cliente</option>{store.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</div>
    <fieldset className="procedure-picker"><legend>Procedimentos <span>Selecione um ou mais</span></legend><div>{store.procedures.filter(p => p.active || selected.some(s => s.id === p.id)).map(p => <label key={p.id} className={selected.some(s => s.id === p.id) ? "selected" : ""}><input type="checkbox" checked={selected.some(s => s.id === p.id)} onChange={() => toggle(p)} /><span><strong>{p.name}</strong><small>{p.duration} min · {money(p.price)}</small></span><span className="check-square">{selected.some(s => s.id === p.id) && <Check size={13} />}</span></label>)}</div></fieldset>
    <div className="form-grid three"><label>Data<input type="date" required value={day} onInput={e => { setDay(e.currentTarget.value); setAllowOverlap(false); }} onChange={e => { setDay(e.target.value); setAllowOverlap(false); }} /></label><label>Horário<input type="time" required value={start} onInput={e => { setStart(e.currentTarget.value); setAllowOverlap(false); }} onChange={e => { setStart(e.target.value); setAllowOverlap(false); }} /></label><label>Duração (min)<input type="number" min="5" max="1440" step="5" required value={duration} onChange={e => { setDuration(Number(e.target.value)); setAllowOverlap(false); }} /></label></div>
    <div className="form-hint"><Clock3 size={14} />Término previsto às {minutes(start) + duration <= 1440 ? endTime(start, duration) : "—"}. Você pode ajustar a duração.</div>
    {overlapping.length > 0 && <div className="warning-box"><AlertTriangle size={18} /><div><strong>Há um conflito de horário</strong><p>{overlapping.map(a => `${a.time} · ${store.clients.find(c => c.id === a.clientId)?.name}`).join("; ")}</p><label className="checkbox-label"><input type="checkbox" checked={allowOverlap} onChange={e => setAllowOverlap(e.target.checked)} />Quero salvar mesmo com essa sobreposição.</label></div></div>}
    {!store.availability[day]?.includes(start) && <p className="form-hint">Este início está fora dos horários cadastrados. Você pode registrar este atendimento como exceção.</p>}
    <div className="form-grid"><label>Valor do atendimento (R$)<input type="number" min="0" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} /></label>{!appointment && <label>Sinal ou valor recebido (R$)<input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0,00" /></label>}{!appointment && signal > 0 && <label>Forma de pagamento<select value={method} onChange={e => setMethod(e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></label>}</div>
    <p className="form-hint">O preço e a duração personalizados valem apenas para este agendamento.</p>
    <label>Observações<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferências, cuidados ou algum detalhe importante…" rows={3} maxLength={1000} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-footer"><Button variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" icon={Check}>{appointment ? "Salvar alterações" : "Criar agendamento"}</Button></div>
  </form>;
}

export function ClientEditor({ client, onSave, onClose }: { client?: Client; onSave: (c: Client) => void; onClose: () => void }) {
  const [id] = useState(() => client?.id ?? uid());
  const [name, setName] = useState(client?.name ?? ""); const [phone, setPhone] = useState(client?.phone ?? ""); const [notes, setNotes] = useState(client?.notes ?? "");
  return <form className="editor-form" onSubmit={e => { e.preventDefault(); if (name.trim()) onSave({ id, name: name.trim(), phone: phone.trim(), notes: notes.trim(), color: client?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)] }); }}><label>Nome completo<input autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="Como sua cliente se chama?" required maxLength={100} /></label><label>Telefone<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-0000" maxLength={24} /></label><label>Observações<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Preferências e detalhes para o próximo atendimento" rows={4} maxLength={1000} /></label><div className="form-footer"><Button variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" icon={Check}>Salvar cliente</Button></div></form>;
}

export function ProcedureEditor({ procedure, onSave, onClose }: { procedure?: Procedure; onSave: (p: Procedure) => void; onClose: () => void }) {
  const [id] = useState(() => procedure?.id ?? uid());
  const [name, setName] = useState(procedure?.name ?? ""); const [description, setDescription] = useState(procedure?.description ?? ""); const [price, setPrice] = useState(String((procedure?.price ?? 0) / 100)); const [duration, setDuration] = useState(procedure?.duration ?? 60);
  return <form className="editor-form" onSubmit={e => { e.preventDefault(); if (name.trim()) onSave({ id, name: name.trim(), description: description.trim(), price: Math.round(Number(price) * 100), duration, active: procedure?.active ?? true }); }}><label>Nome do procedimento<input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex.: Alongamento em gel" maxLength={100} /></label><label>Descrição<input value={description} onChange={e => setDescription(e.target.value)} placeholder="Uma breve descrição do serviço" maxLength={200} /></label><div className="form-grid"><label>Preço padrão (R$)<input type="number" min="0" step="0.01" required value={price} onChange={e => setPrice(e.target.value)} /></label><label>Duração (minutos)<input type="number" min="5" max="1440" step="5" required value={duration} onChange={e => setDuration(Number(e.target.value))} /></label></div><div className="info-box">Os atendimentos já registrados mantêm seus preços e durações originais.</div><div className="form-footer"><Button variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" icon={Check}>Salvar procedimento</Button></div></form>;
}

export function PaymentEditor({ appointment, store, onSave, onClose }: { appointment: Appointment; store: Store; onSave: (p: Payment) => void; onClose: () => void }) {
  const [id] = useState(uid);
  const remaining = Math.max(0, appointment.price - paidFor(store, appointment.id));
  const [amount, setAmount] = useState(String(remaining / 100)); const [date, setDate] = useState(todayISO()); const [method, setMethod] = useState("Pix"); const [error, setError] = useState("");
  return <form className="editor-form" onSubmit={e => { e.preventDefault(); const value = Math.round(Number(amount) * 100); if (!Number.isFinite(value) || value <= 0 || value > remaining) return setError("Informe um valor maior que zero e até o saldo pendente."); onSave({ id, appointmentId: appointment.id, amount: value, date, method, kind: paidFor(store, appointment.id) === 0 && value < remaining ? "deposit" : "balance" }); }}><div className="payment-summary"><span>Valor pendente</span><strong>{money(remaining)}</strong></div><div className="form-grid"><label>Valor recebido (R$)<input type="number" min="0.01" max={remaining / 100} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label><label>Data do recebimento<input type="date" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} required /></label></div><label>Forma de pagamento<select value={method} onChange={e => setMethod(e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></label><p className="form-hint">Registro manual. Nenhuma cobrança será realizada.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-footer"><Button variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" icon={Check}>Registrar recebimento</Button></div></form>;
}

export function ExpenseEditor({ onSave, onClose }: { onSave: (e: Expense) => void; onClose: () => void }) {
  const [id] = useState(uid);
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState(""); const [date, setDate] = useState(todayISO()); const [category, setCategory] = useState("Insumos"); const [method, setMethod] = useState("Pix");
  return <form className="editor-form" onSubmit={e => { e.preventDefault(); if (description.trim() && Number(amount) > 0) onSave({ id, description: description.trim(), amount: Math.round(Number(amount) * 100), date, category, method }); }}><label>Descrição<input value={description} onChange={e => setDescription(e.target.value)} required placeholder="Ex.: Compra de esmaltes e géis" maxLength={160} /></label><div className="form-grid"><label>Valor pago (R$)<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label><label>Data do pagamento<input type="date" value={date} onInput={e => setDate(e.currentTarget.value)} onChange={e => setDate(e.target.value)} required /></label><label>Categoria<select value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Forma de pagamento<select value={method} onChange={e => setMethod(e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></label></div><div className="form-footer"><Button variant="secondary" onClick={onClose}>Voltar</Button><Button type="submit" icon={Check}>Registrar despesa</Button></div></form>;
}
