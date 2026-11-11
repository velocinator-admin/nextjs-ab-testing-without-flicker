type HeroProps = {
  headline: string;
  subline?: string;
  cta?: string;
};

export function Hero({
  headline,
  subline = "Acme turns a timesheet into a sent invoice, chases late payers for you, and tells you when the money lands.",
  cta = "Start free",
}: HeroProps) {
  return (
    <section className="hero">
      <p className="eyebrow">Invoicing for small studios</p>
      <h1 data-testid="headline">{headline}</h1>
      <p className="subline">{subline}</p>
      <div className="actions">
        <a className="cta" href="/signup" data-testid="cta" data-evolve-goal="signup">
          {cta}
        </a>
        <a className="secondary" href="#how">
          See how it works
        </a>
      </div>
    </section>
  );
}
