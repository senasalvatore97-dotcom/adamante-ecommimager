import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adamante — Photo Studio",
  description: "Studio fotografico AI per l'e-commerce Adamante.",
  icons: { icon: "/mark.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="it"><body>{children}</body></html>;
}
