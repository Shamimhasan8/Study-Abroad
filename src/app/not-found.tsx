import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#FFF8EE",
        color: "#163D36",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Page not found</h1>
      <p style={{ fontSize: 14, color: "#5C6F62", margin: 0 }}>
        Uraan lives at the home page — everything else is an API route.
      </p>
      <Link
        href="/"
        style={{
          color: "#317A62",
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: 4,
        }}
      >
        Go to Uraan
      </Link>
    </div>
  );
}
