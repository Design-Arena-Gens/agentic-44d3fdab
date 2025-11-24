import { NextRequest, NextResponse } from "next/server";
import { loadConfig, loadTasks, saveTasks } from "@/lib/storage";
import { runAgent } from "@/lib/agent";
import { computeNextRun } from "@/lib/scheduler";

export const runtime = "nodejs";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === params.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const config = await loadConfig();

  task.status = "running";
  task.lastError = undefined;
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  try {
    const result = await runAgent(task, config);
    task.status = task.cadence === "once" ? "completed" : "scheduled";
    task.lastRunAt = result.publishedAt;
    const nextRun = computeNextRun(task);
    task.nextRunAt = nextRun ?? task.nextRunAt;
    task.updatedAt = new Date().toISOString();
    await saveTasks(tasks);
    return NextResponse.json({ result, task });
  } catch (error) {
    task.status = "error";
    task.lastError = error instanceof Error ? error.message : "Unknown error";
    task.updatedAt = new Date().toISOString();
    await saveTasks(tasks);
    return NextResponse.json(
      { error: task.lastError },
      { status: 500 }
    );
  }
}
