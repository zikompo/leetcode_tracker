/** Page title with optional context on the right. */
export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}
