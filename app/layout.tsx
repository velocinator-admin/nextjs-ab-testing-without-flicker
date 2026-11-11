import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acme Invoicing",
  description: "Example site for A/B testing on Next.js without flicker.",
};

// Where the testing tool's script lives. A vendor CDN in real life; the
// stand-in server in vendor/ here.
const VENDOR_SCRIPT = process.env.AB_VENDOR_SCRIPT ?? "http://localhost:3001/ab.js";

// Build with ANTI_FLICKER=off to see the page without the hide (and the flash).
const ANTI_FLICKER = process.env.ANTI_FLICKER !== "off";
const TIMEOUT_MS = 4000;

// A generic install snippet, the pattern most client-side tools ship (Google
// Optimize's async-hide, VWO's SmartCode): hide the whole page, load the
// testing script, and show the page when the script calls __abReveal() or the
// timeout fires, whichever is first. With ANTI_FLICKER=off it only loads the
// script. The snippet injects the script itself so the hide always runs first.
const snippet = `(function (d, w, src, hide, timeout) {
  var html = d.documentElement;
  var done = false;
  w.__abReveal = function () {
    if (done) return;
    done = true;
    html.classList.remove("ab-hide");
  };
  if (hide) {
    html.classList.add("ab-hide");
    setTimeout(w.__abReveal, timeout);
  }
  var s = d.createElement("script");
  s.src = src;
  s.async = true;
  d.head.appendChild(s);
})(document, window, ${JSON.stringify(VENDOR_SCRIPT)}, ${ANTI_FLICKER}, ${TIMEOUT_MS});`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The snippet adds a class to <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{".ab-hide { opacity: 0 !important; }"}</style>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the vendor's install snippet */}
        <script dangerouslySetInnerHTML={{ __html: snippet }} />
      </head>
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
