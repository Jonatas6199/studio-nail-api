import { STATUS, paidFor, type Store } from "./model";

export async function exportWorkbook(store: Store, demo = false) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = demo ? "Ateliê · Demonstração" : "Ateliê Nail Studio";
  const sheets: { name: string; columns: string[]; rows: (string | number)[][] }[] = [
    { name: "Agendamentos", columns: ["Cliente", "Data", "Início", "Duração (min)", "Procedimentos", "Valor (R$)", "Recebido (R$)", "Pendente (R$)", "Status", "Observações"], rows: store.appointments.map(a => [store.clients.find(c => c.id === a.clientId)?.name ?? "", a.date, a.time, a.duration, a.procedures.map(p => p.name).join(" + "), a.price / 100, paidFor(store, a.id) / 100, (a.status === "cancelled" || a.status === "absent" ? 0 : Math.max(0, a.price - paidFor(store, a.id))) / 100, STATUS[a.status], a.notes]) },
    { name: "Clientes", columns: ["Nome", "Telefone", "Observações"], rows: store.clients.map(c => [c.name, c.phone, c.notes]) },
    { name: "Procedimentos", columns: ["Nome", "Descrição", "Valor (R$)", "Duração (min)", "Situação"], rows: store.procedures.map(p => [p.name, p.description, p.price / 100, p.duration, p.active ? "Ativo" : "Arquivado"]) },
    { name: "Recebimentos", columns: ["Cliente", "Data", "Valor (R$)", "Forma", "Tipo", "Agendamento"], rows: store.payments.map(p => { const a = store.appointments.find(a => a.id === p.appointmentId); return [store.clients.find(c => c.id === a?.clientId)?.name ?? "", p.date, p.amount / 100, p.method, p.kind === "deposit" ? "Sinal" : "Pagamento", p.appointmentId]; }) },
    { name: "Despesas", columns: ["Descrição", "Data", "Valor (R$)", "Categoria", "Forma"], rows: store.expenses.map(e => [e.description, e.date, e.amount / 100, e.category, e.method]) },
    { name: "Disponibilidade", columns: ["Data", "Horários de início"], rows: Object.entries(store.availability).sort(([a], [b]) => a.localeCompare(b)).map(([d, times]) => [d, times.join(", ")]) },
  ];
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.columns = sheet.columns.map(header => ({ header, width: Math.max(20, header.length + 3) }));
    sheet.rows.forEach(row => ws.addRow(row));
    ws.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFAF8F5" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF89705E" } }; });
    sheet.columns.forEach((header, index) => { if (header.includes("(R$)")) ws.getColumn(index + 1).numFmt = '"R$" #,##0.00'; });
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  }
  const bytes = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = demo ? "atelie-dados-demonstracao.xlsx" : "atelie-dados.xlsx"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
