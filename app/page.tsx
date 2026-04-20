"use client";

import { useState } from "react";

export default function Home() {
  const [wallet, setWallet] = useState("");

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

  return (
    <main className="min-h-screen bg-white text-black p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">StoryChain</h1>
        <p className="text-lg mb-6">
          A blockchain storytelling platform where the you decide what
          happens next.
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
            Sherlock Holmes: The Next Chapter
          </h2>

          <p className="mb-6">
            Holmes stared at the letter by candlelight. The wax seal bore a mark
            he had not seen since the Moriarty affair. Watson reached for his
            revolver as footsteps echoed outside Baker Street.
          </p>

          <h3 className="text-xl font-semibold mb-3">Choose the next branch:</h3>

          <div className="space-y-4">
            <button className="w-full text-left border rounded-lg p-4 hover:bg-gray-50">
              A. Holmes discovers the letter was sent by Moriarty’s hidden ally.
            </button>

            <button className="w-full text-left border rounded-lg p-4 hover:bg-gray-50">
              B. Watson opens the door and finds Inspector Lestrade wounded.
            </button>

            <button className="w-full text-left border rounded-lg p-4 hover:bg-gray-50">
              C. The lights go out, and the letter vanishes from the table.
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}