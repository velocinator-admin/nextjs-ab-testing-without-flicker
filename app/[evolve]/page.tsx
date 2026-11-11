import { Optimizable, evolveMetadata, evolveStaticParams, withEvolve } from "next-evolve";
import OptimizableHero from "@/components/optimizable-hero";
import { experiment } from "@/lib/experiment";

function Home() {
  return (
    <>
      {/* The props here are the control. Variants come from the signed bundle. */}
      <Optimizable id="hero" component={OptimizableHero} props={{ headline: experiment.variants.a.headline }} />
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

// Static mode (next-evolve): one cached render per variant under [evolve].
export const dynamicParams = true;
export const generateStaticParams = evolveStaticParams;
export const revalidate = 3600;
export const generateMetadata = evolveMetadata("/");
export default withEvolve(Home, { path: "/" });
