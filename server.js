import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilityRegistry, TaskEngine } from './task-engine.js';

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5174);
const windows = new Map();
const taskEngine = new TaskEngine(root);
await taskEngine.init();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '256kb' }));
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Malformed JSON request.' });
  return next(error);
});

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().trim().min(1).max(30_000),
  })).min(1).max(80),
  mode: z.enum(['genius', 'taboo', 'rated']).default('genius'),
});

const imagineSchema = z.object({
  prompt: z.string().trim().min(8).max(4_000),
  siteType: z.enum(['business', 'portfolio', 'store', 'landing', 'editorial']).default('business'),
  style: z.enum(['minimal', 'editorial', 'bold', 'luxury', 'technical']).default('luxury'),
});

const taskSchema = z.object({
  goal: z.string().trim().min(8).max(10_000),
  title: z.string().trim().min(2).max(100).optional(),
  inputs: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  constraints: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(1_000)).max(30).default([]),
});

const imagineContentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  headline: z.string().trim().min(4).max(100),
  description: z.string().trim().min(10).max(260),
  services: z.array(z.object({ title: z.string().max(50), text: z.string().max(140) })).length(3),
  cta: z.string().trim().min(2).max(32),
});

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'imagine-site';

function inferSite(prompt, siteType) {
  const lower = prompt.toLowerCase();
  const matched = prompt.match(/(?:for|called|named)\s+([a-z0-9 &'’-]{2,45})/i)?.[1]?.trim();
  const category = lower.includes('architect') ? 'architecture'
    : lower.includes('restaurant') || lower.includes('food') ? 'restaurant'
      : lower.includes('fashion') || lower.includes('clothing') ? 'fashion'
        : lower.includes('fitness') || lower.includes('gym') ? 'fitness'
          : lower.includes('music') || lower.includes('artist') ? 'creative studio'
            : siteType === 'store' ? 'modern commerce' : siteType === 'portfolio' ? 'creative studio' : 'independent business';
  const name = matched ? matched.replace(/\b(with|that|and)\b.*$/i, '').trim() : category === 'architecture' ? 'FORMA' : category === 'restaurant' ? 'EMBER' : category === 'fashion' ? 'ATELIER' : category === 'fitness' ? 'ASCEND' : category === 'creative studio' ? 'NORTH/01' : 'IMAGINE';
  return {
    name: name.slice(0, 60),
    headline: category === 'architecture' ? 'Spaces made for remarkable lives.' : category === 'restaurant' ? 'A table worth remembering.' : category === 'fashion' ? 'Designed beyond the season.' : category === 'fitness' ? 'Become stronger than yesterday.' : category === 'creative studio' ? 'Ideas built to move culture.' : 'Make your next move impossible to ignore.',
    description: `A considered ${category} experience shaped around clarity, confidence, and work that earns attention.`,
    services: [
      { title: siteType === 'store' ? 'Curated collection' : 'Strategy', text: 'A focused foundation built around your audience and strongest commercial advantage.' },
      { title: siteType === 'portfolio' ? 'Selected work' : 'Experience', text: 'Distinctive design, thoughtful detail, and a clear path from interest to action.' },
      { title: siteType === 'store' ? 'Worldwide delivery' : 'Partnership', text: 'A direct, collaborative process with momentum from first conversation to launch.' },
    ],
    cta: siteType === 'store' ? 'Shop the collection' : 'Start a project',
    category,
  };
}

function buildImagineProject(prompt, siteType, style, content) {
  const safe = imagineContentSchema.parse(content);
  const slug = slugify(safe.name);
  const images = {
    architecture: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/modern-house-near-trees-during-daytime-2gDwlIim3Uw'],
    restaurant: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/clear-wine-glass-on-table-N_Y88TWmGwA'],
    fashion: ['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/woman-standing-near-wall-W7b3eDUb_2I'],
    fitness: ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/man-lifting-barbel-U5kQvbQWoG0'],
    'creative studio': ['https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/people-sitting-down-near-table-with-assorted-laptop-computers-QckxruozjRg'],
    'independent business': ['https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/people-sitting-down-near-table-with-assorted-laptop-computers-GWe0dlVD9e0'],
    'modern commerce': ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=88', 'https://unsplash.com/photos/shallow-focus-photography-of-clothes-racks-6MT4_Ut8a3Y'],
  };
  const inferred = inferSite(prompt, siteType);
  const [heroImage, imageCredit] = images[inferred.category] || images['independent business'];
  const accent = style === 'bold' ? '#ff5d2e' : style === 'editorial' ? '#c7a875' : style === 'technical' ? '#52d6ff' : '#d2ff63';
  const serif = style === 'editorial' || style === 'luxury';
  const previewHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(safe.name)}</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0c0b;color:#f4f3ee;font:16px/1.5 Arial,sans-serif}a{color:inherit}.hero{min-height:100vh;padding:28px 6vw 80px;display:flex;flex-direction:column;background:linear-gradient(90deg,#080908e8 0%,#080908b8 46%,#0809081c 78%),url('${heroImage}') center/cover}.nav{display:flex;align-items:center;gap:34px;font-size:12px;letter-spacing:.12em}.brand{font:700 24px Georgia,serif;margin-right:auto}.hero-copy{max-width:720px;margin:auto 0}.hero h1{font:${serif ? '500' : '700'} clamp(52px,8vw,116px)/.92 ${serif ? 'Georgia,serif' : 'Arial,sans-serif'};letter-spacing:-.055em;margin:0 0 28px}.hero p{max-width:570px;color:#d6dad4;font-size:18px}.cta{display:inline-block;margin-top:22px;padding:14px 22px;border:1px solid ${accent};background:${accent};color:#09100d;text-decoration:none;font-weight:700}.credit{margin-top:auto;font-size:10px;color:#aeb4ae}.services{padding:90px 6vw;background:#f0eee7;color:#111}.services h2{font:500 46px Georgia,serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#bbb}.grid article{background:#f0eee7;padding:34px}.grid span{color:#777;font-size:12px}.grid h3{font-size:22px}.grid p{color:#555}@media(max-width:700px){.nav a:not(.brand){display:none}.grid{grid-template-columns:1fr}.hero h1{font-size:56px}}</style></head><body><section class="hero"><nav class="nav"><a class="brand" href="#">${escapeHtml(safe.name)}</a><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav><div class="hero-copy"><h1>${escapeHtml(safe.headline)}</h1><p>${escapeHtml(safe.description)}</p><a class="cta" href="#contact">${escapeHtml(safe.cta)}</a></div><a class="credit" href="${imageCredit}" target="_blank" rel="noreferrer">Photography via Unsplash ↗</a></section><section class="services" id="work"><h2>Built with intention.</h2><div class="grid">${safe.services.map((service, index) => `<article><span>0${index + 1}</span><h3>${escapeHtml(service.title)}</h3><p>${escapeHtml(service.text)}</p></article>`).join('')}</div></section></body></html>`;
  const files = {
    'package.json': JSON.stringify({ name: slug, version: '1.0.0', private: true, scripts: { dev: 'next dev', build: 'next build', start: 'next start' }, dependencies: { next: '^16.3.4', react: '^19.1.0', 'react-dom': '^19.1.0' }, devDependencies: { '@types/node': '^22.0.0', '@types/react': '^19.0.0', typescript: '^5.8.0' } }, null, 2),
    'app/layout.tsx': `import type { Metadata } from 'next';\nimport './globals.css';\n\nexport const metadata: Metadata = { title: ${JSON.stringify(safe.name)}, description: ${JSON.stringify(safe.description)} };\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }\n`,
    'app/page.tsx': `const site = ${JSON.stringify({ name: safe.name, headline: safe.headline, description: safe.description, cta: safe.cta })};\nconst services = ${JSON.stringify(safe.services)};\nexport default function Home() { return <main><section className="hero"><nav><a className="brand" href="#">{site.name}</a><a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a></nav><div className="heroCopy"><h1>{site.headline}</h1><p>{site.description}</p><a className="cta" href="#contact">{site.cta}</a></div><a className="credit" href="${imageCredit}" target="_blank" rel="noreferrer">Photography via Unsplash ↗</a></section><section className="services" id="work"><h2>Built with intention.</h2><div className="grid">{services.map((service,index)=><article key={service.title}><span>0{index+1}</span><h3>{service.title}</h3><p>{service.text}</p></article>)}</div></section></main>; }\n`,
    'app/globals.css': `*{box-sizing:border-box}body{margin:0;background:#0b0c0b;color:#f4f3ee;font:16px/1.5 Arial,sans-serif}a{color:inherit}.hero{min-height:100vh;padding:28px 6vw 80px;display:flex;flex-direction:column;background:linear-gradient(90deg,#080908e8 0%,#080908b8 46%,#0809081c 78%),url('${heroImage}') center/cover}.hero nav{display:flex;align-items:center;gap:34px;font-size:12px;letter-spacing:.12em}.brand{font:700 24px Georgia,serif;margin-right:auto}.heroCopy{max-width:720px;margin:auto 0}.hero h1{font:${serif ? '500' : '700'} clamp(52px,8vw,116px)/.92 ${serif ? 'Georgia,serif' : 'Arial,sans-serif'};letter-spacing:-.055em;margin:0 0 28px}.hero p{max-width:570px;color:#d6dad4;font-size:18px}.cta{display:inline-block;margin-top:22px;padding:14px 22px;border:1px solid ${accent};background:${accent};color:#09100d;text-decoration:none;font-weight:700}.credit{margin-top:auto;font-size:10px;color:#aeb4ae}.services{padding:90px 6vw;background:#f0eee7;color:#111}.services h2{font:500 46px Georgia,serif}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#bbb}.grid article{background:#f0eee7;padding:34px}.grid span{color:#777;font-size:12px}.grid h3{font-size:22px}.grid p{color:#555}@media(max-width:700px){.hero nav a:not(.brand){display:none}.grid{grid-template-columns:1fr}.hero h1{font-size:56px}}`,
    'next.config.mjs': `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`,
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2017', lib: ['dom', 'dom.iterable', 'esnext'], strict: true, noEmit: true, module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', incremental: true, plugins: [{ name: 'next' }] }, include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }, null, 2),
    'README.md': `# ${safe.name}\n\nGenerated by MV1 Imagine from: “${prompt}”\n\n## Run\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nBuilt with Next.js and responsive CSS. Remote photography is credited in the site footer.\n`,
  };
  const subPagePreview = (title, intro) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#0b0c0b;color:#f4f3ee;font:16px/1.6 Arial,sans-serif}nav{height:76px;padding:0 7vw;display:flex;align-items:center;gap:28px;border-bottom:1px solid #ffffff20}.brand{margin-right:auto;font:700 22px Georgia}a{color:inherit;text-decoration:none}.page{min-height:calc(100vh - 76px);padding:12vh 8vw;background:radial-gradient(circle at 80% 20%,${accent}22,transparent 35%)}small{color:${accent};letter-spacing:.15em}h1{max-width:850px;font:500 clamp(55px,8vw,108px)/.95 ${serif ? 'Georgia,serif' : 'Arial,sans-serif'};letter-spacing:-.05em;margin:22px 0}p{max-width:650px;color:#aeb7b2;font-size:19px}</style></head><body><nav><a class="brand" href="/">${escapeHtml(safe.name)}</a><a href="/about">About</a><a href="/services">Services</a><a href="/contact">Contact</a></nav><main class="page"><small>${escapeHtml(safe.name.toUpperCase())}</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></main></body></html>`;
  const pageSource = (title, intro) => `const content = ${JSON.stringify({ label: safe.name.toUpperCase(), title, intro })};\nexport default function Page() { return <main className="subPage"><small>{content.label}</small><h1>{content.title}</h1><p>{content.intro}</p></main>; }\n`;
  const pages = [
    { id: 'home', title: 'Home', path: '/', file: 'app/page.tsx', previewHtml },
    { id: 'about', title: 'About', path: '/about', file: 'app/about/page.tsx', previewHtml: subPagePreview('Built from a clear point of view.', `Learn the story, principles, and people behind ${safe.name}.`) },
    { id: 'services', title: 'Services', path: '/services', file: 'app/services/page.tsx', previewHtml: subPagePreview('Expertise that creates momentum.', safe.services.map((item) => item.title).join(' · ')) },
    { id: 'contact', title: 'Contact', path: '/contact', file: 'app/contact/page.tsx', previewHtml: subPagePreview('Let’s build what comes next.', 'Tell us what you are creating, where you need help, and what success should look like.') },
    { id: 'privacy', title: 'Privacy', path: '/privacy', file: 'app/privacy/page.tsx', previewHtml: subPagePreview('Privacy, clearly explained.', 'A straightforward policy covering inquiries, analytics, and information visitors choose to share.') },
  ];
  Object.assign(files, {
    'app/about/page.tsx': pageSource('Built from a clear point of view.', `Learn the story, principles, and people behind ${safe.name}.`),
    'app/services/page.tsx': pageSource('Expertise that creates momentum.', safe.services.map((item) => item.title).join(' · ')),
    'app/contact/page.tsx': pageSource('Let’s build what comes next.', 'Tell us what you are creating, where you need help, and what success should look like.'),
    'app/privacy/page.tsx': pageSource('Privacy, clearly explained.', 'A straightforward policy covering inquiries, analytics, and information visitors choose to share.'),
    'app/api/contact/route.ts': `import { NextResponse } from 'next/server';\nexport async function POST(request: Request) { const body = await request.json(); if (!body?.email) return NextResponse.json({ error: 'Email is required' }, { status: 400 }); return NextResponse.json({ ok: true, message: 'Inquiry received' }); }\n`,
    'public/brand-mark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#0b0c0b"/><path d="M28 80 50 34l12 27 10-19 20 38" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    'mv1/project.json': JSON.stringify({ generator: 'MV1 Imagine', prompt, siteType, style, pages: pages.map(({ previewHtml: _preview, ...page }) => page), imageCredit }, null, 2),
    'CLIENT-HANDOFF.md': `# ${safe.name} — Client Handoff\n\n## Deliverables\n- Next.js 16 source project\n- ${pages.length} responsive pages\n- Brand mark and design tokens\n- Contact API route\n- SEO metadata and privacy page\n- Credited remote photography\n\n## Approval\nClient: ____________________\nApproved by: ______________\nDate: _____________________\n`,
    'DEPLOYMENT.md': `# Deployment\n\n## Vercel\nImport this folder from GitHub or run \`npx vercel\`.\n\n## Netlify\nConnect the repository and use \`npm run build\`.\n\n## Cloudflare\nUse the current Next.js adapter supported by your Cloudflare project.\n`,
  });
  files['app/globals.css'] += `.subPage{min-height:100vh;padding:14vh 8vw;background:radial-gradient(circle at 80% 20%,${accent}22,transparent 35%)}.subPage small{color:${accent};letter-spacing:.15em}.subPage h1{max-width:850px;font:500 clamp(55px,8vw,108px)/.95 ${serif ? 'Georgia,serif' : 'Arial,sans-serif'};letter-spacing:-.05em;margin:22px 0}.subPage p{max-width:650px;color:#aeb7b2;font-size:19px}`;
  return { id: crypto.randomUUID(), name: safe.name, slug, description: safe.description, prompt, siteType, style, framework: 'Next.js 16', createdAt: new Date().toISOString(), previewHtml, pages, files, brand: { primary: accent, background: '#0b0c0b', text: '#f4f3ee', headingFont: serif ? 'Georgia' : 'Arial', bodyFont: 'Arial', radius: 0 }, integrations: { forms: true, analytics: false, maps: false, stripe: false, shopify: false, supabase: false, calendly: false } };
}

function rateLimit(req, res, next) {
  const key = req.ip || 'local';
  const now = Date.now();
  const recent = (windows.get(key) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 30) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  recent.push(now);
  windows.set(key, recent);
  next();
}

const modePrompt = {
  genius: 'Be rigorous, inventive, clear, and concise. Show useful reasoning as conclusions, not private chain-of-thought.',
  taboo: 'Explore unconventional ideas while remaining accurate, lawful, and safe.',
  rated: 'Use a direct adult tone when appropriate, while following safety boundaries.',
};

app.get('/api/health', (_req, res) => res.json({ ok: true, configured: Boolean(process.env.AI_API_KEY), taskEngine: true, capabilities: Object.keys(capabilityRegistry) }));

app.get('/api/capabilities', (_req, res) => res.json({ capabilities: capabilityRegistry }));

app.get('/api/tasks', async (_req, res) => res.json({ tasks: await taskEngine.list() }));

app.get('/api/tasks/:id', async (req, res) => {
  const task = await taskEngine.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  return res.json({ task });
});

app.post('/api/tasks', rateLimit, async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Provide a concrete goal of at least eight characters.' });
  const task = await taskEngine.create(parsed.data);
  return res.status(202).json({ task });
});

app.get('/api/tasks/:id/artifacts/:artifactId', async (req, res) => {
  const resolved = await taskEngine.resolveArtifact(req.params.id, req.params.artifactId);
  if (!resolved) return res.status(404).json({ error: 'Artifact not found.' });
  res.type(resolved.artifact.mediaType);
  return res.download(resolved.absolute, resolved.artifact.name);
});

app.post('/api/chat', rateLimit, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid chat request.' });
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI_API_KEY is not configured on this server.' });

  const style = process.env.AI_API_STYLE || 'responses';
  const url = process.env.AI_API_URL || 'https://api.openai.com/v1/responses';
  const model = process.env.AI_MODEL || 'gpt-5-mini';
  const messages = [{ role: 'system', content: modePrompt[parsed.data.mode] }, ...parsed.data.messages];
  const body = style === 'responses'
    ? { model, input: messages.map(({ role, content }) => ({ role, content })) }
    : { model, messages };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).json({ error: data?.error?.message || 'The AI provider rejected the request.' });
    const text = style === 'responses'
      ? data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
      : data.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ error: 'The AI provider returned no text.' });
    return res.json({ text, model });
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'The AI provider timed out.' : 'Could not reach the AI provider.';
    return res.status(502).json({ error: message });
  }
});

app.post('/api/imagine', rateLimit, async (req, res) => {
  const parsed = imagineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Describe the website you want in at least eight characters.' });
  const { prompt, siteType, style } = parsed.data;
  let content = inferSite(prompt, siteType);
  const apiKey = process.env.AI_API_KEY;

  if (apiKey) {
    const url = process.env.AI_API_URL || 'https://api.openai.com/v1/responses';
    const model = process.env.AI_MODEL || 'gpt-5-mini';
    const instruction = `You are MV1 Imagine, a principal brand strategist and Next.js creative director. Turn the website request into conversion-ready website content. Return only valid JSON with exactly: name, headline, description, services (exactly three objects with title and text), and cta. Do not use markdown. Make the copy specific, commercially credible, and concise. Website request: ${prompt}. Site type: ${siteType}. Visual style: ${style}.`;
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: [{ role: 'user', content: instruction }] }),
        signal: AbortSignal.timeout(90_000),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
        if (text) {
          const candidate = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
          const validated = imagineContentSchema.safeParse(candidate);
          if (validated.success) content = { ...validated.data, category: content.category };
        }
      }
    } catch {
      // The deterministic builder remains available when the configured model is unavailable.
    }
  }

  return res.json({ project: buildImagineProject(prompt, siteType, style, content), enhanced: Boolean(apiKey) });
});

app.use(express.static(path.join(root, 'dist')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => console.log(`Metallic.V1 server listening on http://localhost:${port}`));
