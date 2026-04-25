import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const winner = body.winner || "Bananino";

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
            content: `Write the next dramatic episode of StoryChain. ${winner} won the vote. Make it funny, dramatic, and short.`,
          },
        ],
      }),
    });

    const data = await response.json();

    const story =
      data.choices?.[0]?.message?.content ||
      "Chaos erupts in the fruit kingdom.";

    return NextResponse.json({ story });
  } catch (error) {
    return NextResponse.json(
      { story: "The story continues in mysterious ways..." },
      { status: 200 }
    );
  }
}