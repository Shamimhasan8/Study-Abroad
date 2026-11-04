import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Real type gate: the build must fail on type errors (audited fix P1-4).
  // `tsc --noEmit` is also run in CI/verification; see docs/RELEASE_CHECKLIST.md.
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Private document downloads: never cached by shared caches.
        source: "/api/documents/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
