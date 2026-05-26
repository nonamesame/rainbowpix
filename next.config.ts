import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
