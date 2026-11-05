import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Real type gate: the build must fail on type errors (audited fix P1-4).
  // `tsc --noEmit` is also run in CI/verification; see docs/RELEASE_CHECKLIST.md.
  reactStrictMode: false,
  // sharp is never used: the app renders no next/image components, so
  // Next's image optimizer (sharp's only consumer) never runs. Exclude it
  // and its @img/* native variants from standalone tracing — under pruned
  // production installs (bun --production / npm --omit=dev), bun extracts
  // the @img platform variants without README files and the standalone
  // copy step crashed with ENOENT on exactly those files.
  outputFileTracingExcludes: {
    "*": [
      "node_modules/sharp/**",
      "node_modules/@img/**",
      // Next bundles its own copy of @swc/helpers (handle-externals:
      // "should not be external as it would require hoisting"), and the
      // build even deletes the node_modules copy mid-build — yet the
      // Turbopack trace manifest still lists node_modules/@swc/helpers
      // paths, so the standalone copier crashed with ENOENT under
      // production-only installs. Excluded: the inlined copy suffices
      // (verified by booting the standalone server and serving 200s
      // with the package absent).
      "node_modules/@swc/helpers/**",
    ],
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
