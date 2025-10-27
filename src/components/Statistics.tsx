import { Card } from "@/components/ui/card";

export const Statistics = () => {
  const stats = {
    completed: 0,
    failed: 0,
    running: 0,
    estimatedCost: 0.00,
  };

  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        📊 Statistics
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">✅ Completed:</span>
          <span className="font-semibold">{stats.completed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">❌ Failed:</span>
          <span className="font-semibold">{stats.failed}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">⚡ Running:</span>
          <span className="font-semibold">{stats.running}</span>
        </div>
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">💰 Estimated Cost:</span>
          <span className="font-semibold">${stats.estimatedCost.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
};
