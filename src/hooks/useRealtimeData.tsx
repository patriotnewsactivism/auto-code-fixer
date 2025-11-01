import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  current_task_id: string | null;
}

interface ExecutionLog {
  id: string;
  task_id: string;
  agent_id: string;
  log_type: string;
  message: string;
  created_at: string;
}

interface Stats {
  completed: number;
  failed: number;
  running: number;
  estimatedCost: number;
}

export const useRealtimeData = (userId: string | undefined) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    completed: 0,
    failed: 0,
    running: 0,
    estimatedCost: 0,
  });

  useEffect(() => {
    if (!userId) return;

    // Fetch initial data
    const fetchData = async () => {
      const [tasksRes, agentsRes, logsRes, usageRes] = await Promise.all([
        supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("agents").select("*").eq("user_id", userId),
        supabase.from("execution_logs").select("*, tasks!inner(user_id)").eq("tasks.user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("api_usage").select("estimated_cost").eq("user_id", userId),
      ]);

      if (tasksRes.data) setTasks(tasksRes.data);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (logsRes.data) setLogs(logsRes.data);

      // Calculate stats
      if (tasksRes.data) {
        const completed = tasksRes.data.filter((t) => t.status === "completed").length;
        const failed = tasksRes.data.filter((t) => t.status === "failed").length;
        const running = tasksRes.data.filter((t) => t.status === "processing").length;
        const totalCost = usageRes.data?.reduce((sum, u) => sum + Number(u.estimated_cost), 0) || 0;

        setStats({ completed, failed, running, estimatedCost: totalCost });
      }
    };

    fetchData();

    // Set up realtime subscriptions
    const tasksChannel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
          // Recalculate stats
          fetchData();
        }
      )
      .subscribe();

    const agentsChannel = supabase
      .channel("agents-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agents",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAgents((prev) => [...prev, payload.new as Agent]);
          } else if (payload.eventType === "UPDATE") {
            setAgents((prev) =>
              prev.map((a) => (a.id === payload.new.id ? (payload.new as Agent) : a))
            );
          } else if (payload.eventType === "DELETE") {
            setAgents((prev) => prev.filter((a) => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel("logs-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "execution_logs",
        },
        (payload) => {
          setLogs((prev) => [payload.new as ExecutionLog, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [userId]);

  return { tasks, agents, logs, stats };
};
