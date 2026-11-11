// The one test every branch runs: the hero headline, 50/50.
// Branches differ only in *where* the visitor is assigned and the variant applied.

export const experiment = {
  id: "hero-headline",
  cookie: "ab_hero",
  variants: {
    a: { headline: "Send invoices in minutes" },
    b: { headline: "Get paid faster with invoices that send themselves" },
  },
} as const;

export type VariantKey = keyof typeof experiment.variants;

export const control: VariantKey = "a";
