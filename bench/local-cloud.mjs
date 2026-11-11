// A local stand-in for Evolve Cloud, for benchmarking only.
//
// Without an account, next-evolve serves control to everyone and sets no
// cookies. To measure the path a real visitor takes (assignment, cookie,
// rewrite to the variant's cached page), this script signs a bundle that runs
// the hero test 50/50 and serves it the way the cloud does (GET /v1/bundle).
// It signs with a throwaway Ed25519 test key; the app trusts that key only
// because of the EVOLVE_UNSAFE_* variables below. Never set those anywhere real.
//
//   node bench/local-cloud.mjs          # prints the env to start the app with
//   node bench/local-cloud.mjs --b 1    # 100% variant B (for the filmstrip)
import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { parseArgs } from "node:util";
import {
  BUNDLE_TTL_SECONDS,
  BUNDLE_TYP,
  computeBundleHash,
  PROTOCOL_VERSION,
  parseSecretKey,
} from "@next-evolve/protocol";
import { signJws } from "@next-evolve/protocol/testing";

const { values } = parseArgs({
  options: { port: { type: "string", default: "4010" }, b: { type: "string", default: "0.5" } },
});
const port = Number(values.port);
const SITE = "site_benchlocal";
const SECRET_KEY = `evk_live_${SITE}_${"B".repeat(32)}`;
const WEBHOOK_SECRET = `whsec_${"W".repeat(32)}`;

// One throwaway key per checkout, kept out of git (bench/out/).
mkdirSync("bench/out", { recursive: true });
const keyFile = "bench/out/local-cloud-key.json";
if (!existsSync(keyFile)) {
  const { privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(keyFile, JSON.stringify(privateKey.export({ format: "jwk" })));
}
const jwk = JSON.parse(readFileSync(keyFile, "utf8"));
const key = { kid: "bench-local", publicKey: jwk.x, privateKey: createPrivateKey({ key: jwk, format: "jwk" }) };

// The hero test: region "hero", control = the headline in the code.
const wB = Number(values.b);
const content = {
  routing: {
    routes: { "/": ["hero01"] },
    experiments: {
      hero01: {
        status: "running",
        traffic: 1,
        control: "ctrl01",
        variants: [
          { id: "ctrl01", w: 1 - wB },
          { id: "varb01", w: wB },
        ],
      },
    },
  },
  variants: {
    ctrl01: { exp: "hero01", region: "hero", ctrl: true, props: {} },
    varb01: {
      exp: "hero01",
      region: "hero",
      ctrl: false,
      props: { headline: "Get paid faster with invoices that send themselves" },
    },
  },
};
const iat = Math.floor(Date.now() / 1000);
const payload = {
  pv: PROTOCOL_VERSION,
  site: SITE,
  ver: iat,
  iat,
  exp: iat + BUNDLE_TTL_SECONDS,
  hash: computeBundleHash(content),
  ...content,
};
const token = signJws(payload, { kid: key.kid, typ: BUNDLE_TYP, privateKey: key.privateKey });
const etag = `"${payload.ver}.${payload.iat}"`;

createServer(async (req, res) => {
  for await (const _ of req); // drain the body
  const url = new URL(req.url, "http://x");
  const auth = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
  const site = auth ? parseSecretKey(auth[1])?.siteId : undefined;
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (!site) return json(401, { error: "invalid_key" });
  if (req.method === "GET" && url.pathname === "/v1/bundle") {
    if (req.headers["if-none-match"] === etag) return res.writeHead(304, { etag }).end();
    res.writeHead(200, { "content-type": "application/jose", etag, "cache-control": "no-store" });
    return res.end(token);
  }
  if (req.method === "GET" && url.pathname === "/v1/site") {
    return json(200, { site, name: "Local benchmark", appUrl: null });
  }
  // Manifest, region registration and the rest: accept and ignore.
  return json(200, { ok: true });
}).listen(port, "127.0.0.1", () => {
  console.log(`local test cloud on http://127.0.0.1:${port} (variant B weight ${wB})
Start the app with:
  EVOLVE_CLOUD_URL=http://127.0.0.1:${port}
  EVOLVE_SECRET_KEY=${SECRET_KEY}
  EVOLVE_WEBHOOK_SECRET=${WEBHOOK_SECRET}
  EVOLVE_UNSAFE_TEST_PUBLIC_KEY=${key.kid}:${key.publicKey}
  EVOLVE_UNSAFE_ALLOW_TEST_KEY=1`);
});
