import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@leettrack/core", "@leettrack/seed"],
};

export default nextConfig;
