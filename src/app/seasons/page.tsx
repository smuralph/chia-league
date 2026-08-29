import { getSeasonsList, getRankTrends } from "@/lib/queries";
import { SeasonJumpSelect } from "@/components/SeasonJumpSelect";
import { BumpChart } from "@/components/BumpChart";
import { Live2026SeasonButton } from "@/components/Live2026SeasonButton";

export default async function SeasonsIndex() {
  const [seasons, rankTrends] = await Promise.all([getSeasonsList(), getRankTrends()]);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Seasons
        </h1>
        <div className="flex items-center gap-3 ml-auto">
          <Live2026SeasonButton className="shrink-0" />
          <SeasonJumpSelect seasons={seasons} />
        </div>
      </div>

      <BumpChart data={rankTrends} />
    </main>
  );
}
