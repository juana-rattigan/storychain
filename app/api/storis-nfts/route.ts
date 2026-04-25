import { NextResponse } from "next/server";

type AlchemyNft = {
  tokenId?: string;
  name?: string;
  title?: string;
  description?: string;
  tokenUri?: string | { raw?: string; gateway?: string };
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    pngUrl?: string;
  };
  rawMetadata?: {
    name?: string;
    description?: string;
    image?: string;
  };
};

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function getAlchemyApiKey() {
  if (process.env.ALCHEMY_API_KEY) {
    return process.env.ALCHEMY_API_KEY;
  }

  const rpcUrl = process.env.ALCHEMY_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  const match = rpcUrl?.match(/\/v2\/([^/?#]+)/);
  return match?.[1];
}

function getImageUrl(nft: AlchemyNft) {
  return (
    nft.image?.cachedUrl ??
    nft.image?.pngUrl ??
    nft.image?.thumbnailUrl ??
    nft.image?.originalUrl ??
    nft.rawMetadata?.image ??
    "/nfts/storis-voter-pass.gif"
  );
}

function getTokenUri(nft: AlchemyNft) {
  if (typeof nft.tokenUri === "string") {
    return nft.tokenUri;
  }

  return nft.tokenUri?.gateway ?? nft.tokenUri?.raw ?? "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  const contract = url.searchParams.get("contract") ?? "";
  const apiKey = getAlchemyApiKey();

  if (!ADDRESS_REGEX.test(owner) || !ADDRESS_REGEX.test(contract)) {
    return NextResponse.json(
      { error: "A valid owner and NFT contract address are required." },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Alchemy API key is not configured." },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    owner,
    withMetadata: "true",
    pageSize: "20",
  });
  params.append("contractAddresses[]", contract);

  const response = await fetch(
    `https://eth-sepolia.g.alchemy.com/nft/v3/${apiKey}/getNFTsForOwner?${params.toString()}`,
    {
      headers: {
        accept: "application/json",
      },
      next: {
        revalidate: 15,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: data?.message ?? "Could not load NFTs from Alchemy." },
      { status: response.status }
    );
  }

  const nfts = ((data.ownedNfts ?? []) as AlchemyNft[]).map((nft) => ({
    tokenId: nft.tokenId ?? "",
    name: nft.name ?? nft.title ?? nft.rawMetadata?.name ?? "Storis Voter Pass",
    description: nft.description ?? nft.rawMetadata?.description ?? "",
    imageUrl: getImageUrl(nft),
    tokenUri: getTokenUri(nft),
  }));

  return NextResponse.json({
    nfts,
    totalCount: data.totalCount ?? nfts.length,
  });
}
