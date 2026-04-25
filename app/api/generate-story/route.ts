import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const winnerNames: Record<string, string> = {
      A: "Bananino",
      B: "Limoncello",
      C: "Manganello",
    };
    const winner = typeof body.winner === "string" ? body.winner : "A";
    const winnerName = winnerNames[winner] ?? "Bananino";
    const episodeId = Number(body.episodeId ?? 1);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: [
          {
            role: "user",
            content: `Write the next dramatic episode of Storis. ${winnerName} won the vote. Make it funny, dramatic, and short.`,
          },
        ],
      }),
    });

    const data = await response.json();

    const story =
      data.choices?.[0]?.message?.content ||
      "Chaos erupts in the coast, as bananino finds out Strawberrina is leaving him for Manganello and having his baby";

    return NextResponse.json({ episodeId, winner, winnerName, story });
  } catch (error) {
    return NextResponse.json(
      {
        episodeId: 1,
        winner: "A",
        winnerName: "Bananino",
        story: "The story continues in mysterious ways...",
      },
      { status: 200 }
    );
  }
}
