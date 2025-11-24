import { NextRequest, NextResponse } from "next/server";
import { loadTasks, saveTasks } from "@/lib/storage";
import { taskSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === params.id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const json = await req.json();
    const parsed = taskSchema.partial().parse(json);

    const tasks = await loadTasks();
    const idx = tasks.findIndex((t) => t.id === params.id);
    if (idx === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updated = {
      ...tasks[idx],
      ...parsed,
      updatedAt: new Date().toISOString()
    };

    tasks[idx] = updated;
    await saveTasks(tasks);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update task"
      },
      { status: 400 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const tasks = await loadTasks();
  const filtered = tasks.filter((task) => task.id !== params.id);
  if (filtered.length === tasks.length) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await saveTasks(filtered);
  return NextResponse.json({ ok: true });
}
