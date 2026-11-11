import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ateliê · Sua agenda, com leveza",
  description: "Agenda e gestão para nail designers. Protótipo navegável com dados de demonstração.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
