import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const ActiveAgents = () => {
  const agents = [
    // Example: { id: 1, name: "Code Generator", status: "active" }
  ];

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        🤖 Active Agents
      </h3>
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active agents</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-2 rounded bg-secondary">
              <span className="text-sm">{agent.name}</span>
              <Badge variant="default">{agent.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
