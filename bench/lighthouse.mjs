// Runs Lighthouse (mobile, simulated throttling) N times against a running
// production server and prints the median LCP, CLS and TBT.
//
//   npm run build && npm start            # in one terminal
//   npm run bench:lighthouse -- --label diy-proxy --runs 9
//
// Each run launches a fresh headless Chrome with an empty profile, so every
// run is a new visitor with no cookies (a new random assignment).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/" },
    runs: { type: "string", default: "9" },
    label: { type: "string", default: "local" },
  },
});
const runs = Number(values.runs);
const outDir = join("bench", "out", values.label);
mkdirSync(outDir, { recursive: true });

// Warm the server so no run pays for a first render or a cold cache.
// Same UA as Lighthouse's mobile run, so bot filters treat it as a visitor.
const UA =
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36";
for (let i = 0; i < 20; i++) await fetch(values.url, { headers: { "user-agent": UA } }).then((r) => r.text());

const metrics = {
  lcp: "largest-contentful-paint",
  fcp: "first-contentful-paint",
  tbt: "total-blocking-time",
  cls: "cumulative-layout-shift",
  si: "speed-index",
  ttfb: "server-response-time",
};

const rows = [];
for (let i = 1; i <= runs; i++) {
  const file = join(outDir, `lighthouse-${i}.json`);
  const res = spawnSync(
    "npx",
    [
      "--no-install",
      "lighthouse",
      values.url,
      "--only-categories=performance",
      "--form-factor=mobile",
      "--throttling-method=simulate",
      "--output=json",
      `--output-path=${file}`,
      "--quiet",
      "--chrome-flags=--headless=new --no-first-run",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (res.status !== 0) throw new Error(`lighthouse run ${i} failed`);
  const lhr = JSON.parse(readFileSync(file, "utf8"));
  const row = { run: i, score: Math.round(lhr.categories.performance.score * 100) };
  for (const [k, id] of Object.entries(metrics)) row[k] = lhr.audits[id].numericValue;
  rows.push(row);
  console.log(
    `run ${i}: LCP ${row.lcp.toFixed(0)} ms, CLS ${row.cls.toFixed(3)}, TBT ${row.tbt.toFixed(0)} ms, score ${row.score}`,
  );
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const summary = { label: values.label, url: values.url, runs, median: {}, min: {}, max: {} };
for (const k of [...Object.keys(metrics), "score"]) {
  const xs = rows.map((r) => r[k]);
  summary.median[k] = median(xs);
  summary.min[k] = Math.min(...xs);
  summary.max[k] = Math.max(...xs);
}
const first = JSON.parse(readFileSync(join(outDir, "lighthouse-1.json"), "utf8"));
summary.lighthouseVersion = first.lighthouseVersion;
summary.userAgent = first.environment.hostUserAgent;
summary.benchmarkIndex = median(
  rows.map((r) => JSON.parse(readFileSync(join(outDir, `lighthouse-${r.run}.json`), "utf8")).environment.benchmarkIndex),
);
summary.rows = rows;
writeFileSync(join(outDir, "lighthouse-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

const m = summary.median;
console.log(
  `\n${values.label}: median of ${runs} → LCP ${m.lcp.toFixed(0)} ms (range ${summary.min.lcp.toFixed(0)}–${summary.max.lcp.toFixed(0)}), ` +
    `CLS ${m.cls.toFixed(3)}, TBT ${m.tbt.toFixed(0)} ms, FCP ${m.fcp.toFixed(0)} ms, score ${m.score}`,
);
