import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const TaskQueue = () => {
  const tasks = [
    // Example: { id: 1, description: "Create login form", status: "pending" }
  ];

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        📋 Task Queue
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending tasks</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="p-2 rounded bg-secondary">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm flex-1">{task.description}</p>
                <Badge variant="outline" className="text-xs">
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
