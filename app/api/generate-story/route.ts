import { NextResponse } from "next/server";

import { parseEpisodeId, votesStore } from "../_lib/vote-store";

const STORY_CONTEXT = `Strawberrina looks deeply into Bananino's eyes and swears to him
that the baby is, in fact, his. "I love you so much. I would never cheat on
you again, Bananino, I swear."

Bananino looks at Strawberrina with deep hurt and a certain kind of longing for
the early days, when their relationship was perfect and before... before he knew
what Strawberrina had done. His face twists in anguish as he remembers that
Limoncello also had a bite of what he once thought was only his.`;

const OPTION_NAMES = {
  A: "Bananino",
  B: "Limoncello",
  C: "Manganello",
} as const;

type StoryWinner = keyof typeof OPTION_NAMES;

function getWinner(episodeId: number): StoryWinner | null {
  const votes = votesStore[episodeId];

  if (!votes) {
    return null;
  }

  const entries = Object.entries(votes) as Array<[StoryWinner, number]>;
  entries.sort((a, b) => b[1] - a[1]);

  if (entries[0][1] === 0) {
    return null;
  }

  return entries[0][0];
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const episodeId = parseEpisodeId(String(body?.episodeId ?? ""));

    if (episodeId === null) {
      return NextResponse.json(
        { error: "A valid episodeId is required" },
        { status: 400 }
      );
    }

    const winner = getWinner(episodeId);

    if (!winner) {
      return NextResponse.json(
        { error: "At least one vote is required before generating a story" },
        { status: 400 }
      );
    }

    const winnerName = OPTION_NAMES[winner];
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-5-mini";
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-OpenRouter-Title": "StoryChain",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "You write playful, dramatic, serialized story episodes for a community voting app.",
            },
            {
              role: "user",
              content: `Write episode ${episodeId + 1} of StoryChain.

Current story:
${STORY_CONTEXT}

The community vote winner is ${winner}: ${winnerName}.

Requirements:
- Continue the story in 3 short paragraphs.
- Keep the tone melodramatic, funny, and soap-opera absurd.
- Make ${winnerName} central to the episode.
- End with exactly 3 new choices labeled A, B, and C for the next vote.
- Keep the total response under 300 words.`,
            },
          ],
          temperature: 0.9,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message ||
        "OpenRouter request failed while generating story";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const story =
      typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content.trim()
        : "";

    if (!story) {
      return NextResponse.json(
        { error: "The model did not return story text" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      episodeId: episodeId + 1,
      winner,
      winnerName,
      story,
    });
  } catch (error) {
    console.error("POST /api/generate-story failed:", error);
    return NextResponse.json(
      { error: "Failed to generate the next story" },
      { status: 500 }
    );
  }
}
