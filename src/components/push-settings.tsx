"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Send, Smartphone } from "lucide-react";
import { Button } from "./ui";

async function request(action: string, fields: Record<string, unknown>) {
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...fields }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Não foi possível configurar as notificações.");
  return data;
}
function keyBytes(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export function PushSettings({ demo = false }: { demo?: boolean }) {
  const [mode, setMode] = useState<"loading" | "install" | "unsupported" | "ready" | "unavailable">("loading");
  const [enabled, setEnabled] = useState(false); const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [publicKey, setPublicKey] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    if (demo) { setMode("unavailable"); return; }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (ios && !installed) { setMode("install"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setMode("unsupported"); return; }
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/push", { cache: "no-store" }); const config = await res.json();
        if (!res.ok || !config.available) { if (active) setMode("unavailable"); return; }
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        const status = sub ? await request("status", { endpoint: sub.endpoint }) : { enabled: false };
        if (active) { setRegistration(reg); setPublicKey(config.publicKey); setEnabled(status.enabled && Notification.permission === "granted"); setMode("ready"); }
      } catch { if (active) { setError("Não foi possível conferir os avisos. Abra novamente esta tela para tentar de novo."); setMode("unavailable"); } }
    })();
    return () => { active = false; };
  }, [demo]);
  async function enable() {
    if (!registration || !publicKey) return;
    const permission = Notification.requestPermission();
    setBusy(true); setError(""); setMessage("");
    try {
      if (await permission !== "granted") throw new Error("As notificações não foram permitidas. Você pode liberar o acesso nos ajustes do aparelho; os lembretes continuam na agenda.");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      await request("save", { subscription: subscription.toJSON() }); setEnabled(true);
      setMessage("Avisos ativados neste aparelho. Use o teste abaixo para conferir.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ativar os avisos."); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setError(""); setMessage("");
    try { const sub = await registration?.pushManager.getSubscription(); if (sub) { await request("remove", { endpoint: sub.endpoint }); await sub.unsubscribe(); } setEnabled(false); setMessage("Avisos desativados neste aparelho."); }
    catch { setError("Não foi possível desativar agora. Confira sua conexão e tente novamente."); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setError(""); setMessage("");
    try { const sub = await registration?.pushManager.getSubscription(); if (!sub) throw new Error("Ative os avisos primeiro."); await request("test", { endpoint: sub.endpoint }); setMessage("Teste enviado para este aparelho. Confira a central de notificações."); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar o teste."); }
    finally { setBusy(false); }
  }
  return <section className="panel settings-card"><div className="settings-card-heading"><Bell size={22} strokeWidth={1.4} /><h2>Seus lembretes</h2>{enabled && <span className="subtle-badge"><Check size={12} />Ativados</span>}</div><p>Às 09h, dois dias antes de cada atendimento, avisamos você para preparar o lembrete. Horário de Brasília.</p><p className="form-hint">O aviso é para você. As mensagens às clientes são sempre enviadas manualmente.</p>
    {mode === "install" && <div className="install-guide"><Smartphone size={22} /><strong>Receba também com o aplicativo fechado</strong><ol><li>Abra este endereço no Safari do iPhone.</li><li>Toque em Compartilhar e em Adicionar à Tela de Início.</li><li>Abra o Ateliê pelo ícone, entre na conta e volte a esta tela.</li><li>Toque em Ativar notificações e depois em Permitir.</li></ol><small>Disponível no iOS 16.4 ou mais recente. Foco e ajustes do iPhone podem silenciar os avisos.</small></div>}
    {mode === "loading" && <p className="muted small">Conferindo este aparelho…</p>}
    {mode === "unsupported" && <p className="info-box">Este navegador não oferece notificações. Os lembretes continuam na tela principal.</p>}
    {mode === "unavailable" && <p className="info-box">{demo ? "Na demonstração, os avisos aparecem na agenda. As notificações do celular são ativadas na sua conta real." : "As notificações ainda não estão disponíveis neste momento. Os lembretes continuam na agenda."}</p>}
    {mode === "ready" && (enabled ? <div className="message-actions"><Button variant="secondary" icon={Send} onClick={() => void test()} disabled={busy}>Testar notificação</Button><Button variant="ghost" icon={BellOff} onClick={() => void disable()} disabled={busy}>Desativar neste aparelho</Button></div> : <Button icon={Bell} onClick={() => void enable()} disabled={busy}>Ativar notificações</Button>)}
    {message && <p className="form-success" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
  </section>;
}
