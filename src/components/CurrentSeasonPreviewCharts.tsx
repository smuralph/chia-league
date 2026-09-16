"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PlayerProjectionPoint, StarterBenchPoint } from "@/lib/queries";
import { Avatar } from "@/components/Avatar";

function StarterBenchTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: StarterBenchPoint }> }) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <strong style={{ color: "var(--foreground)" }}>{row.owner}</strong>
      <div style={{ color: "var(--text-secondary)" }}>Starters: {row.starters.toFixed(1)}</div>
      <div style={{ color: "var(--text-secondary)" }}>Bench: {row.bench.toFixed(1)}</div>
    </div>
  );
}

function ProjectionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PlayerProjectionPoint }> }) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const color = row.difference >= 0 ? "var(--success)" : "var(--critical)";
  return (
    <div className="rounded-md border px-3 py-2 text-xs shadow-lg" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <strong style={{ color: "var(--foreground)" }}>{row.player}</strong>
      <div style={{ color: "var(--text-secondary)" }}>{row.owner} · {row.position}</div>
      <div style={{ color: "var(--text-secondary)" }}>Actual: {row.actual.toFixed(1)}</div>
      <div style={{ color: "var(--text-secondary)" }}>Projected: {row.projected.toFixed(1)}</div>
      <div style={{ color, fontWeight: 600 }}>{row.difference >= 0 ? "+" : ""}{row.difference.toFixed(1)} vs. projection</div>
    </div>
  );
}

type ProjectionMarkProps = {
  cx?: number;
  cy?: number;
  payload?: PlayerProjectionPoint;
  highlighted: boolean;
  square: boolean;
};

function ProjectionMark({ cx = 0, cy = 0, payload, highlighted, square }: ProjectionMarkProps) {
  const markSize = 6;
  const positive = payload?.difference !== undefined && payload.difference >= 0;
  const fill = positive
    ? highlighted ? "#16a34a" : "#166534"
    : highlighted ? "#ef4444" : "#7f1d1d";
  const common = highlighted
    ? { fill, fillOpacity: 1, stroke: "#ffffff", strokeWidth: 1.5 }
    : { fill, fillOpacity: 0.45, stroke: "none", strokeWidth: 0 };
  if (square) {
    return <rect x={cx - markSize / 2} y={cy - markSize / 2} width={markSize} height={markSize} {...common} />;
  }
  return <circle cx={cx} cy={cy} r={markSize / 2} {...common} />;
}

export function CurrentSeasonPreviewCharts({
  starterBench,
  playerProjections,
}: {
  starterBench: StarterBenchPoint[];
  playerProjections: PlayerProjectionPoint[];
}) {
  const [barFocus, setBarFocus] = useState<"starters" | "bench" | null>(null);
  const [ownerHover, setOwnerHover] = useState<string | null>(null);
  const [ownerFocus, setOwnerFocus] = useState<string | null>(null);
  const weeks = useMemo(
            () => [...new Set([...starterBench.map((row) => row.week), ...playerProjections.map((row) => row.week)])].sort((a, b) => a - b),
    [starterBench, playerProjections]
  );
  const [selectedWeek, setSelectedWeek] = useState(weeks[weeks.length - 1] ?? 1);
  const selectedStarterBench = starterBench.filter((row) => row.week === selectedWeek);
  const selectedPlayers = playerProjections.filter((row) => row.week === selectedWeek);
  const owners = useMemo(() => [...new Set(playerProjections.map((row) => row.owner))].sort(), [playerProjections]);
  const highlightedOwner = ownerHover ?? ownerFocus;
  const starterPlayers = selectedPlayers.filter((row) => !row.isBench);
  const benchPlayers = selectedPlayers.filter((row) => row.isBench);
  const isHighlighted = (owner: string) => !highlightedOwner || highlightedOwner === owner;
  const starterMark = (props: Omit<ProjectionMarkProps, "highlighted" | "square">) => (
    <ProjectionMark {...props} highlighted={isHighlighted(props.payload?.owner ?? "")} square={false} />
  );
  const benchMark = (props: Omit<ProjectionMarkProps, "highlighted" | "square">) => (
    <ProjectionMark {...props} highlighted={isHighlighted(props.payload?.owner ?? "")} square />
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Starter vs. Bench Points</h2>
                  <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              Week:
              <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))} className="rounded border px-2 py-1 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                {weeks.map((week) => <option key={week} value={week}>Week {week}</option>)}
              </select>
            </label>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Scoring split by lineup status. Click a bar to compare that category.</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }} aria-label="Starter and bench bar color legend">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--primary)" }} /> Starters</span>
            <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: "var(--accent)" }} /> Bench</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={selectedStarterBench} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 10 }}>
            <CartesianGrid stroke="var(--gridline)" horizontal={false} />
            <XAxis type="number" stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
            <YAxis type="category" dataKey="owner" width={112} stroke="var(--baseline)" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
            <Tooltip content={<StarterBenchTooltip />} />
            <Bar
              dataKey="starters"
              name="Starters"
              fill="var(--primary)"
              isAnimationActive={false}
              onClick={() => setBarFocus((current) => current === "starters" ? null : "starters")}
            >
              <LabelList dataKey="starters" position="right" formatter={(value) => Number(value).toFixed(1)} fill="var(--text-secondary)" fontSize={11} />
              {selectedStarterBench.map((row) => <Cell key={`${row.owner}-starters`} fill="var(--primary)" opacity={barFocus && barFocus !== "starters" ? 0.25 : 1} />)}
            </Bar>
            <Bar
              dataKey="bench"
              name="Bench"
              fill="var(--accent)"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              onClick={() => setBarFocus((current) => current === "bench" ? null : "bench")}
            >
              <LabelList dataKey="bench" position="right" formatter={(value) => Number(value).toFixed(1)} fill="var(--text-secondary)" fontSize={11} />
              {selectedStarterBench.map((row) => <Cell key={`${row.owner}-bench`} fill="var(--accent)" opacity={barFocus && barFocus !== "bench" ? 0.25 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-lg border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Player Projection Accuracy</h2>
            <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              Week:
              <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))} className="rounded border px-2 py-1 text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}>
                {weeks.map((week) => <option key={week} value={week}>Week {week}</option>)}
              </select>
            </label>
          </div>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Players above the diagonal beat projections; hover or click a manager below to highlight their roster.
          </p>
        </div>
        <div className="relative h-[500px]">
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 12, right: 24, bottom: 18, left: 4 }}>
              <CartesianGrid stroke="var(--gridline)" />
              <XAxis type="number" dataKey="projected" name="Projected" domain={[0, 40]} stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} label={{ value: "Projected points", position: "insideBottom", offset: -8, fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis type="number" dataKey="actual" name="Actual" domain={[0, 40]} stroke="var(--baseline)" tick={{ fill: "var(--text-muted)", fontSize: 12 }} label={{ value: "Actual points", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 12 }} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 40, y: 40 }]} stroke="var(--text-muted)" strokeDasharray="4 4" />
              <Tooltip content={<ProjectionTooltip />} />
              <Scatter data={starterPlayers} name="Starters" shape={starterMark} isAnimationActive={false}>
                {starterPlayers.map((row) => <Cell key={`${row.owner}-${row.player}`} fill={row.difference >= 0 ? "var(--success)" : "var(--critical)"} />)}
              </Scatter>
              <Scatter data={benchPlayers} name="Bench" shape={benchMark} isAnimationActive={false}>
                {benchPlayers.map((row) => <Cell key={`${row.owner}-${row.player}`} fill={row.difference >= 0 ? "var(--success)" : "var(--critical)"} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="absolute inset-x-2 bottom-0 flex items-start justify-around gap-1" aria-label="Filter projection chart by manager">
            {owners.map((owner) => {
              const selected = highlightedOwner === owner;
              return (
                <button
                  key={owner}
                  type="button"
                  title={`Highlight ${owner}`}
                  aria-label={`Highlight ${owner}`}
                  onPointerOver={() => setOwnerHover(owner)}
                  onPointerLeave={() => setOwnerHover(null)}
                  onClick={() => setOwnerFocus((current) => current === owner ? null : owner)}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-md p-1 transition-opacity"
                  style={{ opacity: highlightedOwner && !selected ? 0.45 : 1 }}
                >
                  <Avatar owner={owner} size={32} />
                  <span className="max-w-[66px] truncate text-[10px]" style={{ color: selected ? "var(--foreground)" : "var(--text-muted)" }}>{owner}</span>
                </button>
              );
            })}
          </div>
          <p className="absolute inset-x-2 -bottom-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Hover a manager to temporarily highlight their players. Click to keep the highlight; click again or hover another manager to change it.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }} aria-label="Projection chart shape legend">
          <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border-2 border-black" style={{ background: "#898781" }} /> Starter</span>
          <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 border-2 border-black" style={{ background: "#898781" }} /> Bench</span>
        </div>
      </section>
    </div>
  );
}
