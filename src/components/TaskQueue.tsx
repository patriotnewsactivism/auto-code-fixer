import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

interface TaskQueueProps {
  tasks: Task[];
}

export const TaskQueue = ({ tasks }: TaskQueueProps) => {
  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing"
  );

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        📋 Task Queue ({pendingTasks.length})
      </h3>
      {pendingTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending tasks</p>
      ) : (
        <div className="space-y-2">
          {pendingTasks.slice(0, 5).map((task) => (
            <div key={task.id} className="p-2 rounded bg-secondary">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                </div>
                <Badge variant={task.status === "processing" ? "default" : "outline"} className="text-xs">
                  {task.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
