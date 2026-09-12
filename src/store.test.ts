import { beforeEach, describe, expect, it } from 'vitest';
import { conversationStore, snapshotStore } from './store';

describe('local stores', () => {
  beforeEach(() => localStorage.clear());
  it('persists conversations', () => {
    const item = { id: '1', title: 'Hello', messages: [], createdAt: 'now', updatedAt: 'now' };
    conversationStore.save([item]);
    expect(conversationStore.all()).toEqual([item]);
  });
  it('recovers from malformed data', () => {
    localStorage.setItem('metallic.snapshots.v1', '{broken');
    expect(snapshotStore.all()).toEqual([]);
  });
});
