// `npm start`: the Next.js production server plus the stand-in vendor origin.
import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["vendor/server.mjs"], { stdio: "inherit" }),
  spawn("npx", ["--no-install", "next", "start", ...process.argv.slice(2)], { stdio: "inherit" }),
];
const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", (code) => { stop(); process.exitCode = code ?? 0; }));
