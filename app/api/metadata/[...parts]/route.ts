import { NextResponse } from "next/server";

function extractNumber(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return null;
  }

  const number = Number(value.slice(prefix.length));
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ parts: string[] }> }
) {
  const { parts } = await context.params;

  const episodeId = extractNumber(parts[0], "episode-");
  const winnerIndex = extractNumber(parts[1], "winner-");
  const tokenId = extractNumber(parts[2]?.replace(".json", ""), "token-");

  if (episodeId === null || winnerIndex === null || tokenId === null) {
    return NextResponse.json({ error: "Invalid metadata path" }, { status: 400 });
  }

  const winnerName =
    winnerIndex === 0
      ? "Bananino"
      : winnerIndex === 1
      ? "Limoncello"
      : "Manganello";

  const imageUrl = new URL(
    "/nfts/storis-voter-pass.png",
    request.url
  ).toString();

  return NextResponse.json({
    name: `Storis Voter Pass #${tokenId}`,
    description:
      `A Storis voter NFT awarded to participants who helped shape episode ${episodeId}. This collectible marks your vote in the story, where ${winnerName} became the winning character.`,
    image: imageUrl,
    external_url: new URL("/", request.url).toString(),
    background_color: "fff7ed",
    attributes: [
      { trait_type: "Episode", value: episodeId },
      { trait_type: "Winning Character", value: winnerName },
      { trait_type: "Network", value: "Sepolia" },
      { trait_type: "Collection", value: "Storis Voter Pass" },
    ],
  });
}
