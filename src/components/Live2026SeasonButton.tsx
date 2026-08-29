import Link from "next/link";

type Live2026SeasonButtonProps = {
  className?: string;
};

export function Live2026SeasonButton({ className = "" }: Live2026SeasonButtonProps) {
  const active = false;
  const label = "Live 2026 Season";
  const tooltipText = "This will be active after week one.";

  const baseClassName = [
    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    "border-zinc-500 bg-zinc-200 text-zinc-700 shadow-sm",
    className,
  ].join(" ");

  if (!active) {
    return (
      <div className="group relative inline-block" title={tooltipText}>
        <button
          type="button"
          className={[baseClassName, "cursor-not-allowed opacity-60"].join(" ")}
          aria-label={tooltipText}
        >
          {label}
        </button>
        <span
          className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
          style={{ transform: "translateX(-50%)" }}
        >
          {tooltipText}
        </span>
      </div>
    );
  }

  return (
    <Link href="/seasons/2026" className={[baseClassName, "hover:bg-zinc-300"].join(" ")}>
      {label}
    </Link>
  );
}
