export type Mode = 'genius' | 'taboo' | 'rated';
export type WorkloadKind = 'music' | 'image_batch' | 'story' | 'website' | 'research' | 'general';
export type TaskStep = { id: string; title: string; detail: string; kind: string; status: 'pending' | 'running' | 'completed' | 'failed'; attempts: number };
export type TaskArtifact = { id: string; name: string; path: string; mediaType: string; size: number; createdAt: string };
export type MV1Task = { id: string; title: string; goal: string; kind: WorkloadKind; capability: { label: string; icon: string; outputs: string[]; provider: string | null }; status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'; progress: number; plan: TaskStep[]; artifacts: TaskArtifact[]; events: { id: string; at: string; type: string; message: string }[]; waitingFor?: { type: string; capability: string; env: string; message: string } | null; error?: string; updatedAt: string };
export type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; taskId?: string };
export type Conversation = { id: string; title: string; messages: Message[]; createdAt: string; updatedAt: string };
export type Snapshot = { id: string; name: string; language: string; code: string; createdAt: string };
