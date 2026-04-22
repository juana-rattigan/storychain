import { NextResponse } from "next/server";

import {
  getEmptyVotes,
  isVoteOption,
  normalizeWallet,
  parseEpisodeId,
  selectionsStore,
  votesStore,
} from "../_lib/vote-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const episodeId = parseEpisodeId(String(body?.episodeId ?? ""));
    const wallet = normalizeWallet(body?.wallet);
    const choiceKey = body?.choiceKey;

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

    if (!isVoteOption(choiceKey)) {
      return NextResponse.json(
        { error: "choiceKey must be A, B, or C" },
        { status: 400 }
      );
    }

    const episodeSelections = selectionsStore[episodeId] ?? {};
    const existingVote = episodeSelections[wallet];

    if (existingVote) {
      return NextResponse.json(
        { error: "This wallet has already voted", selected: existingVote },
        { status: 409 }
      );
    }

    const episodeVotes = votesStore[episodeId] ?? getEmptyVotes();
    episodeVotes[choiceKey] += 1;

    votesStore[episodeId] = episodeVotes;
    selectionsStore[episodeId] = {
      ...episodeSelections,
      [wallet]: choiceKey,
    };

    return NextResponse.json({
      success: true,
      selected: choiceKey,
      votes: episodeVotes,
    });
  } catch (error) {
    console.error("POST /api/vote failed:", error);
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
  }
}
