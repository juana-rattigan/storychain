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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const typedError = error as { shortMessage?: string; details?: string };
    return typedError.shortMessage || typedError.details || fallback;
  }

  return fallback;
}

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
    if (!isSepoliaMode || typeof window === "undefined" || !(window as any).ethereum) {
      return;
    }

    const ethereum = (window as any).ethereum;

    async function loadConnectedWallet() {
      const accounts = (await ethereum.request({
        method: "eth_accounts",
      })) as string[];

      setWallet(accounts[0] ?? "");
    }

    function handleAccountsChanged(accounts: string[]) {
      setWallet(accounts[0] ?? "");
    }

    loadConnectedWallet().catch((error) => {
      console.error("Could not load connected wallet:", error);
    });

    ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [isSepoliaMode]);

  useEffect(() => {
    if (!wallet || !rewardNftAddress) {
      setClaimedNfts([]);
      setClaimedNftsError("");
      return;
    }

    loadClaimedNfts(wallet, rewardNftAddress);
  }, [wallet, rewardNftAddress]);

  async function connectWallet(): Promise<string | undefined> {
    if (!isSepoliaMode) {
      setWeb3Status("Sepolia contract is not configured for this deployment.");
      return undefined;
    }

    if (!(window as any).ethereum) {
      alert("MetaMask is not installed");
      return undefined;
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
      return connectedWallet;
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error, "Wallet connection failed");
      setWeb3Status(message);
      alert(message);
      return undefined;
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
    if (selected) {
      alert("You already voted.");
      return;
    }

    if (!isSepoliaMode) {
      setWeb3Status("Sepolia contract is not configured for this deployment.");
      return;
    }

    if (!(window as any).ethereum) {
      alert("MetaMask is not installed");
      return;
    }

    try {
      setSubmittingVote(true);
      await ensureSepoliaNetwork();

      const accounts = (await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      })) as `0x${string}`[];
      const account = accounts[0];

      if (!account) {
        throw new Error("No MetaMask account selected");
      }

      const walletClient = await getWalletClient();
      setWallet(account);

      const hash = await walletClient.writeContract({
        account,
        address: STORIS_VOTING_ADDRESS!,
        abi: STORIS_VOTING_ABI,
        functionName: "vote",
        args: [BigInt(episodeId), OPTION_TO_INDEX[option]],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      setWeb3Status("Vote confirmed on Sepolia.");
      await syncOnchainState(account);
    } catch (error) {
      console.error(error);
      const message = getErrorMessage(error, "Vote failed");
      setWeb3Status(message);
      alert(message);
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
      setWeb3Status("Rewards claimed. Your NFT and STORIS token is now in your wallet.");
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
  const walletLabel = wallet
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : "";

  return (
    <main className="min-h-screen bg-[#fffaf1] text-slate-950">
      <div className="mx-auto max-w-7xl px-5 py-6 md:px-8">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-slate-900/10 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div>
            <p className="text-3xl font-black tracking-tight">storis</p>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
              Create stories. Back them. Own them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {wallet && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                {walletLabel}
              </span>
            )}
            <button
              onClick={connectWallet}
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800"
            >
              {wallet
                ? isSepoliaMode
                  ? "Wallet connected"
                  : "Wallet Connected"
                : "Connect Wallet"}
            </button>
          </div>
        </nav>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] border border-slate-900 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.12)] md:p-10">
            <p className="mb-4 inline-flex rounded-full bg-violet-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-800">
              Creator ownership platform
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
              Stories that fans can shape, collect, and remember.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Storis turns interactive episodes into verifiable participation.
              Audiences vote on-chain, creators continue the narrative, and
              supporters earn a voter pass NFT plus STORIS rewards.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <WorkflowStep title="Create" body="Publish a story world" />
              <WorkflowStep title="Back" body="Let fans vote on-chain" />
              <WorkflowStep title="Own" body="Mint proof of support" />
              <WorkflowStep title="Earn" body="Reward active readers" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-slate-900 bg-slate-950 p-6 text-white shadow-xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber-300">
                Live episode
              </p>
              <p className="mt-3 text-5xl font-black">#{episodeId}</p>
              <p className="mt-3 text-slate-300">
                Current leader: <span className="text-white">{winner.name}</span>
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Metric label="Total votes" value={totalVotes.toString()} />
                <Metric
                  label="Status"
                  value={isEpisodeFinalized ? "Finalized" : "Open"}
                />
              </div>
            </div>
            <div className="rounded-[2rem] border border-slate-900/10 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose-600">
                Core Product
              </p>
              <div className="mt-4 grid gap-3">
                <ModuleRow title="On-chain voting" detail="Ethereum Sepolia" />
                <ModuleRow title="NFT participation pass" detail="Alchemy indexed" />
                <ModuleRow title="AI continuation" detail="OpenRouter route" />
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-[2.5rem] border border-slate-900 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-violet-700">
                  Creator and community rewards
                </p>
                <h2 className="mt-2 text-3xl font-black">Participation ownership</h2>
                <p className="mt-2 max-w-2xl text-slate-600">
                  Voters receive a Storis voter pass NFT and STORIS token after
                  the episode is finalized on-chain.
                </p>
              </div>
              {web3Status && (
                <p className="rounded-full bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-700">
                  {web3Status}
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-sm text-slate-500">Voting Contract</p>
                <p className="break-all text-sm font-semibold">
                  {STORIS_VOTING_ADDRESS}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-sm text-slate-500">Reward Token</p>
                <p className="break-all text-sm font-semibold">
                  {rewardTokenAddress || "Load after deploy"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-1 text-sm text-slate-500">Voter NFT</p>
                <p className="break-all text-sm font-semibold">
                  {rewardNftAddress || "Load after deploy"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={finalizeEpisodeOnchain}
                disabled={!wallet || !isOwner || isEpisodeFinalized || finalizingEpisode}
                className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-violet-800 disabled:opacity-60"
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
                className="rounded-full bg-emerald-600 px-5 py-3 font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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

            <div className="mt-4 space-y-1 text-sm text-slate-600">
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

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Your Storis NFT</h3>
                  <p className="text-sm text-slate-600">
                    Alchemy checks your connected wallet for the voter pass NFT.
                  </p>
                </div>
                <button
                  onClick={() => loadClaimedNfts()}
                  disabled={!wallet || !rewardNftAddress || loadingClaimedNfts}
                  className="rounded-full border bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-60"
                >
                  {loadingClaimedNfts ? "Checking..." : "Refresh NFT"}
                </button>
              </div>

              {!wallet ? (
                <p className="mt-4 text-sm text-slate-600">
                  Connect your wallet to see your claimed NFT.
                </p>
              ) : claimedNftsError ? (
                <p className="mt-4 text-sm font-medium text-red-600">
                  {claimedNftsError}
                </p>
              ) : loadingClaimedNfts ? (
                <p className="mt-4 text-sm text-slate-600">
                  Looking for your Storis NFT...
                </p>
              ) : claimedNfts.length > 0 ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {claimedNfts.map((nft) => (
                    <ClaimedNftCard key={`${nft.tokenId}-${nft.name}`} nft={nft} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  No Storis NFT found yet. Claim rewards after finalization, then refresh.
                </p>
              )}
            </div>
          </section>

        <section className="rounded-[2.5rem] border border-slate-900 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] md:p-8">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-rose-600">
                Story studio
              </p>
              <h2 className="mt-2 text-4xl font-black">
                Strawberrina and Bananino
              </h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                A creator-owned episode where the community decides the next
                chapter and receives proof of participation.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900">
              Episode #{episodeId}
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div>
              <h3 className="text-xl font-semibold mb-3">Part 1</h3>
              <video
                src="/part1.mp4"
                controls
                className="aspect-video w-full rounded-2xl border bg-black object-cover"
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
                  className="aspect-video w-full rounded-2xl border bg-black object-cover"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>

          <div className="mb-8 rounded-2xl border border-slate-200 bg-[#fffaf1] p-5">
          <p className="text-slate-700 mb-4 leading-7">
            Strawberrina looks deeply into Bananino&apos;s eyes and swears to
            him that the baby is, in fact, his. “I love you so much. I would
            never cheat on you again, Bananino, I swear.”
          </p>

          <p className="text-slate-700 leading-7">
            Bananino looks at Strawberrina with deep hurt and a certain kind of
            longing for the early days, when their relationship was perfect and
            before... before he knew what Strawberrina had done. His face twists
            in anguish as he remembers that Limoncello also had a bite of what
            he once thought was only his.
          </p>
          </div>

          <div className="mb-8 rounded-2xl border border-pink-200 bg-pink-50 p-5">
            <h3 className="mb-2 text-xl font-bold">
              Community decides the next chapter
            </h3>
            <p className="text-sm text-slate-600">
              Connect MetaMask on Sepolia and cast one on-chain vote. After the
              episode is finalized, supporters can claim a voter pass NFT and
              STORIS reward.
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

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-lg font-semibold mb-2">Live results</h4>
            {loadingVotes ? (
              <p className="text-slate-600">Loading votes...</p>
            ) : (
              <p className="text-slate-700">
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
              <p className="mt-3 text-sm text-slate-500">Submitting vote...</p>
            )}

          </div>

          <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-lg font-semibold">
                  Generate story continuation
                </h4>
                <p className="text-sm text-slate-600">
                  Use the current winning vote to create the next Storis
                  chapter instantly.
                </p>
              </div>
              <button
                onClick={generateNextEpisode}
                disabled={loadingVotes || generatingStory}
                className="rounded-full bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
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
                  Episode #2
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Based on the community vote: {generatedStory.winner}.{" "}
                  {generatedStory.winnerName}
                </p>
                <div className="mt-4 whitespace-pre-line text-slate-800 leading-7">
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

function WorkflowStep({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-700">
        {title}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function ModuleRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="font-bold">{title}</p>
      <p className="text-right text-sm text-slate-500">{detail}</p>
    </div>
  );
}

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
      className={`rounded-2xl border p-4 text-left transition shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "bg-black text-white border-black"
          : "bg-white hover:-translate-y-1 disabled:hover:translate-y-0"
      }`}
    >
      <Image
        src={image}
        alt={name}
        width={500}
        height={500}
        className="w-full h-64 object-cover object-[center_35%] rounded-xl mb-4 bg-gray-100"
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
