import type { NextConfig } from "next";

// Local dev/build: normal app at root, unchanged. When NEXT_PUBLIC_BASE_PATH is
// set (the GitHub Pages CI build), emit a static export served under that path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = basePath
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
