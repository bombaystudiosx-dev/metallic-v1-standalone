import { Check, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';
import PageShell from '../components/PageShell';

const integrations = [
  ['Visual Studio Code', 'code --install-extension metallic-v1', 'AI-powered generation and chat in VS Code'],
  ['JetBrains IDEs', 'Install from your private plugin registry', 'IntelliJ, PyCharm, and WebStorm support'],
  ['Terminal CLI', 'npm link', 'Use the local Metallic gateway from your shell'],
];
export default function IDEIntegration() {
  const [copied, setCopied] = useState('');
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); setCopied(value); setTimeout(() => setCopied(''), 1600); };
  return <PageShell title="IDE Integration" accent="orange"><section className="integration-grid">{integrations.map(([name, command, text]) => <article key={name}><Terminal size={29} /><h2>{name}</h2><p>{text}</p><div><code>{command}</code><button onClick={() => copy(command)} aria-label={`Copy ${name} command`}>{copied === command ? <Check size={15} /> : <Copy size={15} />}</button></div></article>)}</section><section className="command-list"><h2>CLI Commands</h2>{[['metallic login', 'Authenticate with your server'], ['metallic generate "Create React component"', 'Generate code from a prompt'], ['metallic analyze ./src', 'Analyze a local directory'], ['metallic refactor file.js', 'Refactor an existing file']].map(([command, text]) => <div key={command}><code>$ {command}</code><span>{text}</span><button onClick={() => copy(command)}><Copy size={14} /></button></div>)}</section><aside className="key-callout"><h2>API Key Required</h2><p>Configure the server-side <code>AI_API_KEY</code> environment variable to enable live AI workflows. Keys never enter browser storage.</p></aside></PageShell>;
}
