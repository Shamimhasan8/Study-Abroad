import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Real type gate: the build must fail on type errors (audited fix P1-4).
  // `tsc --noEmit` is also run in CI/verification; see docs/RELEASE_CHECKLIST.md.
  reactStrictMode: false,
  typescript: {
    // Build-only TS config: deploy hosts may prune devDependencies
    // (vitest et al.), so test-only files (tests/, vitest.config.ts)
    // must not be type-checked during `next build` — an undeclared
    // import there used to fail the whole build on pruned installs.
    // Local `tsc --noEmit` (tsconfig.json) still type-checks tests.
    tsconfigPath: "./tsconfig.build.json",
  },
  // sharp is never used: the app renders no next/image components, so
  // Next's image optimizer (sharp's only consumer) never runs. Exclude it
  // and its @img/* native variants from standalone tracing — under pruned
  // production installs (bun --production / npm --omit=dev), bun extracts
  // the @img platform variants without README files and the standalone
  // copy step crashed with ENOENT on exactly those files.
  outputFileTracingExcludes: {
    "*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
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
