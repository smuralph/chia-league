export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
