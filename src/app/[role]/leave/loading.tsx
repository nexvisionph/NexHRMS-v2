export default function LeaveLoading() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 rounded bg-muted" />
        <div className="h-9 w-32 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-muted/60" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-4 w-28 rounded bg-muted/40" />
            <div className="h-4 w-20 rounded bg-muted/40" />
            <div className="h-4 w-16 rounded bg-muted/40" />
            <div className="h-4 w-20 rounded bg-muted/40 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
