import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://autopost-app-1.onrender.com/:path*',
      },
    ];
  },
};

export default nextConfig;

