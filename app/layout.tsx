import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veyrin — See before you sign",
  description: "A keyless, human-readable safety layer for Zcash PCZTs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
