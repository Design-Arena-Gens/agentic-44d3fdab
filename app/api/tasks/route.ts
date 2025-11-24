import { NextRequest, NextResponse } from "next/server";
import { loadTasks, saveTasks } from "@/lib/storage";
import { taskSchema } from "@/lib/validation";
import { v4 as uuid } from "uuid";
import { AutomationTask } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const tasks = await loadTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = taskSchema.parse(json);

    const now = new Date().toISOString();
    const task: AutomationTask = {
      id: uuid(),
      name: parsed.name,
      status: "scheduled",
      prompt: parsed.prompt,
      cadence: parsed.cadence,
      nextRunAt: parsed.nextRunAt,
      videoSourceUrl: parsed.videoSourceUrl,
      preferredDuration: parsed.preferredDuration,
      language: parsed.language,
      autoPublish: parsed.autoPublish,
      visibilityOverride: parsed.visibilityOverride,
      createdAt: now,
      updatedAt: now
    };

    const tasks = await loadTasks();
    tasks.push(task);
    await saveTasks(tasks);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create task"
      },
      { status: 400 }
    );
  }
}
