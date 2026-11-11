// A hand-written cookie split. No testing library, no vendor script.
//
// The proxy runs before the page is rendered. It reads the visitor's bucket
// from a cookie (or picks one, 50/50), and rewrites "/" to "/a" or "/b". Both
// variants are prerendered at build time, so the response is static HTML with
// the right headline already in it.
import { type NextRequest, NextResponse } from "next/server";
import { experiment, type VariantKey } from "@/lib/experiment";

const keys = Object.keys(experiment.variants) as VariantKey[];

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(experiment.cookie)?.value as VariantKey | undefined;
  const variant = existing && keys.includes(existing) ? existing : Math.random() < 0.5 ? "a" : "b";

  const url = request.nextUrl.clone();
  url.pathname = `/${variant}`;
  const response = NextResponse.rewrite(url);
  if (variant !== existing) {
    response.cookies.set(experiment.cookie, variant, {
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = { matcher: "/" };
