import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Send, Settings, Play, Pause } from "lucide-react";
import { ActiveAgents } from "./ActiveAgents";
import { TaskQueue } from "./TaskQueue";
import { Statistics } from "./Statistics";
import { VoiceControl } from "./VoiceControl";
import { ConfigDialog } from "./ConfigDialog";
import { toast } from "@/hooks/use-toast";

export const Dashboard = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);

  const handleStart = () => {
    setIsRunning(true);
    toast({
      title: "System Started",
      description: "AI agents are now processing tasks",
    });
  };

  const handleStop = () => {
    setIsRunning(false);
    toast({
      title: "System Stopped",
      description: "All agents have been paused",
    });
  };

  const handleSubmitTask = () => {
    if (!taskInput.trim()) return;
    
    toast({
      title: "Task Added",
      description: "Your task has been added to the queue",
    });
    setTaskInput("");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-cyan-400 to-purple-500 bg-clip-text text-transparent">
            🤖 AI Autonomous Agent
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant={isRunning ? "destructive" : "default"}
              size="sm"
              onClick={isRunning ? handleStop : handleStart}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <Pause className="h-4 w-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Config
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 px-4">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-6">
            <ActiveAgents />
            <TaskQueue />
            <Statistics />
            <VoiceControl 
              isActive={voiceActive}
              onToggle={() => setVoiceActive(!voiceActive)}
            />
          </aside>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Welcome Card */}
            <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-4xl">🚀</span>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      AI Autonomous Agent System
                    </h2>
                    <p className="text-muted-foreground">
                      Real Data Operation Mode
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">✨ Features:</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>📱 Mobile-optimized responsive design</li>
                    <li>⚡ Multiple AI providers (Groq, Gemini, Claude, OpenAI)</li>
                    <li>🎤 Voice control with natural conversation</li>
                    <li>💰 Smart cost optimization</li>
                    <li>📊 Real-time statistics and monitoring</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">🎯 Setup Required:</h3>
                  <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Click "Config" to configure your API key</li>
                    <li>Verify your API connection is active</li>
                    <li>Click "Start" to begin processing tasks</li>
                    <li>Submit tasks and receive AI-generated responses</li>
                  </ol>
                </div>
              </div>
            </Card>

            {/* Task Input */}
            <Card className="p-4 bg-card border-border">
              <div className="space-y-4">
                <h3 className="font-semibold">Submit a Task</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setVoiceActive(!voiceActive)}
                    className={voiceActive ? "bg-primary/20" : ""}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSubmitTask()}
                    placeholder="Describe your coding task..."
                    className="flex-1 px-4 py-2 rounded-lg bg-secondary border border-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button onClick={handleSubmitTask} className="gap-2">
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </Card>

            {/* Warning Card */}
            <Card className="p-4 bg-warning/10 border-warning/30">
              <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="space-y-2">
                  <h3 className="font-semibold">Warning: No API Key Configured</h3>
                  <p className="text-sm text-muted-foreground">
                    This platform operates on REAL DATA only. You must configure an API key before you can start.
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold mb-1">Options:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Click "Config" to set up your API key for cloud providers</li>
                      <li>Install and use Ollama for 100% local operation</li>
                    </ol>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <ConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
};
