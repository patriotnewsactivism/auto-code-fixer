import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

interface VoiceControlProps {
  isActive: boolean;
  onToggle: () => void;
}

export const VoiceControl = ({ isActive, onToggle }: VoiceControlProps) => {
  return (
    <Card className="p-4 bg-card border-border">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        🎤 Voice Control
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span className={isActive ? "text-success" : "text-muted-foreground"}>
            {isActive ? "● Voice Ready" : "○ Inactive"}
          </span>
        </div>
        <Button
          variant={isActive ? "destructive" : "default"}
          className="w-full gap-2"
          onClick={onToggle}
        >
          {isActive ? (
            <>
              <MicOff className="h-4 w-4" />
              Stop Voice
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Start Voice
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
