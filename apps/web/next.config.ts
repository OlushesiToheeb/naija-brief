import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared workspace package ships raw TypeScript.
  transpilePackages: ["@naija-brief/shared"],
};

export default nextConfig;
