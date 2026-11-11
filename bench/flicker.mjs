// Visual check for flicker. Loads the page N times as a new visitor in real
// Chrome with DevTools throttling (the network and CPU numbers Lighthouse uses
// for its "devtools" mode), and records every frame in which the headline's
// visibility or text changed. Writes a filmstrip of one variant-B visit.
//
//   npm run bench:flicker -- --label client-side --runs 10
//
// "Flicker" here means the visitor saw one headline and then a different one.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000/" },
    runs: { type: "string", default: "10" },
    label: { type: "string", default: "local" },
    variantText: { type: "string", default: "Get paid faster" },
    watchMs: { type: "string", default: "6000" },
  },
});
const outDir = join("bench", "out", values.label);
mkdirSync(outDir, { recursive: true });
const watchMs = Number(values.watchMs);

// Lighthouse's devtools-throttling preset for mobile (Slow 4G, 4x CPU).
const NETWORK = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1474.56 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
};
const CPU_RATE = 4;

// Runs in the page before any of its own scripts.
const probe = `(() => {
  const log = (window.__probe = { frames: [], lcp: 0, cls: 0 });
  let last = "";
  const tick = () => {
    const h = document.querySelector('[data-testid="headline"]');
    const visible = !!h && h.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const text = h ? h.textContent : "";
    const key = visible + "|" + text;
    if (key !== last) {
      last = key;
      log.frames.push({ t: Math.round(performance.now()), visible, text });
    }
    if (performance.now() < ${watchMs}) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) log.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) log.cls += e.value;
  }).observe({ type: "layout-shift", buffered: true });
})();`;

// Warm the server.
// Same UA as Lighthouse's mobile run, so bot filters treat it as a visitor.
const UA =
  "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36";
for (let i = 0; i < 20; i++) await fetch(values.url, { headers: { "user-agent": UA } }).then((r) => r.text());

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
let filmstripDone = false;

for (let i = 1; i <= Number(values.runs); i++) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    // Headless Chrome's own UA says "HeadlessChrome", which bot filters skip.
    userAgent: UA,
  });
  await context.addInitScript(probe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", NETWORK);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });

  const shots = [];
  cdp.on("Page.screencastFrame", async (f) => {
    shots.push({ wall: f.metadata.timestamp * 1000, data: f.data });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: 412, maxHeight: 823 });

  await page.goto(values.url, { waitUntil: "load" });
  await page.waitForTimeout(Math.max(0, watchMs - 0));
  const probeData = await page.evaluate(() => window.__probe);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await cdp.send("Page.stopScreencast");

  const visible = probeData.frames.filter((f) => f.visible);
  const firstVisible = visible[0];
  const texts = [...new Set(visible.map((f) => f.text))];
  const finalText = probeData.frames.at(-1)?.text ?? "";
  const run = {
    run: i,
    variant: finalText.startsWith(values.variantText) ? "b" : "a",
    headlineVisibleAt: firstVisible?.t ?? null,
    sawTwoHeadlines: texts.length > 1,
    swapAt: texts.length > 1 ? visible.find((f) => f.text !== firstVisible.text).t : null,
    lcp: Math.round(probeData.lcp),
    cls: Number(probeData.cls.toFixed(4)),
    frames: probeData.frames,
  };
  results.push(run);
  console.log(
    `run ${i}: variant ${run.variant}, headline visible at ${run.headlineVisibleAt} ms, ` +
      `two headlines seen: ${run.sawTwoHeadlines}${run.swapAt ? ` (swap at ${run.swapAt} ms)` : ""}, ` +
      `LCP ${run.lcp} ms, CLS ${run.cls}`,
  );

  if (!filmstripDone && run.variant === "b" && shots.length) {
    filmstripDone = true;
    await writeFilmstrip(browser, shots, timeOrigin, run);
  }
  await context.close();
}
await browser.close();

const b = results.filter((r) => r.variant === "b");
const median = (xs) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
};
const summary = {
  label: values.label,
  runs: results.length,
  variantBRuns: b.length,
  runsWithFlicker: results.filter((r) => r.sawTwoHeadlines).length,
  medianHeadlineVisibleAt: median(results.map((r) => r.headlineVisibleAt)),
  medianLcp: median(results.map((r) => r.lcp)),
  maxCls: Math.max(...results.map((r) => r.cls)),
  throttling: { network: NETWORK, cpuRate: CPU_RATE },
  results,
};
writeFileSync(join(outDir, "flicker-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(
  `\n${values.label}: ${summary.runsWithFlicker}/${summary.runs} runs showed two headlines; ` +
    `headline visible at ${summary.medianHeadlineVisibleAt} ms (median), LCP ${summary.medianLcp} ms, max CLS ${summary.maxCls}`,
);

// One frame every 250 ms from navigation start, as a single PNG.
async function writeFilmstrip(browser, shots, timeOrigin, run) {
  const step = 250;
  const end = Math.min(watchMs, 3000);
  const cells = [];
  for (let t = 0; t <= end; t += step) {
    const frame = shots.filter((s) => s.wall - timeOrigin <= t).at(-1);
    cells.push({ t, src: frame ? `data:image/jpeg;base64,${frame.data}` : null });
  }
  const html = `<html><body style="margin:0;background:#fff;font:600 14px system-ui">
    <div style="padding:10px 12px">${values.label}: variant B visitor, Slow 4G + 4x CPU (DevTools throttling)</div>
    <div style="display:grid;grid-template-columns:repeat(${cells.length},132px);gap:6px;padding:0 12px 12px">
    ${cells
      .map(
        (c) => `<div><div style="border:1px solid #ccc;height:264px;overflow:hidden;background:#fff">
          ${c.src ? `<img src="${c.src}" style="width:132px">` : ""}</div>
          <div style="font-weight:400;color:#555;padding-top:4px">${(c.t / 1000).toFixed(2)} s</div></div>`,
      )
      .join("")}
    </div></body></html>`;
  const ctx = await browser.newContext({ viewport: { width: cells.length * 138 + 24, height: 340 } });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: "load" });
  await p.screenshot({ path: join(outDir, "filmstrip.png"), fullPage: true });
  await ctx.close();
  writeFileSync(join(outDir, "filmstrip-run.json"), `${JSON.stringify({ run: run.run, frames: run.frames }, null, 2)}\n`);
}
