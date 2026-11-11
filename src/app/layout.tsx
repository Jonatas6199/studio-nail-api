import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ateliê · Sua agenda, com leveza",
  description: "Sua agenda e o cuidado com seu ateliê, em um só lugar.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ateliê" },
  icons: { apple: "/icons/icon-180.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#faf8f5" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
