import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "recharts",
      "date-fns",
      "nanoid",
      "zustand",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.sslip.io https://*.nexvision.info https://*.tile.openstreetmap.org https://*.openstreetmap.org https://images.unsplash.com https://i.pravatar.cc; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sslip.io wss://*.sslip.io http://*.sslip.io ws://*.sslip.io https://*.nexvision.info wss://*.nexvision.info https://dashscope.aliyuncs.com https://nominatim.openstreetmap.org; frame-ancestors 'none'" },
        ],
      },
      {
        // Cache face-api models aggressively - they are immutable ~12MB files
        source: "/models/face-api/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;