import { notFound } from "next/navigation";
import { Hero } from "@/components/hero";
import { experiment, type VariantKey } from "@/lib/experiment";

// One static page per variant, built ahead of time. proxy.ts rewrites "/" here.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(experiment.variants).map((variant) => ({ variant }));
}

export default async function Home({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const v = experiment.variants[variant as VariantKey];
  if (!v) notFound();
  return (
    <>
      <Hero headline={v.headline} />
      <Features />
    </>
  );
}

function Features() {
  return (
    <section id="how" className="features">
      <div>
        <h2>Timesheet in, invoice out</h2>
        <p>Import hours from the tools you already use. Acme groups them by client and drafts the invoice.</p>
      </div>
      <div>
        <h2>Reminders that sound like you</h2>
        <p>Polite nudges at 3, 7 and 14 days. Stop them with one click when the client replies.</p>
      </div>
      <div>
        <h2>Know when you get paid</h2>
        <p>A daily note with what came in, what is late and what is due this week.</p>
      </div>
    </section>
  );
}
