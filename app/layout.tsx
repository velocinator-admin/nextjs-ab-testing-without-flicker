import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Invoicing",
  description: "Example site for A/B testing on Next.js without flicker.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <a href="/" className="logo">
            Acme
          </a>
          <nav>
            <a href="#how">Product</a>
            <a href="/signup">Pricing</a>
            <a href="/signup">Sign in</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
