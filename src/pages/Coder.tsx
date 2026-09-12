import { FormEvent, useMemo, useState } from 'react';
import { Code2, Copy, History, Play, Save, Sparkles, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { snapshotStore } from '../store';
import type { Snapshot } from '../types';

const starters: Record<string, string> = {
  typescript: "export function metallic(input: string) {\n  return { input, ready: true };\n}",
  javascript: "export const metallic = (input) => ({ input, ready: true });",
  python: "def metallic(value: str):\n    return {\"value\": value, \"ready\": True}",
};

export default function Coder() {
  const [language, setLanguage] = useState('typescript');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState(starters.typescript);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => snapshotStore.all());
  const [status, setStatus] = useState('Idle');
  const preview = useMemo(() => language === 'javascript' && code.includes('<') ? code : '', [code, language]);

  const generate = (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setStatus('Generating code...');
    setTimeout(() => {
      setCode(`// ${prompt.trim()}\n${starters[language] || starters.typescript}`);
      setStatus('Generated locally — connect the AI gateway for model output');
    }, 450);
  };

  const save = () => {
    const snapshot = { id: crypto.randomUUID(), name: prompt.slice(0, 36) || 'Untitled snapshot', language, code, createdAt: new Date().toISOString() };
    const next = [snapshot, ...snapshots];
    setSnapshots(next); snapshotStore.save(next); setStatus('Snapshot saved');
  };

  return <main className="coder">
    <header className="coder-header"><Link to="/Chat">MV1</Link><h1>MV1 Coder</h1><span><Sparkles size={14} /> Metallic Cognition Active</span></header>
    <section className="coder-toolbar">
      <form onSubmit={generate}><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe what code you want to generate..." /><button><Play size={16} />Generate</button></form>
      <select value={language} onChange={(e) => { setLanguage(e.target.value); setCode(starters[e.target.value] || ''); }} aria-label="Language"><option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="python">Python</option></select>
      <button onClick={save}><Save size={15} />Save Snapshot</button>
    </section>
    <section className="coder-grid">
      <div className="code-panel"><div className="panel-title"><span><Code2 size={15} />Generated Code</span><button onClick={() => navigator.clipboard.writeText(code)} aria-label="Copy code"><Copy size={15} /></button></div><textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} /></div>
      <div className="preview-panel"><div className="panel-title"><span><Play size={15} />Live Artifact Preview</span></div>{preview ? <iframe title="Artifact preview" sandbox="allow-scripts" srcDoc={preview} /> : <div className="preview-empty"><Sparkles size={28} /><p>Artifact Preview</p><small>HTML artifacts appear here.</small></div>}</div>
      <aside className="history-panel"><div className="panel-title"><span><History size={15} />Version History</span></div>{snapshots.length === 0 ? <p>No snapshots saved yet</p> : snapshots.map((item) => <div className="snapshot" key={item.id}><button onClick={() => { setCode(item.code); setLanguage(item.language); }}>{item.name}<small>{item.language}</small></button><button onClick={() => { const next = snapshots.filter((x) => x.id !== item.id); setSnapshots(next); snapshotStore.save(next); }} aria-label="Delete snapshot"><Trash2 size={13} /></button></div>)}</aside>
    </section>
    <footer className="coder-status"><span>{status}</span><span>Powered by MV1 Coder</span></footer>
  </main>;
}
