"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import type { PlayerNetwork, PlayerSeasonPoints } from "@/lib/queries";
import { getAvatarPath, getInitials } from "@/lib/avatars";

const WIDTH = 1100;
const HEIGHT = 750;
// The Top 10 panel floats over the top-left corner of the graph, so the
// hub-and-spoke layout is centered up and to the right of the viewBox
// midpoint (rather than dead center) to keep nodes from sitting behind it
// or getting crowded against the bottom edge.
const CENTER_X = WIDTH / 2 + 40;
const CENTER_Y = HEIGHT / 2 - 50;
const OWNER_R = 30;
const PLAYER_R_MIN = 3;
const PLAYER_R_MAX = 15;

const POS_COLOR: Record<string, string> = {
  QB: "var(--series-1)",
  RB: "var(--series-2)",
  WR: "var(--series-3)",
  TE: "var(--series-4)",
  K: "var(--series-5)",
};
const POS_ORDER = ["QB", "RB", "WR", "TE", "K"];

type OwnerNode = { id: string; kind: "owner"; ownerId: number; name: string; x: number; y: number };
type PlayerNode = {
  id: string;
  kind: "player";
  name: string;
  pos: string;
  totalPoints: number;
  ownerIds: number[];
  seasonBreakdown: PlayerSeasonPoints[];
  r: number;
  x: number;
  y: number;
};
type GraphNode = OwnerNode | PlayerNode;
type GraphLink = { source: string; target: string };

type Layout = { nodes: GraphNode[]; links: GraphLink[] };

function buildLayout(network: PlayerNetwork): Layout {
  const maxPoints = Math.max(1, ...network.players.map((p) => p.totalPoints));

  const ownerNodes: (OwnerNode & { fx: number; fy: number })[] = network.owners.map((o, i) => {
    const angle = (i / network.owners.length) * 2 * Math.PI - Math.PI / 2;
    const x = CENTER_X + Math.cos(angle) * 320;
    const y = CENTER_Y + Math.sin(angle) * 270;
    // Owners are pinned (fx/fy) rather than left to the simulation - with
    // ~770 links all pulling toward the player cluster, unpinned hubs drift
    // inward and lose the "spokes radiating out" layout that makes a
    // hub-and-spoke graph like this legible.
    return { id: `owner-${o.id}`, kind: "owner", ownerId: o.id, name: o.name, x, y, fx: x, fy: y };
  });

  const playerNodes: PlayerNode[] = network.players.map((p) => {
    const scale = Math.sqrt(p.totalPoints / maxPoints);
    return {
      id: `player-${p.name}`,
      kind: "player",
      name: p.name,
      pos: p.pos,
      totalPoints: p.totalPoints,
      ownerIds: p.ownerIds,
      seasonBreakdown: p.seasonBreakdown,
      r: PLAYER_R_MIN + (PLAYER_R_MAX - PLAYER_R_MIN) * scale,
      x: CENTER_X,
      y: CENTER_Y,
    };
  });

  const nodes: GraphNode[] = [...ownerNodes, ...playerNodes];
  const links: GraphLink[] = [];
  for (const p of network.players) {
    for (const ownerId of p.ownerIds) {
      links.push({ source: `owner-${ownerId}`, target: `player-${p.name}` });
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const simLinks = links.map((l) => ({ source: nodeById.get(l.source)!, target: nodeById.get(l.target)! }));

  const simulation = forceSimulation(nodes as any)
    .force(
      "link",
      forceLink(simLinks as any)
        .id((d: any) => d.id)
        .distance(70)
        .strength(0.5)
    )
    .force("charge", forceManyBody().strength(-40))
    .force("center", forceCenter(CENTER_X, CENTER_Y))
    .force(
      "collide",
      forceCollide((d: any) => (d.kind === "owner" ? OWNER_R + 6 : d.r + 2))
    )
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  // Belt-and-suspenders: forceCollide/forceManyBody can still push a
  // lightly-connected player node past the viewBox edge after 300 ticks.
  // Owners are pinned (fx/fy) and never move, so only players need clamping.
  for (const n of playerNodes) {
    n.x = Math.min(WIDTH - n.r, Math.max(n.r, n.x));
    n.y = Math.min(HEIGHT - n.r, Math.max(n.r, n.y));
  }

  return { nodes, links };
}

type HoverInfo =
  | { kind: "player"; node: PlayerNode; x: number; y: number }
  | { kind: "owner"; node: OwnerNode; x: number; y: number }
  | null;

// Placed beside the node rather than centered above it, so the node and its
// radiating connections stay visible instead of getting covered by the box -
// whichever side of the graph the node sits on determines which way the
// tooltip opens, so it also stays clear of the SVG's edge.
function tooltipPosition(hover: NonNullable<HoverInfo>): CSSProperties {
  const radius = hover.kind === "owner" ? OWNER_R : hover.node.r;
  const leftPct = (hover.x / WIDTH) * 100;
  const topPct = (hover.y / HEIGHT) * 100;
  const openRight = hover.x < WIDTH / 2;

  return openRight
    ? { left: `calc(${leftPct}% + ${radius + 14}px)`, top: `${topPct}%`, transform: "translateY(-50%)" }
    : { left: `calc(${leftPct}% - ${radius + 14}px)`, top: `${topPct}%`, transform: "translate(-100%, -50%)" };
}

export function PlayerNetworkGraph({ network }: { network: PlayerNetwork }) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [hover, setHover] = useState<HoverInfo>(null);

  useEffect(() => {
    setLayout(buildLayout(network));
  }, [network]);

  const connected = useMemo(() => {
    if (!hover || !layout) return null;
    const id = hover.node.id;
    const set = new Set<string>([id]);
    for (const l of layout.links) {
      if (l.source === id) set.add(l.target);
      if (l.target === id) set.add(l.source);
    }
    return set;
  }, [hover, layout]);

  if (!layout) {
    return (
      <div
        className="rounded-lg border p-4 flex items-center justify-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)", height: HEIGHT }}
      >
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          Laying out network…
        </span>
      </div>
    );
  }

  const ownerNodes = layout.nodes.filter((n): n is OwnerNode => n.kind === "owner");
  const playerNodes = layout.nodes.filter((n): n is PlayerNode => n.kind === "player");
  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const playerNodesByName = new Map(playerNodes.map((n) => [n.name, n]));

  const topTen = [...network.players]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      totalPoints: p.totalPoints,
      seasons: new Set(p.seasonBreakdown.map((s) => s.season)).size,
      teams: p.ownerIds.length,
    }));

  function selectPlayer(name: string) {
    const node = playerNodesByName.get(name);
    if (node) setHover({ kind: "player", node, x: node.x, y: node.y });
  }

  return (
    <div
      className="rounded-lg border p-4 relative"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Player Network
        </h3>
        <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "var(--text-secondary)" }}>
          {POS_ORDER.map((pos) => (
            <span key={pos} className="flex items-center gap-1">
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, background: POS_COLOR[pos] }}
              />
              {pos}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        Players rostered 10+ weeks in a season, across 4+ seasons. Node size = total points, 2018-2025. Hover a node
        to trace its connections.
      </p>

      <div className="relative">
        <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
          {ownerNodes.map((o) => {
            const path = getAvatarPath(o.name);
            if (!path) return null;
            return (
              <clipPath key={o.id} id={`clip-${o.id}`}>
                <circle cx={o.x} cy={o.y} r={OWNER_R} />
              </clipPath>
            );
          })}
        </defs>

        {layout.links.map((l, i) => {
          const source = nodeById.get(l.source);
          const target = nodeById.get(l.target);
          if (!source || !target) return null;
          const isActive = connected ? connected.has(l.source) && connected.has(l.target) : false;
          const isDimmed = connected ? !isActive : false;
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isActive ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth={isActive ? 1.5 : 1}
              strokeOpacity={isDimmed ? 0.04 : isActive ? 0.7 : 0.12}
            />
          );
        })}

        {playerNodes.map((p) => {
          const isDimmed = connected ? !connected.has(p.id) : false;
          return (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={POS_COLOR[p.pos] ?? "var(--text-muted)"}
              fillOpacity={isDimmed ? 0.12 : 0.9}
              stroke="var(--surface)"
              strokeWidth={0.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover({ kind: "player", node: p, x: p.x, y: p.y })}
              onMouseMove={() => setHover({ kind: "player", node: p, x: p.x, y: p.y })}
            />
          );
        })}

        {ownerNodes.map((o) => {
          const isDimmed = connected ? !connected.has(o.id) : false;
          const path = getAvatarPath(o.name);
          return (
            <g
              key={o.id}
              style={{ cursor: "pointer" }}
              opacity={isDimmed ? 0.25 : 1}
              onMouseEnter={() => setHover({ kind: "owner", node: o, x: o.x, y: o.y })}
              onMouseMove={() => setHover({ kind: "owner", node: o, x: o.x, y: o.y })}
            >
              <circle cx={o.x} cy={o.y} r={OWNER_R} fill="var(--series-1)" />
              {path ? (
                <image
                  href={path}
                  x={o.x - OWNER_R}
                  y={o.y - OWNER_R}
                  width={OWNER_R * 2}
                  height={OWNER_R * 2}
                  clipPath={`url(#clip-${o.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#fff">
                  {getInitials(o.name)}
                </text>
              )}
              <circle cx={o.x} cy={o.y} r={OWNER_R} fill="none" stroke="var(--surface)" strokeWidth={2} />
              <text
                x={o.x}
                y={o.y + OWNER_R + 13}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--foreground)"
              >
                {o.name}
              </text>
            </g>
          );
        })}
          </svg>

          {hover && (
            <div
              className="absolute pointer-events-none rounded-lg border px-3 py-2 text-xs"
              style={{
                background: "var(--surface-translucent)",
                borderColor: "var(--border)",
                ...tooltipPosition(hover),
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                minWidth: 140,
                width: "max-content",
                maxWidth: 480,
              }}
            >
              {hover.kind === "player" ? (
                <>
                  <div style={{ color: "var(--foreground)", fontWeight: 600 }}>{hover.node.name}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{hover.node.pos}</div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    {hover.node.ownerIds.length} team{hover.node.ownerIds.length === 1 ? "" : "s"}
                  </div>
                  <div style={{ color: "var(--text-muted)" }}>
                    {hover.node.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })} pts, 2018-2025
                  </div>
                  {hover.node.seasonBreakdown.length > 0 && (
                    <div className="mt-1 pt-1" style={{ borderTop: "1px solid var(--gridline)" }}>
                      {hover.node.seasonBreakdown.map((s, i) => (
                        <div key={i} style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          <span style={{ color: "var(--text-muted)" }}>{s.season}</span> · {s.teamName} ({s.owner}) ·{" "}
                          {s.points.toLocaleString(undefined, { maximumFractionDigits: 0 })} pts
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "var(--foreground)", fontWeight: 600 }}>{hover.node.name}</div>
              )}
            </div>
          )}

        {/* Phone: normal block below the graph, full width, so the graph
            itself gets the full width instead of a fixed-width floating
            panel eating most of it. Laptop/iPad (md+): floats over the
            top-left corner, unchanged. */}
        <div
          className="mt-4 md:mt-0 md:absolute md:top-0 md:left-0 md:z-10 md:w-[195px] rounded-lg border px-2 py-2"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h4 className="text-xs font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            Top 10 Players · 2018-2025
          </h4>
          <table className="w-full" style={{ fontVariantNumeric: "tabular-nums", fontSize: 11 }}>
            <thead>
              <tr style={{ color: "var(--text-muted)" }} className="text-left uppercase tracking-wide">
                <th className="py-1 pr-1">#</th>
                <th className="py-1 pr-1">Player</th>
                <th className="py-1 pr-1 text-right">Pts</th>
                <th className="py-1 pr-1 text-right">Sea</th>
                <th className="py-1 text-right">Tm</th>
              </tr>
            </thead>
            <tbody>
              {topTen.map((p, i) => {
                const isSelected = hover?.kind === "player" && hover.node.name === p.name;
                return (
                  <tr
                    key={p.name}
                    onClick={() => selectPlayer(p.name)}
                    style={{
                      borderTop: "1px solid var(--gridline)",
                      cursor: "pointer",
                      background: isSelected ? "var(--gridline)" : "transparent",
                    }}
                  >
                    <td className="py-1 pr-1" style={{ color: "var(--text-muted)" }}>
                      {i + 1}
                    </td>
                    <td
                      className="py-1 pr-1 font-medium"
                      style={{ color: isSelected ? "var(--primary)" : "var(--foreground)" }}
                    >
                      {p.name}
                    </td>
                    <td className="py-1 pr-1 text-right" style={{ color: "var(--text-secondary)" }}>
                      {p.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-1 pr-1 text-right" style={{ color: "var(--text-secondary)" }}>
                      {p.seasons}
                    </td>
                    <td className="py-1 text-right" style={{ color: "var(--text-secondary)" }}>
                      {p.teams}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
