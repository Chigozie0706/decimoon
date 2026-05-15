import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/.well-known/farcaster.json",
        destination:
          "https://api.farcaster.xyz/miniapps/hosted-manifest/019e2933-efa6-7e88-c4d1-eb17f4417093",
        permanent: false, // Generates 307 temporary redirect
      },
    ];
  },
};

export default nextConfig;