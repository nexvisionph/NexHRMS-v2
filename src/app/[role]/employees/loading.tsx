export default function EmployeesLoading() {
  return (
    <div className="flex-1 space-y-6 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted/60" />
        </div>
        <div className="h-9 w-32 rounded bg-muted" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 max-w-sm rounded bg-muted/50" />
        <div className="h-9 w-28 rounded bg-muted/50" />
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="h-9 w-9 rounded-full bg-muted/40" />
            <div className="h-4 w-32 rounded bg-muted/40" />
            <div className="h-4 w-24 rounded bg-muted/40" />
            <div className="h-4 w-20 rounded bg-muted/40" />
            <div className="h-4 w-16 rounded bg-muted/40 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
