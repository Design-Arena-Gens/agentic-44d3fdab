import { promises as fs } from "fs";
import path from "path";
import type { AgentConfig, AutomationTask } from "./types";
import { sql } from "@vercel/postgres";

const hasPostgres =
  Boolean(process.env.POSTGRES_URL) ||
  Boolean(process.env.POSTGRES_PRISMA_URL) ||
  Boolean(process.env.POSTGRES_URL_NON_POOLING) ||
  Boolean(process.env.DATABASE_URL);

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_PATH = path.join(DATA_DIR, "tasks.json");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(TASKS_PATH);
  } catch {
    await fs.writeFile(TASKS_PATH, JSON.stringify({ tasks: [] }, null, 2), "utf8");
  }

  try {
    await fs.access(CONFIG_PATH);
  } catch {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig(), null, 2), "utf8");
  }
}

function defaultConfig(): AgentConfig {
  return {
    openAiModel: "gpt-4o-mini",
    defaultPrivacy: "unlisted",
    defaultCategoryId: "22",
    defaultTags: []
  };
}

let tablesReady: Promise<void> | null = null;

async function ensureTables() {
  if (!hasPostgres) return;
  if (!tablesReady) {
    tablesReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS agentic_config (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`;

      await sql`INSERT INTO agentic_config (id, data)
        VALUES (1, ${JSON.stringify(defaultConfig())}::jsonb)
        ON CONFLICT (id) DO NOTHING;`;

      await sql`CREATE TABLE IF NOT EXISTS agentic_tasks (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cadence TEXT NOT NULL,
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        video_source_url TEXT NOT NULL,
        preferred_duration INTEGER NOT NULL,
        language TEXT NOT NULL,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        auto_publish BOOLEAN NOT NULL DEFAULT TRUE,
        visibility_override TEXT
      );`;
    })();
  }

  return tablesReady;
}

export async function loadConfig(): Promise<AgentConfig> {
  if (hasPostgres) {
    await ensureTables();
    const { rows } = await sql`SELECT data FROM agentic_config WHERE id = 1;`;
    const stored = rows[0]?.data as AgentConfig | undefined;
    return {
      ...defaultConfig(),
      openAiApiKey: process.env.OPENAI_API_KEY ?? stored?.openAiApiKey,
      youtubeClientId: process.env.YOUTUBE_CLIENT_ID ?? stored?.youtubeClientId,
      youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? stored?.youtubeClientSecret,
      youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? stored?.youtubeRefreshToken,
      defaultPrivacy: stored?.defaultPrivacy ?? "unlisted",
      defaultCategoryId: stored?.defaultCategoryId ?? "22",
      defaultTags: stored?.defaultTags ?? []
    };
  }

  await ensureDataFiles();
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  const stored = JSON.parse(raw) as AgentConfig;
  return {
    ...defaultConfig(),
    ...stored,
    openAiApiKey: process.env.OPENAI_API_KEY ?? stored.openAiApiKey,
    youtubeClientId: process.env.YOUTUBE_CLIENT_ID ?? stored.youtubeClientId,
    youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET ?? stored.youtubeClientSecret,
    youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN ?? stored.youtubeRefreshToken
  };
}

export async function saveConfig(config: AgentConfig) {
  if (hasPostgres) {
    await ensureTables();
    await sql`INSERT INTO agentic_config (id, data, updated_at)
      VALUES (1, ${JSON.stringify(config)}::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();`;
    return;
  }

  await ensureDataFiles();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function rowToTask(row: any): AutomationTask {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    prompt: row.prompt,
    cadence: row.cadence,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : new Date().toISOString(),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : undefined,
    videoSourceUrl: row.video_source_url,
    preferredDuration: row.preferred_duration,
    language: row.language,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    autoPublish: row.auto_publish,
    visibilityOverride: row.visibility_override ?? undefined
  };
}

export async function loadTasks(): Promise<AutomationTask[]> {
  if (hasPostgres) {
    await ensureTables();
    const { rows } = await sql`SELECT * FROM agentic_tasks ORDER BY created_at ASC;`;
    return rows.map(rowToTask);
  }

  await ensureDataFiles();
  const raw = await fs.readFile(TASKS_PATH, "utf8");
  const data = JSON.parse(raw);
  return (data.tasks ?? []) as AutomationTask[];
}

export async function saveTasks(tasks: AutomationTask[]) {
  if (hasPostgres) {
    await ensureTables();
    await sql`BEGIN`;
    try {
      await sql`DELETE FROM agentic_tasks;`;
      for (const task of tasks) {
        await sql`INSERT INTO agentic_tasks (
          id, name, status, prompt, cadence, next_run_at, last_run_at, video_source_url,
          preferred_duration, language, last_error, created_at, updated_at, auto_publish, visibility_override
        ) VALUES (
          ${task.id}::uuid,
          ${task.name},
          ${task.status},
          ${task.prompt},
          ${task.cadence},
          ${task.nextRunAt},
          ${task.lastRunAt ?? null},
          ${task.videoSourceUrl},
          ${task.preferredDuration},
          ${task.language},
          ${task.lastError ?? null},
          ${task.createdAt},
          ${task.updatedAt},
          ${task.autoPublish},
          ${task.visibilityOverride ?? null}
        );`;
      }
      await sql`COMMIT`;
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
    return;
  }

  await ensureDataFiles();
  await fs.writeFile(TASKS_PATH, JSON.stringify({ tasks }, null, 2), "utf8");
}
