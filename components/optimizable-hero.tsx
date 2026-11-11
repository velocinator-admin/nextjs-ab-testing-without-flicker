import { optimizable } from "next-evolve";
import { z } from "zod";
import { Hero } from "./hero";

// The props Evolve may change in a variant. Everything else stays as coded.
const heroSchema = z.object({
  headline: z.string().min(3).max(70).meta({ label: "Headline" }),
});

function HeroRegion(props: z.infer<typeof heroSchema>) {
  return <Hero headline={props.headline} />;
}

export default optimizable(HeroRegion, heroSchema);
