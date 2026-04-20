export default function DashboardLoading() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-pulse">
      <div className="h-7 w-56 rounded bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-muted/60" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 h-48" />
        ))}
      </div>
    </div>
  );
}
