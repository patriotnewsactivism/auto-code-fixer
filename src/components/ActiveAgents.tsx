import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  name: string;
  status: string;
  type: string;
}

interface ActiveAgentsProps {
  agents: Agent[];
}

export const ActiveAgents = ({ agents }: ActiveAgentsProps) => {
  const activeAgents = agents.filter((a) => a.status === "active");

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        🤖 Active Agents ({activeAgents.length})
      </h3>
      {activeAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active agents</p>
      ) : (
        <div className="space-y-2">
          {activeAgents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-2 rounded bg-secondary">
              <div>
                <span className="text-sm font-medium">{agent.name}</span>
                <p className="text-xs text-muted-foreground">{agent.type}</p>
              </div>
              <Badge variant="default">{agent.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
