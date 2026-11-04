"use client";

/**
 * Global error boundary — honest, calm, retryable. Data stays safe;
 * the guest store is untouched by a render error.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaperPlaneMark } from "@/components/uraan/illustrations";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sanitized reporting hook — no personal content in logs.
    console.error("[uraan] render error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            background: "#FFF8EE",
            color: "#163D36",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <PaperPlaneMark width={40} height={40} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#5C6F62", maxWidth: 420, margin: 0, lineHeight: 1.6 }}>
            Your saved answers and plan are safe in this browser and on your
            account. Try again — if it keeps happening, please report it via
            the repository issues.
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
