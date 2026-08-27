import Link from "next/link";
import { getManagersList } from "@/lib/queries";
import { slugifyOwner } from "@/lib/avatars";
import { Avatar } from "@/components/Avatar";

export default async function ManagersPage() {
  const managers = await getManagersList();

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
        Managers
      </h1>

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {managers.map((m) => (
          <Link
            key={m.owner}
            href={`/managers/${slugifyOwner(m.owner)}`}
            className="rounded-lg border p-4 flex flex-col items-center gap-3 text-center transition-colors"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <Avatar owner={m.owner} size={72} />
            <div>
              <div className="font-semibold" style={{ color: "var(--foreground)" }}>
                {m.owner}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                {m.seasons} season{m.seasons === 1 ? "" : "s"} since {m.firstSeason}
              </div>
              {m.championships > 0 && <div className="text-xs mt-1">{"🏆".repeat(m.championships)}</div>}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
