import Dashboard from "@/components/Dashboard";
import { loadConfig, loadTasks } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [tasks, config] = await Promise.all([loadTasks(), loadConfig()]);

  return (
    <main className="container">
      <Dashboard initialTasks={tasks} initialConfig={config} />
    </main>
  );
}
