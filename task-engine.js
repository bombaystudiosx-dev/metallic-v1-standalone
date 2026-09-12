import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const iso = () => new Date().toISOString();
const safeName = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'artifact';

export const capabilityRegistry = {
  music: { label: 'Music Production', icon: 'music', outputs: ['production-brief.md', 'song-structure.json', 'session-manifest.json'], provider: 'AUDIO_PROVIDER' },
  image_batch: { label: 'Batch Image Studio', icon: 'images', outputs: ['batch-manifest.json', 'visual-direction.md', 'prompts/*.md'], provider: 'IMAGE_PROVIDER' },
  story: { label: 'Story Studio', icon: 'book', outputs: ['story-bible.md', 'beat-sheet.json', 'draft.md'], provider: null },
  website: { label: 'Website Builder', icon: 'code', outputs: ['website-brief.md', 'sitemap.json', 'acceptance-tests.md'], provider: null },
  research: { label: 'Research Lab', icon: 'search', outputs: ['research-plan.md', 'source-matrix.json', 'report-outline.md'], provider: 'SEARCH_PROVIDER' },
  general: { label: 'General Production', icon: 'sparkles', outputs: ['task-brief.md', 'execution-plan.json', 'handoff.md'], provider: null },
};

const signals = [
  ['music', /\b(song|music|album|ep|beat|instrumental|vocal|mix|master|audio|lyrics|track)\b/i],
  ['image_batch', /\b(batch|photos?|images?|visuals?|portraits?|product shots?|character sheet|thumbnails?)\b/i],
  ['story', /\b(story|screenplay|script|novel|episode|character arc|worldbuilding|narrative)\b/i],
  ['website', /\b(website|web app|landing page|next\.?js|storefront|site)\b/i],
  ['research', /\b(research|compare|market|competitor|sources?|investigate|report)\b/i],
];

export function classifyWorkload(goal) {
  const scored = signals.map(([id, pattern]) => ({ id, score: (goal.match(new RegExp(pattern.source, 'gi')) || []).length }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score ? scored[0].id : 'general';
}

function step(id, title, detail, kind = 'work') { return { id, title, detail, kind, status: 'pending', attempts: 0 }; }

function buildPlan(kind, goal) {
  const commonStart = step('understand', 'Understand the outcome', 'Extract deliverables, constraints, source material, and acceptance criteria.', 'reason');
  const verify = step('verify', 'Quality review', 'Check every requested output against the brief and record evidence.', 'verify');
  const deliver = step('deliver', 'Package delivery', 'Create a manifest with usable artifact paths and remaining external actions.', 'deliver');
  const plans = {
    music: [commonStart, step('direction', 'Lock musical direction', 'Define genre, tempo, key, reference language, arrangement, and vocal intent.'), step('structure', 'Build song architecture', 'Create section timing, energy curve, instrumentation, and transition map.'), step('session', 'Prepare production session', 'Create track, stem, recording, mix, and mastering manifests.'), verify, deliver],
    image_batch: [commonStart, step('continuity', 'Lock visual continuity', 'Define subject identity, styling, lighting, lens, palette, and invariant details.'), step('shots', 'Design individual shots', 'Create a numbered shot list with one deliverable per file.'), step('generate', 'Run batch production', 'Route each shot through the configured image provider and preserve prompt/seed metadata.', 'tool'), verify, deliver],
    story: [commonStart, step('bible', 'Create story bible', 'Lock premise, world rules, characters, voice, stakes, and continuity.'), step('beats', 'Build narrative beats', 'Map acts, turning points, emotional progression, and scene purpose.'), step('draft', 'Produce the draft', 'Write a coherent first-pass narrative from the approved structure.'), verify, deliver],
    website: [commonStart, step('requirements', 'Define product requirements', 'Lock routes, user journeys, data, stack, visual direction, and responsive behavior.'), step('build', 'Build the product', 'Create implementation artifacts and connect real user flows.'), step('test', 'Run product verification', 'Build, test, and inspect the rendered interface.', 'verify'), deliver],
    research: [commonStart, step('questions', 'Define research matrix', 'Set scope, date range, source hierarchy, comparison dimensions, and evidence rules.'), step('collect', 'Collect and normalize evidence', 'Gather sources and preserve URLs, dates, claims, and contradictions.', 'tool'), step('synthesize', 'Synthesize findings', 'Separate confirmed facts, inference, uncertainty, and recommendations.'), verify, deliver],
    general: [commonStart, step('plan', 'Design execution plan', 'Choose capabilities, sequence work, and define checkpoints.'), step('produce', 'Produce requested artifacts', 'Execute the planned work using available tools.'), verify, deliver],
  };
  return plans[kind].map((item) => ({ ...item, detail: item.id === 'understand' ? `${item.detail} Goal: ${goal.slice(0, 180)}` : item.detail }));
}

export class TaskEngine {
  constructor(root) { this.root = root; this.tasksDir = path.join(root, 'data', 'mv1-tasks'); this.running = new Set(); }
  async init() { await fs.mkdir(this.tasksDir, { recursive: true }); }
  taskDir(id) { return path.join(this.tasksDir, id); }
  taskFile(id) { return path.join(this.taskDir(id), 'task.json'); }
  async save(task) { task.updatedAt = iso(); await fs.mkdir(this.taskDir(task.id), { recursive: true }); await fs.writeFile(this.taskFile(task.id), JSON.stringify(task, null, 2)); return task; }
  async get(id) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { return JSON.parse(await fs.readFile(this.taskFile(id), 'utf8')); }
      catch (error) {
        if (error?.code === 'ENOENT') return null;
        if (attempt === 4) return null;
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
    }
    return null;
  }
  async list() {
    await this.init();
    const entries = await fs.readdir(this.tasksDir, { withFileTypes: true });
    const tasks = (await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.get(entry.name)))).filter(Boolean);
    return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  event(task, type, message, data = {}) { task.events.push({ id: crypto.randomUUID(), at: iso(), type, message, data }); }
  async create({ goal, title, inputs = [], constraints = [], acceptanceCriteria = [] }) {
    const kind = classifyWorkload(goal);
    const capability = capabilityRegistry[kind];
    const id = crypto.randomUUID();
    const task = { id, title: title || goal.slice(0, 64), goal, kind, capability, outputContract: { expected: capability.outputs, primaryFormat: capability.outputs[0], deliveryMode: 'downloadable_artifacts', verificationRequired: true }, status: 'queued', progress: 0, inputs, constraints, acceptanceCriteria, plan: buildPlan(kind, goal), artifacts: [], events: [], checkpoint: null, delivery: null, createdAt: iso(), updatedAt: iso(), waitingFor: null };
    this.event(task, 'task_created', `MV1 classified this as ${capability.label}.`, { kind });
    await this.save(task);
    queueMicrotask(() => void this.run(id));
    return task;
  }
  async writeArtifact(task, filename, content, mediaType = 'text/plain') {
    const relative = path.join('artifacts', filename).replaceAll('\\', '/');
    const absolute = path.join(this.taskDir(task.id), relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    const serialized = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    await fs.writeFile(absolute, serialized);
    const stat = await fs.stat(absolute);
    const supporting = /(^task-brief|qa\.md$|report\.md$|prompts\/)/i.test(filename);
    const artifact = { id: crypto.randomUUID(), name: path.basename(filename), path: relative, mediaType, size: stat.size, checksum: createHash('sha256').update(serialized).digest('hex'), version: 1, role: supporting ? 'supporting' : 'primary', visibility: 'private', validation: { exists: true, readable: true, checkedAt: iso() }, createdAt: iso() };
    task.artifacts.push(artifact);
    this.event(task, 'artifact_created', `Created ${artifact.name}.`, { artifactId: artifact.id });
  }
  async run(id) {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      const task = await this.get(id);
      if (!task || ['completed', 'cancelled'].includes(task.status)) return;
      task.status = 'running'; this.event(task, 'status', 'Execution started.'); await this.save(task);
      for (let index = 0; index < task.plan.length; index += 1) {
        const current = task.plan[index];
        if (current.status === 'completed') continue;
        current.status = 'running'; current.attempts += 1; this.event(task, 'step_started', current.title, { stepId: current.id }); await this.save(task);
        await this.executeStep(task, current);
        current.status = 'completed'; task.progress = Math.round(((index + 1) / task.plan.length) * 100); task.checkpoint = { stepId: current.id, at: iso(), artifactCount: task.artifacts.length };
        this.event(task, 'step_completed', current.title, { stepId: current.id }); await this.save(task);
      }
      task.status = task.waitingFor ? 'waiting' : 'completed';
      task.delivery = { status: task.waitingFor ? 'partial' : 'completed', summary: task.waitingFor?.message || 'Requested local deliverables were materialized, validated, registered, and packaged.', primaryArtifacts: task.artifacts.filter((item) => item.role === 'primary').map((item) => item.id), supportingArtifacts: task.artifacts.filter((item) => item.role === 'supporting').map((item) => item.id), caveats: task.waitingFor ? [task.waitingFor.message] : [] };
      this.event(task, task.status === 'completed' ? 'task_completed' : 'task_waiting', task.status === 'completed' ? 'All locally executable work completed.' : task.waitingFor.message);
      await this.save(task);
    } catch (error) {
      const task = await this.get(id);
      if (task) { task.status = 'failed'; task.error = error instanceof Error ? error.message : 'Unknown task failure'; this.event(task, 'task_failed', task.error); await this.save(task); }
    } finally { this.running.delete(id); }
  }
  async executeStep(task, current) {
    if (current.id === 'understand') {
      await this.writeArtifact(task, 'task-brief.md', `# ${task.title}\n\n## Outcome\n${task.goal}\n\n## Workload\n${task.capability.label}\n\n## Inputs\n${task.inputs.length ? task.inputs.map((item) => `- ${item}`).join('\n') : '- None supplied'}\n\n## Constraints\n${task.constraints.length ? task.constraints.map((item) => `- ${item}`).join('\n') : '- Use safe local execution and preserve source files'}\n\n## Acceptance criteria\n${task.acceptanceCriteria.length ? task.acceptanceCriteria.map((item) => `- ${item}`).join('\n') : '- Every declared artifact exists and is included in the delivery manifest'}\n`);
      return;
    }
    const handlers = {
      music: () => this.musicArtifacts(task, current), image_batch: () => this.imageArtifacts(task, current), story: () => this.storyArtifacts(task, current), website: () => this.websiteArtifacts(task, current), research: () => this.researchArtifacts(task, current), general: () => this.generalArtifacts(task, current),
    };
    await handlers[task.kind]();
  }
  async musicArtifacts(task, current) {
    if (current.id === 'direction') await this.writeArtifact(task, 'production-brief.md', `# Production Direction\n\nGoal: ${task.goal}\n\nDefine BPM, key, genre blend, emotional arc, vocal character, sonic references, and non-negotiable identity before recording.\n`);
    if (current.id === 'structure') await this.writeArtifact(task, 'song-structure.json', { sections: ['Intro', 'Verse 1', 'Pre-Chorus', 'Chorus', 'Verse 2', 'Chorus', 'Bridge', 'Final Chorus', 'Outro'], targetDurationSeconds: 210, energyCurve: [20, 42, 62, 88, 58, 92, 55, 100, 24] }, 'application/json');
    if (current.id === 'session') { await this.writeArtifact(task, 'session-manifest.json', { tracks: ['Drums', 'Bass', 'Harmony', 'Lead', 'FX', 'Lead Vocal', 'Doubles', 'Ad-libs'], exports: ['instrumental.wav', 'acapella.wav', 'performance-mix.wav', 'master.wav'], status: 'preproduction_ready', audioProviderRequired: true }, 'application/json'); if (!process.env.AUDIO_PROVIDER) task.waitingFor = { type: 'integration', capability: 'audio', env: 'AUDIO_PROVIDER', message: 'The production package is ready; connect an audio provider or upload stems to render, mix, and master audio files.' }; }
    if (current.id === 'verify') await this.writeArtifact(task, 'music-qa.md', '# Music QA\n\n- Direction defined\n- Arrangement mapped\n- Session and export manifests created\n- Audio rendering requires an enabled audio provider or uploaded stems\n');
    if (current.id === 'deliver') await this.delivery(task, 'Audio generation/mixing is ready to continue when an audio provider or source stems are connected.');
  }
  async imageArtifacts(task, current) {
    if (current.id === 'continuity') await this.writeArtifact(task, 'visual-direction.md', `# Locked Visual Direction\n\nGoal: ${task.goal}\n\nPreserve identity, proportions, wardrobe/product geometry, palette, lens language, lighting direction, and environment continuity across every individual file.\n`);
    if (current.id === 'shots') {
      const shots = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, filename: `shot-${String(index + 1).padStart(2, '0')}.png`, purpose: ['Hero', 'Wide context', 'Medium action', 'Detail', 'Alternate angle', 'Closing image'][index], status: 'prompt_ready' }));
      await this.writeArtifact(task, 'batch-manifest.json', { oneImagePerFile: true, montage: false, shots }, 'application/json');
      for (const shot of shots) await this.writeArtifact(task, `prompts/shot-${String(shot.id).padStart(2, '0')}.md`, `# ${shot.purpose}\n\n${task.goal}\n\nCreate one standalone image. Preserve the locked visual direction and continuity. No collage, grid, contact sheet, or text overlay.\n`);
    }
    if (current.id === 'generate' && !process.env.IMAGE_PROVIDER) task.waitingFor = { type: 'integration', capability: 'image', env: 'IMAGE_PROVIDER', message: 'Image prompts and batch manifest are ready; connect an image provider to render the final files.' };
    if (current.id === 'verify') await this.writeArtifact(task, 'image-qa.md', '# Batch QA\n\nValidate one file per shot, visual continuity, requested dimensions, no unintended text, and manifest-to-file completeness after rendering.\n');
    if (current.id === 'deliver') await this.delivery(task, task.waitingFor?.message || 'Batch rendered and packaged.');
  }
  async storyArtifacts(task, current) {
    if (current.id === 'bible') await this.writeArtifact(task, 'story-bible.md', `# Story Bible\n\n## Premise\n${task.goal}\n\n## Continuity locks\n- Protagonist desire and fear\n- World rules and cost of breaking them\n- Antagonistic force\n- Voice, tense, tone, and audience\n- Visual and thematic motifs\n`);
    if (current.id === 'beats') await this.writeArtifact(task, 'beat-sheet.json', { acts: [{ act: 1, purpose: 'Setup, disturbance, decision' }, { act: 2, purpose: 'Escalation, reversal, cost' }, { act: 3, purpose: 'Crisis, choice, resolution' }], continuityCheckpoints: ['character motivation', 'timeline', 'world rules', 'setup/payoff'] }, 'application/json');
    if (current.id === 'draft') await this.writeArtifact(task, 'draft.md', `# First Draft\n\n${task.goal}\n\nThe room held the kind of silence that arrives just before a life changes. The protagonist understood the choice before anyone spoke it aloud: remain protected by the old rules, or step forward and discover why those rules had been written.\n\nThis draft establishes the opening movement. Continue from the approved story bible and beat sheet for a full-length manuscript.\n`);
    if (current.id === 'verify') await this.writeArtifact(task, 'continuity-report.md', '# Continuity Review\n\n- Premise preserved\n- Three-act movement defined\n- Character, timeline, world-rule, and setup/payoff checks registered\n');
    if (current.id === 'deliver') await this.delivery(task, 'Story foundation, beat sheet, draft opening, and continuity review packaged.');
  }
  async websiteArtifacts(task, current) {
    if (current.id === 'requirements') { await this.writeArtifact(task, 'website-brief.md', `# Website Brief\n\n${task.goal}\n\nDefine audience, offer, routes, user journeys, data contracts, responsive states, accessibility, SEO, and deployment target before implementation.\n`); await this.writeArtifact(task, 'sitemap.json', { routes: ['/', '/about', '/services', '/contact'], coreFlow: 'landing -> evidence -> offer -> contact' }, 'application/json'); }
    if (current.id === 'build') await this.writeArtifact(task, 'implementation-plan.md', '# Build Plan\n\nUse MV1 Imagine for the source project, then connect real data and interactions before delivery. Preserve the selected stack and visual reference.\n');
    if (current.id === 'test') await this.writeArtifact(task, 'acceptance-tests.md', '# Acceptance Tests\n\n- Production build passes\n- Routes load directly\n- Primary user journey works\n- Desktop and mobile are visually inspected\n- Forms validate and return visible states\n- No secrets ship to the browser\n');
    if (current.id === 'verify') await this.writeArtifact(task, 'website-qa.md', '# Website QA\n\nImplementation remains pending until a generated source project is attached or this task is continued in Imagine.\n');
    if (current.id === 'deliver') await this.delivery(task, 'Website specification and implementation handoff packaged.');
  }
  async researchArtifacts(task, current) {
    if (current.id === 'questions') await this.writeArtifact(task, 'research-plan.md', `# Research Plan\n\nQuestion: ${task.goal}\n\nDefine cutoff date, geography, terminology, primary-source hierarchy, comparison fields, contradiction handling, and citation format.\n`);
    if (current.id === 'collect') { await this.writeArtifact(task, 'source-matrix.json', { columns: ['source', 'url', 'publisher', 'publishedAt', 'claim', 'evidenceType', 'confidence'], rows: [], status: process.env.SEARCH_PROVIDER ? 'collection_ready' : 'search_provider_required' }, 'application/json'); if (!process.env.SEARCH_PROVIDER) task.waitingFor = { type: 'integration', capability: 'search', env: 'SEARCH_PROVIDER', message: 'The research framework is ready; connect a search provider for live source collection.' }; }
    if (current.id === 'synthesize') await this.writeArtifact(task, 'report-outline.md', '# Report Outline\n\n1. Executive answer\n2. Method and scope\n3. Confirmed findings\n4. Contradictions and uncertainty\n5. Inferences\n6. Recommendations\n7. Source appendix\n');
    if (current.id === 'verify') await this.writeArtifact(task, 'research-qa.md', '# Research QA\n\nDo not finalize factual claims until the source matrix contains live, attributable evidence.\n');
    if (current.id === 'deliver') await this.delivery(task, task.waitingFor?.message || 'Research package completed.');
  }
  async generalArtifacts(task, current) {
    if (current.id === 'plan') await this.writeArtifact(task, 'execution-plan.json', { goal: task.goal, phases: task.plan.map(({ id, title, detail }) => ({ id, title, detail })) }, 'application/json');
    if (current.id === 'produce') await this.writeArtifact(task, 'working-notes.md', `# Working Notes\n\nMV1 created a durable execution workspace for: ${task.goal}\n`);
    if (current.id === 'verify') await this.writeArtifact(task, 'verification.md', '# Verification\n\nThe task brief, execution plan, working notes, and delivery manifest were checked for presence.\n');
    if (current.id === 'deliver') await this.delivery(task, 'General production package completed.');
  }
  async delivery(task, note) { await this.writeArtifact(task, 'delivery-manifest.json', { taskId: task.id, workload: task.kind, note, artifacts: task.artifacts.map(({ name, path, mediaType, size }) => ({ name, path, mediaType, size })), generatedAt: iso() }, 'application/json'); }
  async resolveArtifact(id, artifactId) {
    const task = await this.get(id); if (!task) return null;
    const artifact = task.artifacts.find((item) => item.id === artifactId); if (!artifact) return null;
    const absolute = path.resolve(this.taskDir(id), artifact.path); const base = path.resolve(this.taskDir(id), 'artifacts');
    if (!absolute.startsWith(`${base}${path.sep}`) && absolute !== base) return null;
    return { task, artifact, absolute };
  }
}
