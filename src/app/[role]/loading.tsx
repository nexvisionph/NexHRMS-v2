export default function RoleLoading() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-72 rounded bg-muted/60" />
      </div>
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="h-3 w-20 rounded bg-muted/60" />
            <div className="h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <div className="h-9 w-64 rounded bg-muted/50" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="h-4 w-4 rounded bg-muted/40" />
              <div className="h-4 flex-1 rounded bg-muted/40" />
              <div className="h-4 w-20 rounded bg-muted/40" />
              <div className="h-4 w-16 rounded bg-muted/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
