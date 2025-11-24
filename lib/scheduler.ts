import { addDays, addWeeks, isPast } from "date-fns";
import { AutomationTask } from "./types";

export function computeNextRun(task: AutomationTask): string | undefined {
  const current = new Date(task.nextRunAt);
  if (task.cadence === "once") {
    return undefined;
  }

  if (task.cadence === "daily") {
    return addDays(current, 1).toISOString();
  }

  if (task.cadence === "weekly") {
    return addWeeks(current, 1).toISOString();
  }

  return undefined;
}

export function shouldRun(task: AutomationTask, now = new Date()): boolean {
  if (task.status === "running") return false;
  if (!task.nextRunAt) return false;
  const nextRun = new Date(task.nextRunAt);
  return isPast(nextRun) || nextRun <= now;
}
