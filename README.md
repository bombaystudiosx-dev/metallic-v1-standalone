# Metallic.V1 Standalone

This is the independent replacement for the Base44-hosted Metallic.V1 app. It contains Chat, Imagine, Coder, Developer Hub, API Playground, Remote Agent, and IDE Integration surfaces and does not import the Base44 SDK.

## Imagine

Open `/Imagine` to generate a complete responsive Next.js project from a plain-language website brief. Every build includes a live preview, editable source files, credited remote photography, metadata, responsive CSS, and a downloadable ZIP. Imagine works immediately with a deterministic production template and automatically upgrades the brand strategy and copy when `AI_API_KEY` is configured.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and add a server-side provider key.
3. Start both services: `npm run dev`
4. Open `http://localhost:5173/Chat`

The browser keeps conversations, code snapshots, and agent definitions in local storage. Live AI requests go through `server.js`; the provider key never enters frontend code or local storage.

## Production

Run `npm run build`, set the variables from `.env.example` on your host, and run `npm start`. The Node server serves both the compiled app and `/api/*` routes. This structure works on hosts that run a persistent Node service (for example Railway, Render, Fly.io, or a VPS). For Vercel/Netlify, adapt `server.js` to that host's serverless function format.

## Provider compatibility

- `AI_API_STYLE=responses`: sends a Responses-style payload and reads `output_text`.
- `AI_API_STYLE=chat`: sends a Chat Completions-style payload and reads `choices[0].message.content`.

`AI_API_URL` and `AI_MODEL` let you use any compatible provider without changing the UI.
