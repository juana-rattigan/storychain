"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";

import {
  STORIS_VOTING_ABI,
  STORIS_VOTING_ADDRESS,
  ensureSepoliaNetwork,
  getVotingContract,
  getWalletClient,
  publicClient,
} from "../lib/storis-sepolia";

type VoteOption = "A" | "B" | "C";

type VoteCounts = {
  A: number;
  B: number;
  C: number;
};

type GeneratedStory = {
  episodeId: number;
  winner: VoteOption;
  winnerName: string;
  story: string;
};

type ClaimedNft = {
  tokenId: string;
  name: string;
  description: string;
  imageUrl: string;
  tokenUri: string;
};

const OPTION_TO_INDEX: Record<VoteOption, number> = {
  A: 0,
  B: 1,
  C: 2,
};

const INDEX_TO_OPTION: VoteOption[] = ["A", "B", "C"];

export default function Home() {
  const [episodeId] = useState(1);
  const [wallet, setWallet] = useState("");
  const [selected, setSelected] = useState<VoteOption | "">("");
  const [votes, setVotes] = useState<VoteCounts>({
    A: 0,
    B: 0,
    C: 0,
  });
  const [loadingVotes, setLoadingVotes] = useState(true);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(
    null
  );
  const [storyError, setStoryError] = useState("");
  const [showPart2, setShowPart2] = useState(false);
  const [isEpisodeFinalized, setIsEpisodeFinalized] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [canClaimRewards, setCanClaimRewards] = useState(false);
  const [claimingRewards, setClaimingRewards] = useState(false);
  const [finalizingEpisode, setFinalizingEpisode] = useState(false);
  const [rewardTokenAddress, setRewardTokenAddress] = useState("");
  const [rewardNftAddress, setRewardNftAddress] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [web3Status, setWeb3Status] = useState("");
  const [claimedNfts, setClaimedNfts] = useState<ClaimedNft[]>([]);
  const [loadingClaimedNfts, setLoadingClaimedNfts] = useState(false);
  const [claimedNftsError, setClaimedNftsError] = useState("");

  const part2VideoRef = useRef<HTMLVideoElement | null>(null);
  const isSepoliaMode = Boolean(STORIS_VOTING_ADDRESS);

  useEffect(() => {
    loadVotes();
  }, [episodeId, wallet]);

  useEffect(() => {
    if (!wallet || !rewardNftAddress) {
      setClaimedNfts([]);
      setClaimedNftsError("");
      return;
    }

    loadClaimedNfts(wallet, rewardNftAddress);
  }, [wallet, rewardNftAddress]);

  async function connectWallet() {
    if (!isSepoliaMode) {
      setWeb3Status("Sepolia contract is not configured for this deployment.");
      return;
    }

    if (!(window as any).ethereum) {
      alert("MetaMask is not installed");
      return;
    }

    try {
      await ensureSepoliaNetwork();

      const accounts = (await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const connectedWallet = accounts[0];
      setWallet(connectedWallet);
      setWeb3Status("Connected to MetaMask for Sepolia voting.");

      await checkExistingVote(connectedWallet);
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed");
    }
  }

  async function checkExistingVote(walletAddress: string) {
    try {
      await syncOnchainState(walletAddress);
    } catch (error) {
      console.error("Failed to check existing vote:", error);
    }
  }

  async function loadVotes() {
    try {
      setLoadingVotes(true);
      await syncOnchainState(wallet || undefined);
    } catch (error) {
      console.error(error);
      alert("Could not load vote totals");
    } finally {
      setLoadingVotes(false);
    }
  }

  async function syncOnchainState(walletAddress?: string) {
    const contract = getVotingContract();
    const [counts, episode, owner, token, nft, reward] = await Promise.all([
      contract.read.getVoteCounts([BigInt(episodeId)]),
      contract.read.getEpisode([BigInt(episodeId)]),
      contract.read.owner(),
      contract.read.rewardToken(),
      contract.read.voterPassNft(),
      contract.read.rewardPerVote(),
    ]);

    setVotes({
      A: Number(counts[0]),
      B: Number(counts[1]),
      C: Number(counts[2]),
    });
    setIsEpisodeFinalized(episode.finalized);
    setRewardTokenAddress(token);
    setRewardNftAddress(nft);
    setRewardAmount(formatUnits(reward, 18));

    if (!walletAddress) {
      setSelected("");
      setCanClaimRewards(false);
      setIsOwner(false);
      return;
    }

    const [voteOf, claimed] = await Promise.all([
      contract.read.getVoteOf([BigInt(episodeId), walletAddress as `0x${string}`]),
      contract.read.hasClaimedRewards([
        BigInt(episodeId),
        walletAddress as `0x${string}`,
      ]),
    ]);

    setSelected(voteOf <= 2 ? INDEX_TO_OPTION[Number(voteOf)] : "");
    setCanClaimRewards(episode.finalized && voteOf <= 2 && !claimed);
    setIsOwner(owner.toLowerCase() === walletAddress.toLowerCase());
  }

  async function vote(option: VoteOption) {
    if (!wallet) {
      alert("Connect your wallet first.");
      return;
    }

    if (selected) {
      alert("You already voted.");
      return;
    }

    try {
      setSubmittingVote(true);
      const walletClient = await getWalletClient();
      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        account,
        address: STORIS_VOTING_ADDRESS!,
        abi: STORIS_VOTING_ABI,
        functionName: "vote",
        args: [BigInt(episodeId), OPTION_TO_INDEX[option]],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setWeb3Status("Vote confirmed on Sepolia.");
      await syncOnchainState(wallet);
    } catch (error) {
      console.error(error);
      alert("Vote failed");
    } finally {
      setSubmittingVote(false);
    }
  }

  async function finalizeEpisodeOnchain() {
    if (!wallet || !isSepoliaMode) {
      return;
    }

    try {
      setFinalizingEpisode(true);
      const walletClient = await getWalletClient();
      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        account,
        address: STORIS_VOTING_ADDRESS!,
        abi: STORIS_VOTING_ABI,
        functionName: "finalizeEpisode",
        args: [BigInt(episodeId), OPTION_TO_INDEX[winner.key as VoteOption]],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setWeb3Status("Episode finalized on Sepolia. Voters can now claim rewards.");
      await syncOnchainState(wallet);
    } catch (error) {
      console.error(error);
      alert("Could not finalize the episode");
    } finally {
      setFinalizingEpisode(false);
    }
  }

  async function claimRewardsOnchain() {
    if (!wallet || !isSepoliaMode) {
      return;
    }

    try {
      setClaimingRewards(true);
      const walletClient = await getWalletClient();
      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.writeContract({
        account,
        address: STORIS_VOTING_ADDRESS!,
        abi: STORIS_VOTING_ABI,
        functionName: "claimRewards",
        args: [BigInt(episodeId)],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setWeb3Status("Rewards claimed. Your NFT and STORIS tokens are now in your wallet.");
      await syncOnchainState(wallet);
      if (rewardNftAddress) {
        window.setTimeout(() => loadClaimedNfts(wallet, rewardNftAddress), 2500);
      }
    } catch (error) {
      console.error(error);
      alert("Could not claim rewards");
    } finally {
      setClaimingRewards(false);
    }
  }

  async function loadClaimedNfts(walletAddress = wallet, nftAddress = rewardNftAddress) {
    if (!walletAddress || !nftAddress) {
      return;
    }

    try {
      setLoadingClaimedNfts(true);
      setClaimedNftsError("");

      const params = new URLSearchParams({
        owner: walletAddress,
        contract: nftAddress,
      });
      const res = await fetch(`/api/storis-nfts?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not load your Storis NFT");
      }

      setClaimedNfts(data.nfts ?? []);
    } catch (error) {
      console.error(error);
      setClaimedNfts([]);
      setClaimedNftsError(
        error instanceof Error ? error.message : "Could not load your Storis NFT"
      );
    } finally {
      setLoadingClaimedNfts(false);
    }
  }

  async function generateNextEpisode() {
    try {
      setGeneratingStory(true);
      setStoryError("");

      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          episodeId,
          winner: isSepoliaMode ? (winner.key as VoteOption) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not generate the next episode");
      }

      setGeneratedStory({
        episodeId: data.episodeId,
        winner: data.winner,
        winnerName: data.winnerName,
        story: data.story,
      });

      setShowPart2(true);

      setTimeout(() => {
        if (part2VideoRef.current) {
          part2VideoRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });

          part2VideoRef.current.currentTime = 0;
          part2VideoRef.current.play().catch((error) => {
            console.error("Autoplay failed:", error);
          });
        }
      }, 100);
    } catch (error) {
      console.error(error);
      setGeneratedStory(null);
      setStoryError(
        error instanceof Error
          ? error.message
          : "Could not generate the next episode"
      );
    } finally {
      setGeneratingStory(false);
    }
  }

  const totalVotes = votes.A + votes.B + votes.C;

  function getPercentage(count: number) {
    if (totalVotes === 0) return 0;
    return Math.round((count / totalVotes) * 100);
  }

  function getWinner() {
    const entries = [
      { key: "A", name: "Bananino", votes: votes.A },
      { key: "B", name: "Limoncello", votes: votes.B },
      { key: "C", name: "Manganello", votes: votes.C },
    ];

    entries.sort((a, b) => b.votes - a.votes);
    return entries[0];
  }

  const winner = getWinner();

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-yellow-50 text-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <section className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600 mb-3">
            Web3 Interactive Storytelling
          </p>
          <h1 className="text-5xl font-extrabold mb-4">Storis</h1>
          <p className="text-lg max-w-2xl mx-auto text-gray-600">
            A community-driven storytelling platform where users connect their
            wallet, vote on the next plot twist, and shape the future of the
            story.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={connectWallet}
              className="bg-black text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition"
            >
              {wallet
                ? isSepoliaMode
                  ? "Wallet Connected To Sepolia"
                  : "Wallet Connected"
                : "Connect Wallet"}
            </button>
          </div>

          {wallet && (
            <p className="mt-4 text-sm text-gray-600 break-all">
              <strong>Connected wallet:</strong> {wallet}
            </p>
          )}

          {isSepoliaMode && (
            <p className="mt-2 text-sm text-pink-700">
              Sepolia mode is active. Votes, NFT claims, and STORIS rewards will
              go through your deployed contract.
            </p>
          )}
        </section>

        <section className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">1. Connect Wallet</h5>
            <p className="text-sm text-gray-600">
              Users connect MetaMask to participate in the story.
            </p>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">2. Vote On Sepolia</h5>
            <p className="text-sm text-gray-600">
              The vote is recorded on-chain, and every voter becomes eligible
              for rewards.
            </p>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">3. Claim NFT + Tokens</h5>
            <p className="text-sm text-gray-600">
              Once the episode is finalized, every voter can claim a
              participation NFT and STORIS reward.
            </p>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">Episode</p>
            <p className="text-2xl font-bold">#{episodeId}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">Total Votes</p>
            <p className="text-2xl font-bold">{totalVotes}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">Current Leader</p>
            <p className="text-2xl font-bold">{winner.name}</p>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-sm border p-6 mb-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">Sepolia Rewards</h2>
                <p className="text-gray-600 max-w-2xl">
                  Voters receive a participation NFT and STORIS tokens after the
                  episode is finalized on-chain.
                </p>
              </div>
              {web3Status && (
                <p className="text-sm text-pink-700 font-medium">{web3Status}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-6">
              <div className="bg-gray-50 rounded-2xl border p-4">
                <p className="text-sm text-gray-500 mb-1">Voting Contract</p>
                <p className="text-sm font-medium break-all">
                  {STORIS_VOTING_ADDRESS}
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl border p-4">
                <p className="text-sm text-gray-500 mb-1">Reward Token</p>
                <p className="text-sm font-medium break-all">
                  {rewardTokenAddress || "Load after deploy"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-2xl border p-4">
                <p className="text-sm text-gray-500 mb-1">Voter NFT</p>
                <p className="text-sm font-medium break-all">
                  {rewardNftAddress || "Load after deploy"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={finalizeEpisodeOnchain}
                disabled={!wallet || !isOwner || isEpisodeFinalized || finalizingEpisode}
                className="bg-black text-white px-5 py-3 rounded-full font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {isEpisodeFinalized
                  ? "Episode Finalized"
                  : finalizingEpisode
                  ? "Finalizing..."
                  : "Finalize Episode"}
              </button>
              <button
                onClick={claimRewardsOnchain}
                disabled={!wallet || !canClaimRewards || claimingRewards}
                className="bg-green-600 text-white px-5 py-3 rounded-full font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {!wallet
                  ? "Connect Wallet To Claim"
                  : claimingRewards
                  ? "Claiming Rewards..."
                  : canClaimRewards
                  ? "Claim NFT + Tokens"
                  : selected && isEpisodeFinalized
                  ? "Already Claimed"
                  : "Claim NFT + Tokens"}
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p>
                <strong>Status:</strong>{" "}
                {isEpisodeFinalized ? "Voting closed, rewards unlocked." : "Voting open."}
              </p>
              <p>
                <strong>Reward per voter:</strong>{" "}
                {rewardAmount ? `${rewardAmount} STORIS` : "Will load from contract"}
              </p>
              <p>
                <strong>Your claim:</strong>{" "}
                {canClaimRewards
                  ? "Ready to claim."
                  : selected && isEpisodeFinalized
                  ? "Already claimed or already checked."
                  : "Vote first, then wait for finalization."}
              </p>
            </div>

            <div className="mt-6 rounded-2xl border bg-gray-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Your Storis NFT</h3>
                  <p className="text-sm text-gray-600">
                    Alchemy checks your connected wallet for the voter pass NFT.
                  </p>
                </div>
                <button
                  onClick={() => loadClaimedNfts()}
                  disabled={!wallet || !rewardNftAddress || loadingClaimedNfts}
                  className="bg-white border px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-100 transition disabled:opacity-60"
                >
                  {loadingClaimedNfts ? "Checking..." : "Refresh NFT"}
                </button>
              </div>

              {!wallet ? (
                <p className="mt-4 text-sm text-gray-600">
                  Connect your wallet to see your claimed NFT.
                </p>
              ) : claimedNftsError ? (
                <p className="mt-4 text-sm font-medium text-red-600">
                  {claimedNftsError}
                </p>
              ) : loadingClaimedNfts ? (
                <p className="mt-4 text-sm text-gray-600">
                  Looking for your Storis NFT...
                </p>
              ) : claimedNfts.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {claimedNfts.map((nft) => (
                    <ClaimedNftCard key={`${nft.tokenId}-${nft.name}`} nft={nft} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-600">
                  No Storis NFT found yet. Claim rewards after finalization, then refresh.
                </p>
              )}
            </div>
          </section>

        <section className="bg-white rounded-3xl shadow-lg border p-8 mb-10">
          <h2 className="text-3xl font-bold mb-4">
            Strawberrina and Bananino: The Next Part
          </h2>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div>
              <h3 className="text-xl font-semibold mb-3">Part 1</h3>
              <video
                src="/part1.mp4"
                controls
                className="w-full rounded-2xl border bg-black"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            {showPart2 && (
              <div>
                <h3 className="text-xl font-semibold mb-3">Part 2</h3>
                <video
                  ref={part2VideoRef}
                  src="/part2.mp4"
                  controls
                  muted
                  className="w-full rounded-2xl border bg-black"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>

          <p className="text-gray-700 mb-4 leading-7">
            Strawberrina looks deeply into Bananino&apos;s eyes and swears to
            him that the baby is, in fact, his. “I love you so much. I would
            never cheat on you again, Bananino, I swear.”
          </p>

          <p className="text-gray-700 mb-6 leading-7">
            Bananino looks at Strawberrina with deep hurt and a certain kind of
            longing for the early days, when their relationship was perfect and
            before... before he knew what Strawberrina had done. His face twists
            in anguish as he remembers that Limoncello also had a bite of what
            he once thought was only his.
          </p>

          <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4 mb-8">
            <h3 className="text-xl font-semibold mb-2">Choose the baby daddy</h3>
            <p className="text-gray-600 text-sm">
              Connect MetaMask on Sepolia and cast one on-chain vote. After
              finalization, voters can claim an NFT and STORIS reward.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <VoteCard
              option="A"
              name="Bananino"
              image="/bananino.jpg"
              votes={votes.A}
              percentage={getPercentage(votes.A)}
              selected={selected === "A"}
              disabled={submittingVote || isEpisodeFinalized}
              onVote={vote}
            />

            <VoteCard
              option="B"
              name="Limoncello"
              image="/limoncello.jpg"
              votes={votes.B}
              percentage={getPercentage(votes.B)}
              selected={selected === "B"}
              disabled={submittingVote || isEpisodeFinalized}
              onVote={vote}
            />

            <VoteCard
              option="C"
              name="Manganello"
              image="/manganello.jpg"
              votes={votes.C}
              percentage={getPercentage(votes.C)}
              selected={selected === "C"}
              disabled={submittingVote || isEpisodeFinalized}
              onVote={vote}
            />
          </div>

          <div className="mt-8 bg-gray-50 border rounded-2xl p-5">
            <h4 className="text-lg font-semibold mb-2">Live results</h4>
            {loadingVotes ? (
              <p className="text-gray-600">Loading votes...</p>
            ) : (
              <p className="text-gray-700">
                <strong>{winner.name}</strong> is leading with{" "}
                <strong>{winner.votes}</strong> vote
                {winner.votes === 1 ? "" : "s"}.
              </p>
            )}

            {selected && (
              <p className="mt-3 text-green-700 font-medium">
                You voted for option {selected}.
              </p>
            )}

            {submittingVote && (
              <p className="mt-3 text-gray-500 text-sm">Submitting vote...</p>
            )}

          </div>

          <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-lg font-semibold">
                  Generate the next episode
                </h4>
                <p className="text-sm text-gray-600">
                  Use the current winning vote to create the next Storis
                  chapter instantly.
                </p>
              </div>
              <button
                onClick={generateNextEpisode}
                disabled={loadingVotes || generatingStory || totalVotes === 0}
                className="bg-yellow-500 text-black px-6 py-3 rounded-full font-semibold hover:opacity-90 transition disabled:opacity-60"
              >
                {generatingStory
                  ? "Generating Episode..."
                  : "Generate Next Episode"}
              </button>
            </div>

            {storyError && (
              <p className="mt-4 text-sm font-medium text-red-600">
                {storyError}
              </p>
            )}

            {generatedStory && (
              <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
                  Episode #{generatedStory.episodeId}
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Based on the winning vote: {generatedStory.winner}.{" "}
                  {generatedStory.winnerName}
                </p>
                <div className="mt-4 whitespace-pre-line text-gray-800 leading-7">
                  {generatedStory.story}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type VoteCardProps = {
  option: VoteOption;
  name: string;
  image: string;
  votes: number;
  percentage: number;
  selected: boolean;
  disabled: boolean;
  onVote: (option: VoteOption) => void;
};

function VoteCard({
  option,
  name,
  image,
  votes,
  percentage,
  selected,
  disabled,
  onVote,
}: VoteCardProps) {
  return (
    <button
      onClick={() => onVote(option)}
      disabled={disabled}
      className={`rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-md ${
        selected
          ? "bg-black text-white border-black"
          : "bg-white hover:-translate-y-1"
      }`}
    >
      <Image
        src={image}
        alt={name}
        width={500}
        height={500}
        className="w-full h-64 object-cover rounded-xl mb-4 bg-gray-100"
      />
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-bold">
          {option}. {name}
        </h3>
        <span className="text-sm font-medium">{percentage}%</span>
      </div>
      <p className={`text-sm ${selected ? "text-gray-200" : "text-gray-600"}`}>
        Votes: {votes}
      </p>
    </button>
  );
}

function ClaimedNftCard({ nft }: { nft: ClaimedNft }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <img
        src={nft.imageUrl}
        alt={nft.name}
        className="h-56 w-full bg-gray-100 object-cover"
      />
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
          Token #{nft.tokenId}
        </p>
        <h4 className="mt-2 text-lg font-bold">{nft.name}</h4>
        {nft.description && (
          <p className="mt-2 line-clamp-3 text-sm text-gray-600">
            {nft.description}
          </p>
        )}
        {nft.tokenUri && (
          <a
            href={nft.tokenUri}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-medium text-pink-700 hover:text-pink-900"
          >
            View metadata
          </a>
        )}
      </div>
    </div>
  );
}
