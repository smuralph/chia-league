import type { SeasonStory } from "@/lib/seasonStory";

export function LeagueStory({ story }: { story: SeasonStory }) {
  const cards: { label: string; value: string; sub?: string }[] = [];

  if (story.biggestBlowout) {
    cards.push({
      label: "Biggest Blowout",
      value: `${story.biggestBlowout.winner} +${story.biggestBlowout.margin.toFixed(1)}`,
      sub: `Week ${story.biggestBlowout.week} vs. ${story.biggestBlowout.loser} (${story.biggestBlowout.winnerPoints.toFixed(1)}–${story.biggestBlowout.loserPoints.toFixed(1)})`,
    });
  }
  if (story.closestGame) {
    cards.push({
      label: "Closest Game",
      value: `${story.closestGame.winner} +${story.closestGame.margin.toFixed(1)}`,
      sub: `Week ${story.closestGame.week} vs. ${story.closestGame.loser} (${story.closestGame.winnerPoints.toFixed(1)}–${story.closestGame.loserPoints.toFixed(1)})`,
    });
  }
  if (story.longestWinStreak) {
    cards.push({
      label: "Longest Winning Streak",
      value: `${story.longestWinStreak.length} games`,
      sub: `${story.longestWinStreak.owner}, weeks ${story.longestWinStreak.startWeek}–${story.longestWinStreak.endWeek}`,
    });
  }
  if (story.longestLossStreak) {
    cards.push({
      label: "Longest Losing Streak",
      value: `${story.longestLossStreak.length} games`,
      sub: `${story.longestLossStreak.owner}, weeks ${story.longestLossStreak.startWeek}–${story.longestLossStreak.endWeek}`,
    });
  }
  if (story.biggestUpsets[0]) {
    const u = story.biggestUpsets[0];
    cards.push({
      label: "Biggest Upset",
      value: `${u.winner} over ${u.loser}`,
      sub: `Week ${u.week} — entering ${(u.winnerEnteringWinPct * 100).toFixed(0)}% beat ${(u.loserEnteringWinPct * 100).toFixed(0)}%`,
    });
  }
  if (story.biggestComeback) {
    cards.push({
      label: "Biggest Comeback",
      value: story.biggestComeback.owner,
      sub: `Rank ${story.biggestComeback.midpointRank} at midseason → finished ${story.biggestComeback.finalRank}, made playoffs`,
    });
  }
  if (story.biggestCollapse) {
    cards.push({
      label: "Biggest Collapse",
      value: story.biggestCollapse.owner,
      sub: `Rank ${story.biggestCollapse.midpointRank} at midseason → finished ${story.biggestCollapse.finalRank}, missed playoffs`,
    });
  }

  return (
    <section
      className="rounded-lg border p-5 flex flex-col gap-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div>
        <h2 className="text-xs uppercase tracking-wide font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
          League Story
        </h2>
        <p className="text-lg font-medium leading-snug" style={{ color: "var(--foreground)" }}>
          {story.headline}
        </p>
      </div>
      {cards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-md border p-3 flex flex-col gap-0.5"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {c.label}
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {c.value}
              </span>
              {c.sub && (
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {c.sub}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
