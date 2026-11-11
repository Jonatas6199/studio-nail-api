"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flower2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { signIn, requestRecovery, updatePassword } from "@/app/auth/actions";
import { Button } from "./ui";

export function AuthScreen({ reset = false, passwordUpdated = false, invalidLink = false }: { reset?: boolean; passwordUpdated?: boolean; invalidLink?: boolean }) {
  const [recover, setRecover] = useState(false);
  const [loginState, loginAction, loginPending] = useActionState(signIn, { message: "" });
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(requestRecovery, { message: "" });
  const [resetState, resetAction, resetPending] = useActionState(updatePassword, { message: "" });
  const state = reset ? resetState : recover ? recoveryState : loginState;
  const pending = reset ? resetPending : recover ? recoveryPending : loginPending;
  return <main className="login-page"><div className="login-story"><div className="login-brand"><Flower2 size={34} strokeWidth={1} /><span>ateliê<span className="brand-period">.</span></span></div><div className="login-story-content"><p className="eyebrow">FEITO PARA O SEU DIA A DIA</p><h1>Seu talento merece<br />um pouco mais<br />de leveza.</h1><p>Uma agenda organizada.<br />Um negócio cuidado.<br />Mais espaço para você.</p><div className="login-flower"><Flower2 size={230} strokeWidth={0.4} /><Sparkles size={38} strokeWidth={0.8} /></div></div><span className="login-story-footer">Um espaço para fazer seu ateliê florescer.</span></div><div className="login-form-side"><div className="login-mobile-brand"><Flower2 size={29} strokeWidth={1} /><span>ateliê.</span></div><form className="login-form" action={reset ? resetAction : recover ? recoveryAction : loginAction} aria-busy={pending}><span className="subtle-badge"><LockKeyhole size={11} />SEU ESPAÇO DE CUIDADO</span><h2>{reset ? "Um novo começo." : recover ? "Vamos recuperar seu acesso." : "Bom ter você aqui."}</h2><p>{reset ? "Escolha uma nova senha para o seu ateliê." : recover ? "Informe o e-mail da sua conta." : "Entre para cuidar da sua agenda."}</p>
    {passwordUpdated && !recover && <p className="auth-success" role="status">Senha atualizada. Entre com sua nova senha.</p>}
    {invalidLink && !recover && <p className="form-error" role="alert">O link é inválido ou expirou. Solicite um novo em “Esqueci minha senha”.</p>}
    {!reset && <label>E-mail<div className="input-with-icon"><Mail size={17} /><input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="seuemail@exemplo.com" disabled={pending} /></div></label>}
    {(!recover || reset) && <label>{reset ? "Nova senha" : "Senha"}<div className="input-with-icon"><LockKeyhole size={17} /><input name="password" type="password" autoComplete={reset ? "new-password" : "current-password"} required minLength={reset ? 12 : 1} maxLength={reset ? 128 : 256} placeholder={reset ? "Pelo menos 12 caracteres" : "Sua senha"} disabled={pending} /></div></label>}
    {reset && <label>Confirme a nova senha<div className="input-with-icon"><LockKeyhole size={17} /><input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Repita a nova senha" disabled={pending} /></div></label>}
    {!recover && !reset && <button type="button" className="recover-button" onClick={() => setRecover(true)}>Esqueci minha senha</button>}
    {state.message && <div className={state.success ? "auth-success" : "form-error"} role={state.success ? "status" : "alert"}>{state.message}</div>}
    <Button type="submit" icon={ArrowRight} disabled={pending}>{pending ? "Aguarde…" : reset ? "Salvar nova senha" : recover ? "Enviar link de recuperação" : "Entrar"}</Button>
    {recover && <button type="button" className="auth-back" onClick={() => setRecover(false)}>Voltar para entrar</button>}
    {reset && <Link className="auth-back" href="/login">Voltar para entrar</Link>}
    {!reset && !recover && <p className="login-demo-note">Acesso exclusivo à sua conta. Seus dados ficam protegidos no Supabase.</p>}
    </form><div className="login-form-footer"><LockKeyhole size={13} />Seu espaço. No seu ritmo.</div></div></main>;
}
