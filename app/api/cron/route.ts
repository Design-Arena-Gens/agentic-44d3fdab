import { NextRequest, NextResponse } from "next/server";
import { loadConfig, loadTasks, saveTasks } from "@/lib/storage";
import { shouldRun, computeNextRun } from "@/lib/scheduler";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await loadTasks();
  const config = await loadConfig();
  const now = new Date();
  const results: Array<{ id: string; status: string; message?: string }> = [];

  for (const task of tasks) {
    if (!task.autoPublish) {
      continue;
    }

    if (!shouldRun(task, now)) {
      continue;
    }

    task.status = "running";
    task.updatedAt = now.toISOString();
    await saveTasks(tasks);

    try {
      const run = await runAgent(task, config);
      task.status = task.cadence === "once" ? "completed" : "scheduled";
      task.lastRunAt = run.publishedAt;
      const nextRun = computeNextRun(task);
      task.nextRunAt = nextRun ?? task.nextRunAt;
      results.push({ id: task.id, status: "ok" });
    } catch (error) {
      task.status = "error";
      task.lastError = error instanceof Error ? error.message : "Unknown error";
      results.push({ id: task.id, status: "error", message: task.lastError });
    }

    task.updatedAt = new Date().toISOString();
    await saveTasks(tasks);
  }

  return NextResponse.json({
    ok: true,
    results
  });
}
