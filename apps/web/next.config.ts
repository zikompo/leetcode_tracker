import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@leettrack/core", "@leettrack/seed", "@leettrack/insights", "@leettrack/ui"],
};

export default nextConfig;
