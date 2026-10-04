import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The dev badge would show up in the captures compared with Figma.
  devIndicators: false,
  // The design system ships TypeScript and CSS Modules sources.
  transpilePackages: ["@access/ui"],
};

export default config;
