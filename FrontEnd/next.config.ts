import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load root .env for local dev — on Vercel, env vars are injected directly
loadEnv({ path: resolve(process.cwd(), "../.env") });

function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api")) return trimmed.slice(0, -4);
  return trimmed;
}

const backendUrl = normalizeApiOrigin(
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000"
);
const IS_PROD    = process.env.NODE_ENV === "production";
const TURBOPACK_ROOT = resolve(__dirname, "..");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "initia.xyz" },
    ],
    // Serve modern formats (avif > webp > original) where supported
    formats: ["image/avif", "image/webp"],
  },

  turbopack: {
    root: TURBOPACK_ROOT,
  },

  // Production optimizations
  poweredByHeader: false, // hide X-Powered-By for security
  compress: true,          // enable gzip compression

  // Tree-shake large packages — only imports actually used are bundled
  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "recharts",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tooltip",
    ],
  },

  // Proxy all /api/* calls to the Express backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // Security headers. Note: `immutable` Cache-Control on /_next/static breaks
  // Turbopack HMR in dev (browser caches stale chunks → "module factory not
  // available" runtime error), so long-cache rules are production-only.
  async headers() {
    const securityHeaders = [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection
          { key: "X-Frame-Options", value: "DENY" },
          // MIME-type sniffing protection
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer leakage protection
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Legacy XSS filter
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Disable unnecessary browser features
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          // DNS prefetch control
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // HSTS — force HTTPS for 1 year in production, disabled in dev to avoid breaking localhost
          ...(IS_PROD
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];

    if (!IS_PROD) return securityHeaders;

    return [
      ...securityHeaders,
      {
        // Cache static assets aggressively (fingerprinted by build hash)
        source: "/(.*)\\.(ico|png|jpg|jpeg|svg|woff2|woff|ttf|eot)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Next.js _next/static chunks: already content-hashed, safe to cache forever
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
