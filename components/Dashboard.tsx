"use client";

import { useMemo, useState } from "react";
import { AgentConfig, AutomationTask } from "@/lib/types";
import clsx from "clsx";
import { formatDistanceToNow, format } from "date-fns";

type DashboardProps = {
  initialTasks: AutomationTask[];
  initialConfig: AgentConfig;
};

type TaskDraft = {
  name: string;
  prompt: string;
  cadence: "once" | "daily" | "weekly";
  nextRunAt: string;
  videoSourceUrl: string;
  preferredDuration: number;
  language: string;
  autoPublish: boolean;
  visibilityOverride?: "public" | "unlisted" | "private";
};

const defaultDraft: TaskDraft = {
  name: "",
  prompt: "",
  cadence: "once",
  nextRunAt: new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16),
  videoSourceUrl: "",
  preferredDuration: 120,
  language: "en",
  autoPublish: true
};

export default function Dashboard({ initialTasks, initialConfig }: DashboardProps) {
  const [tasks, setTasks] = useState<AutomationTask[]>(initialTasks);
  const [config, setConfig] = useState<AgentConfig>(initialConfig);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(defaultDraft);
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const anyCredentialsMissing = useMemo(() => {
    return !config.openAiApiKey || !config.youtubeClientId || !config.youtubeClientSecret || !config.youtubeRefreshToken;
  }, [config]);

  const handleConfigChange = (field: keyof AgentConfig, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          defaultTags: (config.defaultTags || []).filter((tag) => tag.trim().length > 0)
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save configuration.");
      }

      const saved = (await response.json()) as AgentConfig;
      setConfig(saved);
      setSuccess("Configuration saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  const createTask = async () => {
    setCreatingTask(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...taskDraft,
          preferredDuration: Number(taskDraft.preferredDuration),
          nextRunAt: new Date(taskDraft.nextRunAt).toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to create task.");
      }

      const created = (await response.json()) as AutomationTask;
      setTasks((prev) => [...prev, created]);
      setTaskDraft({
        ...defaultDraft,
        nextRunAt: defaultDraft.nextRunAt
      });
      setSuccess("Task created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setError(null);
    setSuccess(null);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error || "Failed to delete task.");
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setSuccess("Task deleted.");
  };

  const triggerRun = async (taskId: string) => {
    setRunningTaskId(taskId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}/run`, {
        method: "POST"
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Run failed.");
      }

      const data = (await response.json()) as { result: { videoId: string; publishedAt: string }; task: AutomationTask };
      setTasks((prev) => prev.map((task) => (task.id === taskId ? data.task : task)));
      setSuccess(`Uploaded video https://youtube.com/watch?v=${data.result.videoId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run agent.");
    } finally {
      setRunningTaskId(null);
    }
  };

  const toggleAutoPublish = async (task: AutomationTask) => {
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoPublish: !task.autoPublish })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error || "Unable to update task.");
      return;
    }

    const updated = await response.json();
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    setSuccess(`Auto publish ${updated.autoPublish ? "enabled" : "disabled"}.`);
  };

  const onConfigTagChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    handleConfigChange("defaultTags", tags);
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";
    try {
      return `${format(new Date(value), "PPpp")} (${formatDistanceToNow(new Date(value), {
        addSuffix: true
      })})`;
    } catch {
      return value;
    }
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="heading">
        <h1>Agentic YouTube Publisher</h1>
        <span>
          Automate uploads with OpenAI + YouTube API
          {anyCredentialsMissing && <strong style={{ color: "#f97316" }}> · Credentials incomplete</strong>}
        </span>
      </div>

      {error && (
        <div className="glass gradient-border" style={{ borderRadius: 16, padding: 18, color: "#fecaca" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="glass gradient-border" style={{ borderRadius: 16, padding: 18, color: "#bbf7d0" }}>
          {success}
        </div>
      )}

      <section className="card gradient-border">
        <div className="heading" style={{ marginBottom: 16 }}>
          <h2>Configuration</h2>
          <button className="btn" onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="grid two" style={{ gap: 20 }}>
          <label>
            OpenAI API Key
            <input
              type="password"
              value={config.openAiApiKey ?? ""}
              placeholder="sk-..."
              onChange={(event) => handleConfigChange("openAiApiKey", event.target.value)}
            />
          </label>
          <label>
            OpenAI Model
            <input
              type="text"
              value={config.openAiModel}
              onChange={(event) => handleConfigChange("openAiModel", event.target.value)}
            />
          </label>
          <label>
            YouTube Client ID
            <input
              type="text"
              value={config.youtubeClientId ?? ""}
              onChange={(event) => handleConfigChange("youtubeClientId", event.target.value)}
            />
          </label>
          <label>
            YouTube Client Secret
            <input
              type="password"
              value={config.youtubeClientSecret ?? ""}
              onChange={(event) => handleConfigChange("youtubeClientSecret", event.target.value)}
            />
          </label>
          <label>
            YouTube Refresh Token
            <input
              type="password"
              value={config.youtubeRefreshToken ?? ""}
              onChange={(event) => handleConfigChange("youtubeRefreshToken", event.target.value)}
            />
          </label>
          <label>
            Default Privacy
            <select
              value={config.defaultPrivacy}
              onChange={(event) => handleConfigChange("defaultPrivacy", event.target.value as AgentConfig["defaultPrivacy"])}
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            Default Category ID
            <input
              type="text"
              value={config.defaultCategoryId}
              onChange={(event) => handleConfigChange("defaultCategoryId", event.target.value)}
            />
          </label>
          <label>
            Default Tags (comma separated)
            <input
              type="text"
              value={(config.defaultTags || []).join(", ")}
              onChange={(event) => onConfigTagChange(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card gradient-border">
        <div className="heading" style={{ marginBottom: 16 }}>
          <h2>Schedule New Automation</h2>
          <button className="btn" onClick={createTask} disabled={creatingTask}>
            {creatingTask ? "Creating…" : "Create Task"}
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            createTask();
          }}
        >
          <div className="grid two" style={{ gap: 18 }}>
            <label>
              Task Name
              <input
                type="text"
                value={taskDraft.name}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="AI Shorts - Daily"
                required
              />
            </label>
            <label>
              Cadence
              <select
                value={taskDraft.cadence}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, cadence: event.target.value as TaskDraft["cadence"] }))}
              >
                <option value="once">Run once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>

          <label>
            Agent Prompt
            <textarea
              rows={4}
              value={taskDraft.prompt}
              onChange={(event) => setTaskDraft((prev) => ({ ...prev, prompt: event.target.value }))}
              placeholder="Explain quantum computing in plain language with energetic narration."
              required
            />
          </label>

          <div className="grid three" style={{ gap: 18 }}>
            <label>
              Preferred Duration (seconds)
              <input
                type="number"
                min={10}
                max={7200}
                value={taskDraft.preferredDuration}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, preferredDuration: Number(event.target.value) }))}
              />
            </label>
            <label>
              Language
              <input
                type="text"
                value={taskDraft.language}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, language: event.target.value }))}
              />
            </label>
            <label>
              Next Run
              <input
                type="datetime-local"
                value={taskDraft.nextRunAt}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, nextRunAt: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid two" style={{ gap: 18 }}>
            <label>
              Source Video URL
              <input
                type="url"
                value={taskDraft.videoSourceUrl}
                onChange={(event) => setTaskDraft((prev) => ({ ...prev, videoSourceUrl: event.target.value }))}
                placeholder="https://storage.googleapis.com/your-bucket/video.mp4"
                required
              />
            </label>
            <label>
              Visibility Override
              <select
                value={taskDraft.visibilityOverride ?? "inherit"}
                onChange={(event) =>
                  setTaskDraft((prev) => ({
                    ...prev,
                    visibilityOverride:
                      event.target.value === "inherit" ? undefined : (event.target.value as TaskDraft["visibilityOverride"])
                  }))
                }
              >
                <option value="inherit">Use default</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              checked={taskDraft.autoPublish}
              onChange={(event) => setTaskDraft((prev) => ({ ...prev, autoPublish: event.target.checked }))}
              style={{ width: 16, height: 16 }}
            />
            Enable auto publish via cron
          </label>
        </form>
      </section>

      <section className="card gradient-border">
        <div className="heading" style={{ marginBottom: 16 }}>
          <h2>Automation Queue</h2>
          <span>{tasks.length} configured</span>
        </div>

        {tasks.length === 0 ? (
          <div className="glass" style={{ borderRadius: 14, padding: 24, color: "#94a3b8" }}>
            No scheduled automations yet. Create one above to get started.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Next Run</th>
                <th>Last Run</th>
                <th>Cadence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong>{task.name}</strong>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{task.prompt.slice(0, 72)}…</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={clsx("tag", {
                        success: task.status === "scheduled" || task.status === "completed",
                        warn: task.status === "error"
                      })}
                    >
                      {task.status.toUpperCase()}
                    </span>
                    {task.lastError && (
                      <div style={{ marginTop: 6, color: "#fca5a5", fontSize: 12 }}>{task.lastError}</div>
                    )}
                  </td>
                  <td>{formatDate(task.nextRunAt)}</td>
                  <td>{formatDate(task.lastRunAt)}</td>
                  <td>{task.cadence}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn secondary"
                        onClick={() => triggerRun(task.id)}
                        disabled={runningTaskId === task.id}
                      >
                        {runningTaskId === task.id ? "Running…" : "Run now"}
                      </button>
                      <button className="btn secondary" onClick={() => toggleAutoPublish(task)}>
                        {task.autoPublish ? "Disable auto" : "Enable auto"}
                      </button>
                      <button className="btn danger" onClick={() => deleteTask(task.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="glass" style={{ borderRadius: 16, padding: 20, display: "grid", gap: 12 }}>
        <strong>Setup Checklist</strong>
        <span style={{ color: "#94a3b8" }}>
          1. Provide OpenAI + YouTube credentials in Configuration. 2. Create automations with source video URLs (GCS/S3). 3.
          Configure a Vercel Cron job hitting <code>/api/cron</code> with optional <code>CRON_SECRET</code> bearer token.
        </span>
      </section>
    </div>
  );
}
