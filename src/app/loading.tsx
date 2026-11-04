/** Route-level loading state — warm skeletons, no fake content. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-4">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-secondary" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded-lg bg-secondary/70" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-border/70 bg-card" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading Uraan…</span>
    </div>
  );
}
