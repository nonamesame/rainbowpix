import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["sharp", "@cloudbase/node-sdk"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.tcloudbaseapp.com",
      },
    ],
  },
};

export default nextConfig;
