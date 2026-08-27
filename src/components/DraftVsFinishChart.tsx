"use client";

import { useMemo } from "react";
import { Sankey, Layer, Rectangle, Tooltip, ResponsiveContainer } from "recharts";
import type { ManagerSeasonRow } from "@/lib/queries";

const ORDINAL = [
  "",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
  "13th",
  "14th",
];
function ordinal(n: number): string {
  return ORDINAL[n] ?? `${n}th`;
}

type SankeyNodeDatum = { name: string; kind: "draft" | "finish"; rank: number };
type SankeyLinkDatum = { source: number; target: number; value: number; seasons: number[] };

// One node per distinct draft position this manager has drafted from (left
// column) and one per distinct final finish (right column); a link per
// season connects the two, and repeats of the same pick->finish pairing
// across different seasons are merged into a single wider link rather than
// drawn as overlapping duplicates.
function buildSankeyData(seasons: ManagerSeasonRow[]) {
  const drafted = seasons.filter((s) => s.draftOrder !== null);
  const draftPositions = [...new Set(drafted.map((s) => s.draftOrder as number))].sort((a, b) => a - b);
  const finishes = [...new Set(drafted.map((s) => s.finalRank))].sort((a, b) => a - b);

  const draftIndex = new Map(draftPositions.map((p, i) => [p, i]));
  const finishIndex = new Map(finishes.map((f, i) => [f, draftPositions.length + i]));

  const nodes: SankeyNodeDatum[] = [
    ...draftPositions.map((p) => ({ name: `Pick ${p}`, kind: "draft" as const, rank: p })),
    ...finishes.map((f) => ({ name: ordinal(f), kind: "finish" as const, rank: f })),
  ];

  const linkMap = new Map<string, SankeyLinkDatum>();
  for (const s of drafted) {
    const source = draftIndex.get(s.draftOrder as number)!;
    const target = finishIndex.get(s.finalRank)!;
    const key = `${source}-${target}`;
    const existing = linkMap.get(key);
    if (existing) {
      existing.value += 1;
      existing.seasons.push(s.season);
    } else {
      linkMap.set(key, { source, target, value: 1, seasons: [s.season] });
    }
  }

  return { nodes, links: [...linkMap.values()] };
}

function SankeyNodeShape(props: any) {
  const { x, y, width, height, payload } = props;
  const isDraft = payload.kind === "draft";
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill="var(--series-1)" fillOpacity={0.85} />
      <text
        x={isDraft ? x - 8 : x + width + 8}
        y={y + height / 2}
        textAnchor={isDraft ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={12}
        fill="var(--text-secondary)"
      >
        {payload.name}
      </text>
    </Layer>
  );
}

// Recharts doesn't expose a color prop on Sankey links, so this replicates
// its default cubic-bezier path formula (see recharts' own renderLinkItem)
// and colors it: green if the finish beat the draft slot (lower rank number
// = better), red if it underperformed, muted on an exact match.
function SankeyLinkShape(props: any) {
  const { sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload } = props;
  const beat = payload.target.rank < payload.source.rank;
  const worse = payload.target.rank > payload.source.rank;
  const stroke = beat ? "var(--success)" : worse ? "var(--critical)" : "var(--text-muted)";
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={stroke}
      strokeOpacity={0.45}
      strokeWidth={Math.max(linkWidth, 1)}
    />
  );
}

function SankeyTooltip({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  const boxStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 13,
    padding: "8px 12px",
  };

  if (entry.kind) {
    return (
      <div style={boxStyle}>
        <div style={{ color: "var(--foreground)", fontWeight: 600 }}>{entry.name}</div>
      </div>
    );
  }

  // On resize/scroll, Recharts can momentarily re-fire the tooltip with its
  // internal entry-settings object instead of a real hovered node/link
  // (neither has .kind, and this one has no .source/.target either) -
  // bail rather than crash on it.
  if (!entry.source?.name || !entry.target?.name) return null;

  const seasons: number[] = entry.seasons ?? [];
  return (
    <div style={boxStyle}>
      <div style={{ color: "var(--foreground)", fontWeight: 600 }}>
        {entry.source.name} → {entry.target.name}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        {seasons.length} season{seasons.length === 1 ? "" : "s"}: {seasons.join(", ")}
      </div>
    </div>
  );
}

export function DraftVsFinishChart({ seasons }: { seasons: ManagerSeasonRow[] }) {
  const data = useMemo(() => buildSankeyData(seasons), [seasons]);

  if (data.links.length === 0) return null;

  const height = Math.max(300, Math.max(data.nodes.length, 1) * 26);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--foreground)" }}>
        Draft Position → Final Finish
      </h3>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Green links beat the draft slot. Red links underperformed it.
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={data}
          node={SankeyNodeShape}
          link={SankeyLinkShape}
          nodePadding={24}
          nodeWidth={12}
          margin={{ top: 8, right: 90, bottom: 8, left: 90 }}
          sort={false}
        >
          <Tooltip content={<SankeyTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
