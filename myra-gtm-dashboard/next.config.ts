import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // This helps with the nested workspace issue by strictly scoping to the current directory
    // However, Turbopack root config is technically a CLI flag or inferred.
    // We will try strictly typed routes or just rely on ignoring the parent.
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
