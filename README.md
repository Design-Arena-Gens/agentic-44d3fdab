# Agentic YouTube Publisher

Full-stack Next.js application that orchestrates AI-assisted uploads to your YouTube channel. The agent generates channel-ready metadata with OpenAI, ingests source video assets, and publishes directly to YouTube through the official Data API. Automations can be scheduled to run continuously via Vercel Cron or triggered on demand.

## Stack

- Next.js 14 (App Router)
- TypeScript + SWR client utilities
- OpenAI Responses API for metadata generation
- Google APIs (YouTube Data v3) for uploads
- Postgres persistence via `@vercel/postgres` (falls back to JSON files for local prototyping)

## Quick Start

```bash
npm install
npm run dev
```

The dashboard is served at `http://localhost:3000`.

## Environment

Create `.env.local` (or use the dashboard configuration form for non-secret values):

```bash
OPENAI_API_KEY=sk-...
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
CRON_SECRET=optional-shared-secret
POSTGRES_URL=postgres://...
```

- When `POSTGRES_URL` (or any Vercel Postgres runtime variable) is set, application data is persisted in Postgres. Otherwise, data is stored in `data/*.json` for local experimentation.
- The refresh token must originate from an OAuth client with the YouTube Data API enabled and the `youtube.upload` scope authorized for the target channel.

## Features

- Credential management panel with environment-variable overrides
- Automation scheduler with recurring cadences (once/daily/weekly)
- OpenAI-powered title/description/tag generation tuned for discoverability
- Direct YouTube uploads from remote video URLs
- Manual run controls plus optional cron endpoint (`POST /api/cron`)
- Status dashboard with error surfacing and auto-publish toggles

## Deployment

1. Provision Vercel Postgres (recommended) and add credentials to the project.
2. Configure `OPENAI_API_KEY`, Google OAuth secrets, and optional `CRON_SECRET` in Vercel → Settings → Environment Variables.
3. Deploy with `vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-44d3fdab`.
4. Add a Vercel Cron Job that hits `https://agentic-44d3fdab.vercel.app/api/cron` (supply the Bearer token if `CRON_SECRET` is set).

## Agent Flow

1. Scheduler detects a due task.
2. OpenAI generates YouTube metadata from the stored prompt and preferences.
3. The agent streams the source video into a temporary buffer.
4. YouTube Data API uploads the video with the generated metadata.
5. Task state updates and the next run is computed.

## Development Notes

- The application runs entirely on the Node.js runtime—routes make filesystem and network calls, so the Edge runtime is disabled.
- File-system persistence (`data/tasks.json`) is only intended for local development; production environments should supply Postgres credentials.
- All API routes validate input with Zod to guard against malformed automation payloads.

## License

MIT © 2024 Agentic Automations
