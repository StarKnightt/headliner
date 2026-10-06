import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
  /* config options here */
};

export default nextConfig;
