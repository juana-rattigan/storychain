import {
  createPublicClient,
  createWalletClient,
  custom,
  getContract,
  http,
} from "viem";
import { sepolia } from "viem/chains";

export const STORIS_VOTING_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "rewardToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "voterPassNft",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "rewardPerVote",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeId", type: "uint256" },
      { name: "choice", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeEpisode",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeId", type: "uint256" },
      { name: "winner", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRewards",
    stateMutability: "nonpayable",
    inputs: [{ name: "episodeId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getVoteCounts",
    stateMutability: "view",
    inputs: [{ name: "episodeId", type: "uint256" }],
    outputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
      { name: "", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getVoteOf",
    stateMutability: "view",
    inputs: [
      { name: "episodeId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "getEpisode",
    stateMutability: "view",
    inputs: [{ name: "episodeId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "votesA", type: "uint256" },
          { name: "votesB", type: "uint256" },
          { name: "votesC", type: "uint256" },
          { name: "finalized", type: "bool" },
          { name: "winner", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "hasVoted",
    stateMutability: "view",
    inputs: [
      { name: "episodeId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasClaimedRewards",
    stateMutability: "view",
    inputs: [
      { name: "episodeId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const configuredVotingAddress =
  process.env.NEXT_PUBLIC_STORIS_VOTING_CONTRACT;

export const STORIS_VOTING_ADDRESS = /^0x[a-fA-F0-9]{40}$/.test(
  configuredVotingAddress ?? ""
)
  ? (configuredVotingAddress as `0x${string}`)
  : undefined;

const fallbackRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(fallbackRpcUrl),
});

export function getVotingContract() {
  if (!STORIS_VOTING_ADDRESS) {
    throw new Error("NEXT_PUBLIC_STORIS_VOTING_CONTRACT is not configured");
  }

  return getContract({
    address: STORIS_VOTING_ADDRESS,
    abi: STORIS_VOTING_ABI,
    client: publicClient,
  });
}

export async function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  return createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum),
  });
}

export async function ensureSepoliaNetwork() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask is not installed");
  }

  const targetChainId = `0x${sepolia.id.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;

    if (code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: targetChainId,
            chainName: "Sepolia",
            nativeCurrency: {
              name: "Sepolia ETH",
              symbol: "SEP",
              decimals: 18,
            },
            rpcUrls: [fallbackRpcUrl ?? "https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
      return;
    }

    throw error;
  }
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
    };
  }
}
