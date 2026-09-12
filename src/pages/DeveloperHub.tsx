import { Braces, Bot, Code2, KeyRound, Puzzle, Radio, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import Brand from '../components/Brand';

const tools = [
  { to: '/APIPlayground', title: 'API Platform', text: 'Test your independent AI gateway and inspect JSON responses.', icon: Braces, color: 'amber' },
  { to: '/RemoteAgent', title: 'Remote Agent', text: 'Create and manage scheduled agent definitions locally.', icon: Bot, color: 'purple' },
  { to: '/IDEIntegration', title: 'IDE Integration', text: 'Commands and integration points for your development tools.', icon: Puzzle, color: 'orange' },
  { to: '/Coder', title: 'App Builder', text: 'Generate, edit, preview, and version code artifacts.', icon: Code2, color: 'green' },
];

export default function DeveloperHub() {
  return <main className="hub"><header><Brand /><Link to="/Chat">Open Chat</Link></header><section className="hub-hero"><p>Developer Hub</p><h1>Elite development platform</h1><span>One independent surface for cognition, code, agents, and API workflows.</span></section><section className="hub-tools">{tools.map((tool) => <Link to={tool.to} className={`tool-card tool-card--${tool.color}`} key={tool.title}><tool.icon size={25} /><h2>{tool.title}</h2><p>{tool.text}</p><span>Open workspace →</span></Link>)}</section><section className="hub-strip"><div><Radio size={19} /><span>Gateway</span><strong>Server-side</strong></div><div><KeyRound size={19} /><span>Secrets</span><strong>Environment only</strong></div><div><Terminal size={19} /><span>Runtime</span><strong>Node + React</strong></div></section></main>;
}
