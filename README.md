# A/B testing on Next.js without flicker

One small Next.js 16 App Router page, one headline test, three ways to run it. We built each one and measured them on the same machine in the same way, so you can see what each approach costs before you pick one.

| Branch | How the visitor gets a variant |
|---|---|
| [`client-side`](../../tree/client-side) | A testing script changes the headline in the browser. An anti-flicker snippet hides the page until it's done. |
| [`diy-proxy`](../../tree/diy-proxy) | A hand-written `proxy.ts` picks a variant from a cookie and rewrites to a prerendered page. No library. |
| [`evolve`](../../tree/evolve) | The same test with [`next-evolve`](https://www.npmjs.com/package/next-evolve), our SDK. |

`main` holds the shared page (`app/`, `components/`, `lib/experiment.ts`), the benchmark scripts in `bench/` and the raw results in `results/`.

The test is the same everywhere: 50/50 between "Send invoices in minutes" (control) and "Get paid faster with invoices that send themselves".

## Results

Measured on 2026-11-11. LCP, CLS and TBT are Lighthouse medians of 9 runs. The last two columns come from a separate check in a throttled browser: 10 new visitors per setup, roughly half of them assigned variant B.

| Setup | LCP | CLS | TBT | Headline first visible | Visitors who saw the headline change |
|---|---|---|---|---|---|
| No test (`main`, reference) | 757 ms | 0 | 34 ms | 1,177 ms | 0 of 10 |
| `client-side`, anti-flicker on (as shipped) | **1,883 ms** | 0 | 31 ms | **1,814 ms** | 0 of 10 |
| `client-side`, anti-flicker off | 756 ms | 0 | 31 ms | 1,183 ms | **5 of 10** (every B visitor) |
| `diy-proxy` | 756 ms | 0 | 15 ms | 1,177 ms | 0 of 10 |
| `evolve`, no account (serves control) | 756 ms | 0 | 31 ms | 1,183 ms | 0 of 10 |
| `evolve`, test running 50/50 | 756 ms | 0 | 33 ms | 1,182 ms | 0 of 10 |

Every setup scored 100 for performance in Lighthouse; on a page this small even the hidden one does. Here's what the table says:

**DIY is as fast as Evolve.** `diy-proxy` and `evolve` land on the same LCP and CLS as the page with no test at all, and nobody saw a flash in either. The TBT gap (15 ms against 31–33 ms) is inside the run-to-run spread: single runs ranged from 14 to 41 ms across setups, and from 15 to 31 ms within `diy-proxy` alone. If raw speed is all you need, the 29 lines in [`proxy.ts` on `diy-proxy`](../../blob/diy-proxy/proxy.ts) get you there. What Evolve adds is everything around the split, covered [below](#what-evolve-adds-to-the-diy-version).

**The anti-flicker snippet costs about a second of LCP in Lighthouse** (1,883 ms against 757 ms), and in the throttled browser check the page stayed blank about 630 ms longer than any server-side setup. Our stand-in script is 2.7 KB unminified, half of it comments, and comes from a local origin, so treat that as the floor. A real vendor script is far larger and often fetches its config separately; and if the script is slow enough, the snippet's 4-second timeout decides when the page shows.

**Turn the snippet off and you get the flicker instead.** All 5 visitors who drew variant B read the control headline for about 630 ms before it changed at 1.8 s, and the longer headline pushed the rest of the page down (CLS 0.029). Their LCP in the browser check moved from about 1.25 s to 2.6 s, because the new headline counts as a new largest paint.

**Lighthouse under-reports the client-side cost.** With the snippet off, the median Lighthouse LCP (756 ms) and CLS (0) look the same as a page with no test at all, even though the browser check caught the swap for every B visitor. Lighthouse's default "simulated" throttling loads the page unthrottled and models the slow network afterwards. On localhost the testing script usually finishes before the first paint of that unthrottled load, so for a control visitor, and for many B visitors, there's no swap in the trace to model. 4 of the 9 runs caught it (LCP about 1,890 ms, two of them with CLS 0.029), and the median hid all four. That's why we added the second check, which throttles for real and watches every frame.

### Filmstrips

A variant-B visitor, one frame every 250 ms from navigation start, Slow 4G and 4x CPU slowdown.

`client-side` (anti-flicker on): blank until the script reveals the page.
![client-side filmstrip](results/client-side/filmstrip.png)

`client-side` (anti-flicker off): the control headline, then the swap.
![client-side without anti-flicker filmstrip](results/client-side-no-hide/filmstrip.png)

`diy-proxy`:
![diy-proxy filmstrip](results/diy-proxy/filmstrip.png)

`evolve` (test running):
![evolve filmstrip](results/evolve/filmstrip.png)

## How we measured

- **Builds:** production only, `next build` then `next start` on `localhost:3000`. Each setup was built fresh and measured on its own, one after another, with nothing else under test running.
- **Lighthouse:** `lighthouse` 13.6.0 from the local `node_modules` through `npx`, mobile form factor, simulated throttling (Lighthouse's defaults: 150 ms RTT, 1.6 Mbps down, 4x CPU slowdown), performance category only, headless Chrome. 9 runs per setup; we report the median. Every run starts a fresh Chrome profile, so every run is a new visitor with no cookies and a new random assignment. The server gets 20 warm-up requests first. Script: [`bench/lighthouse.mjs`](bench/lighthouse.mjs).
- **Flicker check:** Playwright drives the installed Chrome with DevTools throttling at Lighthouse's devtools-mode numbers (562.5 ms latency, 1,474.56 kbps down, 675 kbps up, 4x CPU) and a 412×823 mobile viewport. A script injected before the page's own records, on every animation frame, whether the headline is visible (it counts as hidden under `opacity: 0`) and what it says. "Saw the headline change" means a visitor saw one headline and then a different one. "Headline first visible" is the median over 10 new visitors. Filmstrips come from Chrome trace screenshots. Script: [`bench/flicker.mjs`](bench/flicker.mjs).
- **Machine:** Apple M3 Pro (12 cores, 36 GB), macOS 27.2, Node 22.13.1, headless Chrome 157. Lighthouse's CPU benchmark index was about 2,900.
- **Versions:** Next.js 16.4.3, React 19.3.1, `next-evolve` 0.9.0, Playwright 1.64.1.
- **Raw data:** every summary and every run is in [`results/`](results/).

What this setup leaves out: everything runs on localhost, so there's no CDN and no distance to a server. On Vercel, any proxy at all adds roughly 20 ms to a first page view (we measured 18 to 23 ms with a proxy that does nothing), and that applies to `diy-proxy` and `evolve` alike. Server-side, our proxy's own work took 0.1 to 0.5 ms here (the `server-timing` header). The anti-flicker timeout never fired in these runs because the stand-in script always loaded in time; on a real phone with a real vendor script it sometimes will.

Run it yourself:

```sh
git checkout diy-proxy            # or client-side, evolve, main
npm ci
npm run build && npm start        # leave running
npm run bench:lighthouse -- --label diy-proxy --runs 9
npm run bench:flicker -- --label diy-proxy --runs 10
```

Results land in `bench/out/<label>/`.

## The three branches

### `client-side`

We didn't want to sign up for a vendor account to publish its snippet, so this branch uses a **stand-in we wrote**, not any vendor's code. It does what script-based tools do, in the same order:

1. `app/layout.tsx` puts an install snippet in `<head>`. It adds `opacity: 0` to `<html>` and loads the testing script. The page shows when the script calls `__abReveal()` or after 4,000 ms, whichever comes first. That's the pattern of Google Optimize's `async-hide` snippet, and 4,000 ms was its default.
2. `vendor/ab.js` assigns the visitor (stored in a first-party cookie), swaps the headline in the DOM, puts it back if React re-renders it, reveals the page and sends an exposure beacon.
3. `vendor/server.mjs` serves that script from a second origin (`localhost:3001`), the way a vendor CDN would, so the browser has to open a second connection. `npm start` runs both servers.

Build with `ANTI_FLICKER=off npm run build` to see the page without the hide.

### `diy-proxy`

`proxy.ts` reads the `ab_hero` cookie, picks a variant 50/50 if there isn't one, and rewrites `/` to `/a` or `/b`. Both are prerendered at build time (`app/[variant]/page.tsx`), so the response is static HTML with the right headline already in it. That's the whole test.

Two things to watch if you copy it. Next marks the rewritten page as cacheable (`s-maxage=31536000`), which is fine on Vercel, where the proxy runs before the cache, but if you put a CDN that caches HTML by URL in front of `next start`, everyone gets whichever variant it cached first. And `/a` and `/b` are reachable directly.

### `evolve`

We ran `npx next-evolve init --routes "/"` and wrapped the hero. The diff against `main`:

- `components/optimizable-hero.tsx`: a Zod schema saying the headline is the one prop a variant may change.
- `app/[evolve]/page.tsx`: the page, moved by `init` so each variant gets its own cached render ("static mode"). The props in the code are the control.
- `proxy.ts`: picks the variant from a signed config cached in memory, with no network call on the request, and rewrites to that variant's cached page.
- `app/layout.tsx`: `<EvolveScript />`, the beacon that records exposures and Core Web Vitals into your Postgres.
- `instrumentation.ts`, `evolve.config.ts`, `evolve.goals.ts`, `app/api/evolve/[...evolve]/route.ts`.

**Without an account it serves control.** Clone it, build it and run it, and every visitor sees "Send invoices in minutes", no cookies are set and nothing is recorded. That's the second-to-last row in the table. The test config is a signed bundle from Evolve Cloud, and with no bundle there's no test.

**To measure a running test without an account** we wrote [`bench/local-cloud.mjs`](../../blob/evolve/bench/local-cloud.mjs) on the `evolve` branch. It signs a bundle that runs the headline 50/50 with a throwaway key and serves it the way the cloud does; the app trusts that key only because of two `EVOLVE_UNSAFE_*` variables, which exist for testing and must never be set anywhere real. The last row of the table used it, with a local Postgres so exposures were written for real (we checked: 10 visits, 10 exposure rows).

**To connect it for real:**

1. [Start a free trial](https://app.evolveab.com/sign-in?trial=1&utm_source=github&utm_medium=directory&utm_campaign=flicker-example) (30 days, no card) and create a site. Copy the secret key and the webhook secret.
2. Get a Postgres database: `docker run -d --name evolve-pg -e POSTGRES_PASSWORD=postgres -p 54320:5432 postgres:17` works locally.
3. In this branch, run `init` again. It's safe to re-run; this time it writes `.env.local` and migrates the database:
   ```sh
   npx next-evolve init --key evk_live_… --webhook-secret whsec_… \
     --db postgres://postgres:postgres@localhost:54320/postgres --routes "/"
   ```
4. `npm run dev`, open the page once, and the `hero` region shows up in the dashboard. Create an experiment there, change the headline for variant B and start it.

The full walkthrough is in the [docs](https://evolveab.com/docs?utm_source=github&utm_medium=directory&utm_campaign=flicker-example).

## What Evolve adds to the DIY version

The numbers say speed isn't the reason to pick Evolve over a good hand-written proxy. These are the reasons:

- **Statistics.** Bayesian results per goal, Thompson-sampling bandits, and auto-rollback that pauses a variant whose LCP, CLS or INP gets clearly worse than control's.
- **Tests without deploys.** Start, pause and change weights from the dashboard; the app picks up the new signed config within a minute.
- **AI-written variants.** The cloud drafts challengers inside the schema you declared, checks them against locked props and forbidden claims, and waits for your approval (or runs on autopilot, capped at 20% of traffic).
- **Winners as pull requests.** "Promote winner" opens a PR that makes the winning props the new code.

Visitor-level data stays in your Postgres; the cloud only sees aggregate counts. More at [evolveab.com](https://evolveab.com/?utm_source=github&utm_medium=directory&utm_campaign=flicker-example), and the longer write-up on hiding pages is [The anti-flicker tax](https://evolveab.com/blog/the-anti-flicker-tax?utm_source=github&utm_medium=directory&utm_campaign=flicker-example).

Found a mistake in the method? Open an issue. We'd rather fix the numbers than defend them.

## License

MIT, see [LICENSE](LICENSE). The Evolve team.
