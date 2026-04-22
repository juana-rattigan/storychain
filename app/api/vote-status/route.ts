import { NextResponse } from "next/server";

import {
  normalizeWallet,
  parseEpisodeId,
  selectionsStore,
} from "../_lib/vote-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const episodeId = parseEpisodeId(searchParams.get("episodeId"));
    const wallet = normalizeWallet(searchParams.get("wallet"));

    if (episodeId === null) {
      return NextResponse.json(
        { error: "A valid episodeId is required" },
        { status: 400 }
      );
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const selected = selectionsStore[episodeId]?.[wallet] ?? null;

    return NextResponse.json({ selected });
  } catch (error) {
    console.error("GET /api/vote-status failed:", error);
    return NextResponse.json(
      { error: "Failed to load vote status" },
      { status: 500 }
    );
  }
}
