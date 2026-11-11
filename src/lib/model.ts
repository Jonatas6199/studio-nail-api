export type View = "agenda" | "availability" | "clients" | "procedures" | "finance" | "settings";
export type Client = { id: string; name: string; phone: string; notes: string; color: string };
export type Procedure = { id: string; name: string; description: string; price: number; duration: number; active: boolean };
export type Appointment = {
  id: string; clientId: string; date: string; time: string; duration: number;
  procedures: { id: string; name: string; price: number; duration: number }[];
  price: number; notes: string; status: "scheduled" | "completed" | "cancelled" | "absent";
  overlapConfirmed?: boolean; googleDeletionPending?: boolean;
  pricePending?: boolean; timeUnknown?: boolean;
};
export type Payment = { id: string; appointmentId: string; amount: number; date: string; method: string; kind: "deposit" | "balance" };
export type Expense = { id: string; description: string; amount: number; date: string; category: string; method: string };
export type MessageKind = "confirmation" | "reminder";
export type MessageContext = { client: string; phone: string; date: string; time: string; procedures: string[]; price: number; paid: number; deposit: number; address: string; business: string; pricePending?: boolean; timeUnknown?: boolean };
export type MessageReceipt = { appointmentId: string; kind: MessageKind; context: MessageContext; sentAt: string };
export type Store = { version: 1; clients: Client[]; procedures: Procedure[]; appointments: Appointment[]; payments: Payment[]; expenses: Expense[]; availability: Record<string, string[]>; business: { name: string; professional: string; phone: string; address?: string }; messages?: MessageReceipt[] };

export const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export const appointmentPrice = (a: Appointment) => a.pricePending ? "Valor a definir" : money(a.price);
export const appointmentStart = (a: Appointment) => a.timeUnknown ? "Horário não informado" : a.time;
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const dateObject = (date: string) => new Date(`${date}T12:00:00`);
export const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function addDays(date: string, days: number) { const value = dateObject(date); value.setDate(value.getDate() + days); return isoDate(value); }
export function weekDates(date: string) { const offset = (dateObject(date).getDay() + 6) % 7; return Array.from({ length: 7 }, (_, i) => addDays(date, i - offset)); }
export const formatDate = (date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) => dateObject(date).toLocaleDateString("pt-BR", options);
export const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
export const clockTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export const endTime = (time: string, duration: number) => clockTime(minutes(time) + duration);
export const durationLabel = (duration: number) => `${Math.floor(duration / 60) ? `${Math.floor(duration / 60)}h` : ""}${duration % 60 ? ` ${duration % 60}min` : ""}`.trim();
export const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("");
export const uid = () => crypto.randomUUID();
export const paidFor = (store: Store, id: string) => store.payments.filter(p => p.appointmentId === id).reduce((sum, p) => sum + p.amount, 0);
export function conflicts(store: Store, draft: Pick<Appointment, "id" | "date" | "time" | "duration"> & { timeUnknown?: boolean }) {
  if (draft.timeUnknown) return [];
  return store.appointments.filter(a => !a.timeUnknown && a.id !== draft.id && a.date === draft.date && a.status !== "cancelled" && a.status !== "absent" && minutes(a.time) < minutes(draft.time) + draft.duration && minutes(a.time) + a.duration > minutes(draft.time));
}
export const METHODS = ["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Transferência", "Outro", "Não informado"];
export const CATEGORIES = ["Insumos", "Equipamentos", "Aluguel", "Cursos", "Marketing", "Outros"];
export const STATUS: Record<Appointment["status"], string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", absent: "Não compareceu" };
export const COLORS = ["rose", "sage", "sand", "lilac", "clay"];
export const STORAGE_KEY = "atelie-prototype-v1";

export function createDemo(anchor: string): Store {
  const clients: Client[] = [
    { id: "c1", name: "Mariana Oliveira", phone: "(11) 99912-3456", notes: "Prefere tons nude e formato amendoado.", color: "rose" },
    { id: "c2", name: "Beatriz Santos", phone: "(11) 99823-4567", notes: "Gosta de nail art delicada.", color: "sage" },
    { id: "c3", name: "Camila Costa", phone: "(11) 99734-5678", notes: "Manutenção a cada 20 dias.", color: "lilac" },
    { id: "c4", name: "Juliana Almeida", phone: "(11) 99645-6789", notes: "", color: "sand" },
    { id: "c5", name: "Ana Clara Lima", phone: "(11) 99556-7890", notes: "Prefere atendimento à tarde.", color: "clay" },
    { id: "c6", name: "Fernanda Rocha", phone: "(11) 99467-8901", notes: "", color: "rose" },
    { id: "c7", name: "Isabela Martins", phone: "(11) 99378-9012", notes: "", color: "sage" },
    { id: "c8", name: "Larissa Ribeiro", phone: "(11) 99289-0123", notes: "", color: "lilac" },
  ];
  const procedures: Procedure[] = [
    { id: "p1", name: "Alongamento em gel", description: "Estrutura, acabamento e esmaltação", price: 18000, duration: 150, active: true },
    { id: "p2", name: "Manutenção em gel", description: "Cuidado e renovação do alongamento", price: 12000, duration: 90, active: true },
    { id: "p3", name: "Esmaltação em gel", description: "Cor e brilho de longa duração", price: 8500, duration: 60, active: true },
    { id: "p4", name: "Banho de gel", description: "Proteção para as unhas naturais", price: 14000, duration: 120, active: true },
    { id: "p5", name: "Nail art", description: "Detalhes que fazem a diferença", price: 3000, duration: 30, active: true },
    { id: "p6", name: "Remoção", description: "Remoção cuidadosa do produto", price: 4500, duration: 45, active: true },
  ];
  const appointments: Appointment[] = [];
  const payments: Payment[] = [];
  const availability: Record<string, string[]> = {};
  for (let d = -7; d <= 14; d++) {
    const date = addDays(anchor, d);
    if (dateObject(date).getDay() !== 0 || d === 0) availability[date] = d > 6 ? ["11:00", "16:00"] : ["09:00", "13:00", "16:00"];
  }
  const rows: [number, string, number, number, number][] = [[0, "09:00", 0, 0, 18000], [0, "13:00", 1, 1, 4000], [0, "16:00", 2, 2, 0], [1, "09:00", 3, 3, 5000], [1, "16:00", 4, 1, 0], [2, "13:00", 5, 0, 6000], [3, "09:00", 6, 2, 2500], [4, "16:00", 7, 3, 0], [-1, "09:00", 3, 1, 12000], [-2, "13:00", 4, 0, 18000], [-3, "16:00", 5, 2, 8500], [-5, "09:00", 6, 3, 14000]];
  rows.forEach(([d, time, ci, pi, paid], i) => {
    const procedure = procedures[pi]; const date = addDays(anchor, d); const id = `a${i}`;
    appointments.push({ id, clientId: clients[ci].id, date, time, duration: procedure.duration, procedures: [{ id: procedure.id, name: procedure.name, price: procedure.price, duration: procedure.duration }], price: procedure.price, notes: i === 1 ? "Cliente pediu um nude rosado." : "", status: d < 0 || i === 0 ? "completed" : "scheduled", googleDeletionPending: i === 5 });
    if (paid) payments.push({ id: `pay${i}`, appointmentId: id, amount: paid, date: d < 0 ? date : anchor, method: i % 3 ? "Pix" : "Cartão de crédito", kind: paid === procedure.price ? "balance" : "deposit" });
  });
  availability[anchor] = ["09:00", "13:00", "16:00", "18:00"];
  return { version: 1, clients, procedures, appointments, payments, availability, expenses: [
    { id: "e1", description: "Géis e esmaltes", amount: 18500, date: addDays(anchor, -2), category: "Insumos", method: "Pix" },
    { id: "e2", description: "Lixas e materiais descartáveis", amount: 6800, date: addDays(anchor, -4), category: "Insumos", method: "Cartão de débito" },
    { id: "e3", description: "Curso de nail art", amount: 15000, date: addDays(anchor, -6), category: "Cursos", method: "Pix" },
  ], business: { name: "Ateliê Nail Studio", professional: "Sofia", phone: "(11) 99999-0000" } };
}
