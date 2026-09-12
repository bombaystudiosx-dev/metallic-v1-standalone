import type { Conversation, Snapshot } from './types';

const CONVERSATIONS = 'metallic.conversations.v1';
const SNAPSHOTS = 'metallic.snapshots.v1';

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
}

export const conversationStore = {
  all: () => read<Conversation[]>(CONVERSATIONS, []),
  save(items: Conversation[]) { localStorage.setItem(CONVERSATIONS, JSON.stringify(items)); },
};

export const snapshotStore = {
  all: () => read<Snapshot[]>(SNAPSHOTS, []),
  save(items: Snapshot[]) { localStorage.setItem(SNAPSHOTS, JSON.stringify(items)); },
};
