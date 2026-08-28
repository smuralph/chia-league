import type { TeamNameCloudEntry } from "@/lib/queries";

// Deterministic pseudo-randomness from the name itself (no client JS / no
// Math.random()) so server-rendered output is stable and there's no
// hydration mismatch - this stays a plain server component.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MIN_SIZE = 13;
const MAX_SIZE = 34;

export function TeamNameCloud({
  names,
  title,
  subtitle,
  sizeScale = 1,
  maxHeight,
}: {
  names: TeamNameCloudEntry[];
  title: string;
  subtitle: string;
  sizeScale?: number;
  maxHeight?: number;
}) {
  const maxUsed = Math.max(...names.map((n) => n.seasonsUsed), 1);
  const minUsed = Math.min(...names.map((n) => n.seasonsUsed), 1);
  const range = Math.max(maxUsed - minUsed, 1);

  return (
    <div
      className="relative rounded-lg border overflow-hidden"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        minHeight: 280,
        ...(maxHeight ? { maxHeight } : {}),
      }}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 p-10">
        {names.map((entry) => {
          const h = hashString(entry.name);
          const sizeT = (entry.seasonsUsed - minUsed) / range;
          const fontSize = (MIN_SIZE + sizeT * (MAX_SIZE - MIN_SIZE)) * sizeScale;
          const rotation = (h % 13) - 6; // -6deg .. +6deg
          const opacity = 0.35 + sizeT * 0.5;
          return (
            <span
              key={entry.name}
              style={{
                fontSize,
                transform: `rotate(${rotation}deg)`,
                color: "var(--text-secondary)",
                opacity,
                fontWeight: sizeT > 0.6 ? 700 : 500,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {entry.name}
            </span>
          );
        })}
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-xl border px-8 py-6 text-center pointer-events-auto"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
        >
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
            {title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
