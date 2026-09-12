import { FormEvent, useState } from 'react';
import { Play } from 'lucide-react';
import PageShell from '../components/PageShell';

export default function APIPlayground() {
  const [body, setBody] = useState('{\n  "messages": [\n    { "role": "user", "content": "Hello Metallic" }\n  ],\n  "mode": "genius"\n}');
  const [response, setResponse] = useState('Execute request to see response');
  const [busy, setBusy] = useState(false);
  const run = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { const parsed = JSON.parse(body); const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) }); setResponse(JSON.stringify(await res.json(), null, 2)); } catch (error) { setResponse(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request' }, null, 2)); } finally { setBusy(false); } };
  return <PageShell title="API Playground" accent="green"><div className="api-layout"><form onSubmit={run} className="api-panel"><div className="api-bar"><span className="method">POST</span><code>/api/chat</code></div><label>Request Body (JSON)</label><textarea value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} /><button disabled={busy}><Play size={16} />{busy ? 'Running…' : 'Execute Request'}</button></form><section className="api-panel"><div className="api-bar"><span>Response Body</span></div><pre>{response}</pre></section></div><section className="endpoint-list"><h2>Endpoints</h2><div><span className="method get">GET</span><code>/api/health</code><p>Gateway status</p></div><div><span className="method">POST</span><code>/api/chat</code><p>Chat completion</p></div></section></PageShell>;
}
