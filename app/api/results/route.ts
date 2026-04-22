import { NextResponse } from "next/server";

import { getEmptyVotes, parseEpisodeId, votesStore } from "../_lib/vote-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const episodeId = parseEpisodeId(searchParams.get("episodeId"));

    if (episodeId === null) {
      return NextResponse.json(
        { error: "A valid episodeId is required" },
        { status: 400 }
      );
    }

    const votes = votesStore[episodeId] ?? getEmptyVotes();

    return NextResponse.json({ votes });
  } catch (error) {
    console.error("GET /api/results failed:", error);
    return NextResponse.json(
      { error: "Failed to load results" },
      { status: 500 }
    );
  }
}
