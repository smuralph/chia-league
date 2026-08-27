import { getRivalries } from "@/lib/queries";
import { RivalryCard } from "@/components/RivalryCard";

export default async function RivalriesPage() {
  const rivalries = await getRivalries();

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          Rivalries
        </h1>
        <p className="text-sm mt-2 max-w-2xl" style={{ color: "var(--text-secondary)" }}>
          Each manager's rivalry opponent is whoever they've faced the most across league history. Ties are broken
          first by closest all-time head-to-head record, then by closest average scoring margin. Rivalries aren't
          always mutual - one manager's most-played opponent isn't guaranteed to have them as their own top rival.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {rivalries.map((r) => (
          <RivalryCard key={r.owner} rivalry={r} />
        ))}
      </section>
    </main>
  );
}
