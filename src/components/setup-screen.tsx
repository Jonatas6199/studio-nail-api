import Link from "next/link";
import { Flower2, LockKeyhole } from "lucide-react";

export function SetupScreen({ message }: { message?: string }) {
  return <main className="setup-screen"><Flower2 size={45} strokeWidth={1} /><span className="eyebrow">ATELIÊ NAIL STUDIO</span><h1>{message ? "Vamos tentar de novo?" : "Seu ateliê está sendo preparado."}</h1><p>{message ?? "A conexão segura com o Supabase precisa ser concluída antes de acessar a agenda."}</p><div className="info-box"><LockKeyhole size={17} />Nenhum dado real está disponível sem autenticação.</div>{message && <Link className="button button-secondary" href="/">Tentar novamente</Link>}<Link className="text-link" href="/login">Ir para o login</Link>{process.env.NODE_ENV !== "production" && <Link className="text-link" href="/demo">Abrir demonstração com dados fictícios</Link>}</main>;
}
