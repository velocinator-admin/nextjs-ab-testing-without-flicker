// Serves the stand-in testing script from its own origin (port 3001), the way a
// vendor CDN would: the browser has to open a second connection to get it.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.VENDOR_PORT ?? 3001);
const script = readFileSync(new URL("./ab.js", import.meta.url));

createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  if (pathname === "/ab.js") {
    res.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    });
    return res.end(script);
  }
  if (pathname === "/collect") {
    res.writeHead(204, { "access-control-allow-origin": "*" });
    return res.end();
  }
  res.writeHead(404).end();
}).listen(port, () => console.log(`stand-in vendor script on http://localhost:${port}/ab.js`));
