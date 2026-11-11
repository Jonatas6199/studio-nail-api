"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDemo, STORAGE_KEY, todayISO, type Store } from "./model";
import type { Command, Workspace } from "./commands";

export function useWorkspace(initial: Workspace | undefined, demo: boolean, paused: boolean, onConflict: () => void) {
  const [store, setStore] = useState<Store | null>(initial?.data ?? null);
  const revision = useRef(initial?.revision ?? 0);
  const [saving, setSaving] = useState(false); const busy = useRef(false);
  const [error, setError] = useState(""); const [storageError, setStorageError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const retry = useRef<{ key: string; id: string } | null>(null);
  const pausedRef = useRef(paused); const conflictRef = useRef(onConflict);
  useEffect(() => { pausedRef.current = paused; conflictRef.current = onConflict; }, [paused, onConflict]);
  useEffect(() => {
    if (!demo) return;
    let seed = createDemo(todayISO());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const saved = JSON.parse(raw) as Store; if (saved.version === 1 && [saved.clients, saved.procedures, saved.appointments, saved.payments, saved.expenses].every(Array.isArray) && saved.availability && saved.business?.professional) seed = saved; }
    } catch { setStorageError(true); }
    setStore(seed);
  }, [demo]);
  useEffect(() => { if (demo && store) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { setStorageError(true); } } }, [demo, store]);

  const refresh = useCallback(async (force = false) => {
    if (demo || busy.current || pausedRef.current && !force) return;
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) { setStore(null); window.location.assign("/login"); return; }
      if (!res.ok) throw new Error("Não foi possível atualizar a agenda. Seus dados continuam preservados.");
      const next = await res.json() as Workspace;
      if (!pausedRef.current || force) { revision.current = next.revision; setStore(next.data); setError(""); setUncertain(false); }
    } catch { setError("Não foi possível atualizar a agenda. Confira sua conexão e tente novamente."); }
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
    const timer = setInterval(onFocus, 60_000);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [demo, refresh]);

  async function mutate(command: Command): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true; setSaving(true); setError("");
    const key = JSON.stringify(command);
    const attempt = retry.current?.key === key ? retry.current : { key, id: crypto.randomUUID() };
    retry.current = attempt;
    try {
      const res = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: attempt.id, revision: revision.current, command }), cache: "no-store" });
      const result = await res.json();
      if (res.status === 401 || res.status === 403) { setStore(null); window.location.assign("/login"); return false; }
      if (!res.ok) {
        retry.current = null;
        if (res.status === 409) {
          conflictRef.current();
          const latest = await fetch("/api/workspace", { cache: "no-store" });
          if (latest.ok) { const next = await latest.json() as Workspace; revision.current = next.revision; setStore(next.data); }
        }
        setError(result.message ?? "Não foi possível salvar. Tente novamente.");
        return false;
      }
      const next = result as Workspace;
      revision.current = next.revision; setStore(next.data); retry.current = null; setUncertain(false);
      return true;
    } catch {
      setError("A conexão foi interrompida e não foi possível confirmar o salvamento. Tente salvar novamente; a mesma operação não será duplicada.");
      setUncertain(true);
      return false;
    } finally { busy.current = false; setSaving(false); }
  }

  return { store, setStore, mutate, saving, error, storageError, uncertain, refresh };
}
