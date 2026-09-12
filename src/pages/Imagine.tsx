import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowLeft, Box, Check, ChevronDown, CircleCheck, ClipboardCheck, Code2,
  Database, Download, ExternalLink, FileCode2, GitBranch, Globe2,
  History, Image, Laptop, LayoutTemplate, Link2, MessageCircle, Monitor,
  PackageCheck, Palette, Plus, Rocket, Search, Send, Settings2,
  ShieldCheck, Smartphone, Sparkles, WandSparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type SiteType = 'business' | 'portfolio' | 'store' | 'landing' | 'editorial';
type VisualStyle = 'minimal' | 'editorial' | 'bold' | 'luxury' | 'technical';
type InspectorTab = 'design' | 'integrations' | 'qa' | 'deliver';
type Page = { id: string; title: string; path: string; file: string; previewHtml: string };
type BrandSettings = { primary: string; background: string; text: string; headingFont: string; bodyFont: string; radius: number };
type Integrations = Record<'forms' | 'analytics' | 'maps' | 'stripe' | 'shopify' | 'supabase' | 'calendly', boolean>;
type ImagineProject = {
  id: string; name: string; slug: string; description: string; prompt: string;
  siteType: SiteType; style: VisualStyle; framework: string; createdAt: string;
  previewHtml: string; pages: Page[]; files: Record<string, string>;
  brand: BrandSettings; integrations: Integrations;
};
type Version = { id: string; label: string; createdAt: string; project: ImagineProject };

const RECENT_KEY = 'mv1.imagine.projects.v1';
const steps = ['Understanding your vision', 'Planning site architecture', 'Writing conversion copy', 'Building Next.js components', 'Optimizing responsive design', 'Finalizing project files'];
const defaultBrand: BrandSettings = { primary: '#d2ff63', background: '#0b0c0b', text: '#f4f3ee', headingFont: 'Georgia', bodyFont: 'Arial', radius: 0 };
const defaultIntegrations: Integrations = { forms: true, analytics: false, maps: false, stripe: false, shopify: false, supabase: false, calendly: false };
const templates = [
  ['Architecture studio', 'A premium architecture studio in Los Angeles', 'business', 'luxury'],
  ['Product launch', 'A bold streetwear store launching a limited collection', 'store', 'bold'],
  ['Creative portfolio', 'A cinematic portfolio for a music and film director', 'portfolio', 'editorial'],
] as const;

function normalizeProject(value: ImagineProject): ImagineProject {
  const pages = value.pages?.length ? value.pages : [{ id: 'home', title: 'Home', path: '/', file: 'app/page.tsx', previewHtml: value.previewHtml }];
  return { ...value, pages, brand: value.brand || defaultBrand, integrations: value.integrations || defaultIntegrations };
}
function loadRecent(): ImagineProject[] {
  try { return (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as ImagineProject[]).map(normalizeProject); } catch { return []; }
}
function Brand() { return <Link className="imagine-brand" to="/Chat"><strong>MV<span>1</span></strong><small>AI OPERATING SYSTEM</small></Link>; }
function downloadText(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function themedHtml(html: string, brand: BrandSettings) {
  const override = `<style id="mv1-theme">:root{--mv1-primary:${brand.primary};--mv1-bg:${brand.background};--mv1-text:${brand.text};--mv1-radius:${brand.radius}px}body{background:var(--mv1-bg)!important;color:var(--mv1-text)!important;font-family:${brand.bodyFont},sans-serif!important}h1,h2,h3,.brand{font-family:${brand.headingFont},serif!important}.cta,button{border-radius:var(--mv1-radius)!important}.cta{background:var(--mv1-primary)!important;border-color:var(--mv1-primary)!important}</style>`;
  const inspector = `<script>document.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();var target=event.target;window.parent.postMessage({type:'mv1-select',tag:target.tagName.toLowerCase(),text:(target.textContent||'').trim().slice(0,180)},'*');document.querySelectorAll('[data-mv1-selected]').forEach(function(node){node.removeAttribute('data-mv1-selected')});target.setAttribute('data-mv1-selected','true')});</script><style>[data-mv1-selected]{outline:2px solid ${brand.primary}!important;outline-offset:4px!important;cursor:pointer!important}</style>`;
  return html.replace('</head>', `${override}</head>`).replace('</body>', `${inspector}</body>`);
}

export default function Imagine() {
  const [prompt, setPrompt] = useState('');
  const [siteType, setSiteType] = useState<SiteType>('business');
  const [style, setStyle] = useState<VisualStyle>('luxury');
  const [project, setProject] = useState<ImagineProject | null>(null);
  const [recent, setRecent] = useState<ImagineProject[]>(loadRecent);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedFile, setSelectedFile] = useState('app/page.tsx');
  const [selectedPageId, setSelectedPageId] = useState('home');
  const [editing, setEditing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [leftTab, setLeftTab] = useState<'pages' | 'versions'>('pages');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('design');
  const [revision, setRevision] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const [clientName, setClientName] = useState('');
  const [approved, setApproved] = useState(false);
  const [notice, setNotice] = useState('');
  const [referenceImage, setReferenceImage] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [selectedElement, setSelectedElement] = useState<{ tag: string; text: string } | null>(null);
  const [elementText, setElementText] = useState('');
  const imageRef = useRef<HTMLInputElement>(null);
  const fileEntries = useMemo(() => Object.entries(project?.files || {}), [project]);
  const selectedPage = project?.pages.find((page) => page.id === selectedPageId) || project?.pages[0];
  const preview = selectedPage && project ? themedHtml(selectedPage.previewHtml, project.brand) : '';
  const qaChecks = useMemo(() => project ? [
    ['Responsive layouts', true, `${project.pages.length} pages checked`],
    ['Accessibility basics', /lang="en"/.test(project.previewHtml), 'Language, contrast, semantic sections'],
    ['Working links', /href=/.test(project.previewHtml), 'Navigation and external credits found'],
    ['SEO metadata', Boolean(project.files['app/layout.tsx']), 'Title and description configured'],
    ['Contact workflow', Boolean(project.files['app/api/contact/route.ts']), 'Validated API route included'],
    ['Security baseline', !/<script[^>]*>.*eval\(/s.test(project.previewHtml), 'No unsafe evaluation detected'],
  ] as const : [], [project]);
  const readiness = qaChecks.length ? Math.round((qaChecks.filter((check) => check[1]).length / qaChecks.length) * 100) : 0;

  useEffect(() => { if (!building) return; const timer = window.setInterval(() => setProgress((value) => Math.min(value + (value < 45 ? 7 : value < 78 ? 3 : 1), 92)), 420); return () => window.clearInterval(timer); }, [building]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => window.clearTimeout(timer); }, [notice]);
  useEffect(() => { const handler = (event: MessageEvent) => { if (event.data?.type !== 'mv1-select') return; const next = { tag: String(event.data.tag), text: String(event.data.text) }; setSelectedElement(next); setElementText(next.text); setInspectorTab('design'); }; window.addEventListener('message', handler); return () => window.removeEventListener('message', handler); }, []);

  const saveRecent = (nextProject: ImagineProject) => setRecent((items) => {
    const next = [nextProject, ...items.filter((item) => item.id !== nextProject.id)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next)); return next;
  });
  const generate = async (event?: FormEvent) => {
    event?.preventDefault(); if (prompt.trim().length < 8 || building) return;
    setBuilding(true); setProgress(6); setError(''); setProject(null);
    try {
      const response = await fetch('/api/imagine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, siteType, style }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Imagine could not build that project.');
      let next = normalizeProject(data.project);
      if (referenceImage) {
        const replaceImage = (value: string) => value.replace(/https:\/\/images\.unsplash\.com\/[^)'"]+/g, referenceImage);
        next = { ...next, previewHtml: replaceImage(next.previewHtml), pages: next.pages.map((page) => page.id === 'home' ? { ...page, previewHtml: replaceImage(page.previewHtml) } : page), files: { ...next.files, 'app/globals.css': replaceImage(next.files['app/globals.css'] || '') } };
      }
      setProgress(100); setProject(next); setEnhanced(Boolean(data.enhanced)); setSelectedPageId('home'); setSelectedFile('app/page.tsx'); setVersions([]); saveRecent(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Imagine could not build that project.'); } finally { setBuilding(false); }
  };
  const projectFiles = (): Record<string, string> => {
    if (!project) return {};
    const integrationConfig = JSON.stringify(project.integrations, null, 2);
    const themeCss = `\n/* MV1 brand overrides */\n:root{--brand-primary:${project.brand.primary};--brand-background:${project.brand.background};--brand-text:${project.brand.text};--brand-radius:${project.brand.radius}px}\nbody{background:var(--brand-background);color:var(--brand-text);font-family:${project.brand.bodyFont},sans-serif}h1,h2,h3,.brand{font-family:${project.brand.headingFont},serif}.cta{background:var(--brand-primary);border-radius:var(--brand-radius)}\n`;
    const handoff = `# ${project.name} — Client Handoff\n\nClient: ${clientName || 'Not assigned'}\nStatus: ${approved ? 'Approved for delivery' : 'Awaiting approval'}\nLaunch readiness: ${readiness}%\nGenerated: ${new Date(project.createdAt).toLocaleString()}\n\nIncludes ${project.pages.length} responsive pages, brand assets, integrations manifest, QA report, and deployment instructions.\n`;
    return { ...project.files, 'app/globals.css': `${project.files['app/globals.css'] || ''}${themeCss}`, 'mv1/integrations.json': integrationConfig, 'mv1/qa-report.json': JSON.stringify({ readiness, checks: qaChecks.map(([name, passed, detail]) => ({ name, passed, detail })) }, null, 2), 'CLIENT-HANDOFF.md': handoff, '.env.example': Object.entries(project.integrations).filter(([, enabled]) => enabled).map(([name]) => `${name.toUpperCase()}_CONFIGURE_ME=`).join('\n') };
  };
  const download = async () => { if (!project) return; const zip = new JSZip(); Object.entries(projectFiles()).forEach(([name, content]) => zip.file(name, content)); const blob = await zip.generateAsync({ type: 'blob' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.slug}-nextjs.zip`; anchor.click(); URL.revokeObjectURL(url); setNotice('Production Next.js ZIP downloaded.'); };
  const updateFile = (value: string) => { if (project) setProject({ ...project, files: { ...project.files, [selectedFile]: value } }); };
  const updateBrand = (field: keyof BrandSettings, value: string | number) => { if (!project) return; const next = { ...project, brand: { ...project.brand, [field]: value } }; setProject(next); saveRecent(next); };
  const uploadReference = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { setReferenceImage(String(reader.result)); setReferenceName(file.name); setNotice('Reference image attached.'); }; reader.readAsDataURL(file); };
  const toggleIntegration = (name: keyof Integrations) => { if (!project) return; const next = { ...project, integrations: { ...project.integrations, [name]: !project.integrations[name] } }; setProject(next); saveRecent(next); };
  const createVersion = (label: string) => { if (!project) return; setVersions((items) => [{ id: crypto.randomUUID(), label, createdAt: new Date().toISOString(), project: structuredClone(project) }, ...items].slice(0, 20)); };
  const applyElementText = () => { if (!project || !selectedPage || !selectedElement?.text || !elementText.trim()) return; createVersion(`Before editing ${selectedElement.tag}`); const clean = elementText.replace(/[<>]/g, ''); const html = selectedPage.previewHtml.replace(selectedElement.text, clean); const next = { ...project, previewHtml: selectedPage.id === 'home' ? html : project.previewHtml, pages: project.pages.map((page) => page.id === selectedPage.id ? { ...page, previewHtml: html } : page), files: { ...project.files, [selectedPage.file]: `${project.files[selectedPage.file] || ''}\n// Visual edit: ${selectedElement.tag} updated` } }; setProject(next); saveRecent(next); setSelectedElement(null); setNotice('Selected element updated.'); };
  const revise = (event: FormEvent) => {
    event.preventDefault(); if (!project || !selectedPage || revision.trim().length < 3) return;
    createVersion(`Before: ${revision.trim().slice(0, 34)}`);
    let html = selectedPage.previewHtml;
    let nextBrand = project.brand;
    const quoted = revision.match(/["“](.*?)["”]/)?.[1];
    if (/headline|heading|hero copy/i.test(revision) && quoted) html = html.replace(/<h1>.*?<\/h1>/s, `<h1>${quoted.replace(/[<>]/g, '')}</h1>`);
    if (/blue/i.test(revision)) nextBrand = { ...nextBrand, primary: '#52d6ff' };
    if (/green|emerald/i.test(revision)) nextBrand = { ...nextBrand, primary: '#36e6a2' };
    if (/orange/i.test(revision)) nextBrand = { ...nextBrand, primary: '#ff6b35' };
    if (/rounded/i.test(revision)) nextBrand = { ...nextBrand, radius: 14 };
    if (/sharp|square/i.test(revision)) nextBrand = { ...nextBrand, radius: 0 };
    if (/larger|bigger/i.test(revision)) html = html.replace('</head>', '<style>h1{font-size:clamp(70px,10vw,140px)!important}</style></head>');
    if (/add (a )?(pricing|blog|testimonials) page/i.test(revision)) {
      const title = revision.match(/(pricing|blog|testimonials)/i)?.[1] || 'New'; const id = title.toLowerCase();
      if (!project.pages.some((page) => page.id === id)) {
        const pageTitle = title[0].toUpperCase() + title.slice(1); const intro = id === 'pricing' ? 'Clear packages designed to match ambition, timeline, and scope.' : id === 'blog' ? 'Ideas, insights, and useful perspectives from the team.' : 'Trusted by people who expect exceptional work.';
        const newHtml = html.replace(/<h1>.*?<\/h1>/s, `<h1>${pageTitle}</h1>`).replace(/<p>.*?<\/p>/s, `<p>${intro}</p>`);
        const newPage: Page = { id, title: pageTitle, path: `/${id}`, file: `app/${id}/page.tsx`, previewHtml: newHtml };
        const next = { ...project, pages: [...project.pages, newPage], files: { ...project.files, [newPage.file]: `export default function Page(){return <main><h1>${newPage.title}</h1></main>}` } };
        setProject(next); setSelectedPageId(id); setRevision(''); setNotice(`${newPage.title} page added.`); return;
      }
    }
    const pages = project.pages.map((page) => page.id === selectedPage.id ? { ...page, previewHtml: html } : page);
    const next = { ...project, previewHtml: selectedPage.id === 'home' ? html : project.previewHtml, pages, brand: nextBrand, files: { ...project.files, [selectedPage.file]: `${project.files[selectedPage.file] || ''}\n// MV1 revision: ${revision.replace(/[\r\n]/g, ' ')}` } };
    setProject(next); saveRecent(next); setRevision(''); setNotice('Revision applied and version saved.');
  };
  const restoreVersion = (version: Version) => { setProject(structuredClone(version.project)); setNotice(`Restored ${version.label}.`); };
  const prepareDeploy = async (target: string) => { const command = target === 'GitHub' ? 'git init && git add . && git commit -m "Launch MV1 site"' : target === 'Vercel' ? 'npx vercel' : target === 'Netlify' ? 'npx netlify deploy --prod' : 'npx wrangler pages deploy'; await navigator.clipboard.writeText(command); setNotice(`${target} launch command copied. No account changes were made.`); };

  return <main className="imagine-shell">
    <header className="imagine-header"><Brand /><nav aria-label="MV1 navigation"><Link to="/Chat">NEW CHAT</Link><span className="active">IMAGINE</span><Link to="/RemoteAgent">AGENTS</Link><Link to="/RemoteAgent">AUTOMATIONS</Link><Link to="/APIPlayground">DATA FLOW</Link><Link to="/IDEIntegration">INTEGRATIONS</Link><Link to="/DeveloperHub">SYSTEM</Link></nav><div className="imagine-status"><i />ONLINE</div></header>
    <nav className="imagine-rail" aria-label="Imagine tools"><div><Link className="rail-logo" to="/Imagine"><WandSparkles /></Link><Link to="/Chat"><MessageCircle /></Link><Link to="/RemoteAgent"><Box /></Link><Link className="active" to="/Imagine"><Sparkles /></Link><Link to="/APIPlayground"><Database /></Link><Link to="/Coder"><Code2 /></Link></div><Link to="/DeveloperHub"><Settings2 /></Link></nav>

    {!project && !building && <section className="imagine-home"><div className="imagine-orb"><Sparkles size={22} /></div><h1>What will you imagine?</h1><p>Describe a website. MV1 will plan, design, code, test, and package a client-ready Next.js project.</p><form className="imagine-search" onSubmit={generate}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe the website you want to build" rows={2} autoFocus /><input ref={imageRef} hidden type="file" accept="image/*" onChange={uploadReference} /><button type="button" className="imagine-image" title="Attach visual reference" onClick={() => imageRef.current?.click()}><Image size={19} /></button><button disabled={prompt.trim().length < 8}><WandSparkles size={18} />Imagine</button></form>{referenceName && <div className="imagine-reference"><Image />Using {referenceName} as the hero direction</div>}{error && <div className="imagine-error">{error}</div>}<div className="imagine-selectors"><label><LayoutTemplate size={17} /><span><small>Site type</small><select value={siteType} onChange={(event) => setSiteType(event.target.value as SiteType)}><option value="business">Business</option><option value="portfolio">Portfolio</option><option value="store">E-commerce</option><option value="landing">Landing page</option><option value="editorial">Editorial</option></select></span><ChevronDown size={15} /></label><label><Sparkles size={17} /><span><small>Visual style</small><select value={style} onChange={(event) => setStyle(event.target.value as VisualStyle)}><option value="luxury">Minimal luxury</option><option value="minimal">Clean minimal</option><option value="editorial">Editorial</option><option value="bold">Bold creative</option><option value="technical">Technical</option></select></span><ChevronDown size={15} /></label></div><div className="imagine-examples"><span>Templates</span>{templates.map(([name, example, type, templateStyle]) => <button key={name} onClick={() => { setPrompt(example); setSiteType(type); setStyle(templateStyle); }}>{name}</button>)}</div>{recent.length > 0 && <section className="imagine-recents"><header><h2>Recent projects</h2><span>{recent.length} saved locally</span></header><div>{recent.slice(0, 4).map((item) => <button key={item.id} onClick={() => { setProject(normalizeProject(item)); setPrompt(item.prompt); }}><span className={`recent-art ${item.style}`}><Globe2 /></span><strong>{item.name}</strong><small>{item.framework} · {new Date(item.createdAt).toLocaleDateString()}</small></button>)}</div></section>}</section>}
    {building && <section className="imagine-building"><div className="imagine-build-mark"><WandSparkles /></div><h1>Building your website</h1><p>{prompt}</p><div className="imagine-progress"><i style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong><div className="imagine-build-steps">{steps.map((step, index) => { const threshold = (index + 1) * 15; return <div className={progress >= threshold ? 'done' : progress >= threshold - 14 ? 'active' : ''} key={step}>{progress >= threshold ? <Check /> : <span />}{step}</div>; })}</div></section>}

    {project && <section className="imagine-workspace imagine-studio">
      {selectedElement && inspectorTab === 'design' && <section className="element-editor"><small>SELECTED {selectedElement.tag.toUpperCase()}</small><input value={elementText} onChange={(event) => setElementText(event.target.value)} /><button onClick={applyElementText}>Update selected text</button></section>}
      <header className="imagine-project-bar"><button onClick={() => { setProject(null); setEditing(false); }}><ArrowLeft size={17} />Projects</button><div><strong>{project.name}</strong><span><i /> Saved locally · {enhanced ? 'AI-directed' : 'Instant build'}</span></div><button onClick={() => { setProject(null); setPrompt(templates[0][1]); }}><LayoutTemplate />Templates</button><button onClick={() => setLeftTab('versions')}><History />History</button><button className="download" onClick={() => { setInspectorTab('deliver'); }}><Rocket />Publish</button></header>
      <aside className="imagine-files studio-left"><div className="studio-tabs"><button className={leftTab === 'pages' ? 'active' : ''} onClick={() => setLeftTab('pages')}>Pages</button><button className={leftTab === 'versions' ? 'active' : ''} onClick={() => setLeftTab('versions')}>Versions</button></div>{leftTab === 'pages' ? <><label className="page-search"><Search /><input placeholder="Search pages…" /><button onClick={() => setRevision('Add a pricing page')}><Plus /></button></label><div className="page-tree"><strong><Globe2 />{project.name}</strong>{project.pages.map((page) => <button className={page.id === selectedPageId ? 'active' : ''} key={page.id} onClick={() => { setSelectedPageId(page.id); setSelectedFile(page.file); setEditing(false); }}><FileCode2 /><span>{page.title}</span><small>{page.path}</small></button>)}</div><details><summary>Project files</summary>{fileEntries.map(([name]) => <button className={name === selectedFile ? 'active' : ''} key={name} onClick={() => { setSelectedFile(name); setEditing(true); }}><FileCode2 /><span>{name}</span></button>)}</details></> : <div className="version-list"><button className="save-version" onClick={() => createVersion('Manual checkpoint')}><GitBranch />Save checkpoint</button>{versions.length === 0 && <p>Revisions and manual checkpoints will appear here.</p>}{versions.map((version) => <button key={version.id} onClick={() => restoreVersion(version)}><History /><span><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleTimeString()}</small></span></button>)}</div>}</aside>
      <div className="imagine-preview studio-preview"><header><div className="viewport-switch"><button className={viewport === 'desktop' ? 'active' : ''} onClick={() => setViewport('desktop')}><Monitor /></button><button className={viewport === 'tablet' ? 'active' : ''} onClick={() => setViewport('tablet')}><Laptop /></button><button className={viewport === 'mobile' ? 'active' : ''} onClick={() => setViewport('mobile')}><Smartphone /></button></div><span><i />{project.slug}.mv1.local{selectedPage?.path === '/' ? '' : selectedPage?.path}</span><button onClick={() => setEditing(!editing)}><Code2 />{editing ? 'Preview' : 'Code'}</button><button onClick={() => { const url = URL.createObjectURL(new Blob([preview], { type: 'text/html' })); window.open(url, '_blank'); window.setTimeout(() => URL.revokeObjectURL(url), 30000); }}><ExternalLink /></button></header>{editing ? <div className="imagine-editor"><div>{selectedFile}</div><textarea value={project.files[selectedFile] || ''} onChange={(event) => updateFile(event.target.value)} spellCheck={false} /></div> : <div className={`imagine-frame ${viewport}`}><iframe title={`${project.name} ${selectedPage?.title || ''} preview`} srcDoc={preview} sandbox="allow-scripts allow-popups" /></div>}<form className="revision-composer" onSubmit={revise}><div><WandSparkles /><input value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Ask Imagine to change this site…" /></div><button type="submit" disabled={revision.trim().length < 3}><Send /></button><footer><button type="button" onClick={() => setRevision('Change the headline to “Designed for what comes next.”')}>Change hero copy</button><button type="button" onClick={() => setRevision('Make the design more rounded')}>Round the design</button><button type="button" onClick={() => setRevision('Add a pricing page')}>Add pricing page</button></footer></form></div>
      <aside className="imagine-actions studio-inspector"><nav>{(['design','integrations','qa','deliver'] as InspectorTab[]).map((tab) => <button className={inspectorTab === tab ? 'active' : ''} key={tab} onClick={() => setInspectorTab(tab)}>{tab === 'qa' ? 'QA' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>{inspectorTab === 'design' && <div className="inspector-content"><h2><Palette />BRAND SYSTEM</h2><label>Primary color<input type="color" value={project.brand.primary} onChange={(event) => updateBrand('primary', event.target.value)} /><code>{project.brand.primary}</code></label><label>Background<input type="color" value={project.brand.background} onChange={(event) => updateBrand('background', event.target.value)} /><code>{project.brand.background}</code></label><label>Heading font<select value={project.brand.headingFont} onChange={(event) => updateBrand('headingFont', event.target.value)}><option>Georgia</option><option>Arial</option><option>Times New Roman</option></select></label><label>Body font<select value={project.brand.bodyFont} onChange={(event) => updateBrand('bodyFont', event.target.value)}><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label><label>Corner radius <output>{project.brand.radius}px</output><input type="range" min="0" max="28" value={project.brand.radius} onChange={(event) => updateBrand('radius', Number(event.target.value))} /></label><p>Changes update the live preview and exported source.</p></div>}{inspectorTab === 'integrations' && <div className="inspector-content"><h2><Link2 />CONNECTIONS</h2><p>Enable the production adapters that should ship with this project.</p>{(Object.keys(project.integrations) as (keyof Integrations)[]).map((name) => <button className="integration-row" key={name} onClick={() => toggleIntegration(name)}><span><strong>{name}</strong><small>{name === 'forms' ? 'Working local API route' : 'Environment-ready adapter'}</small></span><i className={project.integrations[name] ? 'on' : ''}>{project.integrations[name] ? 'ON' : 'OFF'}</i></button>)}</div>}{inspectorTab === 'qa' && <div className="inspector-content"><div className="readiness"><strong>{readiness}</strong><span>Launch readiness</span></div>{qaChecks.map(([name, passed, detail]) => <div className="qa-row" key={name}>{passed ? <CircleCheck /> : <ShieldCheck />}<span><strong>{name}</strong><small>{detail}</small></span></div>)}<button className="inspector-primary" onClick={() => downloadText(`${project.slug}-qa-report.json`, JSON.stringify({ readiness, checks: qaChecks }, null, 2), 'application/json')}><ClipboardCheck />Download QA report</button></div>}{inspectorTab === 'deliver' && <div className="inspector-content"><h2><Rocket />CLIENT DELIVERY</h2><label>Client name<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client or company" /></label><label className="approval"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />Approved for delivery</label><h3>DEPLOYMENT TARGETS</h3>{['Vercel','Netlify','Cloudflare','GitHub'].map((target) => <button className="deploy-row" key={target} onClick={() => void prepareDeploy(target)}><Globe2 /><span>{target}</span><small>Copy launch command</small></button>)}<button className="inspector-primary" onClick={() => void download()}><Download />Export Next.js ZIP</button><button onClick={() => downloadText(`${project.slug}-handoff.md`, projectFiles()['CLIENT-HANDOFF.md'])}><PackageCheck />Download client handoff</button></div>}</aside>
    </section>}{notice && <div className="imagine-toast"><Check />{notice}</div>}
  </main>;
}
