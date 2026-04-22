export type VoteOption = "A" | "B" | "C";

export type VoteCounts = {
  A: number;
  B: number;
  C: number;
};

type VoteSelections = Record<number, Record<string, VoteOption>>;

const globalForStoryVotes = globalThis as typeof globalThis & {
  storyVotes?: Record<number, VoteCounts>;
  storySelections?: VoteSelections;
};

export const votesStore =
  globalForStoryVotes.storyVotes ?? (globalForStoryVotes.storyVotes = {});

export const selectionsStore =
  globalForStoryVotes.storySelections ??
  (globalForStoryVotes.storySelections = {});

export function getEmptyVotes(): VoteCounts {
  return { A: 0, B: 0, C: 0 };
}

export function parseEpisodeId(value: string | null): number | null {
  if (!value) return null;

  const episodeId = Number(value);

  if (!Number.isInteger(episodeId) || episodeId <= 0) {
    return null;
  }

  return episodeId;
}

export function normalizeWallet(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const wallet = value.trim().toLowerCase();
  return wallet ? wallet : null;
}

export function isVoteOption(value: unknown): value is VoteOption {
  return value === "A" || value === "B" || value === "C";
}
