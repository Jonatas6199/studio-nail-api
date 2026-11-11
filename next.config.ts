import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: path.resolve(process.cwd()) },
  output: "standalone",
};
export default config;
