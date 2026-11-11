import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: path.resolve(process.cwd()) },
  output: "standalone",
  serverExternalPackages: ["pg", "web-push"],
  async headers() { return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }, { key: "Service-Worker-Allowed", value: "/" }] }]; },
};
export default config;
