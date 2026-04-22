"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

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

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [selected, setSelected] = useState("");
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

  const episodeId = 1;

  useEffect(() => {
    loadVotes();
  }, []);

  async function connectWallet() {
    if (!(window as any).ethereum) {
      alert("MetaMask is not installed");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });

      const connectedWallet = accounts[0];
      setWallet(connectedWallet);

      await checkExistingVote(connectedWallet);
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed");
    }
  }

  async function checkExistingVote(walletAddress: string) {
    try {
      const res = await fetch(
        `/api/vote-status?episodeId=${episodeId}&wallet=${walletAddress}`
      );
      const data = await res.json();

      if (res.ok && data.selected) {
        setSelected(data.selected);
      }
    } catch (error) {
      console.error("Failed to check existing vote:", error);
    }
  }

  async function loadVotes() {
    try {
      setLoadingVotes(true);

      const res = await fetch(`/api/results?episodeId=${episodeId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load votes");
      }

      setVotes({
        A: data.votes.A || 0,
        B: data.votes.B || 0,
        C: data.votes.C || 0,
      });
    } catch (error) {
      console.error(error);
      alert("Could not load vote totals");
    } finally {
      setLoadingVotes(false);
    }
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

      const res = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          episodeId,
          wallet,
          choiceKey: option,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Vote failed");
        return;
      }

      setSelected(option);
      await loadVotes();
    } catch (error) {
      console.error(error);
      alert("Vote failed");
    } finally {
      setSubmittingVote(false);
    }
  }

  async function generateNextStory() {
    try {
      setGeneratingStory(true);
      setStoryError("");

      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ episodeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate the next story");
      }

      setGeneratedStory(data);
    } catch (error) {
      console.error(error);
      setStoryError(
        error instanceof Error
          ? error.message
          : "Failed to generate the next story"
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
          <h1 className="text-5xl font-extrabold mb-4">StoryChain</h1>
          <p className="text-lg max-w-2xl mx-auto text-gray-600">
            A community-driven storytelling platform where users connect their
            wallet, vote on the next plot twist, and shape the future of the story.
          </p>

          <div className="mt-6">
            <button
              onClick={connectWallet}
              className="bg-black text-white px-6 py-3 rounded-full font-medium hover:opacity-90 transition"
            >
              {wallet ? "Wallet Connected" : "Connect Wallet"}
            </button>
          </div>

          {wallet && (
            <p className="mt-4 text-sm text-gray-600 break-all">
              <strong>Connected wallet:</strong> {wallet}
            </p>
          )}
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

        <section className="bg-white rounded-3xl shadow-lg border p-8 mb-10">
          <h2 className="text-3xl font-bold mb-4">
            Strawberrina and Bananino: The Next Part
          </h2>

          <p className="text-gray-700 mb-4 leading-7">
            Strawberrina looks deeply into Bananino&apos;s eyes and swears to him
            that the baby is, in fact, his. “I love you so much. I would never
            cheat on you again, Bananino, I swear.”
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
              Connect your wallet and cast one vote. Each wallet can vote once.
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
              disabled={submittingVote}
              onVote={vote}
            />

            <VoteCard
              option="B"
              name="Limoncello"
              image="/limoncello.jpg"
              votes={votes.B}
              percentage={getPercentage(votes.B)}
              selected={selected === "B"}
              disabled={submittingVote}
              onVote={vote}
            />

            <VoteCard
              option="C"
              name="Manganello"
              image="/manganello.jpg"
              votes={votes.C}
              percentage={getPercentage(votes.C)}
              selected={selected === "C"}
              disabled={submittingVote}
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

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={generateNextStory}
                disabled={generatingStory || loadingVotes || totalVotes === 0}
                className="bg-pink-600 text-white px-5 py-3 rounded-full font-medium transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingStory ? "Generating..." : "Generate Next Story"}
              </button>
              <p className="text-sm text-gray-500">
                Generates episode #{episodeId + 1} from the current vote winner.
              </p>
            </div>

            {storyError && (
              <p className="mt-4 text-sm font-medium text-red-600">
                {storyError}
              </p>
            )}
          </div>

          {generatedStory && (
            <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-yellow-700">
                Generated Episode
              </p>
              <h4 className="mt-2 text-2xl font-bold text-gray-900">
                Episode #{generatedStory.episodeId}
              </h4>
              <p className="mt-2 text-sm text-gray-600">
                Based on the winning vote: {generatedStory.winner}.{" "}
                {generatedStory.winnerName}
              </p>
              <div className="mt-4 whitespace-pre-wrap text-gray-800 leading-7">
                {generatedStory.story}
              </div>
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">1. Connect Wallet</h5>
            <p className="text-sm text-gray-600">
              Users connect MetaMask to participate in the story.
            </p>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">2. Vote on the Plot</h5>
            <p className="text-sm text-gray-600">
              The community decides what happens next by voting on story outcomes.
            </p>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <h5 className="font-semibold mb-2">3. Story Evolves</h5>
            <p className="text-sm text-gray-600">
              The winning option becomes the next episode of the StoryChain universe.
            </p>
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
