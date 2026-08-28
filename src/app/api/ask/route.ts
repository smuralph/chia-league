import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";
import {
  getLeagueKpis,
  getManagerLeaderboard,
  getManagersList,
  getManagerDetail,
  getManagerWeeklyResults,
  getRivalries,
  getSeasonsList,
  getSeasonSummary,
  getSeasonStandings,
  getSeasonHighs,
  getRankTrends,
} from "@/lib/queries";

// Tool-calling, not raw SQL generation: the model can only call these
// pre-vetted, read-only query functions (the same ones the rest of the site
// uses) - it never touches the database directly, so there's no risk of it
// writing an unsafe or destructive query. Anything not covered by one of
// these tools, it simply can't answer.
type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, any>) => Promise<unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "get_league_kpis",
    description:
      "Overall league records (seasons 2018+): highest single-season win %, most career wins, most career points, most playoff appearances, most championships, longest win/loss streaks.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getLeagueKpis(),
  },
  {
    name: "get_manager_leaderboard",
    description:
      "All-time manager rankings (seasons 2018+): wins, losses, win%, championships, podiums, playoff appearances, total points, seasons played - for every manager.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getManagerLeaderboard(),
  },
  {
    name: "get_managers_list",
    description:
      "Every manager's full name exactly as spelled in the database, with season count and championships. Call this first to resolve the exact spelling of a manager's name before calling get_manager_detail or get_manager_weekly_results.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getManagersList(),
  },
  {
    name: "get_manager_detail",
    description:
      "One manager's full career record (all seasons they've played, not capped to 2018+): win/loss/ties, championships, playoff appearances, best/worst/avg finish, total points, and a season-by-season table (team name, record, points for/against, finish, playoffs, champion).",
    parameters: {
      type: "object",
      properties: { owner: { type: "string", description: "Manager's full name, exactly as returned by get_managers_list" } },
      required: ["owner"],
    },
    run: ({ owner }) => getManagerDetail(owner),
  },
  {
    name: "get_manager_weekly_results",
    description:
      "One manager's week-by-week results for one season: opponent, win/loss/tie, points for, points against, and their top 3 players that week.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Manager's full name, exactly as returned by get_managers_list" },
        season: { type: "number" },
      },
      required: ["owner", "season"],
    },
    run: ({ owner, season }) => getManagerWeeklyResults(owner, Number(season)),
  },
  {
    name: "get_rivalries",
    description:
      "Every manager's biggest rivalry opponent (most head-to-head meetings across all history, ties broken by closest record then closest scoring margin), with the full head-to-head record, meeting count, win%, and average scoring margin.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getRivalries(),
  },
  {
    name: "get_seasons_list",
    description: "Every season from 2014-2025 and that season's champion.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getSeasonsList(),
  },
  {
    name: "get_season_summary",
    description: "One season's champion, runner-up, highest-scoring team, and best regular-season record.",
    parameters: { type: "object", properties: { season: { type: "number" } }, required: ["season"] },
    run: ({ season }) => getSeasonSummary(Number(season)),
  },
  {
    name: "get_season_standings",
    description: "One season's final standings: every team's rank, record, points for/against, playoffs, champion.",
    parameters: { type: "object", properties: { season: { type: "number" } }, required: ["season"] },
    run: ({ season }) => getSeasonStandings(Number(season)),
  },
  {
    name: "get_season_highs",
    description:
      "The single highest team-week score of every season (2014-2025), with the team/owner, week, and that week's top player and their stats.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getSeasonHighs(),
  },
  {
    name: "get_rank_trends",
    description:
      "Every manager's final standing and win%-based rank for every season they played - useful for 'who dominated in year X' or a manager's rank history over time.",
    parameters: { type: "object", properties: {}, required: [] },
    run: () => getRankTrends(),
  },
];

// Gemini accepts plain JSON Schema directly via parametersJsonSchema, so the
// tool definitions above don't need any conversion to Gemini's own Schema/
// Type-enum format.
const functionDeclarations = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.parameters,
}));

const SYSTEM_PROMPT = `You are the Chia Fantasy Football League's history assistant. Answer questions using ONLY the data returned by the tools available to you - never invent stats, names, or scores. If the tools don't have what's needed to answer, say so plainly instead of guessing. Keep answers concise and conversational, like a knowledgeable league member, not a data dump. When useful, mention the season(s) the numbers come from.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply: "The AI assistant isn't configured yet - the site owner needs to add a GEMINI_API_KEY.",
    });
  }

  const { messages } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Tool-calling loop: the model requests a tool, we run it against the
  // real database and feed the result back, up to a few rounds so it can
  // chain lookups (e.g. resolve a name via get_managers_list, then look up
  // that manager's detail) before producing a final answer.
  for (let round = 0; round < 5; round++) {
    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations }],
      },
    });

    const candidateContent = response.candidates?.[0]?.content;
    if (candidateContent) contents.push(candidateContent);

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      return NextResponse.json({ reply: response.text ?? "Sorry, I couldn't find an answer to that." });
    }

    const responseParts = [];
    for (const call of calls) {
      const tool = TOOLS.find((t) => t.name === call.name);
      let result: unknown;
      try {
        result = tool ? await tool.run(call.args ?? {}) : { error: `unknown tool: ${call.name}` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      responseParts.push({ functionResponse: { name: call.name, response: { output: result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return NextResponse.json({ reply: "Sorry, I couldn't find an answer to that." });
}
