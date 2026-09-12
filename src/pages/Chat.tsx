import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, Bookmark, Box, Brain, Check, ChevronDown, CircleHelp, Code2, Copy,
  Database, Download, FileText, Image, ListTodo, MessageCircle, Music2, Paperclip,
  Plus, RefreshCw, Search, Send, SlidersHorizontal, Sparkles, Trash2, UserRound, X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { conversationStore } from '../store';
import type { Conversation, Message, Mode, MV1Task, WorkloadKind } from '../types';

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const SYSTEM_KEY = 'metallic.system-prompt.v1';
const defaultSystem = 'You are MV1, a capable AI operating system. Be accurate, actionable, concise, and honest about uncertainty.';
const presets = [
  ['Music production', 'Create a dark cinematic R&B song production package with a complete arrangement, vocal plan, session manifest, and final export checklist.'],
  ['Batch image studio', 'Create a batch of six individual premium campaign images with locked character continuity, a shot manifest, and one prompt per file.'],
  ['Story studio', 'Build a cinematic story bible, character arcs, three-act beat sheet, opening draft, and continuity review.'],
  ['Website production', 'Build a premium Next.js website with real routes, responsive behavior, working forms, QA, and client handoff.'],
  ['Research lab', 'Research this market using attributable sources, a comparison matrix, contradiction handling, and evidence-backed recommendations.'],
];

const productionIntent = /\b(create|make|build|produce|generate|design|write|research|batch|mix|master|develop|compose|storyboard)\b/i;
const workloadIcons: Record<WorkloadKind, typeof Sparkles> = { music: Music2, image_batch: Image, story: FileText, website: Code2, research: Search, general: Sparkles };

function TaskCard({ task }: { task: MV1Task }) {
  const Icon = workloadIcons[task.kind] || Sparkles;
  return <section className={`mv1-task-card ${task.status}`}>
    <header><span><Icon /><strong>{task.capability.label}</strong></span><em>{task.status.replace('_', ' ')}</em></header>
    <div className="mv1-task-progress"><i style={{ width: `${task.progress}%` }} /></div>
    <div className="mv1-task-plan">{task.plan.map((item) => <div className={item.status} key={item.id}><span>{item.status === 'completed' ? <Check /> : <ListTodo />}</span><p><strong>{item.title}</strong><small>{item.detail}</small></p></div>)}</div>
    {task.waitingFor && <aside>{task.waitingFor.message}</aside>}
    {!!task.artifacts.length && <footer>{task.artifacts.map((artifact) => <a key={artifact.id} href={`/api/tasks/${task.id}/artifacts/${artifact.id}`}><Download />{artifact.name}</a>)}</footer>}
  </section>;
}

function emptyConversation(): Conversation {
  const date = now();
  return { id: uid(), title: 'Untitled conversation', messages: [], createdAt: date, updatedAt: date };
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Chat() {
  const initial = useMemo(() => conversationStore.all(), []);
  const [conversations, setConversations] = useState<Conversation[]>(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id || '');
  const [mode, setMode] = useState<Mode>('genius');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState<'history' | 'prompts' | 'system' | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem(SYSTEM_KEY) || defaultSystem);
  const [attached, setAttached] = useState('');
  const [attachedContent, setAttachedContent] = useState('');
  const [copied, setCopied] = useState('');
  const [tasks, setTasks] = useState<Record<string, MV1Task>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const active = conversations.find((item) => item.id === activeId);

  useEffect(() => { conversationStore.save(conversations); }, [conversations]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages, busy]);
  useEffect(() => {
    fetch('/api/health').then((response) => response.json()).then((data) => {
      setConnected(true);
      setAiConfigured(Boolean(data.configured));
    }).catch(() => { setConnected(false); setAiConfigured(false); });
  }, []);

  useEffect(() => {
    fetch('/api/tasks').then((response) => response.json()).then((data) => setTasks(Object.fromEntries((data.tasks || []).map((task: MV1Task) => [task.id, task])))).catch(() => undefined);
  }, []);

  const waitForTask = async (taskId: string) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await fetch(`/api/tasks/${taskId}`);
      if (!response.ok) throw new Error('MV1 lost the task state.');
      const data = await response.json() as { task: MV1Task };
      setTasks((current) => ({ ...current, [taskId]: data.task }));
      if (['completed', 'waiting', 'failed'].includes(data.task.status)) return data.task;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    throw new Error('The task is still running. Its durable state is saved and can be reopened.');
  };

  const newChat = () => {
    const next = emptyConversation();
    setConversations((items) => [next, ...items]);
    setActiveId(next.id);
    setInput('');
    setNotice('');
    setPanel(null);
  };

  const remove = (id: string) => {
    const next = conversations.filter((item) => item.id !== id);
    setConversations(next);
    if (activeId === id) setActiveId(next[0]?.id || '');
  };

  const sendMessage = async (content: string, target = active) => {
    if (!content.trim() || busy) return;
    const conversation = target || emptyConversation();
    const userMessage: Message = { id: uid(), role: 'user', content: content.trim(), createdAt: now() };
    const base = {
      ...conversation,
      title: conversation.messages.length ? conversation.title : content.trim().slice(0, 48),
      updatedAt: now(),
      messages: [...conversation.messages, userMessage],
    };
    setActiveId(base.id);
    setConversations((items) => [base, ...items.filter((item) => item.id !== base.id)]);
    setInput('');
    setAttached('');
    setAttachedContent('');
    setBusy(true);
    setNotice('');
    try {
      if (productionIntent.test(content)) {
        const response = await fetch('/api/tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: content, inputs: attached ? [attached] : [], constraints: ['Preserve supplied source material', 'Produce individually usable artifacts'], acceptanceCriteria: ['Every declared artifact exists', 'Delivery manifest identifies blockers and next actions'] }),
        });
        const created = await response.json();
        if (!response.ok) throw new Error(created.error || 'Could not create the production task.');
        setTasks((current) => ({ ...current, [created.task.id]: created.task }));
        const completed = await waitForTask(created.task.id);
        const summary = completed.status === 'completed'
          ? `${completed.capability.label} finished. I created ${completed.artifacts.length} durable artifacts and verified the local production package.`
          : completed.status === 'waiting'
            ? `${completed.capability.label} completed everything available locally and reached an integration checkpoint. ${completed.waitingFor?.message}`
            : `${completed.capability.label} stopped with an error: ${completed.error || 'Unknown failure.'}`;
        const assistant: Message = { id: uid(), role: 'assistant', content: summary, createdAt: now(), taskId: completed.id };
        setConversations((items) => items.map((item) => item.id === base.id ? { ...item, messages: [...item.messages, assistant], updatedAt: now() } : item));
        return;
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          messages: [{ role: 'system', content: systemPrompt }, ...base.messages.map(({ role, content: text }) => ({ role, content: text }))],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed.');
      const assistant: Message = { id: uid(), role: 'assistant', content: data.text, createdAt: now() };
      setConversations((items) => items.map((item) => item.id === base.id ? { ...item, messages: [...item.messages, assistant], updatedAt: now() } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not reach the AI service.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(attached ? `${input}\n\nAttached file: ${attached}\n\n${attachedContent}` : input);
  };

  const regenerate = () => {
    if (!active) return;
    const lastUser = [...active.messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return;
    const index = active.messages.findIndex((message) => message.id === lastUser.id);
    const trimmed = { ...active, messages: active.messages.slice(0, index) };
    setConversations((items) => items.map((item) => item.id === active.id ? trimmed : item));
    void sendMessage(lastUser.content, trimmed);
  };

  const attachFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAttached(file.name);
    setAttachedContent((await file.text()).slice(0, 24000));
  };

  return (
    <main className="official-shell">
      <header className="official-header">
        <button className="official-brand" onClick={newChat} aria-label="MV1 home">
          <span>MV<span>1</span></span>
          <small>AI OPERATING SYSTEM</small>
        </button>
        <nav className="official-top-nav" aria-label="Primary navigation">
          <button className="active" onClick={newChat}>NEW CHAT</button>
          <Link to="/Imagine">IMAGINE</Link>
          <Link to="/RemoteAgent">AGENTS</Link>
          <Link to="/RemoteAgent">AUTOMATIONS</Link>
          <Link to="/APIPlayground">DATA FLOW</Link>
          <Link to="/IDEIntegration">INTEGRATIONS</Link>
          <button onClick={() => setPanel('system')}>SYSTEM</button>
        </nav>
        <div className="official-header-tools">
          <label className="official-mode">
            <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} aria-label="AI mode">
              <option value="genius">Genius</option>
              <option value="taboo">Taboo</option>
              <option value="rated">Rated R</option>
            </select>
            <ChevronDown size={15} />
          </label>
          <span className={`official-connection ${connected ? 'online' : ''}`}><i />{connected ? 'Connected' : 'Local mode'}</span>
          <button className="official-settings" onClick={() => setPanel(panel === 'system' ? null : 'system')} aria-label="Open system settings"><SlidersHorizontal size={21} /></button>
        </div>
      </header>

      <nav className="official-rail" aria-label="MV1 tools">
        <div className="official-rail-main">
          <button className="active" onClick={() => setPanel(panel === 'history' ? null : 'history')} aria-label="Chats"><MessageCircle /></button>
          <button onClick={newChat} aria-label="New chat"><Plus /></button>
          <button onClick={() => setPanel(panel === 'prompts' ? null : 'prompts')} aria-label="AI prompts"><Brain /></button>
          <Link to="/RemoteAgent" aria-label="Agents"><Box /></Link>
          <Link to="/Coder" aria-label="Coder"><Code2 /></Link>
          <Link to="/APIPlayground" aria-label="Data flow"><Database /></Link>
          <button onClick={() => downloadJson('mv1-conversations.json', conversations)} aria-label="Export conversations"><Bookmark /></button>
        </div>
        <div className="official-rail-bottom">
          <button onClick={() => setNotice('You are all caught up.')} aria-label="Notifications"><Bell /></button>
          <button onClick={() => setNotice('Enter sends. Shift + Enter creates a new line.')} aria-label="Help"><CircleHelp /></button>
          <button className="official-avatar" onClick={() => setPanel('system')} aria-label="Profile">JD</button>
        </div>
      </nav>

      <section className="official-stage">
        {!!active?.messages.length && (
          <div className="official-thread">
            {active.messages.map((message) => (
              <article key={message.id} className={`official-message ${message.role}`}>
                <div className="official-message-avatar">{message.role === 'user' ? <UserRound size={17} /> : 'M'}</div>
                <div>
                  <header><strong>{message.role === 'user' ? 'You' : 'MV1'}</strong><time>{formatTime(message.createdAt)}</time></header>
                  <p>{message.content}</p>
                  {message.taskId && tasks[message.taskId] && <TaskCard task={tasks[message.taskId]} />}
                  <footer>
                    <button onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(message.id); setTimeout(() => setCopied(''), 1200); }}>
                      {copied === message.id ? <Check size={14} /> : <Copy size={14} />}{copied === message.id ? 'Copied' : 'Copy'}
                    </button>
                    {message.role === 'assistant' && <button onClick={regenerate}><RefreshCw size={14} />Regenerate</button>}
                  </footer>
                </div>
              </article>
            ))}
            {busy && <div className="official-thinking"><i /><i /><i /></div>}
            <div ref={endRef} />
          </div>
        )}

        <form className="official-composer" onSubmit={submit}>
          {notice && <div className="official-notice"><span>{notice}</span><button type="button" onClick={() => setNotice('')}><X size={14} /></button></div>}
          {attached && <div className="official-attachment"><FileText size={14} />{attached}<button type="button" onClick={() => { setAttached(''); setAttachedContent(''); }}><X size={12} /></button></div>}
          <button className="official-attach" type="button" onClick={() => attachRef.current?.click()} aria-label="Attach a file"><Paperclip size={21} /></button>
          <input ref={attachRef} hidden type="file" accept="text/*,.json,.md,.csv" onChange={attachFile} />
          <textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask MV1 anything..." rows={1} aria-label="Message MV1" />
          <button className="official-send" disabled={!input.trim() || busy} aria-label="Send message"><Send size={21} /></button>
        </form>
      </section>

      {panel && <button className="official-scrim" onClick={() => setPanel(null)} aria-label="Close panel" />}
      {panel === 'history' && (
        <aside className="official-panel official-history">
          <header><div><small>WORKSPACE</small><h2>Conversations</h2></div><button onClick={() => setPanel(null)}><X /></button></header>
          <button className="official-panel-primary" onClick={newChat}><Plus size={17} />New chat</button>
          <div className="official-history-list">
            {!conversations.length && <p>No conversations yet.</p>}
            {conversations.map((item) => <article className={item.id === activeId ? 'active' : ''} key={item.id}><button onClick={() => { setActiveId(item.id); setPanel(null); }}><MessageCircle size={15} /><span>{item.title}</span></button><button onClick={() => remove(item.id)} aria-label={`Delete ${item.title}`}><Trash2 size={14} /></button></article>)}
          </div>
        </aside>
      )}
      {panel === 'prompts' && (
        <aside className="official-panel official-prompts">
          <header><div><small>INTELLIGENCE</small><h2>Prompt library</h2></div><button onClick={() => setPanel(null)}><X /></button></header>
          <p>Start with a focused MV1 workflow.</p>
          {presets.map(([title, text]) => <button className="official-preset" key={title} onClick={() => { setInput(text); setPanel(null); textareaRef.current?.focus(); }}><Brain size={18} /><span><strong>{title}</strong><small>{text}</small></span></button>)}
        </aside>
      )}
      {panel === 'system' && (
        <aside className="official-panel official-system">
          <header><div><small>CONTROL CENTER</small><h2>System</h2></div><button onClick={() => setPanel(null)}><X /></button></header>
          <label>AI behavior<textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} /></label>
          <button className="official-panel-primary" onClick={() => { localStorage.setItem(SYSTEM_KEY, systemPrompt); setNotice('System instructions saved.'); setPanel(null); }}>Save instructions</button>
          <div className="official-status-card"><span>AI gateway</span><strong>{aiConfigured ? 'Ready' : 'Needs API key'}</strong></div>
          <Link to="/DeveloperHub">Developer Hub <span>→</span></Link>
          <Link to="/APIPlayground">API Playground <span>→</span></Link>
        </aside>
      )}
    </main>
  );
}
