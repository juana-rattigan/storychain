"use client";

import { useState } from "react";

export default function Home() {
  const [wallet, setWallet] = useState("");
  const[selected, setSelected] = useState("");
  const[votes, setVotes] = useState ({
    A:0,
    B:0,
    C:0,
  });

  async function connectWallet() {
    if (!(window as any).ethereum) {
      alert("MetaMask is not installed");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      setWallet(accounts[0]);
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed");
    }
  }
 function vote(option: "A" | "B" | "C") {
    if (selected) {
      alert("You already voted.");
      return;
    }

    setVotes((prev) => ({
      ...prev,
      [option]: prev[option] + 1,
    }));

    setSelected(option);
  }

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">StoryChain</h1>
        <p className="text-lg mb-6">
          A blockchain storytelling platform where you decide what happens next.
        </p>

        <button
          onClick={connectWallet}
          className="bg-black text-white px-5 py-3 rounded-lg mb-6"
        >
          Connect Wallet
        </button>

        {wallet && (
          <p className="mb-8 break-all">
            <strong>Connected wallet:</strong> {wallet}
          </p>
        )}

        <div className="border rounded-xl p-6 shadow-sm">
          <h2 className="text-2xl font-semibold mb-3">
            Strawberrina and Bananino: The Next Part
          </h2>

          <p className="mb-6">
            Strawberrina looks deeply into Bananino&apos;s eyes and swears to him
            that the baby is, in fact, his. “I love you so much. I would never
            cheat on you again, Bananino, I swear.”
          </p>

          <p className="mb-6">
            Bananino looks at Strawberrina with deep hurt and a certain kind of
            longing for the early days, when their relationship was perfect and
            before... before he knew what Strawberrina had done. His face twists
            in anguish as he remembers that Limoncello also had a bite of what
            he once thought was only his.
          </p>

          <h3 className="text-xl font-semibold mb-3">Choose the baby daddy:</h3>

          <div className="space-y-4">
            <button
              onClick={() => vote("A")}
              className={`w-full text-left border rounded-lg p-4 ${
                selected === "A" ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              A. Bananino
              <div className="text-sm mt-2">Votes: {votes.A}</div>
            </button>

            <button
              onClick={() => vote("B")}
              className={`w-full text-left border rounded-lg p-4 ${
                selected === "B" ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              B. Limoncello
              <div className="text-sm mt-2">Votes: {votes.B}</div>
            </button>

            <button
              onClick={() => vote("C")}
              className={`w-full text-left border rounded-lg p-4 ${
                selected === "C" ? "bg-black text-white" : "hover:bg-gray-50"
              }`}
            >
              C. Manganello
              <div className="text-sm mt-2">Votes: {votes.C}</div>
            </button>
          </div>

          {selected && (
            <p className="mt-6 font-semibold">
              You voted for option {selected}.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

